"""小程序数据快照接口 - 聚合首页/地图/站点/利润/审批所需数据"""

import json
from datetime import date, datetime
from fastapi import APIRouter, Depends
from ..middleware.mp_auth import get_current_user
from ..infra.database import get_connection, get_dict_cursor

router = APIRouter(tags=["📱 小程序 - 数据快照"])


@router.get("/snapshot")
async def snapshot(user: dict = Depends(get_current_user)):
    """经营数据快照（首页/地图/站点/利润/审批共用）"""
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        today = date.today()
        current_year = today.strftime("%Y")
        current_month = today.strftime("%Y-%m")

        # ── 1. 总览 ──────────────────────────────────────────
        cur.execute("SELECT COUNT(*) as cnt FROM stations")
        station_count = cur.fetchone()["cnt"]

        cur.execute("""
            SELECT
                COALESCE(SUM(profit), 0) as elec_profit,
                COALESCE(SUM(pay_amount), 0) as elec_pay,
                COALESCE(SUM(collect_net), 0) as elec_collect
            FROM electricity_records
            WHERE period LIKE %s
        """, (f"{current_year}%",))
        elec_year = cur.fetchone()

        # 租金利润（场租收款 - 场租付款，年化）
        cur.execute("SELECT COALESCE(SUM(annual_rent), 0) as total FROM rent_leases")
        rent_cost_annual = float(cur.fetchone()["total"])

        cur.execute("SELECT COALESCE(SUM(annual_income), 0) as total FROM rent_incomes")
        rent_income_annual = float(cur.fetchone()["total"])

        rent_profit_annual = rent_income_annual - rent_cost_annual

        # 当年电费利润
        elec_profit = float(elec_year["elec_profit"])

        # 异常站点数（当月电量低于平均值50%的站点）
        cur.execute("""
            WITH station_avg AS (
                SELECT m.station_id, AVG(mm.kwh) as avg_kwh
                FROM meter_monthly mm
                JOIN meters m ON m.meter_no = mm.address
                WHERE mm.kwh > 0
                GROUP BY m.station_id
            ),
            station_current AS (
                SELECT m.station_id, SUM(mm.kwh) as current_kwh
                FROM meter_monthly mm
                JOIN meters m ON m.meter_no = mm.address
                WHERE mm.month_period = %s
                GROUP BY m.station_id
            )
            SELECT COUNT(*) as cnt
            FROM station_avg sa
            JOIN station_current sc ON sa.station_id = sc.station_id
            WHERE sc.current_kwh < sa.avg_kwh * 0.5
        """, (current_month.replace("-", ""),))
        abnormal_count = cur.fetchone()["cnt"]

        # ── 2. 电量统计 ──────────────────────────────────────
        # 本月
        cur.execute("""
            SELECT COALESCE(SUM(kwh), 0) as total
            FROM meter_monthly
            WHERE month_period = %s
        """, (current_month.replace("-", ""),))
        month_kwh = float(cur.fetchone()["total"])

        # 本季度
        quarter = (today.month - 1) // 3 + 1
        quarter_start = f"{current_year}{(quarter - 1) * 3 + 1:02d}"
        quarter_end = f"{current_year}{quarter * 3:02d}"
        cur.execute("""
            SELECT COALESCE(SUM(kwh), 0) as total
            FROM meter_monthly
            WHERE month_period >= %s AND month_period <= %s
        """, (quarter_start, quarter_end))
        quarter_kwh = float(cur.fetchone()["total"])

        # 本年
        cur.execute("""
            SELECT COALESCE(SUM(kwh), 0) as total
            FROM meter_monthly
            WHERE month_period >= %s AND month_period <= %s
        """, (f"{current_year}01", f"{current_year}12"))
        year_kwh = float(cur.fetchone()["total"])

        # 月度趋势（当年每月）
        cur.execute("""
            SELECT month_period, COALESCE(SUM(kwh), 0) as kwh
            FROM meter_monthly
            WHERE month_period >= %s AND month_period <= %s
            GROUP BY month_period
            ORDER BY month_period
        """, (f"{current_year}01", f"{current_year}12"))
        monthly_rows = cur.fetchall()

        # ── 3. 公司主体列表 ──────────────────────────────────
        cur.execute("SELECT name FROM entities ORDER BY id")
        entities = [r["name"] for r in cur.fetchall()]

        # ── 4. 站点明细 ──────────────────────────────────────
        cur.execute("""
            SELECT s.id, s.name, s.region, s.company_share, s.status,
                   b.name as brand, e.name as entity, l.name as landlord,
                   m.meter_no, s.address
            FROM stations s
            LEFT JOIN landlords l ON s.landlord_id = l.id
            LEFT JOIN meters m ON m.station_id = s.id
            LEFT JOIN brands b ON m.brand_id = b.id
            LEFT JOIN entities e ON e.id = (
                SELECT id FROM entities LIMIT 1
            )
            ORDER BY s.id
        """)
        raw_stations = cur.fetchall()

        # 获取每个站点的合同信息
        cur.execute("""
            SELECT station_id, contract_type, electricity_price, monthly_rent,
                   cabinets_count, partner, brand_id
            FROM contracts
        """)
        all_contracts = cur.fetchall()

        # 按站点分组合同
        station_contracts = {}
        for c in all_contracts:
            sid = c["station_id"]
            if sid not in station_contracts:
                station_contracts[sid] = []
            station_contracts[sid].append(c)

        # 获取品牌名称映射
        cur.execute("SELECT id, name FROM brands")
        brand_map = {r["id"]: r["name"] for r in cur.fetchall()}

        # 获取每个站点的最新月度电量
        cur.execute("""
            SELECT m.station_id, SUM(mm.kwh) as kwh
            FROM meter_monthly mm
            JOIN meters m ON m.meter_no = mm.address
            WHERE mm.month_period = %s
            GROUP BY m.station_id
        """, (current_month.replace("-", ""),))
        station_kwh_map = {r["station_id"]: float(r["kwh"] or 0) for r in cur.fetchall()}

        # 获取每个站点的历史平均电量
        cur.execute("""
            SELECT m.station_id, AVG(mm.kwh) as avg_kwh
            FROM meter_monthly mm
            JOIN meters m ON m.meter_no = mm.address
            WHERE mm.kwh > 0
            GROUP BY m.station_id
        """)
        station_avg_kwh_map = {r["station_id"]: float(r["avg_kwh"] or 0) for r in cur.fetchall()}

        # 获取每个站点的电费数据
        cur.execute("""
            SELECT station_id,
                   COALESCE(SUM(pay_amount), 0) as elec_pay,
                   COALESCE(SUM(collect_net), 0) as elec_collect,
                   COALESCE(SUM(profit), 0) as elec_profit,
                   COALESCE(SUM(pay_kwh), 0) as kwh_total
            FROM electricity_records
            WHERE period LIKE %s
            GROUP BY station_id
        """, (f"{current_year}%",))
        station_elec_map = {}
        for r in cur.fetchall():
            station_elec_map[r["station_id"]] = {
                "elecPay": float(r["elec_pay"]),
                "elecCollect": float(r["elec_collect"]),
                "elecProfit": float(r["elec_profit"]),
                "kwhTotal": float(r["kwh_total"]),
            }

        # 获取柜子数量
        cur.execute("SELECT station_id, COUNT(*) as cnt FROM meters GROUP BY station_id")
        station_meter_count = {r["station_id"]: r["cnt"] for r in cur.fetchall()}

        # 构建站点列表（去重，一个站点可能有多条 meter 记录）
        seen_station_ids = set()
        stations = []
        for row in raw_stations:
            sid = row["id"]
            if sid in seen_station_ids:
                continue
            seen_station_ids.add(sid)

            contracts = station_contracts.get(sid, [])
            elec_data = station_elec_map.get(sid, {})
            latest_kwh = station_kwh_map.get(sid, 0)
            avg_kwh = station_avg_kwh_map.get(sid, 0)

            # 从合同推断品牌
            brand = row.get("brand") or ""
            if not brand:
                for c in contracts:
                    if c.get("brand_id"):
                        brand = brand_map.get(c["brand_id"], "")
                        break

            # 租金数据
            rent_cost = 0
            rent_income = 0
            for c in contracts:
                if c["contract_type"] == "场地合同" and c.get("monthly_rent"):
                    rent_cost += float(c["monthly_rent"])
                elif c["contract_type"] == "品牌方合同" and c.get("monthly_rent"):
                    rent_income += float(c["monthly_rent"])

            rent_profit = rent_income - rent_cost
            total_profit = elec_data.get("elecProfit", 0) + rent_profit

            # ROI
            roi = None
            if rent_cost > 0 and total_profit > 0:
                roi = round((total_profit * 12 / (rent_cost * 12)) * 100, 1)

            stations.append({
                "id": sid,
                "name": row["name"],
                "region": row.get("region") or "",
                "brand": brand,
                "entity": row.get("entity") or "",
                "landlord": row.get("landlord") or "",
                "status": row.get("status") or "运营中",
                "meterNo": row.get("meter_no") or "",
                "cabinets": station_meter_count.get(sid),
                "companyShare": float(row["company_share"]) if row.get("company_share") else None,
                "latestKwh": round(latest_kwh, 2),
                "avgKwh": round(avg_kwh, 2) if avg_kwh else None,
                "abnormal": latest_kwh < avg_kwh * 0.5 if avg_kwh > 0 else False,
                "kwhTotal": elec_data.get("kwhTotal", 0),
                "elecPay": elec_data.get("elecPay", 0),
                "elecCollect": elec_data.get("elecCollect", 0),
                "elecProfit": elec_data.get("elecProfit", 0),
                "rentCost": round(rent_cost, 2),
                "rentIncome": round(rent_income, 2),
                "rentProfit": round(rent_profit, 2),
                "totalProfit": round(total_profit, 2),
                "roi": roi,
                "lat": None,
                "lng": None,
            })

        # ── 5. 提醒事项 ──────────────────────────────────────
        # 合同到期提醒（90天内到期或已过期）
        cur.execute("""
            SELECT c.station_name, b.name as brand, c.partner, c.end_date,
                   (c.end_date - %s::date) as days_left
            FROM contracts c
            LEFT JOIN brands b ON c.brand_id = b.id
            WHERE c.end_date IS NOT NULL
              AND c.end_date <= %s::date + INTERVAL '90 days'
            ORDER BY c.end_date
        """, (today, today))
        contracts_reminder = []
        for r in cur.fetchall():
            days = int(r["days_left"]) if r["days_left"] else 0
            contracts_reminder.append({
                "station": r["station_name"],
                "brand": r["brand"] or "",
                "partner": r["partner"] or "",
                "endDate": r["end_date"].isoformat() if r["end_date"] else "",
                "daysLeft": days,
            })

        # 电费未付款
        cur.execute("""
            SELECT s.name as station, er.period, er.pay_amount as amount
            FROM electricity_records er
            JOIN stations s ON s.id = er.station_id
            WHERE er.pay_status = '未付款' AND er.pay_amount > 0
            ORDER BY er.period DESC
            LIMIT 20
        """)
        elec_unpaid = [{"station": r["station"], "period": r["period"], "amount": float(r["amount"])} for r in cur.fetchall()]

        # 电费未到账
        cur.execute("""
            SELECT s.name as station, er.period, er.collect_net as amount
            FROM electricity_records er
            JOIN stations s ON s.id = er.station_id
            WHERE er.collect_status = '未到账' AND er.collect_net > 0
            ORDER BY er.period DESC
            LIMIT 20
        """)
        elec_uncollected = [{"station": r["station"], "period": r["period"], "amount": float(r["amount"])} for r in cur.fetchall()]

        # 租金待收
        cur.execute("""
            SELECT s.name as station, rr.seq, rr.amount, rr.period_end
            FROM rent_receipts rr
            JOIN rent_incomes ri ON ri.id = rr.rent_income_id
            JOIN stations s ON s.id = ri.station_id
            WHERE rr.status = '未到账'
            ORDER BY rr.period_end
            LIMIT 20
        """)
        rent_pending = []
        for r in cur.fetchall():
            rent_pending.append({
                "station": r["station"],
                "seq": int(r["seq"]),
                "amount": float(r["amount"]),
                "periodEnd": r["period_end"].isoformat() if r["period_end"] else "",
            })

        # ── 6. 待审批 ────────────────────────────────────────
        cur.execute("""
            SELECT ar.id, ar.biz_type, ar.title, ar.amount, ar.applicant,
                   ar.created_at, ar.status, ar.reason, ar.flow_nodes, ar.current_node
            FROM approval_requests ar
            WHERE ar.status = '审批中'
            ORDER BY ar.created_at DESC
        """)
        approvals_raw = cur.fetchall()

        approvals = []
        for a in approvals_raw:
            flow_nodes = json.loads(a["flow_nodes"]) if isinstance(a["flow_nodes"], str) else a["flow_nodes"]

            # 获取审批记录
            cur.execute("""
                SELECT node_name as role, approver as name, action, comment, created_at
                FROM approval_records
                WHERE request_id = %s
                ORDER BY created_at
            """, (a["id"],))
            records = cur.fetchall()

            # 构建节点状态
            nodes = []
            for i, node in enumerate(flow_nodes):
                node_status = "wait"
                node_time = ""
                node_comment = ""
                if i < a["current_node"]:
                    node_status = "done"
                elif i == a["current_node"]:
                    node_status = "active" if a["status"] == "审批中" else "done"

                # 从审批记录中找对应的操作
                for rec in records:
                    if rec["role"] == node["name"]:
                        if rec["action"] == "通过":
                            node_status = "done"
                            node_time = rec["created_at"].strftime("%Y-%m-%d %H:%M") if rec.get("created_at") else ""
                            node_comment = rec.get("comment") or ""
                        elif rec["action"] == "驳回":
                            node_status = "reject"
                            node_time = rec["created_at"].strftime("%Y-%m-%d %H:%M") if rec.get("created_at") else ""
                            node_comment = rec.get("comment") or ""

                nodes.append({
                    "role": node["name"],
                    "name": node.get("approver", ""),
                    "status": node_status,
                    "time": node_time,
                    "comment": node_comment,
                })

            approvals.append({
                "id": f"AP{a['created_at'].strftime('%Y%m')}{a['id']:03d}",
                "type": a["biz_type"],
                "title": a["title"],
                "amount": float(a["amount"]) if a["amount"] else 0,
                "station": "",
                "applicant": a["applicant"],
                "applyDate": a["created_at"].strftime("%Y-%m-%d") if a.get("created_at") else "",
                "status": "progress" if a["status"] == "审批中" else ("done" if a["status"] == "已通过" else "reject"),
                "reason": a.get("reason") or "",
                "nodes": nodes,
            })

        # ── 组装响应 ─────────────────────────────────────────
        return {
            "code": 0,
            "data": {
                "generatedAt": today.isoformat(),
                "overview": {
                    "stationCount": station_count,
                    "elecProfit": round(elec_profit, 2),
                    "rentProfit": round(rent_profit_annual / 12, 2),
                    "totalProfit": round(elec_profit + rent_profit_annual / 12, 2),
                    "abnormalCount": abnormal_count,
                },
                "kwh": {
                    "month": {
                        "label": current_month,
                        "kwh": round(month_kwh, 2),
                    },
                    "quarter": {
                        "label": f"{current_year} Q{quarter}",
                        "kwh": round(quarter_kwh, 2),
                    },
                    "year": {
                        "label": f"{current_year}年",
                        "kwh": round(year_kwh, 2),
                    },
                    "monthly": [
                        {
                            "period": f"{r['month_period'][:4]}-{r['month_period'][4:]}",
                            "kwh": round(float(r["kwh"]), 2),
                        }
                        for r in monthly_rows
                    ],
                },
                "entities": entities,
                "stations": stations,
                "reminders": {
                    "contracts": contracts_reminder,
                    "elecUnpaid": elec_unpaid,
                    "elecUncollected": elec_uncollected,
                    "rentPending": rent_pending,
                },
                "approvals": approvals,
            }
        }
    finally:
        cur.close()
        conn.close()
