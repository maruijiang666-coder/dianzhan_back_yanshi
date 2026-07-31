"""天雀电表数据同步"""
import json
from datetime import datetime
from ..infra.database import get_connection, get_dict_cursor
from ..infra.meter_api import tq_client


async def sync_devices():
    """同步设备列表（每天1次）"""
    print("🔄 开始同步设备列表...")
    try:
        devices = await tq_client.get_devices()
        conn = get_connection()
        cur = conn.cursor()
        try:
            for d in devices:
                address = d.get("address", "")
                if not address:
                    continue
                cur.execute("""
                    INSERT INTO meter_devices (device_id, collector_id, address, description, rate, synced_at)
                    VALUES (%s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (address)
                    DO UPDATE SET device_id = EXCLUDED.device_id, collector_id = EXCLUDED.collector_id,
                                  description = EXCLUDED.description, rate = EXCLUDED.rate, synced_at = NOW()
                """, (
                    d.get("id"), d.get("collectorid"),
                    address, d.get("description"), d.get("rate")
                ))
            conn.commit()
            print(f"✅ 设备列表同步完成: {len(devices)} 条")
        finally:
            cur.close()
            conn.close()
    except Exception as e:
        print(f"❌ 设备列表同步失败: {e}")


async def sync_status():
    """同步实时状态（每4小时）"""
    print("🔄 开始同步实时状态...")
    try:
        meters = await tq_client.get_status()
        conn = get_connection()
        cur = conn.cursor()
        try:
            for m in meters:
                cur.execute("""
                    INSERT INTO meter_status_cache (device_id, address, c0, c1, c2, c3, c4, remain_money, synced_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
                """, (
                    m.get("id"), m.get("address", ""),
                    m.get("c0"), m.get("c1"), m.get("c2"), m.get("c3"), m.get("c4"),
                    m.get("remain_money")
                ))
            conn.commit()
            print(f"✅ 实时状态同步完成: {len(meters)} 条")
        finally:
            cur.close()
            conn.close()
    except Exception as e:
        print(f"❌ 实时状态同步失败: {e}")


async def sync_monthly_kwh(start_month: str = None, end_month: str = None):
    """同步月度用电量（手动触发，每月限额10次）

    Args:
        start_month: 开始月份 YYYYMM，默认上月
        end_month: 结束月份 YYYYMM，默认本月
    """
    # 检查本月调用次数
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("""
            SELECT COUNT(*) as cnt FROM meter_monthly
            WHERE synced_at >= date_trunc('month', CURRENT_DATE)
        """)
        row = cur.fetchone()
        calls_this_month = row["cnt"] if row else 0

        if calls_this_month >= 10:
            return {
                "ok": False,
                "error": "本月调用次数已达上限（10次）",
                "callsThisMonth": calls_this_month,
                "limit": 10,
            }
    finally:
        cur.close()
        conn.close()

    # 默认同步上月和本月
    if not start_month or not end_month:
        now = datetime.now()
        start_month = start_month or f"{now.year}{now.month - 1:02d}" if now.month > 1 else f"{now.year - 1}12"
        end_month = end_month or f"{now.year}{now.month:02d}"

    print(f"🔄 开始同步月度用电量: {start_month} ~ {end_month}...")
    try:
        periods = await tq_client.get_monthly_kwh(start_month, end_month)
        conn = get_connection()
        cur = conn.cursor()
        try:
            count = 0
            for p in periods:
                month_period = p.get("period", "").replace("-", "")
                for m in p.get("meters", []):
                    address = m.get("meterNo", "")
                    if not address:
                        continue
                    cur.execute("""
                        INSERT INTO meter_monthly (address, month_period, kwh, raw_data, synced_at)
                        VALUES (%s, %s, %s, %s, NOW())
                        ON CONFLICT (address, month_period)
                        DO UPDATE SET kwh = EXCLUDED.kwh, raw_data = EXCLUDED.raw_data, synced_at = NOW()
                    """, (address, month_period, m.get("kwh"), json.dumps(m)))
                    count += 1
            conn.commit()
            print(f"✅ 月度用电量同步完成: {count} 条")

            # 查询本次调用后本月总次数
            cur2 = get_dict_cursor(conn)
            cur2.execute("""
                SELECT COUNT(*) as cnt FROM meter_monthly
                WHERE synced_at >= date_trunc('month', CURRENT_DATE)
            """)
            total_calls = cur2.fetchone()["cnt"]
            cur2.close()

            return {
                "ok": True,
                "count": count,
                "callsThisMonth": total_calls,
                "limit": 10,
            }
        finally:
            cur.close()
            conn.close()
    except Exception as e:
        print(f"❌ 月度用电量同步失败: {e}")
        return {"ok": False, "error": str(e)}


async def sync_warnings():
    """同步报警信息（每2小时）"""
    print("🔄 开始同步报警信息...")
    try:
        warnings = await tq_client.get_warnings()
        conn = get_connection()
        cur = conn.cursor()
        try:
            cur.execute("DELETE FROM meter_warnings_cache")
            for w in warnings:
                cur.execute("""
                    INSERT INTO meter_warnings_cache (device_type, device_id, device_address, warning_def_id, start_time, msg, synced_at)
                    VALUES (%s, %s, %s, %s, %s, %s, NOW())
                """, (
                    w.get("device_type"), w.get("device_id"),
                    w.get("device_address"), w.get("warning_def_id"),
                    w.get("start_time"), w.get("msg")
                ))
            conn.commit()
            print(f"✅ 报警信息同步完成: {len(warnings)} 条")
        finally:
            cur.close()
            conn.close()
    except Exception as e:
        print(f"❌ 报警信息同步失败: {e}")


async def full_sync():
    """全量同步（不含月度用电量，需手动触发）"""
    await sync_devices()
    await sync_status()
    await sync_warnings()
