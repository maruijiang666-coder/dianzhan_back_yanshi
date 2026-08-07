from fastapi import APIRouter, HTTPException, Query
from ..repositories import rent_repo, dividend_repo
from ..domain.dividend_calc import dividend_calculator
import zipfile
import xml.etree.ElementTree as ET
import os

router = APIRouter(prefix="/api/rent", tags=["场地租金"])


# ─── 场租付款合同 ───────────────────────────────────────────

@router.get("/leases")
async def list_leases(stationId: int = None):
    return rent_repo.list_leases(station_id=stationId)


@router.post("/leases", status_code=201)
async def create_lease(data: dict):
    return rent_repo.create_lease(data)


@router.put("/leases/{lease_id}")
async def update_lease(lease_id: int, data: dict):
    result = rent_repo.update_lease(lease_id, data)
    if not result:
        raise HTTPException(404, "合同不存在")
    return result


@router.delete("/leases/{lease_id}")
async def delete_lease(lease_id: int):
    rent_repo.delete_lease(lease_id)
    return {"ok": True}


# ─── 场租收款合同 ───────────────────────────────────────────

@router.get("/incomes")
async def list_incomes(stationId: int = None, brandId: int = None):
    incomes = rent_repo.list_incomes(station_id=stationId, brand_id=brandId)
    result = []
    for i in incomes:
        receipts = rent_repo.list_receipts(rent_income_id=i["id"])
        result.append({**i, "receipts": receipts})
    return result


@router.post("/incomes", status_code=201)
async def create_income(data: dict):
    return rent_repo.create_income(data)


@router.put("/incomes/{income_id}")
async def update_income(income_id: int, data: dict):
    result = rent_repo.update_income(income_id, data)
    if not result:
        raise HTTPException(404, "合同不存在")
    return result


@router.delete("/incomes/{income_id}")
async def delete_income(income_id: int):
    rent_repo.delete_income(income_id)
    return {"ok": True}


# ─── 租金分期收款 ───────────────────────────────────────────

@router.get("/receipts")
async def list_receipts(rentIncomeId: int = None):
    return rent_repo.list_receipts(rent_income_id=rentIncomeId)


@router.post("/receipts", status_code=201)
async def create_receipt(data: dict):
    return rent_repo.create_receipt(data)


@router.put("/receipts/{receipt_id}")
async def update_receipt(receipt_id: int, data: dict):
    result = rent_repo.update_receipt(receipt_id, data)
    if not result:
        raise HTTPException(404, "收款记录不存在")
    return result


@router.delete("/receipts/{receipt_id}")
async def delete_receipt(receipt_id: int):
    rent_repo.delete_receipt(receipt_id)
    return {"ok": True}


# ─── 付款记录（年度付款情况、发票）────────────────────────────

@router.get("/payment-records")
async def list_payment_records(stationName: str = None, brandId: int = None):
    return rent_repo.list_payment_records(station_name=stationName, brand_id=brandId)


@router.post("/payment-records", status_code=201)
async def upsert_payment_record(data: dict):
    return rent_repo.upsert_payment_record(data)


@router.delete("/payment-records/{record_id}")
async def delete_payment_record(record_id: int):
    rent_repo.delete_payment_record(record_id)
    return {"ok": True}


# ─── 收款记录（年度收款情况、进项成本）────────────────────────

@router.get("/income-records")
async def list_income_records(stationName: str = None, brandId: int = None):
    return rent_repo.list_income_records(station_name=stationName, brand_id=brandId)


@router.post("/income-records", status_code=201)
async def upsert_income_record(data: dict):
    return rent_repo.upsert_income_record(data)


@router.delete("/income-records/{record_id}")
async def delete_income_record(record_id: int):
    rent_repo.delete_income_record(record_id)
    return {"ok": True}


# ─── 运营费用 ───────────────────────────────────────────────

