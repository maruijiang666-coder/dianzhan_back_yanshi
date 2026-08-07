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


@router.post("/generate")
async def generate_electricity(data: dict):
    """从 meter_monthly + contracts 自动生成电费台账"""
    period = data.get("period")
    station_id = data.get("stationId")  # 可选：只生成指定站点
    if not period:
        raise HTTPException(400, "period 必填")

    from ..infra.database import get_connection, get_dict_cursor

    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        # 1. 获取电表及其站点、品牌信息
        if station_id:
            cur.execute("""
                SELECT m.id, m.meter_no, m.station_id, m.brand_id, m.transformer_ratio,
                       s.name as station_name, b.name as brand_name
                FROM meters m
                LEFT JOIN stations s ON m.station_id = s.id
                LEFT JOIN brands b ON m.brand_id = b.id
                WHERE m.station_id = %s
            """, (station_id,))
        else:
            cur.execute("""
                SELECT m.id, m.meter_no, m.station_id, m.brand_id, m.transformer_ratio,
                       s.name as station_name, b.name as brand_name
                FROM meters m
                LEFT JOIN stations s ON m.station_id = s.id
                LEFT JOIN brands b ON m.brand_id = b.id
                WHERE m.station_id IS NOT NULL
            """)
        meters = cur.fetchall()

        # 2. 获取该月电表读数（只查相关电表）
        meter_nos = [m["meter_no"] for m in meters if m.get("meter_no")]
        if meter_nos:
            placeholders = ",".join(["%s"] * len(meter_nos))
            cur.execute(f"SELECT address, kwh FROM meter_monthly WHERE month_period = %s AND address IN ({placeholders})", (period, *meter_nos))
        else:
            cur.execute("SELECT address, kwh FROM meter_monthly WHERE month_period = %s AND 1=0", (period,))
        readings = {r["address"]: float(r["kwh"]) for r in cur.fetchall()}

        # 3. 获取相关合同（只查相关 landlord）
        from collections import defaultdict

        # 获取站点 → landlord 映射
        if station_id:
            cur.execute("SELECT id, name, landlord_id FROM stations WHERE id = %s", (station_id,))
        else:
            cur.execute("SELECT id, name, landlord_id FROM stations")
        station_info = {r["id"]: r for r in cur.fetchall()}

        landlord_ids = list(set(r["landlord_id"] for r in station_info.values() if r.get("landlord_id")))
        if landlord_ids:
            placeholders = ",".join(["%s"] * len(landlord_ids))
            cur.execute(f"""
                SELECT c.*, l.name as landlord_name
                FROM contracts c
                LEFT JOIN landlords l ON c.landlord_id = l.id
                WHERE c.landlord_id IN ({placeholders})
            """, landlord_ids)
        else:
            cur.execute("""
                SELECT c.*, l.name as landlord_name
                FROM contracts c
                LEFT JOIN landlords l ON c.landlord_id = l.id
                WHERE 1=0
            """)
        all_contracts = cur.fetchall()

        landlord_contracts_map = defaultdict(list)
        for c in all_contracts:
            if c.get("landlord_id"):
                landlord_contracts_map[c["landlord_id"]].append(c)

        # 4. 按站点分组电表
        station_meters = defaultdict(list)
        for m in meters:
            station_meters[m["station_id"]].append(m)

        # 预加载已有电费记录（用同一个连接）
        if station_id:
            cur.execute("SELECT * FROM electricity_records WHERE period = %s AND station_id = %s", (period, station_id))
        else:
            cur.execute("SELECT * FROM electricity_records WHERE period = %s", (period,))
        existing_map = {r["station_id"]: r for r in cur.fetchall()}

        created = []
        updated = []

        for sid, station_meter_list in station_meters.items():
            existing = existing_map.get(sid)

            # 通过 station → landlord_id → contracts 匹配
            st_info = station_info.get(sid, {})
            lid = st_info.get("landlord_id")
            contracts = landlord_contracts_map.get(lid, []) if lid else []
            # 区分场地合同（成本）和品牌方合同（收入）
            landlord_contracts = [c for c in contracts if "场地" in (c.get("contract_type") or "")]
            brand_contracts = [c for c in contracts if "品牌" in (c.get("contract_type") or "")]

            landlord_price = landlord_contracts[0]["electricity_price"] if landlord_contracts and landlord_contracts[0].get("electricity_price") else None
            brand_price = brand_contracts[0]["electricity_price"] if brand_contracts and brand_contracts[0].get("electricity_price") else None
            landlord_rent = sum(float(c.get("monthly_rent") or 0) for c in landlord_contracts)
            brand_rent = sum(float(c.get("monthly_rent") or 0) for c in brand_contracts)
            tax_rate = float(brand_contracts[0].get("tax_rate") or 0.01) if brand_contracts else 0.01

            # 计算度数（按电表分别匹配）
            total_pay_kwh = 0
            total_collect_kwh = 0
            meter_details = []
            for m in station_meter_list:
                kwh = readings.get(m["meter_no"], 0)
                ratio = float(m.get("transformer_ratio") or 1)
                actual_kwh = round(kwh * ratio, 2)

                total_pay_kwh += actual_kwh
                total_collect_kwh += actual_kwh

                pay_amount = round(actual_kwh * float(landlord_price or 0), 2) if landlord_price else 0
                collect_amount = round(actual_kwh * float(brand_price or 0), 2) if brand_price else 0
                collect_net = round(collect_amount / (1 + tax_rate), 2) if tax_rate else collect_amount

                meter_details.append({
                    "meterId": m["id"],
                    "meterNo": m["meter_no"],
                    "brandName": m.get("brand_name"),
                    "kwh": actual_kwh,
                    "payUnitPrice": float(landlord_price or 0),
                    "payAmount": pay_amount,
                    "collectUnitPrice": float(brand_price or 0),
                    "collectAmount": collect_amount,
                    "collectNet": collect_net,
                })

            total_pay_amount = sum(d["payAmount"] for d in meter_details)
            total_collect_amount = sum(d["collectAmount"] for d in meter_details)
            total_collect_net = sum(d["collectNet"] for d in meter_details)

            # 加上租金
            total_pay_amount = round(total_pay_amount + landlord_rent, 2)
            total_collect_amount = round(total_collect_amount + brand_rent, 2)
            total_collect_net = round(total_collect_net + brand_rent, 2)

            profit = round(total_collect_net - total_pay_amount, 2)

            if existing:
                # 更新已有记录（用同一个连接）
                cur.execute("""
                    UPDATE electricity_records SET
                        pay_kwh=%s, pay_unit_price=%s, pay_amount=%s,
                        collect_kwh=%s, collect_unit_price=%s, collect_amount=%s,
                        tax_rate=%s, collect_net=%s, profit=%s, updated_at=NOW()
                    WHERE id=%s
                """, (
                    round(total_pay_kwh, 2), float(landlord_price or 0), total_pay_amount,
                    round(total_collect_kwh, 2), float(brand_price or 0), total_collect_amount,
                    tax_rate, total_collect_net, profit, existing["id"]
                ))
                # 删除旧明细，插入新明细
                cur.execute("DELETE FROM electricity_meter_details WHERE electricity_id = %s", (existing["id"],))
                for d in meter_details:
                    cur.execute("""
                        INSERT INTO electricity_meter_details
                        (electricity_id, meter_id, start_reading, end_reading, kwh,
                         pay_unit_price, pay_amount, collect_unit_price, collect_amount, collect_net)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        existing["id"], d["meterId"], None, None, d["kwh"],
                        d["payUnitPrice"], d["payAmount"],
                        d["collectUnitPrice"], d["collectAmount"], d["collectNet"]
                    ))
                updated.append(sid)
            else:
                # 新增记录（用同一个连接）
                cur.execute("""
                    INSERT INTO electricity_records
                    (station_id, period, pay_kwh, pay_unit_price, pay_amount, pay_status,
                     collect_kwh, collect_unit_price, collect_amount, tax_rate, collect_net, collect_status, profit)
                    VALUES (%s, %s, %s, %s, %s, '未付款', %s, %s, %s, %s, %s, '未到账', %s)
                    RETURNING id
                """, (
                    sid, period, round(total_pay_kwh, 2), float(landlord_price or 0), total_pay_amount,
                    round(total_collect_kwh, 2), float(brand_price or 0), total_collect_amount,
                    tax_rate, total_collect_net, profit
                ))
                record_id = cur.fetchone()["id"]
                for d in meter_details:
                    cur.execute("""
                        INSERT INTO electricity_meter_details
                        (electricity_id, meter_id, start_reading, end_reading, kwh,
                         pay_unit_price, pay_amount, collect_unit_price, collect_amount, collect_net)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        record_id, d["meterId"], None, None, d["kwh"],
                        d["payUnitPrice"], d["payAmount"],
                        d["collectUnitPrice"], d["collectAmount"], d["collectNet"]
                    ))
                created.append(record_id)

        conn.commit()

        return {
            "created": len(created),
            "updated": len(updated),
            "period": period,
            "detail": f"新增 {len(created)} 条，更新 {len(updated)} 条"
        }
    finally:
        cur.close()
        conn.close()
