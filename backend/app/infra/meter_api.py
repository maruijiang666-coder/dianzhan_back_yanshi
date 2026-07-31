import httpx
import json
from datetime import datetime, timedelta
from ..config import TQ_API_URL, TQ_AUTH_CODE


class TQMeterClient:
    """天雀智慧电表 API 客户端"""

    def __init__(self):
        self.base_url = TQ_API_URL
        self.auth_code = TQ_AUTH_CODE

    async def _request(self, method: str, path: str, **kwargs):
        """发送请求"""
        url = f"{self.base_url}{path}"
        # auth 作为查询参数传递
        params = kwargs.pop("params", {})
        params["auth"] = self.auth_code

        async with httpx.AsyncClient(timeout=30, verify=False) as client:
            resp = await client.request(method, url, params=params, **kwargs)
            resp.raise_for_status()
            return resp.json()

    def _extract_data(self, result, key="data"):
        """从响应中提取数据

        API 返回格式: {"status": 1, "total": 64, "data": [...]}
        """
        if isinstance(result, dict):
            return result.get(key, [])
        if isinstance(result, list):
            return result
        return []

    async def get_devices(self) -> list:
        """获取设备列表（电表）"""
        result = await self._request("GET", "/Api/Meter")
        return self._extract_data(result)

    async def get_status(self) -> list:
        """获取实时状态（总电量、尖峰平谷、剩余金额）"""
        result = await self._request("GET", "/Api/EleMeterState")
        return self._extract_data(result)

    async def get_monthly_kwh(self, start_month: str, end_month: str) -> list:
        """获取月度用电量

        Args:
            start_month: 开始月份 YYYYMM
            end_month: 结束月份 YYYYMM
        """
        result = await self._request("GET", "/Api/StatisticEle/month", params={
            "start_time": f"{start_month}01",
            "end_time": f"{end_month}31",
        })
        return self._extract_data(result)

    async def get_readings(self, start_time: str, end_time: str = None, meter_no: str = None) -> list:
        """获取历史抄表记录

        Args:
            start_time: 开始时间 YYYY-MM-DD HH:MM:SS
            end_time: 结束时间
            meter_no: 电表编号
        """
        params = {"start_time": start_time}
        if end_time:
            params["end_time"] = end_time
        if meter_no:
            params["address"] = meter_no
        result = await self._request("GET", "/Api/DataRequest", params=params)
        return self._extract_data(result)

    async def get_warnings(self, device_type: int = 0) -> list:
        """获取报警信息

        Args:
            device_type: 设备类型 0=电表, 1=水表, 9=采集器
        """
        result = await self._request("GET", "/Api/Warning", params={"device_type": device_type})
        return self._extract_data(result)


# 全局实例
tq_client = TQMeterClient()
