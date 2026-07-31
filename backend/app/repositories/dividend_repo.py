from ..infra.database import get_connection, get_dict_cursor


# ─── 分红配置 ───────────────────────────────────────────────

def list_shareholder_configs(station_id: int = None):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        conditions, values = [], []
        if station_id:
            conditions.append("c.station_id = %s"); values.append(station_id)
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        cur.execute(f"""
            SELECT c.*, sh.name as shareholder_name, s.name as station_name
            FROM station_shareholder_configs c
            LEFT JOIN shareholders sh ON c.shareholder_id = sh.id
            LEFT JOIN stations s ON c.station_id = s.id
            {where}
            ORDER BY c.id
        """, values)
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()


def save_shareholder_config(data: dict):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("""
            INSERT INTO station_shareholder_configs
            (station_id, shareholder_id, mode, ratio, fixed_amount, settlement_period, remark)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (station_id, shareholder_id)
            DO UPDATE SET mode = EXCLUDED.mode, ratio = EXCLUDED.ratio,
                          fixed_amount = EXCLUDED.fixed_amount,
                          settlement_period = EXCLUDED.settlement_period,
                          remark = EXCLUDED.remark
            RETURNING *
        """, (
            data.get("stationId"), data.get("shareholderId"),
            data.get("mode"), data.get("ratio"),
            data.get("fixedAmount"), data.get("settlementPeriod", "月"),
            data.get("remark")
        ))
        conn.commit()
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def delete_shareholder_config(config_id: int):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM station_shareholder_configs WHERE id = %s", (config_id,))
        conn.commit()
        return True
    finally:
        cur.close()
        conn.close()


def list_introducer_configs(station_id: int = None):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        conditions, values = [], []
        if station_id:
            conditions.append("c.station_id = %s"); values.append(station_id)
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        cur.execute(f"""
            SELECT c.*, i.name as introducer_name, s.name as station_name
            FROM station_introducer_configs c
            LEFT JOIN introducers i ON c.introducer_id = i.id
            LEFT JOIN stations s ON c.station_id = s.id
            {where}
            ORDER BY c.id
        """, values)
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()


def save_introducer_config(data: dict):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("""
            INSERT INTO station_introducer_configs
            (station_id, introducer_id, mode, ratio, fixed_amount, settlement_period, count_as_cost, remark)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (station_id, introducer_id)
            DO UPDATE SET mode = EXCLUDED.mode, ratio = EXCLUDED.ratio,
                          fixed_amount = EXCLUDED.fixed_amount,
                          settlement_period = EXCLUDED.settlement_period,
                          count_as_cost = EXCLUDED.count_as_cost,
                          remark = EXCLUDED.remark
            RETURNING *
        """, (
            data.get("stationId"), data.get("introducerId"),
            data.get("mode"), data.get("ratio"),
            data.get("fixedAmount"), data.get("settlementPeriod", "月"),
            data.get("countAsCost", False), data.get("remark")
        ))
        conn.commit()
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def delete_introducer_config(config_id: int):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM station_introducer_configs WHERE id = %s", (config_id,))
        conn.commit()
        return True
    finally:
        cur.close()
        conn.close()


# ─── 分红记录 ───────────────────────────────────────────────

def list_records(station_id: int = None, period: str = None, type_: str = None, status: str = None):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        conditions, values = [], []
        if station_id:
            conditions.append("d.station_id = %s"); values.append(station_id)
        if period:
            conditions.append("d.period = %s"); values.append(period)
        if type_:
            conditions.append("d.type = %s"); values.append(type_)
        if status:
            conditions.append("d.status = %s"); values.append(status)
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        cur.execute(f"""
            SELECT d.*, s.name as station_name
            FROM dividend_records d
            LEFT JOIN stations s ON d.station_id = s.id
            {where}
            ORDER BY d.period DESC, d.station_id
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
            SELECT d.*, s.name as station_name
            FROM dividend_records d
            LEFT JOIN stations s ON d.station_id = s.id
            WHERE d.id = %s
        """, (record_id,))
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def get_shares(dividend_id: int):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("""
            SELECT ds.*, sh.name as shareholder_name, i.name as introducer_name
            FROM dividend_shares ds
            LEFT JOIN shareholders sh ON ds.shareholder_id = sh.id
            LEFT JOIN introducers i ON ds.introducer_id = i.id
            WHERE ds.dividend_id = %s
        """, (dividend_id,))
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()


