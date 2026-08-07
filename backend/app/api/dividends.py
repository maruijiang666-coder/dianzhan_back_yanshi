from fastapi import APIRouter, HTTPException
from ..repositories import dividend_repo, approval_repo
from ..domain.dividend_calc import dividend_calculator

router = APIRouter(prefix="/api/dividends", tags=["分红管理"])


# ─── 分红配置 ───────────────────────────────────────────────

@router.get("/configs/shareholder")
async def list_shareholder_configs(stationId: int = None):
    return dividend_repo.list_shareholder_configs(station_id=stationId)


@router.post("/configs/shareholder", status_code=201)
async def save_shareholder_config(data: dict):
    return dividend_repo.save_shareholder_config(data)


@router.delete("/configs/shareholder/{config_id}")
async def delete_shareholder_config(config_id: int):
    dividend_repo.delete_shareholder_config(config_id)
    return {"ok": True}


@router.get("/configs/introducer")
async def list_introducer_configs(stationId: int = None):
    return dividend_repo.list_introducer_configs(station_id=stationId)


@router.post("/configs/introducer", status_code=201)
async def save_introducer_config(data: dict):
    return dividend_repo.save_introducer_config(data)


@router.delete("/configs/introducer/{config_id}")
async def delete_introducer_config(config_id: int):
    dividend_repo.delete_introducer_config(config_id)
    return {"ok": True}


# ─── 分红计算 ───────────────────────────────────────────────

@router.post("/calculate")
async def calculate_dividend(data: dict):
    """计算分红（预览，不入库）"""
    station_id = data.get("stationId")
    period = data.get("period")
    if not station_id or not period:
        raise HTTPException(400, "stationId 和 period 必填")

    result = dividend_calculator.calculate(station_id, period)
    if not result:
        raise HTTPException(404, "站点不存在")
    return result


# ─── 分红记录 ───────────────────────────────────────────────

@router.get("")
async def list_dividends(stationId: int = None, period: str = None, type: str = None, status: str = None):
    records = dividend_repo.list_records(station_id=stationId, period=period, type_=type, status=status)
    result = []
    for r in records:
        shares = dividend_repo.get_shares(r["id"])
        result.append({**r, "shares": shares})
    return result


@router.get("/{record_id}")
async def get_dividend(record_id: int):
    record = dividend_repo.get_record(record_id)
    if not record:
        raise HTTPException(404, "分红记录不存在")
    shares = dividend_repo.get_shares(record_id)

    # 获取数据来源明细
    from ..repositories import electricity_repo, rent_repo
    elec = electricity_repo.get_record_by_station_period(record["station_id"], record["period"])
    elec_details = electricity_repo.get_meter_details(elec["id"]) if elec else []
    leases = rent_repo.list_leases(station_id=record["station_id"])
    incomes = rent_repo.list_incomes(station_id=record["station_id"])
    expense = rent_repo.get_expense(record["station_id"], record["period"])

    return {
        **record,
        "shares": shares,
        "dataSources": {
            "electricity": elec_details,
            "rent": {
                "leases": leases,
                "incomes": incomes,
            },
            "operatingExpense": expense,
        },
    }


@router.post("", status_code=201)
async def create_dividend(data: dict):
    """创建分红记录"""
    station_id = data.get("stationId")
    period = data.get("period")

    if not station_id or not period:
        raise HTTPException(400, "stationId 和 period 必填")

    # 计算分红
    calc = dividend_calculator.calculate(station_id, period)
    if not calc:
        raise HTTPException(404, "站点不存在")

    # 创建记录
    record = dividend_repo.create_record({
        "stationId": station_id,
        "period": period,
        "type": data.get("type", "股东分红"),
        "elecIncome": calc["income"]["elecIncome"]["total"],
        "rentIncome": calc["income"]["rentIncome"]["total"],
        "totalIncome": calc["income"]["totalIncome"],
        "elecCost": calc["cost"]["elecCost"],
        "rentCost": calc["cost"]["rentCost"],
        "opExpense": calc["cost"]["opExpense"],
        "bizDividendCost": calc["cost"]["bizDividendCost"],
        "totalCost": calc["cost"]["totalCost"],
        "profit": calc["profit"],
        "status": "未结算",
        "settlementDate": calc.get("settlementDate"),
        "remark": data.get("remark"),
    })

    # 创建分红明细
    dividend_type = data.get("type", "股东分红")
    if dividend_type == "商务分红":
        for d in calc["bizDividends"]:
            dividend_repo.create_share(record["id"], {
                "introducerId": d["introducerId"],
                "brandId": d.get("brandId"),
                "mode": d["mode"],
                "ratio": d.get("ratio"),
                "fixedAmount": d.get("fixedAmount"),
                "amount": d["amount"],
            })
    else:
        for d in calc["shareholderDividends"]:
            dividend_repo.create_share(record["id"], {
                "shareholderId": d["shareholderId"],
                "brandId": d.get("brandId"),
                "mode": d["mode"],
                "ratio": d.get("ratio"),
                "fixedAmount": d.get("fixedAmount"),
                "amount": d["amount"],
            })

    return record


