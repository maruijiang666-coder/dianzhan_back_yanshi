"""电表能耗数据 API"""
from fastapi import APIRouter, HTTPException, Query
from ..infra.database import get_connection, get_dict_cursor

router = APIRouter(prefix="/api/meter-energy", tags=["电表能耗"])


@router.get("/daily")
async def get_daily_kwh(
    meterNo: str = None,
    startDate: str = Query(None, description="开始日期 YYYYMMDD"),
    endDate: str = Query(None, description="结束日期 YYYYMMDD"),
):
    """获取日用电量"""
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        conditions, values = [], []
        if meterNo:
            conditions.append("d.address = %s")
            values.append(meterNo)
        if startDate:
            conditions.append("d.day_date >= %s")
            values.append(startDate)
        if endDate:
            conditions.append("d.day_date <= %s")
            values.append(endDate)
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        cur.execute(f"""
            SELECT d.*, m.meter_name, m.station_id, s.name as station_name
            FROM meter_daily d
            LEFT JOIN meters m ON m.meter_no = d.address
            LEFT JOIN stations s ON s.id = m.station_id
            {where}
            ORDER BY d.day_date DESC, d.address
        """, values)
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()


@router.get("/hourly")
async def get_hourly_kwh(
    meterNo: str = None,
    startTime: str = Query(None, description="开始时间 YYYYMMDDHH"),
    endTime: str = Query(None, description="结束时间 YYYYMMDDHH"),
):
    """获取小时用电量"""
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        conditions, values = [], []
        if meterNo:
            conditions.append("h.address = %s")
            values.append(meterNo)
        if startTime:
            conditions.append("h.hour_time >= %s")
            values.append(startTime)
        if endTime:
            conditions.append("h.hour_time <= %s")
            values.append(endTime)
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        cur.execute(f"""
            SELECT h.*, m.meter_name, m.station_id, s.name as station_name
            FROM meter_hourly h
            LEFT JOIN meters m ON m.meter_no = h.address
            LEFT JOIN stations s ON s.id = m.station_id
            {where}
            ORDER BY h.hour_time DESC, h.address
        """, values)
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()


@router.get("/monthly")
async def get_monthly_kwh(
    meterNo: str = None,
    startMonth: str = Query(None, description="开始月份 YYYYMM"),
    endMonth: str = Query(None, description="结束月份 YYYYMM"),
):
    """获取月用电量"""
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        conditions, values = [], []
        if meterNo:
            conditions.append("mm.address = %s")
            values.append(meterNo)
        if startMonth:
            conditions.append("mm.month_period >= %s")
            values.append(startMonth)
        if endMonth:
            conditions.append("mm.month_period <= %s")
            values.append(endMonth)
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        cur.execute(f"""
            SELECT mm.*, m.meter_name, m.station_id, s.name as station_name
            FROM meter_monthly mm
            LEFT JOIN meters m ON m.meter_no = mm.address
            LEFT JOIN stations s ON s.id = m.station_id
            {where}
            ORDER BY mm.month_period DESC, mm.address
        """, values)
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()


@router.get("/station/{station_id}")
async def get_station_energy(
    station_id: int,
    period: str = Query(None, description="月份 YYYY-MM"),
):
    """获取站点下所有电表的能耗数据（日维度），用于站点详情展示"""
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        # 获取站点下的电表
        cur.execute("SELECT id, meter_no, meter_name, brand_id FROM meters WHERE station_id = %s", (station_id,))
        meters = cur.fetchall()

        if not meters:
            return {"meters": [], "daily": [], "monthly": []}

        meter_nos = [m["meter_no"] for m in meters if m.get("meter_no")]
        if not meter_nos:
            return {"meters": meters, "daily": [], "monthly": []}

        placeholders = ",".join(["%s"] * len(meter_nos))

        # 获取日用电量（最近31天或指定月份）
        daily = []
        if period:
            # YYYY-MM -> YYYYMM 范围
            y, m = int(period[:4]), int(period[5:7])
            start_d = f"{y}{m:02d}01"
            if m == 12:
                end_d = f"{y + 1}0101"
            else:
                end_d = f"{y}{m + 1:02d}01"
            cur.execute(f"""
                SELECT address, day_date, kwh
                FROM meter_daily
                WHERE address IN ({placeholders}) AND day_date >= %s AND day_date < %s
                ORDER BY day_date
            """, (*meter_nos, start_d, end_d))
        else:
            cur.execute(f"""
                SELECT address, day_date, kwh
                FROM meter_daily
                WHERE address IN ({placeholders})
                ORDER BY day_date DESC
                LIMIT 100
            """, meter_nos)
        daily = cur.fetchall()

        # 获取月用电量（最近12个月）
        cur.execute(f"""
            SELECT address, month_period, kwh
            FROM meter_monthly
            WHERE address IN ({placeholders})
            ORDER BY month_period DESC
            LIMIT 50
        """, meter_nos)
        monthly = cur.fetchall()

        return {
            "meters": meters,
            "daily": daily,
            "monthly": monthly,
        }
    finally:
        cur.close()
        conn.close()


@router.get("/sync-logs")
async def get_sync_logs(limit: int = 20):
    """获取同步日志"""
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("""
            SELECT * FROM sync_logs
            ORDER BY started_at DESC
            LIMIT %s
        """, (limit,))
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()


@router.post("/sync")
async def trigger_sync(type: str):
    """手动触发同步

    type: devices | collectors | status | hourly | daily | monthly | yearly | full
    """
    from ..jobs.sync_meters import (
        sync_devices, sync_collectors, sync_status,
        sync_hourly_data, sync_daily_data, sync_monthly_data, sync_yearly_data,
        full_sync,
    )

    sync_map = {
        "devices": sync_devices,
        "collectors": sync_collectors,
        "status": sync_status,
        "hourly": sync_hourly_data,
        "daily": sync_daily_data,
        "monthly": sync_monthly_data,
        "yearly": sync_yearly_data,
        "full": full_sync,
    }

    fn = sync_map.get(type)
    if not fn:
        raise HTTPException(400, f"未知同步类型: {type}，可选: {', '.join(sync_map.keys())}")

    result = await fn()
    return {"ok": True, "type": type, "result": result}
