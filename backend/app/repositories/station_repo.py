from ..infra.database import get_connection, get_dict_cursor


def list_stations(landlord_id: int = None, keyword: str = None):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        conditions, values = [], []
        if landlord_id:
            conditions.append("s.landlord_id = %s"); values.append(landlord_id)
        if keyword:
            conditions.append("(s.name ILIKE %s OR s.code ILIKE %s)")
            values.extend([f"%{keyword}%", f"%{keyword}%"])
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        cur.execute(f"""
            SELECT s.*, l.name as landlord_name,
                   (SELECT COUNT(*) FROM meters m WHERE m.station_id = s.id) as meter_count
            FROM stations s
            LEFT JOIN landlords l ON s.landlord_id = l.id
            {where}
            ORDER BY s.id
        """, values)
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()


def get_station(station_id: int):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("""
            SELECT s.*, l.name as landlord_name
            FROM stations s
            LEFT JOIN landlords l ON s.landlord_id = l.id
            WHERE s.id = %s
        """, (station_id,))
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def create_station(data: dict):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("""
            INSERT INTO stations (name, code, region, address, landlord_id, company_share, status, remark)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (
            data.get("name"), data.get("code"), data.get("region"),
            data.get("address"), data.get("landlordId"),
            data.get("companyShare"), data.get("status", "运营中"),
            data.get("remark")
        ))
        conn.commit()
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def update_station(station_id: int, data: dict):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        field_map = {
            "name": "name", "code": "code", "region": "region",
            "address": "address", "landlordId": "landlord_id",
            "companyShare": "company_share", "status": "status", "remark": "remark"
        }
        updates, values = [], []
        for key, db_field in field_map.items():
            if key in data and data[key] is not None:
                updates.append(f"{db_field} = %s")
                values.append(data[key])
        if not updates:
            return None
        values.append(station_id)
        cur.execute(f"UPDATE stations SET {', '.join(updates)} WHERE id = %s RETURNING *", values)
        conn.commit()
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def delete_station(station_id: int):
    conn = get_connection()
    cur = conn.cursor()
    try:
        # 删除关联数据
        cur.execute("DELETE FROM electricity_meter_details WHERE electricity_id IN (SELECT id FROM electricity_records WHERE station_id = %s)", (station_id,))
        cur.execute("DELETE FROM electricity_records WHERE station_id = %s", (station_id,))
        cur.execute("DELETE FROM operating_expenses WHERE station_id = %s", (station_id,))
        cur.execute("DELETE FROM rent_receipts WHERE rent_income_id IN (SELECT id FROM rent_incomes WHERE station_id = %s)", (station_id,))
        cur.execute("DELETE FROM rent_incomes WHERE station_id = %s", (station_id,))
        cur.execute("DELETE FROM rent_leases WHERE station_id = %s", (station_id,))
        cur.execute("DELETE FROM station_shareholder_configs WHERE station_id = %s", (station_id,))
        cur.execute("DELETE FROM station_introducer_configs WHERE station_id = %s", (station_id,))
        cur.execute("DELETE FROM dividend_shares WHERE dividend_id IN (SELECT id FROM dividend_records WHERE station_id = %s)", (station_id,))
        cur.execute("DELETE FROM dividend_records WHERE station_id = %s", (station_id,))
        cur.execute("DELETE FROM meters WHERE station_id = %s", (station_id,))
        cur.execute("DELETE FROM stations WHERE id = %s", (station_id,))
        conn.commit()
        return True
    finally:
        cur.close()
        conn.close()