@router.post("/{record_id}/submit")
async def submit_dividend(record_id: int, data: dict):
    """提交分红审批"""
    record = dividend_repo.get_record(record_id)
    if not record:
        raise HTTPException(404, "分红记录不存在")
    if record["status"] != "未结算":
        raise HTTPException(400, f"当前状态 {record['status']} 不允许提交")

    # 创建审批单
    approval = approval_repo.create_request({
        "bizType": "股东分红",
        "title": f"{record.get('station_name', '')} {record['period']} 分红",
        "reason": data.get("reason"),
        "amount": record.get("profit"),
        "applicant": data.get("applicant", "系统"),
    })

    # 更新分红状态
    dividend_repo.update_status(record_id, "申报中")

    return {"ok": True, "approvalRequestId": approval["id"]}


@router.post("/{record_id}/approve")
async def approve_dividend(record_id: int, data: dict):
    """审批通过"""
    record = dividend_repo.get_record(record_id)
    if not record:
        raise HTTPException(404, "分红记录不存在")

    dividend_repo.update_status(record_id, "已通过")
    return {"ok": True}


@router.post("/{record_id}/reject")
async def reject_dividend(record_id: int, data: dict):
    """审批驳回"""
    record = dividend_repo.get_record(record_id)
    if not record:
        raise HTTPException(404, "分红记录不存在")

    dividend_repo.update_status(record_id, "已驳回")
    return {"ok": True}


@router.post("/{record_id}/settle")
async def settle_dividend(record_id: int, data: dict):
    """标记已结算"""
    record = dividend_repo.get_record(record_id)
    if not record:
        raise HTTPException(404, "分红记录不存在")

    dividend_repo.update_status(record_id, "已结算")
    return {"ok": True}


@router.delete("/{record_id}")
async def delete_dividend(record_id: int):
    dividend_repo.delete_record(record_id)
    return {"ok": True}


# ─── 分红汇总 ───────────────────────────────────────────────

@router.get("/summary/shareholder")
async def shareholder_summary(shareholderId: int = None, period: str = None):
    rows = dividend_repo.get_shareholder_summary(shareholder_id=shareholderId, period=period)
    # 按股东聚合
    holders = {}
    for r in rows:
        hid = r["shareholder_id"]
        if hid not in holders:
            holders[hid] = {
                "shareholderId": hid,
                "shareholderName": r["shareholder_name"],
                "totalAmount": 0,
                "settledAmount": 0,
                "pendingAmount": 0,
                "details": [],
            }
        h = holders[hid]
        amount = float(r.get("amount") or 0)
        h["totalAmount"] += amount
        if r.get("status") == "已结算":
            h["settledAmount"] += amount
        else:
            h["pendingAmount"] += amount
        h["details"].append(r)
    return list(holders.values())


@router.get("/summary/introducer")
async def introducer_summary(introducerId: int = None, period: str = None):
    rows = dividend_repo.get_introducer_summary(introducer_id=introducerId, period=period)
    intros = {}
    for r in rows:
        iid = r["introducer_id"]
        if iid not in intros:
            intros[iid] = {
                "introducerId": iid,
                "introducerName": r["introducer_name"],
                "totalAmount": 0,
                "settledAmount": 0,
                "pendingAmount": 0,
                "details": [],
            }
        h = intros[iid]
        amount = float(r.get("amount") or 0)
        h["totalAmount"] += amount
        if r.get("status") == "已结算":
            h["settledAmount"] += amount
        else:
            h["pendingAmount"] += amount
        h["details"].append(r)
    return list(intros.values())
