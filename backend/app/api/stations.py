from fastapi import APIRouter, HTTPException
from ..repositories import station_repo, meter_repo, dividend_repo, electricity_repo, rent_repo, cabinet_repo
from collections import defaultdict

router = APIRouter(prefix="/api/stations", tags=["站点管理"])


@router.get("")
async def list_stations(landlordId: int = None, keyword: str = None, page: int = None, pageSize: int = None):
    return station_repo.list_stations(landlord_id=landlordId, keyword=keyword, page=page, page_size=pageSize)


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


@router.get("/{station_id}/meter-view")
async def get_station_meter_view(station_id: int, period: str = None):
    """按电表维度查看站点数据"""
    station = station_repo.get_station(station_id)
    if not station:
        raise HTTPException(404, "站点不存在")

    # 如果未指定月份，默认当月
    if not period:
        from datetime import date
        today = date.today()
        period = today.strftime("%Y-%m")

    # 获取所有电表（排除测试电表）
    meters = [m for m in meter_repo.list_station_meters(station_id) if not str(m.get("meter_no", "")).startswith("TEST")]
    meter_ids = [m["id"] for m in meters]

    # 获取每个电表的柜子
    cabinets_by_meter = {}
    for mid in meter_ids:
        cabinets = cabinet_repo.list_cabinets(meter_id=mid)
        cabinets_by_meter[mid] = cabinets

    # 获取该月电费记录
    elec_record = electricity_repo.get_record_by_station_period(station_id, period)
    meter_details = []
    if elec_record:
        meter_details = electricity_repo.get_meter_details(elec_record["id"])
    meter_detail_map = {d["meter_id"]: d for d in meter_details}

    # 获取上月period
    y, m = int(period[:4]), int(period[5:7])
    prev_m, prev_y = (m - 1, y) if m > 1 else (12, y - 1)
    prev_period = f"{prev_y:04d}-{prev_m:02d}"
    prev_record = electricity_repo.get_record_by_station_period(station_id, prev_period)
    prev_meter_details = []
    if prev_record:
        prev_meter_details = electricity_repo.get_meter_details(prev_record["id"])
    prev_meter_detail_map = {d["meter_id"]: d for d in prev_meter_details}

    # 获取合同价格（场地合同=付款单价，品牌方合同=收款单价）
    from ..repositories import contract_repo
    landlord_id = station.get("landlord_id")
    contracts = contract_repo.list_contracts(station_id=station_id) or []
    if landlord_id:
        landlord_contracts = contract_repo.list_contracts(landlord_id=landlord_id) or []
        contracts = contracts + landlord_contracts
    pay_price = None   # 场地合同电费单价（付款）
    collect_price = None  # 品牌方合同电费单价（收款·税前）
    post_tax_price = None  # 品牌方合同电费单价（收款·税后）
    tax_rate = None
    tax_enabled = False
    for c in contracts:
        if c.get("contract_type") == "场地合同" and c.get("electricity_price"):
            pay_price = float(c["electricity_price"])
        elif c.get("contract_type") == "品牌方合同" and c.get("electricity_price"):
            collect_price = float(c["electricity_price"])
            if c.get("tax_enabled"):
                tax_enabled = True
                tax_rate = float(c["tax_rate"]) if c.get("tax_rate") else None
                post_tax_price = float(c["post_tax_electricity_price"]) if c.get("post_tax_electricity_price") else None
            else:
                # 未启用税率时，含税价=不含税价
                post_tax_price = float(c["electricity_price"])

    # 获取能耗数据（日用电量）
    from ..infra.database import get_connection, get_dict_cursor
    meter_nos = [m.get("meter_no") for m in meters if m.get("meter_no")]
    daily_energy = []
    monthly_energy = []
    if meter_nos:
        conn = get_connection()
        cur = get_dict_cursor(conn)
        try:
            placeholders = ",".join(["%s"] * len(meter_nos))
            # 日用电量 - 该月
            y, m = int(period[:4]), int(period[5:7])
            start_d = f"{y}{m:02d}01"
            if m == 12:
                end_d = f"{y + 1}0101"
            else:
                end_d = f"{y}{m + 1:02d}01"
            cur.execute(f"""
                SELECT address, day_date, kwh
                FROM meter_daily
                WHERE address IN ({placeholders}) AND day_date >= %s AND day_date < %s
                ORDER BY day_date
            """, (*meter_nos, start_d, end_d))
            daily_energy = cur.fetchall()

            # 月用电量 - 最近6个月
            cur.execute(f"""
                SELECT address, month_period, kwh
                FROM meter_monthly
                WHERE address IN ({placeholders})
                ORDER BY month_period DESC
                LIMIT 30
            """, meter_nos)
            monthly_energy = cur.fetchall()
        finally:
            cur.close()
            conn.close()

    # 获取租金合同
    leases = rent_repo.list_leases(station_id=station_id)
    incomes = rent_repo.list_incomes(station_id=station_id)

    # 获取租金收款（筛选覆盖该月的）
    rent_receipts = []
    for inc in incomes:
        receipts = rent_repo.list_receipts(rent_income_id=inc["id"])
        for r in receipts:
            ps = str(r.get("period_start", ""))[:7]
            pe = str(r.get("period_end", ""))[:7]
            if ps <= period <= pe:
                r["income_id"] = inc["id"]
                r["brand_id"] = inc.get("brand_id")
                r["brand_name"] = inc.get("brand_name")
                rent_receipts.append(r)

    # 从contracts获取租金数据
    contract_rent = {
        "cost": [],      # 场地合同（付款）
        "income": [],    # 品牌方合同（收款）
    }
    for c in contracts:
        if c.get("contract_type") == "场地合同":
            contract_rent["cost"].append({
                "id": c.get("id"),
                "partner": c.get("partner") or c.get("landlord_name"),
                "annualRent": float(c["rent_amount"]) if c.get("rent_amount") else None,
                "monthlyRent": float(c["monthly_rent"]) if c.get("monthly_rent") else None,
                "payMethod": c.get("pay_method"),
                "startDate": str(c.get("start_date", ""))[:10] if c.get("start_date") else None,
                "endDate": str(c.get("end_date", ""))[:10] if c.get("end_date") else None,
                "payStatus": c.get("pay_status"),
            })
        elif c.get("contract_type") == "品牌方合同":
            contract_rent["income"].append({
                "id": c.get("id"),
                "brandName": c.get("brand_name"),
                "annualRent": float(c["rent_amount"]) if c.get("rent_amount") else None,
                "monthlyRent": float(c["monthly_rent"]) if c.get("monthly_rent") else None,
                "payMethod": c.get("pay_method"),
                "startDate": str(c.get("start_date", ""))[:10] if c.get("start_date") else None,
                "endDate": str(c.get("end_date", ""))[:10] if c.get("end_date") else None,
                "payStatus": c.get("pay_status"),
            })

    # 按品牌分组电表
    brand_groups = defaultdict(list)
    for meter in meters:
        brand_name = meter.get("brand_name") or "未指定品牌"
        brand_groups[brand_name].append(meter)

    # 构建结果
    result_groups = []
    for brand_name in sorted(brand_groups.keys()):
        group_meters = []
        for meter in brand_groups[brand_name]:
            mid = meter["id"]
            md = meter_detail_map.get(mid)
            prev_md = prev_meter_detail_map.get(mid)
            cab_list = cabinets_by_meter.get(mid, [])
            cabinet_nos = [c.get("cabinet_no", "") for c in cab_list if c.get("cabinet_no")]
            cabinet_count = max(1, len(cab_list))

            # 该电表的能耗数据
            meter_no = meter.get("meter_no")
            meter_daily = [d for d in daily_energy if d.get("address") == meter_no]
            meter_monthly_data = [d for d in monthly_energy if d.get("address") == meter_no]

            # 本月和上月的月度用电量
            month_period = period.replace("-", "")  # e.g. "202607"
            prev_month_period = f"{prev_y:04d}{prev_m:02d}"
            this_month_kwh = None
            prev_month_kwh = None
            for mm in meter_monthly_data:
                if mm.get("month_period") == month_period:
                    this_month_kwh = float(mm["kwh"]) if mm.get("kwh") else None
                if mm.get("month_period") == prev_month_period:
                    prev_month_kwh = float(mm["kwh"]) if mm.get("kwh") else None

            # 找该电表品牌对应的租金收款
            meter_brand_id = meter.get("brand_id")
            meter_receipts = [r for r in rent_receipts if r.get("brand_id") == meter_brand_id]

            # 计算付款/收款金额
            pay_kwh = this_month_kwh
            collect_kwh = this_month_kwh
            pay_amount = round(pay_kwh * pay_price, 2) if pay_kwh and pay_price else None
            collect_amount = round(collect_kwh * collect_price, 2) if collect_kwh and collect_price else None

            group_meters.append({
                "meterId": mid,
                "meterNo": meter.get("meter_no"),
                "meterName": meter.get("meter_name"),
                "brandName": brand_name,
                "cabinetCount": cabinet_count,
                "cabinetNos": ", ".join(cabinet_nos) if cabinet_nos else "-",
                # 上月抄表（来自月度用电量）
                "prevEndReading": prev_month_kwh,
                # 本月抄表（来自月度用电量）
                "startReading": None,
                "endReading": this_month_kwh,
                # 付款（来自合同价格 + 月度用电量）
                "payKwh": pay_kwh,
                "payUnitPrice": pay_price,
                "payAmount": pay_amount,
                "payStatus": elec_record.get("pay_status") if elec_record else "未付款",
                # 收款（来自合同价格 + 月度用电量）
                "collectStartDate": None,
                "collectEndDate": None,
                "collectUnitPrice": collect_price,
                "collectAmount": collect_amount,
                "collectStatus": elec_record.get("collect_status") if elec_record else "未到账",
                # 利润（税后）
                "collectNet": round(collect_kwh * post_tax_price, 2) if collect_kwh and post_tax_price else collect_amount,
                "taxRate": tax_rate,
                "taxEnabled": tax_enabled,
                "postTaxPrice": post_tax_price,
                # 租金
                "rentReceipts": meter_receipts,
                # 能耗
                "dailyEnergy": meter_daily,
                "monthlyEnergy": meter_monthly_data,
            })

        result_groups.append({
            "brandName": brand_name,
            "meters": group_meters,
        })

    # 计算汇总数据
    total_pay_amount = 0      # 总电费成本（付款）
    total_collect_amount = 0  # 总电费收入（收款·含税）
    total_collect_net = 0     # 总电费收入（收款·不含税）
    total_kwh = 0             # 总度数
    total_elec_profit = 0     # 总电费利润
    total_rent_cost = 0       # 总场地成本（场地合同月租金）
    total_rent_income = 0     # 总场地收入（品牌方合同月租金）
    total_rent_profit = 0     # 总场地利润

    for group in result_groups:
        for meter in group.get("meters", []):
            if meter.get("payAmount"):
                total_pay_amount += float(meter["payAmount"])
            if meter.get("collectAmount"):
                total_collect_amount += float(meter["collectAmount"])
            if meter.get("collectNet"):
                total_collect_net += float(meter["collectNet"])
            if meter.get("payKwh"):
                total_kwh += float(meter["payKwh"])

    # 场地成本（场地合同月租金）
    for c in contract_rent.get("cost", []):
        if c.get("monthlyRent"):
            total_rent_cost += float(c["monthlyRent"])

    # 场地收入（品牌方合同月租金）
    for c in contract_rent.get("income", []):
        if c.get("monthlyRent"):
            total_rent_income += float(c["monthlyRent"])

    total_elec_profit = total_collect_net - total_pay_amount
    total_rent_profit = total_rent_income - total_rent_cost

    return {
        "stationId": station_id,
        "stationName": station.get("name"),
        "period": period,
        "brandGroups": result_groups,
        "leases": leases,
        "elecRecord": elec_record,
        "contractRent": contract_rent,
        "summary": {
            "totalKwh": total_kwh,
            "totalPayAmount": total_pay_amount,
            "totalCollectAmount": total_collect_amount,
            "totalCollectNet": total_collect_net,
            "totalElecProfit": total_elec_profit,
            "totalRentCost": total_rent_cost,
            "totalRentIncome": total_rent_income,
            "totalRentProfit": total_rent_profit,
        },
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
