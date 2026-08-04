"""小程序财务数据接口（按站点/品牌/公司/场地方/股东 5个维度）"""

from fastapi import APIRouter, Depends
from ..middleware.mp_auth import get_current_user
from ..infra.database import get_connection, get_dict_cursor

router = APIRouter(prefix="/finance", tags=["📱 小程序 - 财务数据"])


@router.get("/stations")
async def finance_stations(user: dict = Depends(get_current_user)):
    """站点维度财务数据"""
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("""
            SELECT
                s.id, s.name as station,
                COALESCE(b.name, '') as brand,
                COALESCE(e.name, '') as entity,
                COALESCE(l.name, '') as landlord,
                COALESCE(SUM(er.pay_amount), 0) as elec_pay,
                COALESCE(SUM(er.collect_net), 0) as elec_collect,
                COALESCE(SUM(er.profit), 0) as elec_profit
            FROM stations s
            LEFT JOIN meters m ON m.station_id = s.id
            LEFT JOIN brands b ON m.brand_id = b.id
            LEFT JOIN entities e ON e.id = (SELECT id FROM entities LIMIT 1)
            LEFT JOIN landlords l ON s.landlord_id = l.id
            LEFT JOIN electricity_records er ON er.station_id = s.id
            GROUP BY s.id, s.name, b.name, e.name, l.name
            ORDER BY s.id
        """)
        elec_data = cur.fetchall()

        # 租金数据
        cur.execute("""
            SELECT station_id,
                   COALESCE(SUM(annual_rent), 0) as rent_cost
            FROM rent_leases
            GROUP BY station_id
        """)
        rent_cost_map = {r["station_id"]: float(r["rent_cost"]) for r in cur.fetchall()}

        cur.execute("""
            SELECT station_id,
                   COALESCE(SUM(annual_income), 0) as rent_income
            FROM rent_incomes
            GROUP BY station_id
        """)
        rent_income_map = {r["station_id"]: float(r["rent_income"]) for r in cur.fetchall()}

        result = []
        for row in elec_data:
            sid = row["id"]
            rent_cost = rent_cost_map.get(sid, 0)
            rent_income = rent_income_map.get(sid, 0)
            result.append({
                "station": row["station"],
                "brand": row["brand"],
                "entity": row["entity"],
                "landlord": row["landlord"],
                "elecPay": round(float(row["elec_pay"]), 2),
                "elecCollect": round(float(row["elec_collect"]), 2),
                "elecProfit": round(float(row["elec_profit"]), 2),
                "rentCostAnnual": rent_cost,
                "rentIncomeAnnual": rent_income,
                "totalProfit": round(float(row["elec_profit"]) + rent_income - rent_cost, 2),
            })

        return {"code": 0, "data": result}
    finally:
        cur.close()
        conn.close()