@router.get("/expenses")
async def list_expenses(stationId: int = None, period: str = None):
    return rent_repo.list_expenses(station_id=stationId, period=period)


@router.post("/expenses", status_code=201)
async def save_expense(data: dict):
    result = rent_repo.save_expense(
        station_id=data.get("stationId"),
        period=data.get("period"),
        amount=data.get("amount"),
        remark=data.get("remark"),
    )
    # 自动更新该站点该月的分红记录
    _update_dividend_records(data.get("stationId"), data.get("period"))
    return result


@router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: int):
    # 先获取运营费用信息，用于后续更新分红记录
    expense = rent_repo.get_expense_by_id(expense_id)
    rent_repo.delete_expense(expense_id)
    # 自动更新该站点该月的分红记录
    if expense:
        _update_dividend_records(expense.get("station_id"), expense.get("period"))
    return {"ok": True}


# ─── 美团台账Excel数据 ───────────────────────────────────────

EXCEL_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "..", "..",
                          "项目相关文件", "聊天文件", "2026-2027美团场租.xlsx")


def _parse_excel():
    """解析Excel文件，返回所有站点数据"""
    ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    z = zipfile.ZipFile(EXCEL_PATH)

    # 读取共享字符串
    ss_root = ET.fromstring(z.read('xl/sharedStrings.xml'))
    shared_strings = []
    for si in ss_root.findall('.//s:si', ns):
        parts = []
        for t in si.findall('.//s:t', ns):
            if t.text:
                parts.append(t.text)
        shared_strings.append(''.join(parts))

    # 读取sheet数据
    sheet_root = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
    rows = []
    for row in sheet_root.findall('.//s:sheetData/s:row', ns):
        cells = {}
        for c in row.findall('s:c', ns):
            ref = c.get('r')
            t = c.get('t', '')
            v = c.find('s:v', ns)
            val = v.text if v is not None else ''
            if t == 's' and val:
                val = shared_strings[int(val)]
            # 提取列字母
            col = ''.join(ch for ch in ref if ch.isalpha())
            cells[col] = val
        rows.append(cells)
    return rows


def _find_excel_station(station_name: str):
    """根据站点名查找Excel中的数据"""
    rows = _parse_excel()
    for row in rows:
        d = row.get('D', '')  # 站名列
        if d and station_name in d:
            return {
                "station_name": d,
                "station_no": row.get('E', ''),
                "company": row.get('B', ''),
                "share_ratio": row.get('C', ''),
                "site_config": {
                    "charging_cabinets": row.get('F', ''),
                    "storage_cabinets": row.get('G', ''),
                    "total": row.get('H', ''),
                },
                "payment_info": {
                    "manager": row.get('I', ''),
                    "contract_period": row.get('J', ''),
                    "cooperation_years": row.get('K', ''),
                    "rent_cost": row.get('L', ''),
                    "pay_method": row.get('M', ''),
                    "pay_status_25_26": row.get('N', ''),
                    "pay_status_26_27": row.get('O', ''),
                    "pay_status": row.get('P', ''),
                    "unit_cost": row.get('Q', ''),
                    "invoice_type": row.get('R', ''),
                    "deposit": row.get('S', ''),
                },
                "income_info": {
                    "income_contract_period": row.get('T', ''),
                    "receipt_status": row.get('U', ''),
                    "income_detail_26_27": row.get('V', ''),
                    "unit_monthly_rent_tax": row.get('W', ''),
                    "unit_annual_income_tax": row.get('X', ''),
                    "annual_income_tax": row.get('Y', ''),
                    "tax_rate": row.get('Z', ''),
                    "annual_income_net": row.get('AA', ''),
                    "input_cost": row.get('AB', ''),
                    "rent_profit": row.get('AC', ''),
                    "dividend_amount": row.get('AD', ''),
                    "profit_after_dividend": row.get('AE', ''),
                },
            }
    return None


