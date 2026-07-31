"""分红计算器"""
from datetime import date
from ..repositories import (
    electricity_repo, rent_repo, dividend_repo, meter_repo, station_repo
)


class DividendCalculator:
    """分红计算器 - 核心业务逻辑"""

    def calculate(self, station_id: int, period: str) -> dict:
        """计算某站点某月的分红（预览，不入库）"""
        station = station_repo.get_station(station_id)
        if not station:
            return None

        # 1. 计算收入
        income = self._calc_income(station_id, period)

        # 2. 计算成本
        cost = self._calc_cost(station_id, period)

        # 3. 计算商务分红
        biz_dividends = self._calc_business_dividends(station_id, income, cost)

        # 4. 如果商务分红计入成本，更新总成本
        biz_cost = sum(d["amount"] for d in biz_dividends if d.get("countAsCost"))
        cost["bizDividendCost"] = round(biz_cost, 2)
        cost["totalCost"] = round(
            cost["elecCost"] + cost["rentCost"] + cost["opExpense"] + biz_cost, 2
        )

        # 5. 计算净利润
        profit = round(income["totalIncome"] - cost["totalCost"], 2)

        # 6. 计算股东分红
        shareholder_dividends = self._calc_shareholder_dividends(station_id, income, profit)

        # 7. 计算结算日期
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

    def _calc_income(self, station_id: int, period: str) -> dict:
        """计算总收入"""
        # 电费收入
        elec_record = electricity_repo.get_record_by_station_period(station_id, period)
        elec_income = float(elec_record["collect_net"] or 0) if elec_record else 0

        # 租金收入
        incomes = rent_repo.list_incomes(station_id=station_id)
        rent_income = sum(float(i.get("monthly_rent") or 0) for i in incomes)

        total = round(elec_income + rent_income, 2)

        return {
            "elecIncome": {
                "total": round(elec_income, 2),
                "details": self._get_elec_income_details(elec_record),
            },
            "rentIncome": {
                "total": round(rent_income, 2),
                "details": self._get_rent_income_details(incomes),
            },
            "totalIncome": total,
        }

    def _get_elec_income_details(self, elec_record) -> list:
        """获取电费收入明细"""
        if not elec_record:
            return []
        details = electricity_repo.get_meter_details(elec_record["id"])
        return [{
            "meterId": d.get("meter_id"),
            "meterNo": d.get("meter_no"),
            "brandName": d.get("brand_name"),
            "startDate": str(elec_record.get("collect_start_date") or ""),
            "endDate": str(elec_record.get("collect_end_date") or ""),
            "kwh": float(d.get("kwh") or 0),
            "unitPrice": float(d.get("collect_unit_price") or 0),
            "amount": float(d.get("collect_amount") or 0),
        } for d in details]

    def _get_rent_income_details(self, incomes) -> list:
        """获取租金收入明细"""
        return [{
            "brandName": i.get("brand_name"),
            "cabinets": float(i.get("cabinets_count") or 0),
            "unitMonthlyRent": float(i.get("unit_monthly_rent") or 0),
            "amount": float(i.get("monthly_rent") or 0),
        } for i in incomes]

    def _calc_cost(self, station_id: int, period: str) -> dict:
        """计算总成本"""
        # 电费成本
        elec_record = electricity_repo.get_record_by_station_period(station_id, period)
        elec_cost = float(elec_record["pay_amount"] or 0) if elec_record else 0

        # 场地租金
        leases = rent_repo.list_leases(station_id=station_id)
        rent_cost = sum(float(l.get("annual_rent") or 0) / 12 for l in leases)

        # 运营费用
        expense = rent_repo.get_expense(station_id, period)
        op_expense = float(expense["amount"]) if expense else 0

        total = round(elec_cost + rent_cost + op_expense, 2)

        return {
            "elecCost": round(elec_cost, 2),
            "rentCost": round(rent_cost, 2),
            "opExpense": round(op_expense, 2),
            "bizDividendCost": 0,  # 后面计算
            "totalCost": total,
            "details": {
                "electricity": self._get_elec_cost_details(elec_record),
                "rent": self._get_rent_cost_details(leases),
                "operatingExpense": {
                    "amount": round(op_expense, 2),
                    "remark": expense.get("remark") if expense else None,
                },
            },
        }

    def _get_elec_cost_details(self, elec_record) -> list:
        """获取电费成本明细"""
        if not elec_record:
            return []
        details = electricity_repo.get_meter_details(elec_record["id"])
        return [{
            "meterNo": d.get("meter_no"),
            "kwh": float(d.get("kwh") or 0),
            "unitPrice": float(d.get("pay_unit_price") or 0),
            "amount": float(d.get("pay_amount") or 0),
        } for d in details]

    def _get_rent_cost_details(self, leases) -> list:
        """获取租金成本明细"""
        return [{
            "landlordName": l.get("station_name"),
            "annualRent": float(l.get("annual_rent") or 0),
            "monthlyRent": round(float(l.get("annual_rent") or 0) / 12, 2),
        } for l in leases]

    def _calc_business_dividends(self, station_id: int, income: dict, cost: dict) -> list:
        """计算商务分红"""
        configs = dividend_repo.list_introducer_configs(station_id=station_id)
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

    def _calc_shareholder_dividends(self, station_id: int, income: dict, profit: float) -> list:
        """计算股东分红"""
        configs = dividend_repo.list_shareholder_configs(station_id=station_id)
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
        year, month = map(int, period.split("-"))
        if month == 12:
            return f"{year + 1}-01-01"
        else:
            return f"{year}-{month + 1:02d}-01"


# 全局实例
dividend_calculator = DividendCalculator()
