from ..infra.database import get_connection, get_dict_cursor


def list_meters(station_id: int = None, brand_id: int = None, landlord_id: int = None):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        conditions, values = [], []
        if station_id:
            conditions.append("m.station_id = %s"); values.append(station_id)
        if brand_id:
            conditions.append("m.brand_id = %s"); values.append(brand_id)
        if landlord_id:
            conditions.append("m.landlord_id = %s"); values.append(landlord_id)
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        cur.execute(f"""
            SELECT m.*, s.name as station_name, b.name as brand_name, l.name as landlord_name,
                   e.name as entity_name
            FROM meters m
            LEFT JOIN stations s ON m.station_id = s.id
            LEFT JOIN brands b ON m.brand_id = b.id
            LEFT JOIN landlords l ON m.landlord_id = l.id
            LEFT JOIN entities e ON m.entity_id = e.id
            {where}
            ORDER BY m.landlord_id, m.id
        """, values)
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()


def get_meter(meter_id: int):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("""
            SELECT m.*, s.name as station_name, b.name as brand_name, l.name as landlord_name,
                   e.name as entity_name
            FROM meters m
            LEFT JOIN stations s ON m.station_id = s.id
            LEFT JOIN brands b ON m.brand_id = b.id
            LEFT JOIN landlords l ON m.landlord_id = l.id
            LEFT JOIN entities e ON m.entity_id = e.id
            WHERE m.id = %s
        """, (meter_id,))
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def get_meter_by_no(meter_no: str):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("SELECT * FROM meters WHERE meter_no = %s", (meter_no,))
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def create_meter(data: dict):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("""
            INSERT INTO meters (station_id, brand_id, landlord_id, entity_id, meter_no, meter_name, collector_id, transformer_ratio, remark)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (
            data.get("stationId"), data.get("brandId"), data.get("landlordId"),
            data.get("entityId"),
            data.get("meterNo"), data.get("meterName"), data.get("collectorId"),
            data.get("transformerRatio", 1), data.get("remark")
        ))
        conn.commit()
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def update_meter(meter_id: int, data: dict):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        field_map = {
            "stationId": "station_id", "brandId": "brand_id", "landlordId": "landlord_id",
            "entityId": "entity_id",
            "meterNo": "meter_no", "meterName": "meter_name",
            "collectorId": "collector_id", "transformerRatio": "transformer_ratio",
            "status": "status", "remark": "remark"
        }
        updates, values = [], []
        for key, db_field in field_map.items():
            if key in data and data[key] is not None:
                updates.append(f"{db_field} = %s")
                values.append(data[key])
        if not updates:
            return None
        values.append(meter_id)
        cur.execute(f"UPDATE meters SET {', '.join(updates)} WHERE id = %s RETURNING *", values)
        conn.commit()
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def delete_meter(meter_id: int):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM electricity_meter_details WHERE meter_id = %s", (meter_id,))
        cur.execute("DELETE FROM meters WHERE id = %s", (meter_id,))
        conn.commit()
        return True
    finally:
        cur.close()
        conn.close()


def list_station_meters(station_id: int):
    """获取站点下的所有电表（含品牌名）"""
    return list_meters(station_id=station_id)


def list_landlord_meters(landlord_id: int):
    """获取场地方下的所有电表（含品牌名）"""
    return list_meters(landlord_id=landlord_id)
