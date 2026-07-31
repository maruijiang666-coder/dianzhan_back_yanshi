from ..infra.database import get_connection, get_dict_cursor


# ─── 场租付款合同 ───────────────────────────────────────────

def list_leases(station_id: int = None):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        conditions, values = [], []
        if station_id:
            conditions.append("l.station_id = %s"); values.append(station_id)
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        cur.execute(f"""
            SELECT l.*, s.name as station_name
            FROM rent_leases l
            LEFT JOIN stations s ON l.station_id = s.id
            {where}
            ORDER BY l.id
        """, values)
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()


def create_lease(data: dict):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("""
            INSERT INTO rent_leases
            (station_id, contract_start, contract_end, annual_rent, pay_method,
             pay_amount, deposit, pay_deadline, pay_status, invoice_type, remark)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (
            data.get("stationId"), data.get("contractStart"), data.get("contractEnd"),
            data.get("annualRent"), data.get("payMethod"), data.get("payAmount"),
            data.get("deposit"), data.get("payDeadline"),
            data.get("payStatus", "未付款"), data.get("invoiceType"), data.get("remark")
        ))
        conn.commit()
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def update_lease(lease_id: int, data: dict):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        field_map = {
            "stationId": "station_id", "contractStart": "contract_start",
            "contractEnd": "contract_end", "annualRent": "annual_rent",
            "payMethod": "pay_method", "payAmount": "pay_amount",
            "deposit": "deposit", "payDeadline": "pay_deadline",
            "payStatus": "pay_status", "invoiceType": "invoice_type", "remark": "remark"
        }
        updates, values = [], []
        for key, db_field in field_map.items():
            if key in data and data[key] is not None:
                updates.append(f"{db_field} = %s"); values.append(data[key])
        if not updates:
            return None
        values.append(lease_id)
        cur.execute(f"UPDATE rent_leases SET {', '.join(updates)} WHERE id = %s RETURNING *", values)
        conn.commit()
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def delete_lease(lease_id: int):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM rent_leases WHERE id = %s", (lease_id,))
        conn.commit()
        return True
    finally:
        cur.close()
        conn.close()


# ─── 场租收款合同 ───────────────────────────────────────────

def list_incomes(station_id: int = None, brand_id: int = None):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        conditions, values = [], []
        if station_id:
            conditions.append("i.station_id = %s"); values.append(station_id)
        if brand_id:
            conditions.append("i.brand_id = %s"); values.append(brand_id)
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        cur.execute(f"""
            SELECT i.*, s.name as station_name, b.name as brand_name
            FROM rent_incomes i
            LEFT JOIN stations s ON i.station_id = s.id
            LEFT JOIN brands b ON i.brand_id = b.id
            {where}
            ORDER BY i.id
        """, values)
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()


def create_income(data: dict):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        # 计算利润
        annual_income_net = data.get("annualIncomeNet") or data.get("annualIncome")
        input_cost = data.get("inputCost") or 0
        profit = round(float(annual_income_net or 0) - float(input_cost), 2)

        cur.execute("""
            INSERT INTO rent_incomes
            (station_id, brand_id, contract_start, contract_end, unit_monthly_rent,
             cabinets_count, monthly_rent, annual_income, tax_rate, annual_income_net,
             input_cost, profit, sign_status, remark)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (
            data.get("stationId"), data.get("brandId"),
            data.get("contractStart"), data.get("contractEnd"),
            data.get("unitMonthlyRent"), data.get("cabinetsCount"),
            data.get("monthlyRent"), data.get("annualIncome"),
            data.get("taxRate"), annual_income_net,
            input_cost, profit,
            data.get("signStatus"), data.get("remark")
        ))
        conn.commit()
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def update_income(income_id: int, data: dict):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        field_map = {
            "stationId": "station_id", "brandId": "brand_id",
            "contractStart": "contract_start", "contractEnd": "contract_end",
            "unitMonthlyRent": "unit_monthly_rent", "cabinetsCount": "cabinets_count",
            "monthlyRent": "monthly_rent", "annualIncome": "annual_income",
            "taxRate": "tax_rate", "annualIncomeNet": "annual_income_net",
            "inputCost": "input_cost", "signStatus": "sign_status", "remark": "remark"
        }
        updates, values = [], []
        for key, db_field in field_map.items():
            if key in data and data[key] is not None:
                updates.append(f"{db_field} = %s"); values.append(data[key])

        # 重新计算利润
        if "annualIncomeNet" in data or "annualIncome" in data or "inputCost" in data:
            cur.execute("SELECT annual_income_net, annual_income, input_cost FROM rent_incomes WHERE id = %s", (income_id,))
            old = cur.fetchone()
            net = float(data.get("annualIncomeNet", old.get("annual_income_net") or old.get("annual_income") or 0))
            cost = float(data.get("inputCost", old.get("input_cost") or 0))
            updates.append("profit = %s"); values.append(round(net - cost, 2))

        if not updates:
            return None
        values.append(income_id)
        cur.execute(f"UPDATE rent_incomes SET {', '.join(updates)} WHERE id = %s RETURNING *", values)
        conn.commit()
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def delete_income(income_id: int):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM rent_receipts WHERE rent_income_id = %s", (income_id,))
        cur.execute("DELETE FROM rent_incomes WHERE id = %s", (income_id,))
        conn.commit()
        return True
    finally:
        cur.close()
        conn.close()


