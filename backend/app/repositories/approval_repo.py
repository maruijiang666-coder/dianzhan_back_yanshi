import json
from datetime import datetime
from ..infra.database import get_connection, get_dict_cursor


def list_flows():
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("SELECT * FROM approval_flows ORDER BY id")
        rows = cur.fetchall()
        for r in rows:
            if isinstance(r.get("nodes"), str):
                r["nodes"] = json.loads(r["nodes"])
        return rows
    finally:
        cur.close()
        conn.close()


def save_flow(biz_type: str, nodes: list):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("""
            INSERT INTO approval_flows (biz_type, nodes)
            VALUES (%s, %s)
            ON CONFLICT (biz_type)
            DO UPDATE SET nodes = EXCLUDED.nodes, updated_at = NOW()
            RETURNING *
        """, (biz_type, json.dumps(nodes, ensure_ascii=False)))
        conn.commit()
        row = cur.fetchone()
        if row and isinstance(row.get("nodes"), str):
            row["nodes"] = json.loads(row["nodes"])
        return row
    finally:
        cur.close()
        conn.close()


def list_requests(biz_type: str = None, status: str = None, applicant: str = None):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        conditions, values = [], []
        if biz_type:
            conditions.append("ar.biz_type = %s"); values.append(biz_type)
        if status:
            conditions.append("ar.status = %s"); values.append(status)
        if applicant:
            conditions.append("ar.applicant = %s"); values.append(applicant)
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        cur.execute(f"""
            SELECT ar.*, dr.period as dividend_period, dr.station_id, s.name as station_name
            FROM approval_requests ar
            LEFT JOIN dividend_records dr ON ar.dividend_record_id = dr.id
            LEFT JOIN stations s ON dr.station_id = s.id
            {where}
            ORDER BY ar.created_at DESC
        """, values)
        rows = cur.fetchall()
        for r in rows:
            if isinstance(r.get("flow_nodes"), str):
                r["flow_nodes"] = json.loads(r["flow_nodes"])
        return rows
    finally:
        cur.close()
        conn.close()


def get_request(request_id: int):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("SELECT * FROM approval_requests WHERE id = %s", (request_id,))
        row = cur.fetchone()
        if row and isinstance(row.get("flow_nodes"), str):
            row["flow_nodes"] = json.loads(row["flow_nodes"])
        return row
    finally:
        cur.close()
        conn.close()


def get_records(request_id: int):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute(
            "SELECT * FROM approval_records WHERE request_id = %s ORDER BY created_at",
            (request_id,)
        )
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()


def create_request(data: dict):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        # 如果传入了自定义 flowNodes 则使用，否则从数据库获取
        if data.get("flowNodes"):
            flow_nodes = data["flowNodes"]
        else:
            cur.execute("SELECT nodes FROM approval_flows WHERE biz_type = %s", (data.get("bizType"),))
            flow = cur.fetchone()
            flow_nodes = json.loads(flow["nodes"]) if flow else [{"name": "经办人", "approver": data.get("applicant")}]

        cur.execute("""
            INSERT INTO approval_requests
            (biz_type, title, reason, amount, applicant, attachments, flow_nodes, status, dividend_record_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, '审批中', %s)
            RETURNING *
        """, (
            data.get("bizType"), data.get("title"), data.get("reason"),
            data.get("amount"), data.get("applicant"),
            json.dumps(data.get("attachments", []), ensure_ascii=False),
            json.dumps(flow_nodes, ensure_ascii=False),
            data.get("dividendRecordId"),
        ))
        request = cur.fetchone()

        # 创建提交记录
        cur.execute("""
            INSERT INTO approval_records (request_id, node_index, node_name, approver, action, comment)
            VALUES (%s, 0, %s, %s, '提交', %s)
        """, (request["id"], flow_nodes[0]["name"], data.get("applicant"), data.get("reason")))

        # 关联回分红记录
        if data.get("dividendRecordId"):
            cur.execute(
                "UPDATE dividend_records SET approval_id = %s WHERE id = %s",
                (request["id"], data["dividendRecordId"])
            )

        conn.commit()
        if isinstance(request.get("flow_nodes"), str):
            request["flow_nodes"] = json.loads(request["flow_nodes"])
        return request
    finally:
        cur.close()
        conn.close()


def act_on_request(request_id: int, action: str, approver: str, comment: str = None, **kwargs):
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("SELECT * FROM approval_requests WHERE id = %s", (request_id,))
        request = cur.fetchone()
        if not request:
            return None

        flow_nodes = json.loads(request["flow_nodes"]) if isinstance(request["flow_nodes"], str) else request["flow_nodes"]
        current_node = request["current_node"]

        if action == "通过":
            next_node = current_node + 1
            if next_node >= len(flow_nodes):
                # 最后一个节点，审批通过
                cur.execute(
                    "UPDATE approval_requests SET current_node = %s, status = '已通过', finished_at = NOW() WHERE id = %s",
                    (next_node, request_id)
                )
                # 如果关联了分红记录，自动更新分红状态
                if request.get("dividend_record_id"):
                    cur.execute(
                        "UPDATE dividend_records SET status = '已通过', updated_at = NOW() WHERE id = %s",
                        (request["dividend_record_id"],)
                    )
            else:
                cur.execute(
                    "UPDATE approval_requests SET current_node = %s WHERE id = %s",
                    (next_node, request_id)
                )
        elif action == "驳回":
            cur.execute(
                "UPDATE approval_requests SET status = '已驳回', finished_at = NOW() WHERE id = %s",
                (request_id,)
            )
        elif action == "催办":
            cur.execute(
                "UPDATE approval_requests SET urge_count = urge_count + 1 WHERE id = %s",
                (request_id,)
            )

        # 记录操作
        node_name = flow_nodes[current_node]["name"] if current_node < len(flow_nodes) else ""
        cur.execute("""
            INSERT INTO approval_records (request_id, node_index, node_name, approver, action, comment)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (request_id, current_node, node_name, approver, action, comment))

        conn.commit()
        return {"ok": True}
    finally:
        cur.close()
        conn.close()


def get_stats():
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("""
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = '审批中') as pending,
                COUNT(*) FILTER (WHERE status = '已通过') as approved,
                COUNT(*) FILTER (WHERE status = '已驳回') as rejected
            FROM approval_requests
        """)
        stats = cur.fetchone()

        cur.execute("""
            SELECT biz_type, COUNT(*) as count,
                   COUNT(*) FILTER (WHERE status = '审批中') as pending
            FROM approval_requests
            GROUP BY biz_type
        """)
        stats["by_biz_type"] = cur.fetchall()
        return stats
    finally:
        cur.close()
        conn.close()
