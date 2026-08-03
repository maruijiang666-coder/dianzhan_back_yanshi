from fastapi import APIRouter
from ..infra.database import get_connection, get_dict_cursor
from datetime import date

router = APIRouter(prefix="/api/overview", tags=["看板"])


@router.get("")
async def overview():
    """经营总览"""
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        # 站点统计
        cur.execute("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = '运营中') as active FROM stations")
        station_stats = cur.fetchone()

        # 电表数量
        cur.execute("SELECT COUNT(*) as total FROM meters")
        meter_count = cur.fetchone()["total"]

        # 品牌方、公司主体、场地方、股东、介绍人数量
        counts = {}
        for table in ["brands", "entities", "landlords", "shareholders", "introducers"]:
            cur.execute(f"SELECT COUNT(*) as total FROM {table}")
            counts[table] = cur.fetchone()["total"]

        # 电费统计
        cur.execute("""
            SELECT
                COALESCE(SUM(pay_amount), 0) as total_pay,
                COALESCE(SUM(collect_net), 0) as total_collect,
                COALESCE(SUM(profit), 0) as total_profit,
                COALESCE(SUM(CASE WHEN pay_status = '未付款' THEN pay_amount ELSE 0 END), 0) as unpaid,
                COALESCE(SUM(CASE WHEN collect_status = '未到账' THEN collect_net ELSE 0 END), 0) as uncollected
            FROM electricity_records
        """)
        elec = cur.fetchone()

        # 租金统计
        cur.execute("SELECT COALESCE(SUM(annual_rent), 0) as total FROM rent_leases")
        rent_cost = cur.fetchone()["total"]

        cur.execute("SELECT COALESCE(SUM(monthly_rent), 0) as total FROM rent_incomes")
        rent_income = cur.fetchone()["total"]

        cur.execute("""
            SELECT COALESCE(SUM(CASE WHEN status = '未到账' THEN amount ELSE 0 END), 0) as uncollected
            FROM rent_receipts
        """)
        rent_uncollected = cur.fetchone()["uncollected"]

        # 运营费用
        cur.execute("SELECT COALESCE(SUM(amount), 0) as total FROM operating_expenses")
        op_total = cur.fetchone()["total"]

        # 分红统计
        cur.execute("""
            SELECT
                COUNT(*) FILTER (WHERE status = '未结算') as pending,
                COALESCE(SUM(CASE WHEN type = '商务分红' THEN profit ELSE 0 END), 0) as biz_total,
                COALESCE(SUM(CASE WHEN type = '股东分红' THEN profit ELSE 0 END), 0) as shareholder_total
            FROM dividend_records
        """)
        div_stats = cur.fetchone()

        # 合同统计
        today = date.today()
        cur.execute("SELECT COUNT(*) as total FROM contracts")
        contract_total = cur.fetchone()["total"]
        cur.execute("SELECT COUNT(*) as total FROM contracts WHERE end_date IS NOT NULL AND end_date < %s", (today,))
        expired = cur.fetchone()["total"]
        cur.execute("SELECT COUNT(*) as total FROM contracts WHERE end_date IS NOT NULL AND end_date >= %s AND end_date <= %s + INTERVAL '90 days'", (today, today))
        expiring = cur.fetchone()["total"]

        # 审批统计
        cur.execute("SELECT COUNT(*) as total FROM approval_requests WHERE status = '审批中'")
        pending_approvals = cur.fetchone()["total"]

        # 月度趋势
        cur.execute("""
            SELECT period,
                   COALESCE(SUM(pay_amount), 0) as pay,
                   COALESCE(SUM(collect_net), 0) as collect,
                   COALESCE(SUM(profit), 0) as profit
            FROM electricity_records
            GROUP BY period
            ORDER BY period DESC
            LIMIT 12
        """)
        monthly = cur.fetchall()

        return {
            "stationCount": station_stats["total"],
            "activeStations": station_stats["active"],
            "meterCount": meter_count,
            "brandCount": counts["brands"],
            "entityCount": counts["entities"],
            "landlordCount": counts["landlords"],
            "shareholderCount": counts["shareholders"],
            "introducerCount": counts["introducers"],
            "elecPay": float(elec["total_pay"]),
            "elecCollect": float(elec["total_collect"]),
            "elecProfit": float(elec["total_profit"]),
            "elecUnpaid": float(elec["unpaid"]),
            "elecUncollected": float(elec["uncollected"]),
            "rentCostTotal": float(rent_cost) / 12,
            "rentIncomeTotal": float(rent_income),
            "rentUncollected": float(rent_uncollected),
            "opExpenseTotal": float(op_total),
            "pendingDividends": div_stats["pending"],
            "bizDividendTotal": float(div_stats["biz_total"]),
            "shareholderDividendTotal": float(div_stats["shareholder_total"]),
            "contractCount": contract_total,
            "expiringContracts": expiring,
            "expiredContracts": expired,
            "pendingApprovals": pending_approvals,
            "monthly": [{
                "period": r["period"],
                "elecPay": float(r["pay"]),
                "elecCollect": float(r["collect"]),
                "elecProfit": float(r["profit"]),
            } for r in monthly],
        }
    finally:
        cur.close()
        conn.close()