# ─── 租金分期收款 ───────────────────────────────────────────

def list_receipts(rent_income_id: int = None):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        conditions, values = [], []
        if rent_income_id:
            conditions.append("r.rent_income_id = %s"); values.append(rent_income_id)
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        cur.execute(f"""
            SELECT r.*, i.station_id, s.name as station_name, b.name as brand_name
            FROM rent_receipts r
            LEFT JOIN rent_incomes i ON r.rent_income_id = i.id
            LEFT JOIN stations s ON i.station_id = s.id
            LEFT JOIN brands b ON i.brand_id = b.id
            {where}
            ORDER BY r.rent_income_id, r.seq
        """, values)
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()


def create_receipt(data: dict):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("""
            INSERT INTO rent_receipts (rent_income_id, seq, period_start, period_end, amount, status, remark)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (
            data.get("rentIncomeId"), data.get("seq"),
            data.get("periodStart"), data.get("periodEnd"),
            data.get("amount"), data.get("status", "未到账"), data.get("remark")
        ))
        conn.commit()
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def update_receipt(receipt_id: int, data: dict):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        field_map = {
            "rentIncomeId": "rent_income_id", "seq": "seq",
            "periodStart": "period_start", "periodEnd": "period_end",
            "amount": "amount", "status": "status", "remark": "remark"
        }
        updates, values = [], []
        for key, db_field in field_map.items():
            if key in data and data[key] is not None:
                updates.append(f"{db_field} = %s"); values.append(data[key])
        if not updates:
            return None
        values.append(receipt_id)
        cur.execute(f"UPDATE rent_receipts SET {', '.join(updates)} WHERE id = %s RETURNING *", values)
        conn.commit()
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def delete_receipt(receipt_id: int):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM rent_receipts WHERE id = %s", (receipt_id,))
        conn.commit()
        return True
    finally:
        cur.close()
        conn.close()


# ─── 运营费用 ───────────────────────────────────────────────

def list_expenses(station_id: int = None, period: str = None):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        conditions, values = [], []
        if station_id:
            conditions.append("o.station_id = %s"); values.append(station_id)
        if period:
            conditions.append("o.period = %s"); values.append(period)
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        cur.execute(f"""
            SELECT o.*, s.name as station_name
            FROM operating_expenses o
            LEFT JOIN stations s ON o.station_id = s.id
            {where}
            ORDER BY o.period DESC, o.station_id
        """, values)
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()


def get_expense(station_id: int, period: str):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute(
            "SELECT * FROM operating_expenses WHERE station_id = %s AND period = %s",
            (station_id, period)
        )
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def save_expense(station_id: int, period: str, amount: float, remark: str = None):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("""
            INSERT INTO operating_expenses (station_id, period, amount, remark)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (station_id, period)
            DO UPDATE SET amount = EXCLUDED.amount, remark = EXCLUDED.remark, updated_at = NOW()
            RETURNING *
        """, (station_id, period, amount, remark))
        conn.commit()
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def delete_expense(expense_id: int):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM operating_expenses WHERE id = %s", (expense_id,))
        conn.commit()
        return True
    finally:
        cur.close()
        conn.close()
