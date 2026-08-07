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
        elec_collect_price = 0  # 品牌方合同电费单价（收入，税前）
        rent_cost = 0          # 场地合同月租金
        rent_income = 0        # 品牌方合同月租金
        rent_refund_total = 0  # 场地费退款总额

        # 按品牌记录电费单价和税后信息
        brand_elec_map = {}  # brand_id -> {pre_tax, post_tax, tax_enabled}
        # 按品牌记录场地租金税后信息
        brand_rent_map = {}  # brand_id -> {pre_tax, post_tax, tax_enabled}

        # 解析当前期间的年月
        if "-" in period:
            period_year, period_month = map(int, period.split("-"))
        else:
            period_year, period_month = int(period[:4]), int(period[4:])

        for c in contracts:
            if c["contract_type"] == "场地合同":
                if c["monthly_rent"]:
                    rent_cost += float(c["monthly_rent"])
                if c["electricity_price"]:
                    elec_pay_price = float(c["electricity_price"])
            elif c["contract_type"] == "品牌方合同":
                # 收入使用税前单价
                if c["electricity_price"] and not elec_collect_price:
                    elec_collect_price = float(c["electricity_price"])

                # 记录每个品牌的电费单价和税后信息
                brand_id = c.get("brand_id")
                if brand_id:
                    brand_elec_map[brand_id] = {
                        "pre_tax": float(c["electricity_price"] or 0),
                        "post_tax": float(c.get("post_tax_electricity_price") or 0),
                        "tax_enabled": bool(c.get("tax_enabled") and c.get("post_tax_electricity_price")),
                    }
                    # 记录场地租金税后信息
                    if c.get("rent_tax_enabled") and c.get("post_tax_rent_price"):
                        brand_rent_map[brand_id] = {
                            "pre_tax": float(c["monthly_rent"] or 0),
                            "post_tax": float(c["post_tax_rent_price"] or 0),
                            "tax_rate": float(c.get("rent_tax_rate") or 0.01),
                            "tax_enabled": True,
                            "brand_name": c.get("brand_name", ""),
                        }

                # 判断是否为合同首月（使用首月场地租金）
                start_date = c.get("start_date")
                is_first_month = False
                if start_date and c.get("first_month_rent"):
                    start_year = start_date.year if hasattr(start_date, 'year') else int(str(start_date)[:4])
                    start_month = start_date.month if hasattr(start_date, 'month') else int(str(start_date)[5:7])
                    is_first_month = (period_year == start_year and period_month == start_month)

                if is_first_month:
                    rent_income += float(c["first_month_rent"])
                elif c["monthly_rent"]:
                    rent_income += float(c["monthly_rent"])

                # 判断是否为合同提前结束月（场地费退款）- 优先使用 early_end_date，否则使用 end_date
                early_end_date = c.get("early_end_date")
                end_date = early_end_date or c.get("end_date")
                if end_date and c.get("rent_refund"):
                    end_year = end_date.year if hasattr(end_date, 'year') else int(str(end_date)[:4])
                    end_month = end_date.month if hasattr(end_date, 'month') else int(str(end_date)[5:7])
                    if period_year == end_year and period_month == end_month:
                        rent_refund_total += float(c["rent_refund"])

        # 2. 获取电表读数（从meter_monthly）
        total_kwh, meter_details = self._get_meter_kwh(landlord_id, period, station_id)

        # 3. 计算电费收入（使用税前单价）和成本
        elec_income = round(total_kwh * elec_collect_price, 2) if elec_collect_price else 0
        elec_cost = round(total_kwh * elec_pay_price, 2) if elec_pay_price else 0

        # 按品牌计算税收（只有启用税后计算的品牌才计算税收）
        elec_tax = 0
        tax_details = []  # 税收明细
        for d in meter_details:
            brand_id = d.get("brand_id")
            kwh = float(d.get("kwh") or 0)
            brand_info = brand_elec_map.get(brand_id, {})
            if brand_info.get("tax_enabled") and kwh > 0:
                pre_tax = brand_info["pre_tax"]
                post_tax = brand_info["post_tax"]
                tax_amount = round(kwh * (pre_tax - post_tax), 2)
                elec_tax += tax_amount
                tax_details.append({
                    "meterNo": d["meter_no"],
                    "brandName": d.get("brand_name", ""),
                    "kwh": kwh,
                    "preTaxPrice": pre_tax,
                    "postTaxPrice": post_tax,
                    "amount": tax_amount,
                })
        elec_tax = round(elec_tax, 2)

        # 计算场地税（按品牌方合同计算）
        rent_tax = 0
        rent_tax_details = []
        for brand_id, brand_info in brand_rent_map.items():
            if brand_info.get("tax_enabled"):
                pre_tax = brand_info["pre_tax"]
                post_tax = brand_info["post_tax"]
                tax_rate = brand_info.get("tax_rate", 0.01)
                tax_amount = round(pre_tax - post_tax, 2)
                rent_tax += tax_amount
                rent_tax_details.append({
                    "brandName": brand_info["brand_name"],
                    "preTaxPrice": pre_tax,
                    "postTaxPrice": post_tax,
                    "taxRate": tax_rate,
                    "amount": tax_amount,
                })
        rent_tax = round(rent_tax, 2)

        # 4. 运营费用
        expense = rent_repo.get_expense(station_id, period)
        op_expense = float(expense["amount"]) if expense else 0

        # 5. 组装收入数据
        # 构建租金收入明细（区分首月租金）
        rent_income_details = []
        for c in contracts:
            if c["contract_type"] == "品牌方合同":
                start_date = c.get("start_date")
                is_first_month = False
                if start_date and c.get("first_month_rent"):
                    start_year = start_date.year if hasattr(start_date, 'year') else int(str(start_date)[:4])
                    start_month = start_date.month if hasattr(start_date, 'month') else int(str(start_date)[5:7])
                    is_first_month = (period_year == start_year and period_month == start_month)

                amount = float(c.get("first_month_rent") or 0) if is_first_month else float(c.get("monthly_rent") or 0)
                brand_id = c.get("brand_id")
                rent_tax_info = brand_rent_map.get(brand_id, {})
                rent_income_details.append({
                    "brandId": brand_id,
                    "brandName": c.get("brand_name", ""),
                    "cabinets": float(c.get("cabinets_count") or 0),
                    "unitMonthlyRent": float(c.get("unit_monthly_rent") or 0),
                    "amount": amount,
                    "isFirstMonth": is_first_month,
                    "postTaxRent": rent_tax_info.get("post_tax") if rent_tax_info.get("tax_enabled") else None,
                })

        income = {
            "elecIncome": {
                "total": elec_income,
                "details": [{
                    "meterNo": d["meter_no"],
                    "brandName": d["brand_name"],
                    "kwh": float(d["kwh"] or 0),
                    "unitPrice": brand_elec_map.get(d.get("brand_id"), {}).get("pre_tax", elec_collect_price),
                    "postTaxPrice": brand_elec_map.get(d.get("brand_id"), {}).get("post_tax") if brand_elec_map.get(d.get("brand_id"), {}).get("tax_enabled") else None,
                    "amount": round(float(d["kwh"] or 0) * brand_elec_map.get(d.get("brand_id"), {}).get("pre_tax", elec_collect_price), 2),
                } for d in meter_details],
            },
            "rentIncome": {
                "total": round(rent_income, 2),
                "details": rent_income_details,
            },
            "totalIncome": round(elec_income + rent_income, 2),
        }

        # 6. 组装成本数据
        cost = {
            "elecCost": elec_cost,
            "rentCost": round(rent_cost, 2),
            "opExpense": round(op_expense, 2),
            "elecTax": round(elec_tax, 2),
            "rentTax": round(rent_tax, 2),
            "rentRefund": round(rent_refund_total, 2),
            "bizDividendCost": 0,
            "totalCost": round(elec_cost + rent_cost + op_expense + elec_tax + rent_tax + rent_refund_total, 2),
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
                "elecTax": {
                    "amount": round(elec_tax, 2),
                    "details": tax_details,
                },
                "rentTax": {
                    "amount": round(rent_tax, 2),
                    "details": rent_tax_details,
                },
                "rentRefund": {
                    "amount": round(rent_refund_total, 2),
                    "remark": "场地费退款" if rent_refund_total > 0 else None,
                },
            },
        }

        # 6.5 按品牌 P&L（用于按品牌分红：股东/介绍人只参与某个品牌的分红）
        brand_map = {}  # brand_id -> {income, cost, profit, venueCost, elecIncome, rentIncome, elecCost, opExpense, brandName}
        brand_contracts = [c for c in contracts if c["contract_type"] == "品牌方合同" and c.get("brand_id")]
        total_brand_cabinets = sum(float(c.get("cabinets_count") or 0) for c in brand_contracts) or 1

        # 按品牌汇总电表度数
        brand_kwh = {}
        for d in meter_details:
            bid = d.get("brand_id")
            if bid:
                brand_kwh[bid] = brand_kwh.get(bid, 0) + float(d.get("kwh") or 0)

        for c in brand_contracts:
            bid = c["brand_id"]
            cabs = float(c.get("cabinets_count") or 0)
            kwh = brand_kwh.get(bid, 0)
            unit_price = float(c.get("electricity_price") or 0)
            b_elec_income = round(kwh * unit_price, 2) if unit_price else 0

            # 租金收入（首月租逻辑与总收入一致）
            start_date = c.get("start_date")
            b_is_first = False
            if start_date and c.get("first_month_rent"):
                sy = start_date.year if hasattr(start_date, 'year') else int(str(start_date)[:4])
                sm = start_date.month if hasattr(start_date, 'month') else int(str(start_date)[5:7])
                b_is_first = (period_year == sy and period_month == sm)
            b_rent_income = float(c.get("first_month_rent") or 0) if b_is_first else float(c.get("monthly_rent") or 0)

            # 场地级成本按柜数分摊
            b_venue_cost = round(rent_cost * cabs / total_brand_cabinets, 2)
            b_elec_cost = round(kwh * elec_pay_price, 2) if elec_pay_price else 0
            b_op = round(op_expense * cabs / total_brand_cabinets, 2)

            b_income = round(b_elec_income + b_rent_income, 2)
            b_cost = round(b_venue_cost + b_elec_cost + b_op, 2)
            brand_map[bid] = {
                "brandId": bid,
                "brandName": c.get("brand_name", ""),
                "elecIncome": b_elec_income,
                "rentIncome": b_rent_income,
                "income": b_income,
                "venueCost": b_venue_cost,
                "elecCost": b_elec_cost,
                "opExpense": b_op,
                "cost": b_cost,
                "profit": round(b_income - b_cost, 2),
            }

        # 7. 计算商务分红
        biz_dividends = self._calc_business_dividends(station_id, income, cost, period, brand_map)

        # 8. 如果商务分红计入成本，更新总成本
        biz_cost = sum(d["amount"] for d in biz_dividends if d.get("countAsCost"))
        cost["bizDividendCost"] = round(biz_cost, 2)
        cost["totalCost"] = round(
            cost["elecCost"] + cost["rentCost"] + cost["opExpense"] + biz_cost, 2
        )

        # 9. 计算净利润
        profit = round(income["totalIncome"] - cost["totalCost"], 2)

        # 10. 计算股东分红
        shareholder_dividends = self._calc_shareholder_dividends(station_id, income, profit, period, brand_map)

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
            "brandBreakdown": list(brand_map.values()),
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
                    SELECT m.meter_no, m.meter_name, m.brand_id, b.name as brand_name
                    FROM meters m
                    LEFT JOIN brands b ON m.brand_id = b.id
                    WHERE m.landlord_id = %s
                    ORDER BY m.id
                """, (landlord_id,))
            elif station_id:
                cur.execute("""
                    SELECT m.meter_no, m.meter_name, m.brand_id, b.name as brand_name
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
                        "brand_id": m.get("brand_id"),
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

    def _calc_business_dividends(self, station_id: int, income: dict, cost: dict, period: str = None, brand_map: dict = None) -> list:
        """计算商务分红（支持按品牌：配置带 brand_id 时用该品牌的收入/利润作基数）"""
        configs = dividend_repo.list_introducer_configs(station_id=station_id)
        if period:
            configs = self._filter_configs_by_period(configs, period)
        total_income = income["totalIncome"]
        base_cost = cost["elecCost"] + cost["rentCost"] + cost["opExpense"]
        base_profit = total_income - base_cost

        results = []
        for cfg in configs:
            brand_id = cfg.get("brand_id")
            brand = brand_map.get(brand_id) if brand_id and brand_map else None

            mode = cfg.get("mode")
            ratio = float(cfg.get("ratio") or 0)
            fixed_amount = float(cfg.get("fixed_amount") or 0)
            settlement_period = cfg.get("settlement_period", "月")

            # 分红基数：指定品牌用该品牌口径，否则用整站口径
            if brand:
                base_income = brand["income"]
                base_profit_brand = brand["profit"]
            else:
                base_income = total_income
                base_profit_brand = base_profit

            # 根据分红周期调整金额
            period_multiplier = self._get_period_multiplier(settlement_period, period)

            if mode == "收入分红":
                amount = round(base_income * ratio * period_multiplier, 2)
                base_amount = base_income
            elif mode == "利润分红":
                amount = round(base_profit_brand * ratio * period_multiplier, 2)
                base_amount = base_profit_brand
            elif mode == "固定金额":
                amount = round(fixed_amount * period_multiplier, 2)
                base_amount = None
            else:
                amount = 0
                base_amount = None

            results.append({
                "introducerId": cfg.get("introducer_id"),
                "introducerName": cfg.get("introducer_name"),
                "brandId": brand_id,
                "brandName": brand["brandName"] if brand else None,
                "mode": mode,
                "ratio": ratio,
                "fixedAmount": fixed_amount if mode == "固定金额" else None,
                "countAsCost": cfg.get("count_as_cost", False),
                "baseAmount": base_amount,
                "amount": amount,
                "settlementPeriod": settlement_period,
            })

        return results

    def _calc_shareholder_dividends(self, station_id: int, income: dict, profit: float, period: str = None, brand_map: dict = None) -> list:
        """计算股东分红（支持按品牌：配置带 brand_id 时用该品牌的收入/利润作基数）"""
        configs = dividend_repo.list_shareholder_configs(station_id=station_id)
        if period:
            configs = self._filter_configs_by_period(configs, period)
        total_income = income["totalIncome"]

        results = []
        for cfg in configs:
            brand_id = cfg.get("brand_id")
            brand = brand_map.get(brand_id) if brand_id and brand_map else None

            mode = cfg.get("mode")
            ratio = float(cfg.get("ratio") or 0)
            fixed_amount = float(cfg.get("fixed_amount") or 0)
            settlement_period = cfg.get("settlement_period", "月")

            # 分红基数：指定品牌用该品牌口径，否则用整站口径
            if brand:
                base_income = brand["income"]
                profit_base = brand["profit"]
            else:
                base_income = total_income
                profit_base = profit

            # 根据分红周期调整金额
            period_multiplier = self._get_period_multiplier(settlement_period, period)

            if mode == "收入分红":
                amount = round(base_income * ratio * period_multiplier, 2)
                base_amount = base_income
            elif mode == "利润分红":
                amount = round(profit_base * ratio * period_multiplier, 2)
                base_amount = profit_base
            elif mode == "固定金额":
                amount = round(fixed_amount * period_multiplier, 2)
                base_amount = None
            else:
                amount = 0
                base_amount = None

            results.append({
                "shareholderId": cfg.get("shareholder_id"),
                "shareholderName": cfg.get("shareholder_name"),
                "brandId": brand_id,
                "brandName": brand["brandName"] if brand else None,
                "mode": mode,
                "ratio": ratio,
                "fixedAmount": fixed_amount if mode == "固定金额" else None,
                "baseAmount": base_amount,
                "amount": amount,
                "settlementPeriod": settlement_period,
            })

        return results

    def _get_period_multiplier(self, settlement_period: str, current_period: str) -> int:
        """根据分红周期计算倍数
        月分红：1
        季度分红：3（每3个月分红一次）
        半年分红：6（每6个月分红一次）
        年分红：12（每12个月分红一次）
        """
        if settlement_period == "月":
            return 1
        elif settlement_period == "季度":
            # 判断当前月份是否是季度末（3, 6, 9, 12月）
            if "-" in current_period:
                _, month = map(int, current_period.split("-"))
            else:
                month = int(current_period[4:])
            if month in [3, 6, 9, 12]:
                return 3
            else:
                return 0  # 非季度末不分红
        elif settlement_period == "半年":
            # 判断当前月份是否是半年末（6, 12月）
            if "-" in current_period:
                _, month = map(int, current_period.split("-"))
            else:
                month = int(current_period[4:])
            if month in [6, 12]:
                return 6
            else:
                return 0  # 非半年末不分红
        elif settlement_period == "年":
            # 判断当前月份是否是年末（12月）
            if "-" in current_period:
                _, month = map(int, current_period.split("-"))
            else:
                month = int(current_period[4:])
            if month == 12:
                return 12
            else:
                return 0  # 非年末不分红
        else:
            return 1

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
