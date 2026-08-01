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
            SELECT c.*, b.name as brand_name, l.name as landlord_name, s.name as station_name_ref
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
            end = r.get("end_date")
            if end:
                days_left = (end - today).days
                r["days_left"] = days_left
                r["status"] = "已到期" if days_left < 0 else "临期" if days_left <= 90 else "正常"
            else:
                r["days_left"] = None
                r["status"] = "未知"
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
             tax_enabled, tax_rate, post_tax_electricity_price, remark)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
