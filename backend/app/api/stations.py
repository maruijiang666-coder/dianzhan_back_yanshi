from fastapi import APIRouter, HTTPException
from ..repositories import station_repo, meter_repo, dividend_repo

router = APIRouter(prefix="/api/stations", tags=["站点管理"])


@router.get("")
async def list_stations(landlordId: int = None, keyword: str = None):
    return station_repo.list_stations(landlord_id=landlordId, keyword=keyword)


@router.get("/{station_id}")
async def get_station(station_id: int):
    station = station_repo.get_station(station_id)
    if not station:
        raise HTTPException(404, "站点不存在")

    # 关联数据
    meters = meter_repo.list_station_meters(station_id)
    shareholder_configs = dividend_repo.list_shareholder_configs(station_id)
    introducer_configs = dividend_repo.list_introducer_configs(station_id)

    return {
        **station,
        "meters": meters,
        "shareholderConfigs": shareholder_configs,
        "introducerConfigs": introducer_configs,
    }


@router.post("", status_code=201)
async def create_station(data: dict):
    return station_repo.create_station(data)


@router.put("/{station_id}")
async def update_station(station_id: int, data: dict):
    result = station_repo.update_station(station_id, data)
    if not result:
        raise HTTPException(404, "站点不存在")
    return result


@router.delete("/{station_id}")
async def delete_station(station_id: int):
    station_repo.delete_station(station_id)
    return {"ok": True}
