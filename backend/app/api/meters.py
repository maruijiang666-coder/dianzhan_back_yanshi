from fastapi import APIRouter, HTTPException
from ..repositories import meter_repo
from ..infra.meter_api import tq_client

router = APIRouter(prefix="/api/meters", tags=["电表管理"])


@router.get("")
async def list_meters(stationId: int = None, brandId: int = None, landlordId: int = None):
    return meter_repo.list_meters(station_id=stationId, brand_id=brandId, landlord_id=landlordId)


@router.get("/{meter_id}")
async def get_meter(meter_id: int):
    meter = meter_repo.get_meter(meter_id)
    if not meter:
        raise HTTPException(404, "电表不存在")

    # 获取第三方数据（从缓存读取）
    from ..infra.database import get_connection, get_dict_cursor
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        # 实时状态
        cur.execute(
            "SELECT * FROM meter_status_cache WHERE address = %s ORDER BY synced_at DESC LIMIT 1",
            (meter["meter_no"],)
        )
        status = cur.fetchone()

        # 月度用电量
        cur.execute(
            "SELECT * FROM meter_monthly WHERE address = %s ORDER BY month_period DESC LIMIT 12",
            (meter["meter_no"],)
        )
        monthly = cur.fetchall()
    finally:
        cur.close()
        conn.close()

    realtime = None
    if status:
        realtime = {
            "totalKwh": float(status.get("c0") or 0),
            "peakKwh": float(status.get("c1") or 0),
            "sharpKwh": float(status.get("c2") or 0),
            "flatKwh": float(status.get("c3") or 0),
            "valleyKwh": float(status.get("c4") or 0),
            "remainingAmount": float(status.get("remain_money") or 0),
            "syncedAt": str(status.get("synced_at") or ""),
        }

    usage = {
        "monthly": [{
            "period": m.get("month_period"),
            "kwh": float(m.get("kwh") or 0),
        } for m in monthly],
    }

    return {**meter, "realtime": realtime, "usage": usage}


@router.post("", status_code=201)
async def create_meter(data: dict):
    return meter_repo.create_meter(data)


@router.put("/{meter_id}")
async def update_meter(meter_id: int, data: dict):
    result = meter_repo.update_meter(meter_id, data)
    if not result:
        raise HTTPException(404, "电表不存在")
    return result


@router.delete("/{meter_id}")
async def delete_meter(meter_id: int):
    meter_repo.delete_meter(meter_id)
    return {"ok": True}
