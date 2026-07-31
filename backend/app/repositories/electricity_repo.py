from ..infra.database import get_connection, get_dict_cursor


def list_records(station_id: int = None, period: str = None):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        conditions, values = [], []
        if station_id:
            conditions.append("e.station_id = %s"); values.append(station_id)
        if period:
            conditions.append("e.period = %s"); values.append(period)
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        cur.execute(f"""
            SELECT e.*, s.name as station_name, l.name as landlord_name
            FROM electricity_records e
            LEFT JOIN stations s ON e.station_id = s.id
            LEFT JOIN landlords l ON s.landlord_id = l.id
            {where}
            ORDER BY e.period DESC, s.id
        """, values)
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()


def get_record(record_id: int):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("""
            SELECT e.*, s.name as station_name, l.name as landlord_name
            FROM electricity_records e
            LEFT JOIN stations s ON e.station_id = s.id
            LEFT JOIN landlords l ON s.landlord_id = l.id
            WHERE e.id = %s
        """, (record_id,))
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def get_record_by_station_period(station_id: int, period: str):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute(
            "SELECT * FROM electricity_records WHERE station_id = %s AND period = %s",
            (station_id, period)
        )
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def get_meter_details(electricity_id: int):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("""
            SELECT d.*, m.meter_no, m.meter_name, b.name as brand_name
            FROM electricity_meter_details d
            LEFT JOIN meters m ON d.meter_id = m.id
            LEFT JOIN brands b ON m.brand_id = b.id
            WHERE d.electricity_id = %s
        """, (electricity_id,))
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()


def create_record(data: dict):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("""
            INSERT INTO electricity_records
            (station_id, period, pay_start_date, pay_start_reading, pay_end_date, pay_end_reading,
             pay_kwh, pay_unit_price, pay_amount, pay_status,
             collect_start_date, collect_start_reading, collect_end_date, collect_end_reading,
             collect_kwh, collect_unit_price, collect_amount, tax_rate, collect_net, collect_status,
             profit, remark)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (
            data.get("stationId"), data.get("period"),
            data.get("payStartDate"), data.get("payStartReading"),
            data.get("payEndDate"), data.get("payEndReading"),
            data.get("payKwh"), data.get("payUnitPrice"), data.get("payAmount"),
            data.get("payStatus", "未付款"),
            data.get("collectStartDate"), data.get("collectStartReading"),
            data.get("collectEndDate"), data.get("collectEndReading"),
            data.get("collectKwh"), data.get("collectUnitPrice"), data.get("collectAmount"),
            data.get("taxRate"), data.get("collectNet"),
            data.get("collectStatus", "未到账"),
            data.get("profit"), data.get("remark")
        ))
        record = cur.fetchone()
        conn.commit()
        return record
    finally:
        cur.close()
        conn.close()


def update_record(record_id: int, data: dict):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        field_map = {
            "stationId": "station_id", "period": "period",
            "payStartDate": "pay_start_date", "payStartReading": "pay_start_reading",
            "payEndDate": "pay_end_date", "payEndReading": "pay_end_reading",
            "payKwh": "pay_kwh", "payUnitPrice": "pay_unit_price",
            "payAmount": "pay_amount", "payStatus": "pay_status",
            "collectStartDate": "collect_start_date", "collectStartReading": "collect_start_reading",
            "collectEndDate": "collect_end_date", "collectEndReading": "collect_end_reading",
            "collectKwh": "collect_kwh", "collectUnitPrice": "collect_unit_price",
            "collectAmount": "collect_amount", "taxRate": "tax_rate",
            "collectNet": "collect_net", "collectStatus": "collect_status",
            "profit": "profit", "remark": "remark"
        }
        updates, values = [], []
        for key, db_field in field_map.items():
            if key in data and data[key] is not None:
                updates.append(f"{db_field} = %s")
                values.append(data[key])
        if not updates:
            return None
        values.append(record_id)
        cur.execute(f"UPDATE electricity_records SET {', '.join(updates)}, updated_at = NOW() WHERE id = %s RETURNING *", values)
        conn.commit()
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def delete_record(record_id: int):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM electricity_meter_details WHERE electricity_id = %s", (record_id,))
        cur.execute("DELETE FROM electricity_records WHERE id = %s", (record_id,))
        conn.commit()
        return True
    finally:
        cur.close()
        conn.close()


def create_meter_detail(electricity_id: int, meter_id: int, data: dict):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("""
            INSERT INTO electricity_meter_details
            (electricity_id, meter_id, start_reading, end_reading, kwh,
             pay_unit_price, pay_amount, collect_unit_price, collect_amount, collect_net)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (
            electricity_id, meter_id,
            data.get("startReading"), data.get("endReading"), data.get("kwh"),
            data.get("payUnitPrice"), data.get("payAmount"),
            data.get("collectUnitPrice"), data.get("collectAmount"), data.get("collectNet")
        ))
        conn.commit()
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def delete_meter_details(electricity_id: int):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM electricity_meter_details WHERE electricity_id = %s", (electricity_id,))
        conn.commit()
    finally:
        cur.close()
        conn.close()


def list_periods():
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("SELECT DISTINCT period FROM electricity_records ORDER BY period DESC")
        return [r["period"] for r in cur.fetchall()]
    finally:
        cur.close()
        conn.close()
