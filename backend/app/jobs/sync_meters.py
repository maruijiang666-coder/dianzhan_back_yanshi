"""天雀电表数据同步"""
import json
import logging
from datetime import datetime, timedelta
from ..infra.database import get_connection, get_dict_cursor
from ..infra.meter_api import tq_client

logger = logging.getLogger(__name__)


def log_sync(sync_type: str, status: str, records: int = 0, error: str = None):
    """记录同步日志"""
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO sync_logs (sync_type, status, records_synced, error_message, started_at, completed_at)
            VALUES (%s, %s, %s, %s, NOW(), NOW())
        """, (sync_type, status, records, error))
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        logger.error(f"记录同步日志失败: {e}")


def parse_kwh_data(item: dict) -> dict:
    """解析能耗数据，处理多费率格式

    返回: {total, sharp, peak, flat, valley, deep_valley, rate, start_reading, end_reading}
    """
    d = item.get("d", [])
    s = item.get("s", [])
    e = item.get("e", [])
    r = item.get("r", 1) or 1

    return {
        "total": d[0] if len(d) > 0 else 0,
        "sharp": d[1] if len(d) > 1 else 0,
        "peak": d[2] if len(d) > 2 else 0,
        "flat": d[3] if len(d) > 3 else 0,
        "valley": d[4] if len(d) > 4 else 0,
        "deep_valley": d[5] if len(d) > 5 else 0,
        "rate": r,
        "start_reading": s[0] if len(s) > 0 else 0,
        "end_reading": e[0] if len(e) > 0 else 0,
        "start_time": item.get("st", ""),
        "end_time": item.get("et", ""),
        "meter_type": len(d),
    }


# ─── 设备同步 ─────────────────────────────────────────────

async def sync_devices():
    """同步设备列表（每天1次）"""
    logger.info("🔄 开始同步设备列表...")
    try:
        devices = await tq_client.get_devices()
        conn = get_connection()
        cur = conn.cursor()
        synced = 0
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
                synced += 1
            conn.commit()
            logger.info(f"✅ 设备列表同步完成: {synced} 条")
            log_sync("devices", "success", synced)
            return synced
        finally:
            cur.close()
            conn.close()
    except Exception as e:
        logger.error(f"❌ 设备列表同步失败: {e}")
        log_sync("devices", "failed", error=str(e))


async def sync_collectors():
    """同步采集器列表"""
    logger.info("🔄 开始同步采集器列表...")
    try:
        collectors = await tq_client.get_collectors()
        conn = get_connection()
        cur = conn.cursor()
        synced = 0
        try:
            for item in collectors:
                collector_id = item.get("id")
                if not collector_id:
                    continue
                cur.execute("""
                    INSERT INTO meter_collectors (id, collector_id, description, device_count, raw_data, synced_at)
                    VALUES (%s, %s, %s, %s, %s::jsonb, NOW())
                    ON CONFLICT (id) DO UPDATE SET
                        collector_id = EXCLUDED.collector_id,
                        description = EXCLUDED.description,
                        device_count = EXCLUDED.device_count,
                        raw_data = EXCLUDED.raw_data,
                        synced_at = NOW()
                """, (
                    str(collector_id),
                    item.get("collectorid"),
                    item.get("description"),
                    item.get("count", 0),
                    json.dumps(item, ensure_ascii=False),
                ))
                synced += 1
            conn.commit()
            logger.info(f"✅ 采集器同步完成: {synced} 条")
            log_sync("collectors", "success", synced)
            return synced
        finally:
            cur.close()
            conn.close()
    except Exception as e:
        logger.error(f"❌ 采集器同步失败: {e}")
        log_sync("collectors", "failed", error=str(e))


# ─── 实时状态同步 ──────────────────────────────────────────

async def sync_status():
    """同步实时状态（每10分钟）"""
    logger.info("🔄 开始同步实时状态...")
    try:
        meters = await tq_client.get_status()
        conn = get_connection()
        cur = conn.cursor()
        synced = 0
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
                synced += 1
            conn.commit()
            logger.info(f"✅ 实时状态同步完成: {synced} 条")
            log_sync("status", "success", synced)
            return synced
        finally:
            cur.close()
            conn.close()
    except Exception as e:
        logger.error(f"❌ 实时状态同步失败: {e}")
        log_sync("status", "failed", error=str(e))


# ─── 能耗数据同步 ──────────────────────────────────────────

async def sync_hourly_data():
    """同步最近24小时用电量（每小时）"""
    logger.info("🔄 开始同步小时用电量...")
    try:
        now = datetime.now()
        start = (now - timedelta(hours=24)).strftime("%Y%m%d%H")
        end = now.strftime("%Y%m%d%H")
        data = await tq_client.get_electricity_by_hour(start, end)

        if not data or not data.get("data"):
            logger.info("小时用电量无数据")
            log_sync("hourly", "success", 0)
            return 0

        conn = get_connection()
        cur = conn.cursor()
        synced = 0
        try:
            # 预加载设备ID到电表号的映射
            cur.execute("SELECT device_id, address FROM meter_devices")
            device_map = {str(row[0]): row[1] for row in cur.fetchall()}

            for period_key, items in data["data"].items():
                if not isinstance(items, list):
                    continue
                for item in items:
                    device_id = str(item.get("mid", item.get("id", "")))
                    if not device_id:
                        continue
                    address = item.get("address") or device_map.get(device_id, "")
                    parsed = parse_kwh_data(item)
                    cur.execute("""
                        INSERT INTO meter_hourly (device_id, address, hour_time, kwh, raw_data, synced_at)
                        VALUES (%s, %s, %s, %s, %s::jsonb, NOW())
                        ON CONFLICT (device_id, hour_time) DO UPDATE SET
                            address = EXCLUDED.address,
                            kwh = EXCLUDED.kwh,
                            raw_data = EXCLUDED.raw_data,
                            synced_at = NOW()
                    """, (
                        device_id, address, period_key,
                        parsed["total"],
                        json.dumps(item, ensure_ascii=False),
                    ))
                    synced += 1
            conn.commit()
            logger.info(f"✅ 小时用电量同步完成: {synced} 条")
            log_sync("hourly", "success", synced)
            return synced
        finally:
            cur.close()
            conn.close()
    except Exception as e:
        logger.error(f"❌ 小时用电量同步失败: {e}")
        log_sync("hourly", "failed", error=str(e))


async def sync_daily_data():
    """同步最近31天用电量（每天）"""
    logger.info("🔄 开始同步日用电量...")
    try:
        now = datetime.now()
        start = (now - timedelta(days=31)).strftime("%Y%m%d")
        end = now.strftime("%Y%m%d")
        data = await tq_client.get_electricity_by_day(start, end)

        if not data or not data.get("data"):
            logger.info("日用电量无数据")
            log_sync("daily", "success", 0)
            return 0

        conn = get_connection()
        cur = conn.cursor()
        synced = 0
        try:
            cur.execute("SELECT device_id, address FROM meter_devices")
            device_map = {str(row[0]): row[1] for row in cur.fetchall()}

            for period_key, items in data["data"].items():
                if not isinstance(items, list):
                    continue
                for item in items:
                    device_id = str(item.get("mid", item.get("id", "")))
                    if not device_id:
                        continue
                    address = item.get("address") or device_map.get(device_id, "")
                    parsed = parse_kwh_data(item)
                    cur.execute("""
                        INSERT INTO meter_daily (device_id, address, day_date, kwh, raw_data, synced_at)
                        VALUES (%s, %s, %s, %s, %s::jsonb, NOW())
                        ON CONFLICT (device_id, day_date) DO UPDATE SET
                            address = EXCLUDED.address,
                            kwh = EXCLUDED.kwh,
                            raw_data = EXCLUDED.raw_data,
                            synced_at = NOW()
                    """, (
                        device_id, address, period_key,
                        parsed["total"],
                        json.dumps(item, ensure_ascii=False),
                    ))
                    synced += 1
            conn.commit()
            logger.info(f"✅ 日用电量同步完成: {synced} 条")
            log_sync("daily", "success", synced)
            return synced
        finally:
            cur.close()
            conn.close()
    except Exception as e:
        logger.error(f"❌ 日用电量同步失败: {e}")
        log_sync("daily", "failed", error=str(e))


async def sync_monthly_data():
    """同步最近12个月用电量（每天）"""
    logger.info("🔄 开始同步月用电量...")
    try:
        now = datetime.now()
        start = (now - timedelta(days=365)).strftime("%Y%m")
        end = now.strftime("%Y%m")
        data = await tq_client.get_electricity_by_month(start, end)

        if not data:
            logger.info("月用电量无数据")
            log_sync("monthly", "success", 0)
            return 0

        conn = get_connection()
        cur = conn.cursor()
        synced = 0
        try:
            cur.execute("SELECT device_id, address FROM meter_devices")
            device_map = {str(row[0]): row[1] for row in cur.fetchall()}

            def parse_reading_fields(item):
                """从 raw_data 中解析起始/抄表度数和时间"""
                prev_reading = None
                prev_reading_date = None
                curr_reading = None
                curr_reading_date = None
                # s: 起始度数, e: 抄表度数, st: 起始时间, et: 抄表时间
                s = item.get("s")
                if isinstance(s, list) and len(s) > 0:
                    prev_reading = s[0]
                e = item.get("e")
                if isinstance(e, list) and len(e) > 0:
                    curr_reading = e[0]
                st = item.get("st")
                if st:
                    prev_reading_date = st.replace("/", "-").split(" ")[0]
                et = item.get("et")
                if et:
                    curr_reading_date = et.replace("/", "-").split(" ")[0]
                return prev_reading, prev_reading_date, curr_reading, curr_reading_date

            # 兼容两种返回格式
            if isinstance(data, dict) and "data" in data:
                for period_key, items in data["data"].items():
                    if not isinstance(items, list):
                        continue
                    for item in items:
                        device_id = str(item.get("mid", item.get("id", "")))
                        if not device_id:
                            continue
                        address = item.get("address") or device_map.get(device_id, "")
                        parsed = parse_kwh_data(item)
                        prev_reading, prev_reading_date, curr_reading, curr_reading_date = parse_reading_fields(item)
                        cur.execute("""
                            INSERT INTO meter_monthly (address, month_period, kwh, raw_data, synced_at,
                                prev_reading, prev_reading_date, curr_reading, curr_reading_date)
                            VALUES (%s, %s, %s, %s::jsonb, NOW(), %s, %s, %s, %s)
                            ON CONFLICT (address, month_period) DO UPDATE SET
                                kwh = EXCLUDED.kwh, raw_data = EXCLUDED.raw_data, synced_at = NOW(),
                                prev_reading = EXCLUDED.prev_reading, prev_reading_date = EXCLUDED.prev_reading_date,
                                curr_reading = EXCLUDED.curr_reading, curr_reading_date = EXCLUDED.curr_reading_date
                        """, (address, period_key, parsed["total"], json.dumps(item, ensure_ascii=False),
                              prev_reading, prev_reading_date, curr_reading, curr_reading_date))
                        synced += 1
            elif isinstance(data, list):
                for p in data:
                    month_period = p.get("period", "").replace("-", "")
                    for m in p.get("meters", []):
                        address = m.get("meterNo", "")
                        if not address:
                            continue
                        prev_reading, prev_reading_date, curr_reading, curr_reading_date = parse_reading_fields(m)
                        cur.execute("""
                            INSERT INTO meter_monthly (address, month_period, kwh, raw_data, synced_at,
                                prev_reading, prev_reading_date, curr_reading, curr_reading_date)
                            VALUES (%s, %s, %s, %s::jsonb, NOW(), %s, %s, %s, %s)
                            ON CONFLICT (address, month_period) DO UPDATE SET
                                kwh = EXCLUDED.kwh, raw_data = EXCLUDED.raw_data, synced_at = NOW(),
                                prev_reading = EXCLUDED.prev_reading, prev_reading_date = EXCLUDED.prev_reading_date,
                                curr_reading = EXCLUDED.curr_reading, curr_reading_date = EXCLUDED.curr_reading_date
                        """, (address, month_period, m.get("kwh"), json.dumps(m, ensure_ascii=False),
                              prev_reading, prev_reading_date, curr_reading, curr_reading_date))
                        synced += 1

            conn.commit()
            logger.info(f"✅ 月用电量同步完成: {synced} 条")
            log_sync("monthly", "success", synced)
            return synced
        finally:
            cur.close()
            conn.close()
    except Exception as e:
        logger.error(f"❌ 月用电量同步失败: {e}")
        log_sync("monthly", "failed", error=str(e))


async def sync_yearly_data():
    """同步最近12年用电量"""
    logger.info("🔄 开始同步年用电量...")
    try:
        now = datetime.now()
        start = str(now.year - 12)
        end = str(now.year)
        data = await tq_client.get_electricity_by_year(start, end)

        if not data or not data.get("data"):
            logger.info("年用电量无数据")
            log_sync("yearly", "success", 0)
            return 0

        conn = get_connection()
        cur = conn.cursor()
        synced = 0
        try:
            cur.execute("SELECT device_id, address FROM meter_devices")
            device_map = {str(row[0]): row[1] for row in cur.fetchall()}

            for period_key, items in data["data"].items():
                if not isinstance(items, list):
                    continue
                for item in items:
                    device_id = str(item.get("mid", item.get("id", "")))
                    if not device_id:
                        continue
                    address = item.get("address") or device_map.get(device_id, "")
                    parsed = parse_kwh_data(item)
                    cur.execute("""
                        INSERT INTO meter_yearly (device_id, address, year_period, kwh, raw_data, synced_at)
                        VALUES (%s, %s, %s, %s, %s::jsonb, NOW())
                        ON CONFLICT (device_id, year_period) DO UPDATE SET
                            address = EXCLUDED.address,
                            kwh = EXCLUDED.kwh,
                            raw_data = EXCLUDED.raw_data,
                            synced_at = NOW()
                    """, (
                        device_id, address, period_key,
                        parsed["total"],
                        json.dumps(item, ensure_ascii=False),
                    ))
                    synced += 1
            conn.commit()
            logger.info(f"✅ 年用电量同步完成: {synced} 条")
            log_sync("yearly", "success", synced)
            return synced
        finally:
            cur.close()
            conn.close()
    except Exception as e:
        logger.error(f"❌ 年用电量同步失败: {e}")
        log_sync("yearly", "failed", error=str(e))


# ─── 报警同步 ─────────────────────────────────────────────

async def sync_warnings():
    """同步报警信息（每2小时）"""
    logger.info("🔄 开始同步报警信息...")
    try:
        warnings = await tq_client.get_warnings()
        conn = get_connection()
        cur = conn.cursor()
        synced = 0
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
                synced += 1
            conn.commit()
            logger.info(f"✅ 报警信息同步完成: {synced} 条")
            log_sync("warnings", "success", synced)
            return synced
        finally:
            cur.close()
            conn.close()
    except Exception as e:
        logger.error(f"❌ 报警信息同步失败: {e}")
        log_sync("warnings", "failed", error=str(e))


# ─── 组合同步 ─────────────────────────────────────────────

async def sync_all_static():
    """同步所有静态数据"""
    results = {}
    results["devices"] = await sync_devices()
    results["collectors"] = await sync_collectors()
    return results


async def sync_all_energy():
    """同步所有能耗数据"""
    results = {}
    results["hourly"] = await sync_hourly_data()
    results["daily"] = await sync_daily_data()
    results["monthly"] = await sync_monthly_data()
    results["yearly"] = await sync_yearly_data()
    return results


async def full_sync():
    """全量同步"""
    logger.info("开始全量同步...")
    results = {}
    results["static"] = await sync_all_static()
    results["status"] = await sync_status()
    results["energy"] = await sync_all_energy()
    results["warnings"] = await sync_warnings()
    logger.info(f"全量同步完成: {results}")
    return results