def create_record(data: dict):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("""
            INSERT INTO dividend_records
            (station_id, period, type, elec_income, rent_income, total_income,
             elec_cost, rent_cost, op_expense, biz_dividend_cost, total_cost,
             profit, status, settlement_date, remark)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (
            data.get("stationId"), data.get("period"), data.get("type"),
            data.get("elecIncome"), data.get("rentIncome"), data.get("totalIncome"),
            data.get("elecCost"), data.get("rentCost"), data.get("opExpense"),
            data.get("bizDividendCost"), data.get("totalCost"),
            data.get("profit"), data.get("status", "未结算"),
            data.get("settlementDate"), data.get("remark")
        ))
        record = cur.fetchone()
        conn.commit()
        return record
    finally:
        cur.close()
        conn.close()


def create_share(dividend_id: int, data: dict):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("""
            INSERT INTO dividend_shares
            (dividend_id, introducer_id, shareholder_id, mode, ratio, fixed_amount, amount, remark)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (
            dividend_id,
            data.get("introducerId"), data.get("shareholderId"),
            data.get("mode"), data.get("ratio"),
            data.get("fixedAmount"), data.get("amount"), data.get("remark")
        ))
        conn.commit()
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def update_status(record_id: int, status: str):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE dividend_records SET status = %s, updated_at = NOW() WHERE id = %s",
            (status, record_id)
        )
        conn.commit()
        return True
    finally:
        cur.close()
        conn.close()


def delete_record(record_id: int):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM dividend_shares WHERE dividend_id = %s", (record_id,))
        cur.execute("DELETE FROM dividend_records WHERE id = %s", (record_id,))
        conn.commit()
        return True
    finally:
        cur.close()
        conn.close()


def get_shareholder_summary(shareholder_id: int = None, period: str = None):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        conditions = ["ds.shareholder_id IS NOT NULL"]
        values = []
        if shareholder_id:
            conditions.append("ds.shareholder_id = %s"); values.append(shareholder_id)
        if period:
            conditions.append("d.period = %s"); values.append(period)
        where = f"WHERE {' AND '.join(conditions)}"
        cur.execute(f"""
            SELECT ds.shareholder_id, sh.name as shareholder_name, d.period,
                   d.station_id, s.name as station_name, d.type, d.status, d.settlement_date,
                   ds.mode, ds.ratio, ds.fixed_amount, ds.amount
            FROM dividend_shares ds
            JOIN dividend_records d ON ds.dividend_id = d.id
            LEFT JOIN shareholders sh ON ds.shareholder_id = sh.id
            LEFT JOIN stations s ON d.station_id = s.id
            {where}
            ORDER BY d.period DESC, d.station_id
        """, values)
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()


def get_introducer_summary(introducer_id: int = None, period: str = None):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        conditions = ["ds.introducer_id IS NOT NULL"]
        values = []
        if introducer_id:
            conditions.append("ds.introducer_id = %s"); values.append(introducer_id)
        if period:
            conditions.append("d.period = %s"); values.append(period)
        where = f"WHERE {' AND '.join(conditions)}"
        cur.execute(f"""
            SELECT ds.introducer_id, i.name as introducer_name, d.period,
                   d.station_id, s.name as station_name, d.type, d.status,
                   ds.mode, ds.ratio, ds.fixed_amount, ds.amount
            FROM dividend_shares ds
            JOIN dividend_records d ON ds.dividend_id = d.id
            LEFT JOIN introducers i ON ds.introducer_id = i.id
            LEFT JOIN stations s ON d.station_id = s.id
            {where}
            ORDER BY d.period DESC, d.station_id
        """, values)
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()
