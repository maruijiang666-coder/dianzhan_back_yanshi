from fastapi import APIRouter, HTTPException
from ..repositories import contract_repo

router = APIRouter(prefix="/api/contracts", tags=["合同管理"])


@router.get("")
async def list_contracts(brandId: int = None, landlordId: int = None, stationId: int = None, contractType: str = None, keyword: str = None):
    return contract_repo.list_contracts(
        brand_id=brandId, landlord_id=landlordId, station_id=stationId,
        contract_type=contractType, keyword=keyword
    )


@router.post("", status_code=201)
async def create_contract(data: dict):
    return contract_repo.create_contract(data)


@router.put("/{contract_id}")
async def update_contract(contract_id: int, data: dict):
    result = contract_repo.update_contract(contract_id, data)
    if not result:
        raise HTTPException(404, "合同不存在")
    return result


@router.delete("/{contract_id}")
async def delete_contract(contract_id: int):
    contract_repo.delete_contract(contract_id)
    return {"ok": True}
