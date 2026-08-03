"""分红计算器"""
from datetime import date
from ..repositories import (
    electricity_repo, rent_repo, dividend_repo, meter_repo, station_repo
)
from ..infra.database import get_connection, get_dict_cursor


class DividendCalculator:
    """分红计算器 - 核心业务逻辑"""

    def calculate(self, station_id: int, period: str) -> dict:
        """计算某站点某月的分红（预览，不入库）"""
        station = station_repo.get_station(station_id)
        if not station:
            return None

        landlord_id = station.get("landlord_id")

        # 1. 获取该场地方的合同（计算电费单价和租金）
        contracts = self._get_contracts(landlord_id, station.get("name"))
        elec_pay_price = 0    # 场地合同电费单价（成本）
        elec_collect_price = 0  # 品牌方合同电费单价（收入）
        rent_cost = 0          # 场地合同月租金
        rent_income = 0        # 品牌方合同月租金

        for c in contracts:
            if c["contract_type"] == "场地合同":
                if c["monthly_rent"]:
                    rent_cost += float(c["monthly_rent"])
                if c["electricity_price"]:
                    elec_pay_price = float(c["electricity_price"])
            elif c["contract_type"] == "品牌方合同":
                if c["electricity_price"] and not elec_collect_price:
                    elec_collect_price = float(c["electricity_price"])
                if c["monthly_rent"]:
                    rent_income += float(c["monthly_rent"])

        # 2. 获取电表读数（从meter_monthly）
        total_kwh, meter_details = self._get_meter_kwh(landlord_id, period, station_id)

        # 3. 计算电费收入和成本
        elec_income = round(total_kwh * elec_collect_price, 2) if elec_collect_price else 0
        elec_cost = round(total_kwh * elec_pay_price, 2) if elec_pay_price else 0

        # 4. 运营费用
        expense = rent_repo.get_expense(station_id, period)
        op_expense = float(expense["amount"]) if expense else 0

        # 5. 组装收入数据
        income = {
            "elecIncome": {
                "total": elec_income,
                "details": [{
                    "meterNo": d["meter_no"],
                    "brandName": d["brand_name"],
                    "kwh": float(d["kwh"] or 0),
                    "unitPrice": elec_collect_price,
                    "amount": round(float(d["kwh"] or 0) * elec_collect_price, 2),
                } for d in meter_details],
            },
            "rentIncome": {
                "total": round(rent_income, 2),
                "details": [{
                    "brandName": c.get("brand_name", ""),
                    "cabinets": float(c.get("cabinets_count") or 0),
                    "unitMonthlyRent": float(c.get("unit_monthly_rent") or 0),
                    "amount": float(c.get("monthly_rent") or 0),
                } for c in contracts if c["contract_type"] == "品牌方合同"],
            },
            "totalIncome": round(elec_income + rent_income, 2),
        }

        # 6. 组装成本数据
        cost = {
            "elecCost": elec_cost,
            "rentCost": round(rent_cost, 2),
            "opExpense": round(op_expense, 2),
            "bizDividendCost": 0,
            "totalCost": round(elec_cost + rent_cost + op_expense, 2),
            "details": {
                "electricity": [{
                    "meterNo": d["meter_no"],
                    "kwh": float(d["kwh"] or 0),
                    "unitPrice": elec_pay_price,
                    "amount": round(float(d["kwh"] or 0) * elec_pay_price, 2),
                } for d in meter_details],
                "rent": [{
                    "landlordName": c.get("partner", ""),
                    "monthlyRent": float(c.get("monthly_rent") or 0),
                } for c in contracts if c["contract_type"] == "场地合同"],
                "operatingExpense": {
                    "amount": round(op_expense, 2),
                    "remark": expense.get("remark") if expense else None,
                },
            },
        }

        # 7. 计算商务分红
        biz_dividends = self._calc_business_dividends(station_id, income, cost, period)

        # 8. 如果商务分红计入成本，更新总成本
        biz_cost = sum(d["amount"] for d in biz_dividends if d.get("countAsCost"))
        cost["bizDividendCost"] = round(biz_cost, 2)
        cost["totalCost"] = round(
            cost["elecCost"] + cost["rentCost"] + cost["opExpense"] + biz_cost, 2
        )

        # 9. 计算净利润
        profit = round(income["totalIncome"] - cost["totalCost"], 2)

        # 10. 计算股东分红
        shareholder_dividends = self._calc_shareholder_dividends(station_id, income, profit, period)

        # 11. 计算结算日期
        settlement_date = self._calc_settlement_date(period)

        return {
            "stationId": station_id,
            "stationName": station.get("name"),
            "period": period,
            "companyShare": float(station.get("company_share") or 0),
            "income": income,
            "cost": cost,
            "profit": profit,
            "bizDividends": biz_dividends,
            "shareholderDividends": shareholder_dividends,
            "settlementDate": settlement_date,
            "summary": {
                "totalBusinessDividend": round(sum(d["amount"] for d in biz_dividends), 2),
                "totalShareholderDividend": round(sum(d["amount"] for d in shareholder_dividends), 2),
            },
        }

    def _get_contracts(self, landlord_id: int, station_name: str = None) -> list:
        """获取场地方的合同，优先按 landlord_id 匹配，否则按 station_name 匹配"""
        conn = get_connection()
        cur = get_dict_cursor(conn)
        try:
            if landlord_id:
                cur.execute("""
                    SELECT c.*, b.name as brand_name
                    FROM contracts c
                    LEFT JOIN brands b ON c.brand_id = b.id
                    WHERE c.landlord_id = %s
                """, (landlord_id,))
            elif station_name:
                cur.execute("""
                    SELECT c.*, b.name as brand_name
                    FROM contracts c
                    LEFT JOIN brands b ON c.brand_id = b.id
                    WHERE c.station_name = %s
                """, (station_name,))
            else:
                return []
            return cur.fetchall()
        finally:
            cur.close()
            conn.close()

    def _get_meter_kwh(self, landlord_id: int, period: str, station_id: int = None) -> tuple:
        """获取场地方或站点下所有电表的月度用电量"""
        conn = get_connection()
        cur = get_dict_cursor(conn)
        try:
            # 优先按 landlord_id 查，没有则按 station_id 查
            if landlord_id:
                cur.execute("""
                    SELECT m.meter_no, m.meter_name, b.name as brand_name
                    FROM meters m
                    LEFT JOIN brands b ON m.brand_id = b.id
                    WHERE m.landlord_id = %s
                    ORDER BY m.id
                """, (landlord_id,))
            elif station_id:
                cur.execute("""
                    SELECT m.meter_no, m.meter_name, b.name as brand_name
                    FROM meters m
                    LEFT JOIN brands b ON m.brand_id = b.id
                    WHERE m.station_id = %s
                    ORDER BY m.id
                """, (station_id,))
            else:
                return 0, []
            meters = cur.fetchall()

            meter_nos = [m["meter_no"] for m in meters if m.get("meter_no")]
            total_kwh = 0
            details = []

            if meter_nos and period:
                month_period = period.replace("-", "")
                placeholders = ",".join(["%s"] * len(meter_nos))
                cur.execute(f"""
                    SELECT mm.address as meter_no, COALESCE(SUM(mm.kwh), 0) as kwh
                    FROM meter_monthly mm
                    WHERE mm.address IN ({placeholders}) AND mm.month_period = %s
                    GROUP BY mm.address
                """, (*meter_nos, month_period))
                kwh_map = {r["meter_no"]: float(r["kwh"] or 0) for r in cur.fetchall()}

                for m in meters:
                    kwh = kwh_map.get(m["meter_no"], 0)
                    total_kwh += kwh
                    details.append({
                        "meter_no": m["meter_no"],
                        "meter_name": m.get("meter_name"),
                        "brand_name": m.get("brand_name"),
                        "kwh": kwh,
                    })
            else:
                for m in meters:
                    details.append({
                        "meter_no": m["meter_no"],
                        "meter_name": m.get("meter_name"),
                        "brand_name": m.get("brand_name"),
                        "kwh": 0,
                    })

            return round(total_kwh, 2), details
        finally:
            cur.close()
            conn.close()

    def _filter_configs_by_period(self, configs: list, period: str) -> list:
        """按期间过滤配置（只保留生效中的配置）"""
        # 解析期间为日期
        if "-" in period:
            year, month = map(int, period.split("-"))
        else:
            year, month = int(period[:4]), int(period[4:])
        period_date = f"{year}-{month:02d}-01"

        result = []
        for cfg in configs:
            start = cfg.get("start_date")
            end = cfg.get("end_date")
            # start_date 为空或 <= 当月，end_date 为空或 >= 当月
            if start and str(start) > period_date:
                continue
            if end and str(end) < period_date:
                continue
            result.append(cfg)
        return result

    def _calc_business_dividends(self, station_id: int, income: dict, cost: dict, period: str = None) -> list:
        """计算商务分红"""
        configs = dividend_repo.list_introducer_configs(station_id=station_id)
        if period:
            configs = self._filter_configs_by_period(configs, period)
        total_income = income["totalIncome"]
        base_cost = cost["elecCost"] + cost["rentCost"] + cost["opExpense"]
        base_profit = total_income - base_cost

        results = []
        for cfg in configs:
            mode = cfg.get("mode")
            ratio = float(cfg.get("ratio") or 0)
            fixed_amount = float(cfg.get("fixed_amount") or 0)

            if mode == "收入分红":
                amount = round(total_income * ratio, 2)
                base_amount = total_income
            elif mode == "利润分红":
                amount = round(base_profit * ratio, 2)
                base_amount = base_profit
            elif mode == "固定金额":
                amount = fixed_amount
                base_amount = None
            else:
                amount = 0
                base_amount = None

            results.append({
                "introducerId": cfg.get("introducer_id"),
                "introducerName": cfg.get("introducer_name"),
                "mode": mode,
                "ratio": ratio,
                "fixedAmount": fixed_amount if mode == "固定金额" else None,
                "countAsCost": cfg.get("count_as_cost", False),
                "baseAmount": base_amount,
                "amount": amount,
            })

        return results

    def _calc_shareholder_dividends(self, station_id: int, income: dict, profit: float, period: str = None) -> list:
        """计算股东分红"""
        configs = dividend_repo.list_shareholder_configs(station_id=station_id)
        if period:
            configs = self._filter_configs_by_period(configs, period)
        total_income = income["totalIncome"]

        results = []
        for cfg in configs:
            mode = cfg.get("mode")
            ratio = float(cfg.get("ratio") or 0)
            fixed_amount = float(cfg.get("fixed_amount") or 0)

            if mode == "收入分红":
                amount = round(total_income * ratio, 2)
                base_amount = total_income
            elif mode == "利润分红":
                amount = round(profit * ratio, 2)
                base_amount = profit
            elif mode == "固定金额":
                amount = fixed_amount
                base_amount = None
            else:
                amount = 0
                base_amount = None

            results.append({
                "shareholderId": cfg.get("shareholder_id"),
                "shareholderName": cfg.get("shareholder_name"),
                "mode": mode,
                "ratio": ratio,
                "fixedAmount": fixed_amount if mode == "固定金额" else None,
                "baseAmount": base_amount,
                "amount": amount,
            })

        return results

    def _calc_settlement_date(self, period: str) -> str:
        """计算结算日期（月末）"""
        if "-" in period:
            year, month = map(int, period.split("-"))
        else:
            year, month = int(period[:4]), int(period[4:])
        if month == 12:
            return f"{year + 1}-01-01"
        else:
            return f"{year}-{month + 1:02d}-01"


# 全局实例
dividend_calculator = DividendCalculator()
