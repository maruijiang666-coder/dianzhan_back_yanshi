from fastapi import APIRouter, HTTPException
from ..repositories import rent_repo

router = APIRouter(prefix="/api/rent", tags=["场地租金"])


# ─── 场租付款合同 ───────────────────────────────────────────

@router.get("/leases")
async def list_leases(stationId: int = None):
    return rent_repo.list_leases(station_id=stationId)


@router.post("/leases", status_code=201)
async def create_lease(data: dict):
    return rent_repo.create_lease(data)


@router.put("/leases/{lease_id}")
async def update_lease(lease_id: int, data: dict):
    result = rent_repo.update_lease(lease_id, data)
    if not result:
        raise HTTPException(404, "合同不存在")
    return result


@router.delete("/leases/{lease_id}")
async def delete_lease(lease_id: int):
    rent_repo.delete_lease(lease_id)
    return {"ok": True}


# ─── 场租收款合同 ───────────────────────────────────────────

@router.get("/incomes")
async def list_incomes(stationId: int = None, brandId: int = None):
    incomes = rent_repo.list_incomes(station_id=stationId, brand_id=brandId)
    result = []
    for i in incomes:
        receipts = rent_repo.list_receipts(rent_income_id=i["id"])
        result.append({**i, "receipts": receipts})
    return result


@router.post("/incomes", status_code=201)
async def create_income(data: dict):
    return rent_repo.create_income(data)


@router.put("/incomes/{income_id}")
async def update_income(income_id: int, data: dict):
    result = rent_repo.update_income(income_id, data)
    if not result:
        raise HTTPException(404, "合同不存在")
    return result


@router.delete("/incomes/{income_id}")
async def delete_income(income_id: int):
    rent_repo.delete_income(income_id)
    return {"ok": True}


# ─── 租金分期收款 ───────────────────────────────────────────

@router.get("/receipts")
async def list_receipts(rentIncomeId: int = None):
    return rent_repo.list_receipts(rent_income_id=rentIncomeId)


@router.post("/receipts", status_code=201)
async def create_receipt(data: dict):
    return rent_repo.create_receipt(data)


@router.put("/receipts/{receipt_id}")
async def update_receipt(receipt_id: int, data: dict):
    result = rent_repo.update_receipt(receipt_id, data)
    if not result:
        raise HTTPException(404, "收款记录不存在")
    return result


@router.delete("/receipts/{receipt_id}")
async def delete_receipt(receipt_id: int):
    rent_repo.delete_receipt(receipt_id)
    return {"ok": True}


# ─── 运营费用 ───────────────────────────────────────────────

@router.get("/expenses")
async def list_expenses(stationId: int = None, period: str = None):
    return rent_repo.list_expenses(station_id=stationId, period=period)


@router.post("/expenses", status_code=201)
async def save_expense(data: dict):
    return rent_repo.save_expense(
        station_id=data.get("stationId"),
        period=data.get("period"),
        amount=data.get("amount"),
        remark=data.get("remark"),
    )


@router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: int):
    rent_repo.delete_expense(expense_id)
    return {"ok": True}