@router.get("/brands")
async def finance_brands(user: dict = Depends(get_current_user)):
    """品牌方维度财务数据"""
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("""
            SELECT
                COALESCE(b.name, '未关联') as brand,
                COUNT(DISTINCT s.id) as station_count,
                COALESCE(SUM(er.pay_amount), 0) as elec_pay,
                COALESCE(SUM(er.collect_net), 0) as elec_collect,
                COALESCE(SUM(er.profit), 0) as elec_profit,
                COALESCE(SUM(CASE WHEN er.pay_status = '未付款' THEN er.pay_amount ELSE 0 END), 0) as elec_unpaid,
                COALESCE(SUM(CASE WHEN er.collect_status = '未到账' THEN er.collect_net ELSE 0 END), 0) as elec_uncollected
            FROM stations s
            LEFT JOIN meters m ON m.station_id = s.id
            LEFT JOIN brands b ON m.brand_id = b.id
            LEFT JOIN electricity_records er ON er.station_id = s.id
            GROUP BY b.name
            ORDER BY elec_profit DESC
        """)
        elec_data = cur.fetchall()

        # 租金数据按品牌
        cur.execute("""
            SELECT COALESCE(b.name, '未关联') as brand,
                   COALESCE(SUM(rl.annual_rent), 0) as rent_cost
            FROM rent_leases rl
            JOIN stations s ON s.id = rl.station_id
            LEFT JOIN meters m ON m.station_id = s.id
            LEFT JOIN brands b ON m.brand_id = b.id
            GROUP BY b.name
        """)
        rent_cost_map = {r["brand"]: float(r["rent_cost"]) for r in cur.fetchall()}

        cur.execute("""
            SELECT COALESCE(b.name, '未关联') as brand,
                   COALESCE(SUM(ri.annual_income), 0) as rent_income,
                   COALESCE(SUM(CASE WHEN rr.status = '未到账' THEN rr.amount ELSE 0 END), 0) as rent_uncollected
            FROM rent_incomes ri
            LEFT JOIN rent_receipts rr ON rr.rent_income_id = ri.id
            LEFT JOIN brands b ON ri.brand_id = b.id
            GROUP BY b.name
        """)
        rent_income_map = {}
        rent_uncollected_map = {}
        for r in cur.fetchall():
            rent_income_map[r["brand"]] = float(r["rent_income"])
            rent_uncollected_map[r["brand"]] = float(r["rent_uncollected"])

        result = []
        for row in elec_data:
            brand = row["brand"]
            rent_cost = rent_cost_map.get(brand, 0)
            rent_income = rent_income_map.get(brand, 0)
            result.append({
                "brand": brand,
                "stationCount": row["station_count"],
                "elecPay": round(float(row["elec_pay"]), 2),
                "elecCollect": round(float(row["elec_collect"]), 2),
                "elecProfit": round(float(row["elec_profit"]), 2),
                "elecUnpaid": round(float(row["elec_unpaid"]), 2),
                "elecUncollected": round(float(row["elec_uncollected"]), 2),
                "rentCostAnnual": rent_cost,
                "rentIncomeAnnual": rent_income,
                "rentProfit": rent_income - rent_cost,
                "rentUncollected": rent_uncollected_map.get(brand, 0),
                "totalProfit": round(float(row["elec_profit"]) + rent_income - rent_cost, 2),
            })

        return {"code": 0, "data": result}
    finally:
        cur.close()
        conn.close()


@router.get("/entities")
async def finance_entities(user: dict = Depends(get_current_user)):
    """公司主体维度财务数据"""
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("""
            SELECT
                e.name as entity,
                COUNT(DISTINCT s.id) as station_count,
                COUNT(DISTINCT b.id) as brand_count,
                COALESCE(SUM(er.pay_amount), 0) as elec_pay,
                COALESCE(SUM(er.collect_net), 0) as elec_collect,
                COALESCE(SUM(er.profit), 0) as elec_profit
            FROM entities e
            LEFT JOIN stations s ON s.id IS NOT NULL
            LEFT JOIN meters m ON m.station_id = s.id
            LEFT JOIN brands b ON m.brand_id = b.id
            LEFT JOIN electricity_records er ON er.station_id = s.id
            GROUP BY e.name
            ORDER BY e.id
        """)
        elec_data = cur.fetchall()

        # 租金数据
        cur.execute("""
            SELECT COALESCE(SUM(annual_rent), 0) as total FROM rent_leases
        """)
        total_rent_cost = float(cur.fetchone()["total"])

        cur.execute("""
            SELECT COALESCE(SUM(annual_income), 0) as total FROM rent_incomes
        """)
        total_rent_income = float(cur.fetchone()["total"])

        result = []
        for row in elec_data:
            # 简化处理：租金按实体均分
            entity_count = len(elec_data) if elec_data else 1
            rent_cost = total_rent_cost / entity_count
            rent_income = total_rent_income / entity_count
            result.append({
                "entity": row["entity"],
                "stationCount": row["station_count"],
                "brandCount": row["brand_count"],
                "elecPay": round(float(row["elec_pay"]), 2),
                "elecCollect": round(float(row["elec_collect"]), 2),
                "elecProfit": round(float(row["elec_profit"]), 2),
                "rentCostAnnual": round(rent_cost, 2),
                "rentIncomeAnnual": round(rent_income, 2),
                "rentProfit": round(rent_income - rent_cost, 2),
                "totalProfit": round(float(row["elec_profit"]) + rent_income - rent_cost, 2),
            })

        return {"code": 0, "data": result}
    finally:
        cur.close()
        conn.close()


