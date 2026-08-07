from ..infra.database import get_connection, get_dict_cursor


def list_stations(landlord_id: int = None, keyword: str = None, page: int = None, page_size: int = None):
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

        # 查询总数
        cur.execute(f"SELECT COUNT(*) as total FROM stations s {where}", values)
        total = cur.fetchone()["total"]

        # 分页查询
        pagination = ""
        if page and page_size:
            offset = (page - 1) * page_size
            pagination = f"LIMIT {page_size} OFFSET {offset}"

        cur.execute(f"""
            SELECT s.*, l.name as landlord_name,
                   (SELECT COUNT(*) FROM meters m WHERE m.station_id = s.id) as meter_count
            FROM stations s
            LEFT JOIN landlords l ON s.landlord_id = l.id
            {where}
            ORDER BY s.id
            {pagination}
        """, values)
        items = cur.fetchall()

        # 如果有分页参数，返回分页格式
        if page and page_size:
            return {
                "items": items,
                "total": total,
                "page": page,
                "pageSize": page_size,
                "totalPages": (total + page_size - 1) // page_size
            }
        # 无分页参数时返回原格式（兼容旧接口）
        return items
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
            INSERT INTO stations (name, code, region, address, landlord_id, company_share, status, latitude, longitude, remark)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (
            data.get("name"), data.get("code"), data.get("region"),
            data.get("address"), data.get("landlordId"),
            data.get("companyShare"), data.get("status", "运营中"),
            data.get("latitude"), data.get("longitude"),
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
            "companyShare": "company_share", "status": "status",
            "latitude": "latitude", "longitude": "longitude",
            "remark": "remark"
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


def get_station_locations(status: str = None):
    """获取所有站点的位置信息（用于小程序地图标注）"""
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        conditions = ["latitude IS NOT NULL", "longitude IS NOT NULL"]
        values = []
        if status:
            conditions.append("status = %s")
            values.append(status)
        where = f"WHERE {' AND '.join(conditions)}"

        cur.execute(f"""
            SELECT id, name, code, region, address, status, latitude, longitude
            FROM stations
            {where}
            ORDER BY id
        """, values)
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()
