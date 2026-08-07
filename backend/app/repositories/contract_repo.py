from datetime import date
from ..infra.database import get_connection, get_dict_cursor


def list_contracts(brand_id: int = None, landlord_id: int = None, station_id: int = None, contract_type: str = None, keyword: str = None):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        conditions, values = [], []
        if brand_id:
            conditions.append("c.brand_id = %s"); values.append(brand_id)
        if landlord_id:
            conditions.append("c.landlord_id = %s"); values.append(landlord_id)
        if station_id:
            conditions.append("c.station_id = %s"); values.append(station_id)
        if contract_type:
            conditions.append("c.contract_type = %s"); values.append(contract_type)
        if keyword:
            conditions.append("(c.station_name ILIKE %s OR c.partner ILIKE %s)")
            values.extend([f"%{keyword}%", f"%{keyword}%"])
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        cur.execute(f"""
            SELECT c.*, b.name as brand_name, l.name as landlord_name, s.name as station_name_ref,
              (
                SELECT COUNT(*) FROM cabinets cab
                INNER JOIN meters m ON cab.meter_id = m.id
                WHERE m.landlord_id = c.landlord_id AND m.brand_id = c.brand_id
              ) AS live_cabinets_count,
              (
                SELECT v.monthly_rent FROM contracts v
                WHERE v.landlord_id = c.landlord_id AND v.contract_type = '场地合同'
                LIMIT 1
              ) AS venue_monthly_rent,
              (
                SELECT COALESCE(SUM(
                  (SELECT COUNT(*) FROM cabinets cab
                   INNER JOIN meters m ON cab.meter_id = m.id
                   WHERE m.landlord_id = c2.landlord_id AND m.brand_id = c2.brand_id)
                ), 0)
                FROM contracts c2
                WHERE c2.landlord_id = c.landlord_id AND c2.contract_type = '品牌方合同'
              ) AS total_brand_cabinets
            FROM contracts c
            LEFT JOIN brands b ON c.brand_id = b.id
            LEFT JOIN landlords l ON c.landlord_id = l.id
            LEFT JOIN stations s ON c.station_id = s.id
            {where}
            ORDER BY c.station_id, c.contract_type, c.id
        """, values)
        rows = cur.fetchall()

        today = date.today()
        for r in rows:
            # 优先使用 early_end_date，否则使用 end_date
            early_end = r.get("early_end_date")
            end = early_end or r.get("end_date")
            if end:
                days_left = (end - today).days
                r["days_left"] = days_left
                if early_end and days_left < 0:
                    r["status"] = "提前结束"
                elif days_left < 0:
                    r["status"] = "已到期"
                elif days_left <= 90:
                    r["status"] = "临期"
                else:
                    r["status"] = "正常"
            else:
                r["days_left"] = None
                r["status"] = "未知"
            # 计算品牌方合同承担的场地成本
            venue_rent = r.get("venue_monthly_rent")
            total_cabs = int(r.get("total_brand_cabinets") or 0)
            live_cabs = int(r.get("live_cabinets_count") or 0)
            if r.get("contract_type") == "品牌方合同" and venue_rent and total_cabs > 0:
                r["venue_cost"] = round(float(venue_rent) / total_cabs * live_cabs, 2)
            else:
                r["venue_cost"] = None
        return rows
    finally:
        cur.close()
        conn.close()


def create_contract(data: dict):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("""
            INSERT INTO contracts
            (station_id, station_name, landlord_id, brand_id, contract_type,
             electricity_price, rent_amount, cabinets_count, unit_monthly_rent, monthly_rent,
             rent_calc_method, pay_method, address, partner, pay_entity, start_date, end_date, pay_status,
             tax_enabled, tax_rate, post_tax_electricity_price, deposit, first_month_rent, rent_refund, early_end_date,
             rent_tax_enabled, rent_tax_rate, post_tax_rent_price, remark)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (
            data.get("stationId"), data.get("stationName"),
            data.get("landlordId"), data.get("brandId"),
            data.get("contractType", "场地合同"),
            data.get("electricityPrice"), data.get("rentAmount"),
            data.get("cabinetsCount"), data.get("unitMonthlyRent"), data.get("monthlyRent"),
            data.get("rentCalcMethod", "按柜子数量"),
            data.get("payMethod"), data.get("address"),
            data.get("partner"), data.get("payEntity"),
            data.get("startDate"), data.get("endDate"),
            data.get("payStatus", "未付款"),
            data.get("taxEnabled", False), data.get("taxRate", 0.01), data.get("postTaxElectricityPrice"),
            data.get("deposit"),
            data.get("firstMonthRent"),
            data.get("rentRefund"),
            data.get("earlyEndDate"),
            data.get("rentTaxEnabled", False),
            data.get("rentTaxRate", 0.01),
            data.get("postTaxRentPrice"),
            data.get("remark")
        ))
        conn.commit()
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def update_contract(contract_id: int, data: dict):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        field_map = {
            "stationId": "station_id", "stationName": "station_name",
            "landlordId": "landlord_id", "brandId": "brand_id",
            "contractType": "contract_type",
            "electricityPrice": "electricity_price", "rentAmount": "rent_amount",
            "cabinetsCount": "cabinets_count", "unitMonthlyRent": "unit_monthly_rent",
            "monthlyRent": "monthly_rent", "rentCalcMethod": "rent_calc_method",
            "payMethod": "pay_method",
            "address": "address", "partner": "partner", "payEntity": "pay_entity",
            "startDate": "start_date", "endDate": "end_date",
            "payStatus": "pay_status",
            "taxEnabled": "tax_enabled", "taxRate": "tax_rate",
            "postTaxElectricityPrice": "post_tax_electricity_price",
            "deposit": "deposit",
            "firstMonthRent": "first_month_rent",
            "rentRefund": "rent_refund",
            "earlyEndDate": "early_end_date",
            "rentTaxEnabled": "rent_tax_enabled",
            "rentTaxRate": "rent_tax_rate",
            "postTaxRentPrice": "post_tax_rent_price",
            "remark": "remark"
        }
        updates, values = [], []
        for key, db_field in field_map.items():
            if key in data and data[key] is not None:
                updates.append(f"{db_field} = %s"); values.append(data[key])
        if not updates:
            return None
        values.append(contract_id)
        cur.execute(f"UPDATE contracts SET {', '.join(updates)} WHERE id = %s RETURNING *", values)
        conn.commit()
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def delete_contract(contract_id: int):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM contracts WHERE id = %s", (contract_id,))
        conn.commit()
        return True
    finally:
        cur.close()
        conn.close()
