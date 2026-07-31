from fastapi import APIRouter, HTTPException
from ..repositories import electricity_repo, meter_repo
from ..domain.electricity_calc import calc_electricity

router = APIRouter(prefix="/api/electricity", tags=["电费台账"])


@router.get("")
async def list_electricity(stationId: int = None, period: str = None):
    records = electricity_repo.list_records(station_id=stationId, period=period)
    result = []
    for r in records:
        details = electricity_repo.get_meter_details(r["id"])
        result.append({**r, "meterDetails": details})
    return result


@router.get("/periods")
async def list_periods():
    return electricity_repo.list_periods()


@router.get("/{record_id}")
async def get_electricity(record_id: int):
    record = electricity_repo.get_record(record_id)
    if not record:
        raise HTTPException(404, "电费记录不存在")
    details = electricity_repo.get_meter_details(record_id)
    return {**record, "meterDetails": details}


@router.post("", status_code=201)
async def create_electricity(data: dict):
    station_id = data.get("stationId")
    period = data.get("period")

    if not station_id or not period:
        raise HTTPException(400, "stationId 和 period 必填")

    # 检查是否已存在
    existing = electricity_repo.get_record_by_station_period(station_id, period)
    if existing:
        raise HTTPException(400, f"站点 {station_id} 的 {period} 电费记录已存在")

    # 从电表读数计算
    meter_details = data.get("meterDetails", [])
    pay_price = float(data.get("payUnitPrice", 0))
    collect_price = float(data.get("collectUnitPrice", 0))
    tax_rate = float(data.get("taxRate", 0.01))

    calc = calc_electricity(meter_details, pay_price, collect_price, tax_rate)

    # 创建记录
    record = electricity_repo.create_record({
        "stationId": station_id,
        "period": period,
        "payStartDate": data.get("payStartDate"),
        "payStartReading": sum(d.get("startReading", 0) for d in meter_details),
        "payEndDate": data.get("payEndDate"),
        "payEndReading": sum(d.get("endReading", 0) for d in meter_details),
        "payKwh": calc["payKwh"],
        "payUnitPrice": pay_price,
        "payAmount": calc["payAmount"],
        "payStatus": data.get("payStatus", "未付款"),
        "collectStartDate": data.get("collectStartDate"),
        "collectStartReading": sum(d.get("startReading", 0) for d in meter_details),
        "collectEndDate": data.get("collectEndDate"),
        "collectEndReading": sum(d.get("endReading", 0) for d in meter_details),
        "collectKwh": calc["collectKwh"],
        "collectUnitPrice": collect_price,
        "collectAmount": calc["collectAmount"],
        "taxRate": tax_rate,
        "collectNet": calc["collectNet"],
        "collectStatus": data.get("collectStatus", "未到账"),
        "profit": calc["profit"],
        "remark": data.get("remark"),
    })

    # 保存电表明细
    for d in calc["details"]:
        electricity_repo.create_meter_detail(record["id"], d["meterId"], d)

    return record


@router.put("/{record_id}")
async def update_electricity(record_id: int, data: dict):
    record = electricity_repo.get_record(record_id)
    if not record:
        raise HTTPException(404, "电费记录不存在")

    # 如果有新的电表读数，重新计算
    if "meterDetails" in data and data["meterDetails"]:
        meter_details = data["meterDetails"]
        pay_price = float(data.get("payUnitPrice", record.get("pay_unit_price", 0)))
        collect_price = float(data.get("collectUnitPrice", record.get("collect_unit_price", 0)))
        tax_rate = float(data.get("taxRate", record.get("tax_rate", 0.01)))

        calc = calc_electricity(meter_details, pay_price, collect_price, tax_rate)

        data["payKwh"] = calc["payKwh"]
        data["payAmount"] = calc["payAmount"]
        data["collectKwh"] = calc["collectKwh"]
        data["collectAmount"] = calc["collectAmount"]
        data["collectNet"] = calc["collectNet"]
        data["profit"] = calc["profit"]

        # 更新电表明细
        electricity_repo.delete_meter_details(record_id)
        for d in calc["details"]:
            electricity_repo.create_meter_detail(record_id, d["meterId"], d)

    result = electricity_repo.update_record(record_id, data)
    if not result:
        raise HTTPException(400, "无更新内容")
    return result


@router.delete("/{record_id}")
async def delete_electricity(record_id: int):
    electricity_repo.delete_record(record_id)
    return {"ok": True}
