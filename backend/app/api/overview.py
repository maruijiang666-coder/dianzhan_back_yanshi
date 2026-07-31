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

            # 电费（按场地方下的站点汇总，按月份筛选）
            elec_pay = 0
            elec_collect = 0
            elec_profit = 0
            for st in stations:
                if period:
                    cur.execute("""
                        SELECT COALESCE(SUM(pay_amount), 0) as pay,
                               COALESCE(SUM(collect_net), 0) as collect,
                               COALESCE(SUM(profit), 0) as profit
                        FROM electricity_records
                        WHERE station_id = %s AND period = %s
                    """, (st["id"], period))
                else:
                    cur.execute("""
                        SELECT COALESCE(SUM(pay_amount), 0) as pay,
                               COALESCE(SUM(collect_net), 0) as collect,
                               COALESCE(SUM(profit), 0) as profit
                        FROM electricity_records
                        WHERE station_id = %s
                    """, (st["id"],))
                elec = cur.fetchone()
                elec_pay += float(elec["pay"] or 0)
                elec_collect += float(elec["collect"] or 0)
                elec_profit += float(elec["profit"] or 0)

            # 租金（按场地方下的站点汇总）
            rent_cost = 0
            rent_income = 0
            for st in stations:
                cur.execute("SELECT COALESCE(SUM(annual_rent), 0) as total FROM rent_leases WHERE station_id = %s", (st["id"],))
                rent_cost += float(cur.fetchone()["total"] or 0) / 12
                cur.execute("SELECT COALESCE(SUM(monthly_rent), 0) as total FROM rent_incomes WHERE station_id = %s", (st["id"],))
                rent_income += float(cur.fetchone()["total"] or 0)

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