@router.get("/station-board")
async def station_board(landlordId: int = None, keyword: str = None, period: str = None):
    """站点看板（按场地方分组）"""
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        # 获取所有场地方
        conditions = []
        values = []
        if landlordId:
            conditions.append("l.id = %s")
            values.append(landlordId)
        if keyword:
            conditions.append("l.name ILIKE %s")
            values.append(f"%{keyword}%")
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        cur.execute(f"""
            SELECT l.id, l.name, l.contact, l.phone
            FROM landlords l
            {where}
            ORDER BY l.id
        """, values)
        landlords = cur.fetchall()

        result = []
        for landlord in landlords:
            lid = landlord["id"]

            # 获取该场地方下的所有电表
            cur.execute("""
                SELECT m.id, m.meter_no, m.meter_name, m.brand_id, b.name as brand_name,
                       m.transformer_ratio, m.status
                FROM meters m
                LEFT JOIN brands b ON m.brand_id = b.id
                WHERE m.landlord_id = %s
                ORDER BY m.id
            """, (lid,))
            meters = cur.fetchall()

            # 获取该场地方关联的站点
            cur.execute("""
                SELECT id, name, company_share, status
                FROM stations
                WHERE landlord_id = %s
                ORDER BY id
            """, (lid,))
            stations = cur.fetchall()

            # 获取该场地方的合同
            cur.execute("""
                SELECT id, contract_type, electricity_price, monthly_rent, cabinets_count, partner, brand_id
                FROM contracts
                WHERE landlord_id = %s
            """, (lid,))
            contracts = cur.fetchall()

            # 获取品牌名称
            brand_ids = [c["brand_id"] for c in contracts if c.get("brand_id")]
            brand_names = {}
            if brand_ids:
                placeholders = ",".join(["%s"] * len(brand_ids))
                cur.execute(f"SELECT id, name FROM brands WHERE id IN ({placeholders})", brand_ids)
                for b in cur.fetchall():
                    brand_names[b["id"]] = b["name"]

            # 从合同计算场地成本和电费成本
            rent_cost = 0       # 场地合同月租金
            elec_pay_price = 0  # 场地合同电费单价
            for c in contracts:
                if c["contract_type"] == "场地合同":
                    if c["monthly_rent"]:
                        rent_cost += float(c["monthly_rent"])
                    if c["electricity_price"]:
                        elec_pay_price = float(c["electricity_price"])

            # 从电表月度数据计算总度数（按站点拆分）
            meter_nos = [m["meter_no"] for m in meters if m.get("meter_no")]
            total_kwh = 0
            station_breakdown = []  # 按站点拆分的数据
            if meter_nos and period:
                month_period = period.replace("-", "")
                placeholders = ",".join(["%s"] * len(meter_nos))
                cur.execute(f"""
                    SELECT m.station_id, s.name as station_name,
                           COALESCE(SUM(mm.kwh), 0) as kwh,
                           COUNT(mm.id) as meter_count
                    FROM meter_monthly mm
                    JOIN meters m ON m.meter_no = mm.address
                    LEFT JOIN stations s ON s.id = m.station_id
                    WHERE mm.address IN ({placeholders}) AND mm.month_period = %s
                    GROUP BY m.station_id, s.name
                    ORDER BY kwh DESC
                """, (*meter_nos, month_period))
                station_breakdown = cur.fetchall()
                total_kwh = sum(float(r["kwh"] or 0) for r in station_breakdown)

            # 电费成本 = 度数 × 场地合同电费单价
            elec_pay = total_kwh * elec_pay_price if elec_pay_price else 0

            # 电费收入（从品牌方合同计算）
            elec_collect_price = 0
            for c in contracts:
                if c["contract_type"] == "品牌方合同" and c["electricity_price"]:
                    elec_collect_price = float(c["electricity_price"])
                    break  # 取第一个品牌方合同的单价
            elec_collect = total_kwh * elec_collect_price if elec_collect_price else 0
            elec_profit = elec_collect - elec_pay

            # 场地收入（品牌方合同月租金）
            rent_income = 0
            for c in contracts:
                if c["contract_type"] == "品牌方合同" and c["monthly_rent"]:
                    rent_income += float(c["monthly_rent"])

            rent_profit = rent_income - rent_cost

            # 运营费用（按月份筛选）
            op_expense = 0
            for st in stations:
                if period:
                    cur.execute("SELECT COALESCE(SUM(amount), 0) as total FROM operating_expenses WHERE station_id = %s AND period = %s", (st["id"], period))
                else:
                    cur.execute("SELECT COALESCE(SUM(amount), 0) as total FROM operating_expenses WHERE station_id = %s", (st["id"],))
                op_expense += float(cur.fetchone()["total"] or 0)

            # 合同
            cur.execute("""
                SELECT COUNT(*) as total,
                       COUNT(*) FILTER (WHERE end_date IS NOT NULL AND end_date < CURRENT_DATE) as expired,
                       COUNT(*) FILTER (WHERE end_date IS NOT NULL AND end_date >= CURRENT_DATE AND end_date <= CURRENT_DATE + INTERVAL '90 days') as expiring
                FROM contracts
                WHERE landlord_id = %s
            """, (lid,))
            contract_stats = cur.fetchone()

            # 计算每个站点的电费成本和收入
            for sb in station_breakdown:
                kwh = float(sb["kwh"] or 0)
                sb["elecPay"] = round(kwh * elec_pay_price, 2) if elec_pay_price else 0
                sb["elecCollect"] = round(kwh * elec_collect_price, 2) if elec_collect_price else 0
                sb["elecProfit"] = round(sb["elecCollect"] - sb["elecPay"], 2)

            # 合同拆分数据
            contract_breakdown = []
            for c in contracts:
                ct = c["contract_type"]
                monthly = float(c["monthly_rent"] or 0)
                price = float(c["electricity_price"] or 0)
                brand_name = brand_names.get(c["brand_id"], "") if c.get("brand_id") else ""
                partner = c.get("partner") or brand_name or ""
                # 场地合同没有partner时，使用场地方名称
                if ct == "场地合同" and not partner:
                    partner = landlord["name"]
                contract_breakdown.append({
                    "id": c["id"],
                    "type": ct,
                    "partner": partner,
                    "monthlyRent": monthly,
                    "elecPrice": price,
                    "cabinetsCount": c.get("cabinets_count"),
                })

            result.append({
                "landlord": {
                    "id": lid,
                    "name": landlord["name"],
                    "contact": landlord["contact"],
                    "phone": landlord["phone"],
                },
                "meters": meters,
                "stations": stations,
                "meterCount": len(meters),
                "stationCount": len(stations),
                "totalKwh": round(total_kwh, 2),
                "elecPay": round(elec_pay, 2),
                "elecCollect": round(elec_collect, 2),
                "elecProfit": round(elec_profit, 2),
                "rentCost": round(rent_cost, 2),
                "rentIncome": round(rent_income, 2),
                "rentProfit": round(rent_profit, 2),
                "opExpense": round(op_expense, 2),
                "totalProfit": round(elec_profit + rent_profit - op_expense, 2),
                "contractCount": contract_stats["total"],
                "expiredContracts": contract_stats["expired"],
                "expiringContracts": contract_stats["expiring"],
                "stationBreakdown": station_breakdown,
                "contractBreakdown": contract_breakdown,
            })

        return result
    finally:
        cur.close()
        conn.close()


@router.get("/shareholder-board")
async def shareholder_board():
    """股东看板"""
    from ..repositories import dividend_repo, directory_repo

    shareholders = directory_repo.list_shareholders()
    summaries = dividend_repo.get_shareholder_summary()

    # 按股东聚合
    holder_map = {}
    for sh in shareholders:
        holder_map[sh["id"]] = {
            "id": sh["id"],
            "name": sh["name"],
            "phone": sh.get("phone"),
            "totalAmount": 0,
            "settledAmount": 0,
            "pendingAmount": 0,
            "details": [],
        }

    for s in summaries:
        hid = s["shareholder_id"]
        if hid in holder_map:
            amount = float(s.get("amount") or 0)
            holder_map[hid]["totalAmount"] += amount
            if s.get("status") == "已结算":
                holder_map[hid]["settledAmount"] += amount
            else:
                holder_map[hid]["pendingAmount"] += amount
            holder_map[hid]["details"].append(s)

    return list(holder_map.values())