@router.get("/landlords")
async def finance_landlords(user: dict = Depends(get_current_user)):
    """场地方维度财务数据"""
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("""
            SELECT
                l.name as landlord,
                COUNT(DISTINCT s.id) as station_count,
                COALESCE(SUM(er.pay_amount), 0) as elec_pay,
                COALESCE(SUM(er.collect_net), 0) as elec_collect,
                COALESCE(SUM(er.profit), 0) as elec_profit
            FROM landlords l
            LEFT JOIN stations s ON s.landlord_id = l.id
            LEFT JOIN electricity_records er ON er.station_id = s.id
            GROUP BY l.id, l.name
            ORDER BY l.id
        """)
        elec_data = cur.fetchall()

        # 租金数据按场地方
        cur.execute("""
            SELECT l.name as landlord,
                   COALESCE(SUM(rl.annual_rent), 0) as rent_cost
            FROM rent_leases rl
            JOIN stations s ON s.id = rl.station_id
            JOIN landlords l ON s.landlord_id = l.id
            GROUP BY l.name
        """)
        rent_cost_map = {r["landlord"]: float(r["rent_cost"]) for r in cur.fetchall()}

        cur.execute("""
            SELECT l.name as landlord,
                   COALESCE(SUM(ri.annual_income), 0) as rent_income
            FROM rent_incomes ri
            JOIN stations s ON s.id = ri.station_id
            JOIN landlords l ON s.landlord_id = l.id
            GROUP BY l.name
        """)
        rent_income_map = {r["landlord"]: float(r["rent_income"]) for r in cur.fetchall()}

        result = []
        for row in elec_data:
            landlord = row["landlord"]
            rent_cost = rent_cost_map.get(landlord, 0)
            rent_income = rent_income_map.get(landlord, 0)
            result.append({
                "landlord": landlord,
                "stationCount": row["station_count"],
                "elecPay": round(float(row["elec_pay"]), 2),
                "elecCollect": round(float(row["elec_collect"]), 2),
                "elecProfit": round(float(row["elec_profit"]), 2),
                "rentCostAnnual": rent_cost,
                "rentIncomeAnnual": rent_income,
                "rentProfit": rent_income - rent_cost,
                "totalProfit": round(float(row["elec_profit"]) + rent_income - rent_cost, 2),
            })

        return {"code": 0, "data": result}
    finally:
        cur.close()
        conn.close()


@router.get("/shareholders")
async def finance_shareholders(user: dict = Depends(get_current_user)):
    """股东分红数据"""
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("""
            SELECT
                sh.name as shareholder,
                COUNT(DISTINCT dr.station_id) as station_count,
                COALESCE(SUM(ds.amount), 0) as dividend_amount,
                COALESCE(SUM(CASE WHEN dr.status = '已结算' THEN ds.amount ELSE 0 END), 0) as paid,
                COALESCE(SUM(CASE WHEN dr.status != '已结算' THEN ds.amount ELSE 0 END), 0) as unpaid
            FROM shareholders sh
            LEFT JOIN dividend_shares ds ON ds.shareholder_id = sh.id
            LEFT JOIN dividend_records dr ON dr.id = ds.dividend_id
            GROUP BY sh.id, sh.name
            ORDER BY sh.id
        """)

        result = []
        for row in cur.fetchall():
            dividend_amount = float(row["dividend_amount"])
            # 计算分红比例（简化：用分红金额占总利润的比例）
            ratio = ""
            if dividend_amount > 0:
                cur.execute("SELECT COALESCE(SUM(profit), 0) as total FROM dividend_records")
                total_profit = float(cur.fetchone()["total"])
                if total_profit > 0:
                    ratio = f"{round(dividend_amount / total_profit * 100, 1)}%"

            result.append({
                "shareholder": row["shareholder"],
                "stationCount": row["station_count"],
                "dividendAmount": round(dividend_amount, 2),
                "dividendRatio": ratio,
                "paid": round(float(row["paid"]), 2),
                "unpaid": round(float(row["unpaid"]), 2),
            })

        return {"code": 0, "data": result}
    finally:
        cur.close()
        conn.close()