@router.get("/excel-data")
async def get_excel_data(stationName: str = Query(None)):
    """获取美团台账Excel数据"""
    rows = _parse_excel()
    all_data = []
    for row in rows:
        d = row.get('D', '')
        a = row.get('A', '')
        if not d or a in ('序号', '合计', ''):
            continue
        all_data.append({
            "station_name": d,
            "station_no": row.get('E', ''),
            "company": row.get('B', ''),
            "share_ratio": row.get('C', ''),
            "site_config": {
                "charging_cabinets": row.get('F', ''),
                "storage_cabinets": row.get('G', ''),
                "total": row.get('H', ''),
            },
            "payment_info": {
                "manager": row.get('I', ''),
                "contract_period": row.get('J', ''),
                "cooperation_years": row.get('K', ''),
                "rent_cost": row.get('L', ''),
                "pay_method": row.get('M', ''),
                "pay_status_25_26": row.get('N', ''),
                "pay_status_26_27": row.get('O', ''),
                "pay_status": row.get('P', ''),
                "unit_cost": row.get('Q', ''),
                "invoice_type": row.get('R', ''),
                "deposit": row.get('S', ''),
            },
            "income_info": {
                "income_contract_period": row.get('T', ''),
                "receipt_status": row.get('U', ''),
                "income_detail_26_27": row.get('V', ''),
                "unit_monthly_rent_tax": row.get('W', ''),
                "unit_annual_income_tax": row.get('X', ''),
                "annual_income_tax": row.get('Y', ''),
                "tax_rate": row.get('Z', ''),
                "annual_income_net": row.get('AA', ''),
                "input_cost": row.get('AB', ''),
                "rent_profit": row.get('AC', ''),
                "dividend_amount": row.get('AD', ''),
                "profit_after_dividend": row.get('AE', ''),
            },
        })

    if stationName:
        # 模糊匹配站点名
        matched = [d for d in all_data if stationName in d["station_name"]]
        if not matched:
            raise HTTPException(404, f"未找到站点: {stationName}")
        return matched[0]

    return {"stations": all_data}


def _update_dividend_records(station_id: int, period: str):
    """更新该站点该月的分红记录（如果存在）"""
    if not station_id or not period:
        return

    # 查找该站点该月的分红记录
    records = dividend_repo.list_records(station_id=station_id, period=period)
    if not records:
        return

    for record in records:
        # 重新计算分红
        calc = dividend_calculator.calculate(station_id, period)
        if not calc:
            continue

        # 更新分红记录
        dividend_repo.update_record(record["id"], {
            "elecIncome": calc["income"]["elecIncome"]["total"],
            "rentIncome": calc["income"]["rentIncome"]["total"],
            "totalIncome": calc["income"]["totalIncome"],
            "elecCost": calc["cost"]["elecCost"],
            "rentCost": calc["cost"]["rentCost"],
            "opExpense": calc["cost"]["opExpense"],
            "bizDividendCost": calc["cost"]["bizDividendCost"],
            "totalCost": calc["cost"]["totalCost"],
            "profit": calc["profit"],
        })

        # 更新分红明细
        dividend_repo.delete_shares(record["id"])
        dividend_type = record.get("type", "股东分红")
        if dividend_type == "商务分红":
            for d in calc["bizDividends"]:
                dividend_repo.create_share(record["id"], {
                    "introducerId": d["introducerId"],
                    "brandId": d.get("brandId"),
                    "mode": d["mode"],
                    "ratio": d.get("ratio"),
                    "fixedAmount": d.get("fixedAmount"),
                    "amount": d["amount"],
                })
        else:
            for d in calc["shareholderDividends"]:
                dividend_repo.create_share(record["id"], {
                    "shareholderId": d["shareholderId"],
                    "brandId": d.get("brandId"),
                    "mode": d["mode"],
                    "ratio": d.get("ratio"),
                    "fixedAmount": d.get("fixedAmount"),
                    "amount": d["amount"],
                })
