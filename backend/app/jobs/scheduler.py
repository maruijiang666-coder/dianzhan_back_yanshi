from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

scheduler = AsyncIOScheduler()


def start_scheduler():
    """启动定时任务调度器"""
    from .sync_meters import sync_devices, sync_status, sync_warnings

    # 每天 02:00 同步设备列表（每天1次）
    scheduler.add_job(sync_devices, CronTrigger(hour=2, minute=0), id="sync_devices")

    # 每4小时同步实时状态（每天6次）
    scheduler.add_job(sync_status, CronTrigger(hour="*/4"), id="sync_status")

    # 每2小时同步报警信息（每天12次）
    scheduler.add_job(sync_warnings, CronTrigger(hour="*/2"), id="sync_warnings")

    # 注意：月度用电量接口不自动同步（每月限额10次），由用户手动触发

    scheduler.start()
    print("✅ 定时任务调度器已启动")


def stop_scheduler():
    """停止调度器"""
    if scheduler.running:
        scheduler.shutdown()
        print("⏹ 定时任务调度器已停止")


def get_scheduler_status():
    """获取调度器状态"""
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "nextRunTime": str(job.next_run_time) if job.next_run_time else None,
        })
    return {
        "running": scheduler.running,
        "jobs": jobs,
    }
