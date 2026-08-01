import os
import asyncio
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from .config import PORT
from .infra.database import init_database
from .api import directory, stations, meters, cabinets, electricity, rent, dividends, approvals, contracts, overview, meter_energy
from .jobs.scheduler import start_scheduler, stop_scheduler, get_scheduler_status
from .jobs.sync_meters import full_sync

app = FastAPI(
    title="换电站管理平台 API",
    description="换电站经营管理平台后端服务",
    version="2.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(directory.router)
app.include_router(stations.router)
app.include_router(meters.router)
app.include_router(cabinets.router)
app.include_router(electricity.router)
app.include_router(rent.router)
app.include_router(dividends.router)
app.include_router(approvals.router)
app.include_router(contracts.router)
app.include_router(overview.router)
app.include_router(meter_energy.router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@app.get("/api/scheduler/status")
async def scheduler_status():
    return get_scheduler_status()


@app.post("/api/sync/trigger")
async def sync_trigger(data: dict):
    """手动触发同步

    type 可选值:
    - devices: 同步设备列表
    - collectors: 同步采集器
    - status: 同步实时状态
    - hourly: 同步小时用电量
    - daily: 同步日用电量
    - monthly: 同步月用电量
    - yearly: 同步年用电量
    - warnings: 同步报警信息
    - full: 全量同步
    """
    sync_type = data.get("type", "full")
    from .jobs.sync_meters import (
        sync_devices, sync_collectors, sync_status,
        sync_hourly_data, sync_daily_data, sync_monthly_data, sync_yearly_data,
        sync_warnings, full_sync,
    )

    sync_map = {
        "devices": sync_devices,
        "collectors": sync_collectors,
        "status": sync_status,
        "hourly": sync_hourly_data,
        "daily": sync_daily_data,
        "monthly": sync_monthly_data,
        "yearly": sync_yearly_data,
        "warnings": sync_warnings,
        "full": full_sync,
    }

    fn = sync_map.get(sync_type)
    if fn:
        result = await fn()
        return {"message": "同步成功", "type": sync_type, "result": result}
    else:
        await full_sync()
        return {"message": "全量同步成功", "type": "full"}


@app.get("/api/sync/monthly-kwh/status")
async def monthly_kwh_status():
    """查询月度用电量同步状态（本月调用次数）"""
    from .infra.database import get_connection, get_dict_cursor
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        cur.execute("""
            SELECT COUNT(*) as cnt FROM meter_monthly
            WHERE synced_at >= date_trunc('month', CURRENT_DATE)
        """)
        row = cur.fetchone()
        calls_this_month = row["cnt"] if row else 0
        return {
            "callsThisMonth": calls_this_month,
            "limit": 10,
            "remaining": max(0, 10 - calls_this_month),
        }
    finally:
        cur.close()
        conn.close()


@app.get("/api/meter-monthly")
async def get_meter_monthly(address: str = None, month: str = None):
    """查询本地缓存的月度用电量（不调用第三方API）"""
    from .infra.database import get_connection, get_dict_cursor
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        conditions, values = [], []
        if address:
            conditions.append("address = %s")
            values.append(address)
        if month:
            conditions.append("month_period = %s")
            values.append(month)
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        cur.execute(f"""
            SELECT address, month_period, kwh, synced_at
            FROM meter_monthly
            {where}
            ORDER BY month_period DESC, address
        """, values)
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()


@app.post("/api/meters/import-from-third-party")
async def import_meters_from_third_party():
    """从第三方平台导入电表到本地 meters 表"""
    from .infra.database import get_connection, get_dict_cursor
    conn = get_connection()
    cur = get_dict_cursor(conn)
    try:
        # 获取第三方平台的设备列表
        cur.execute("""
            SELECT d.device_id, d.address, d.description, d.rate,
                   d.collector_id, m.station_id, s.name as station_name
            FROM meter_devices d
            LEFT JOIN meters m ON d.address = m.meter_no
            LEFT JOIN stations s ON m.station_id = s.id
            WHERE d.address NOT IN (SELECT meter_no FROM meters WHERE meter_no IS NOT NULL)
        """)
        devices = cur.fetchall()

        imported = 0
        for d in devices:
            # 根据 description 判断品牌（简单规则）
            desc = d["description"] or ""
            brand_id = None
            if "台铃" in desc:
                cur.execute("SELECT id FROM brands WHERE name = '台铃'")
                row = cur.fetchone()
                brand_id = row["id"] if row else None
            elif "八维通" in desc:
                cur.execute("SELECT id FROM brands WHERE name = '八维通'")
                row = cur.fetchone()
                brand_id = row["id"] if row else None
            elif "美团" in desc:
                cur.execute("SELECT id FROM brands WHERE name = '美团'")
                row = cur.fetchone()
                brand_id = row["id"] if row else None
            elif "哈啰" in desc:
                cur.execute("SELECT id FROM brands WHERE name = '哈啰'")
                row = cur.fetchone()
                brand_id = row["id"] if row else None

            # 如果没有关联站点，创建一个新站点
            station_id = d["station_id"]
            if not station_id:
                cur.execute("""
                    INSERT INTO stations (name, code, status)
                    VALUES (%s, %s, '运营中')
                    RETURNING id
                """, (desc, d["address"]))
                station_id = cur.fetchone()["id"]

            # 插入 meters 表
            cur.execute("""
                INSERT INTO meters (station_id, brand_id, meter_no, meter_name, collector_id, transformer_ratio, status)
                VALUES (%s, %s, %s, %s, %s, %s, '正常')
            """, (station_id, brand_id, d["address"], desc, d["collector_id"], d["rate"]))
            imported += 1

        conn.commit()
        return {"ok": True, "imported": imported, "total": len(devices)}
    finally:
        cur.close()
        conn.close()


@app.on_event("startup")
async def startup():
    print("🚀 启动换电站管理平台后端服务...")
    init_database()
    start_scheduler()

    # 首次同步
    asyncio.create_task(initial_sync())

    print(f"✅ 服务器已启动: http://localhost:{PORT}")


async def initial_sync():
    await asyncio.sleep(2)
    print("🔄 开始首次数据同步...")
    try:
        await full_sync()
        print("✅ 首次同步完成")
    except Exception as e:
        print(f"❌ 首次同步失败: {e}")


@app.on_event("shutdown")
async def shutdown():
    stop_scheduler()


# 静态文件
BASE_DIR = Path("/app") if Path("/app").exists() else Path(__file__).resolve().parent.parent.parent
DIST_DIR = BASE_DIR / "dist"
if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=PORT, reload=True)
