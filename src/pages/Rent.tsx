import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listContracts, deleteContract } from "@/api/contracts";
import { listBrands, listLandlords } from "@/api/directory";
import { listStations } from "@/api/stations";
import { getExcelData, listPaymentRecords, upsertPaymentRecord, listIncomeRecords, upsertIncomeRecord } from "@/api/rent";
import { Money, StatusBadge } from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/fields";
import { ContractForm } from "@/components/RentForms";
import { exportXlsx } from "@/lib/export";
import { fmtMoney, fmtNum, fmtDate } from "@/lib/format";
import { Download, Plus, Pencil, Trash2, ChevronDown, ChevronRight, Building2, MapPin, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

export default function Rent() {
  // 筛选模式：brand=按品牌方, station=按场地
  const [filterMode, setFilterMode] = useState<"brand" | "station">("brand");
  const [brandId, setBrandId] = useState("");
  const [selectedStationKey, setSelectedStationKey] = useState<string | null>(null);
  // 按场地筛选模式
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [selectedBrandForStation, setSelectedBrandForStation] = useState<number | null>(null);
  // 年份筛选
  const [yearFilter, setYearFilter] = useState("");
  const [expandedStations, setExpandedStations] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<any>(null);
  // 付款记录添加表单
  const [addPayForm, setAddPayForm] = useState<{ stationName: string; brandId: number } | null>(null);
  const [payYear, setPayYear] = useState("");
  const [payStatus, setPayStatus] = useState("");
  const [payInvoice, setPayInvoice] = useState("");
  // 收款记录添加表单
  const [addIncomeForm, setAddIncomeForm] = useState<{ stationName: string; brandId: number } | null>(null);
  const [incomeYear, setIncomeYear] = useState("");
  const [incomeStatus, setIncomeStatus] = useState("");
  const [incomeInputCost, setIncomeInputCost] = useState("");

  const queryClient = useQueryClient();
  const brands = useQuery({ queryKey: ["brands"], queryFn: listBrands });
  const landlords = useQuery({ queryKey: ["landlords"], queryFn: listLandlords });
  const stations = useQuery({ queryKey: ["stations"], queryFn: () => listStations() });
  const contractsQ = useQuery({ queryKey: ["contracts"], queryFn: () => listContracts() });
  const excelDataQ = useQuery({ queryKey: ["excel-data"], queryFn: () => getExcelData() });
  const paymentRecordsQ = useQuery({ queryKey: ["payment-records"], queryFn: () => listPaymentRecords() });
  const incomeRecordsQ = useQuery({ queryKey: ["income-records"], queryFn: () => listIncomeRecords() });

  const contracts = useMemo(() => contractsQ.data ?? [], [contractsQ.data]);

  // 场地合同 brand_id 通常为 NULL，品牌筛选时会被过滤掉，必须在完整 contracts 里按站点匹配
  const findSiteContract = (stationName: string, fallbackContracts: any[]): any => {
    // 1) 优先按 station_name 精确匹配
    if (stationName) {
      const byName = contracts.find(
        (c: any) => c.contract_type === "场地合同" && c.station_name === stationName
      );
      if (byName) return byName;
    }
    // 2) station_name 缺失时，借组内任意合同的 station_id / landlord_id 反查
    const ref = fallbackContracts[0];
    if (ref?.station_id != null) {
      const bySid = contracts.find(
        (c: any) => c.contract_type === "场地合同" && c.station_id === ref.station_id
      );
      if (bySid) return bySid;
    }
    if (ref?.landlord_id != null) {
      const byLid = contracts.find(
        (c: any) => c.contract_type === "场地合同" && c.landlord_id === ref.landlord_id
      );
      if (byLid) return byLid;
    }
    // 3) 最后回退到组内可见合同
    return fallbackContracts.find((c: any) => c.contract_type === "场地合同");
  };

  // 年份筛选
  const yearFilteredContracts = useMemo(() => {
    if (!yearFilter) return contracts;
    const y = Number(yearFilter);
    return contracts.filter((c: any) => {
      if (!c.start_date) return true;
      const startYear = new Date(c.start_date).getFullYear();
      const endYear = new Date(c.early_end_date || c.end_date || new Date()).getFullYear();
      return startYear <= y && endYear >= y;
    });
  }, [contracts, yearFilter]);

  // ─── 按品牌方筛选模式 ───
  const brandFilteredContracts = useMemo(() => {
    if (!brandId) return yearFilteredContracts;
    return yearFilteredContracts.filter((c: any) => String(c.brand_id) === brandId);
  }, [yearFilteredContracts, brandId]);

  // 按站点分组（品牌方模式用）——选品牌后左侧列所有合作站点
  const groupedByStation = useMemo(() => {
    const groups: Record<string, { stationKey: string; stationName: string; contracts: any[] }> = {};
    for (const c of brandFilteredContracts) {
      const key = c.station_name || `station_${c.station_id || "unknown"}`;
      if (!groups[key]) {
        groups[key] = { stationKey: key, stationName: c.station_name || "未知站点", contracts: [] };
      }
      groups[key].contracts.push(c);
    }
    return Object.values(groups).sort((a, b) => a.stationName.localeCompare(b.stationName));
  }, [brandFilteredContracts]);

  // 选中的站点（品牌方模式下）
  const selectedStationGroup = useMemo(() => {
    if (!selectedStationKey) return null;
    return groupedByStation.find(g => g.stationKey === selectedStationKey) || null;
  }, [groupedByStation, selectedStationKey]);

  // ─── 按场地筛选模式 ───
  // 所有不重复的站点
  const allStations = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of yearFilteredContracts) {
      const name = c.station_name;
      if (name && !map.has(name)) {
        map.set(name, name);
      }
    }
    return Array.from(map.entries()).map(([key, name]) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [yearFilteredContracts]);

  // 选中站点下的品牌方分组
  const brandsForStation = useMemo(() => {
    if (!selectedStationId) return [];
    const groups: Record<number, { brand: any; contracts: any[] }> = {};
    for (const c of yearFilteredContracts) {
      if (c.station_name !== selectedStationId) continue;
      const bid = c.brand_id;
      if (!bid) continue;
      if (!groups[bid]) {
        const brand = brands.data?.find((b: any) => b.id === bid);
        groups[bid] = { brand: brand || { id: bid, name: `品牌#${bid}` }, contracts: [] };
      }
      groups[bid].contracts.push(c);
    }
    return Object.values(groups);
  }, [selectedStationId, yearFilteredContracts, brands.data]);

  // 选中的品牌方（场地模式下）
  const selectedBrandGroup = useMemo(() => {
    if (!selectedBrandForStation) return null;
    return brandsForStation.find(g => g.brand.id === selectedBrandForStation) || null;
  }, [brandsForStation, selectedBrandForStation]);

  // 计算汇总数据
  const summary = useMemo(() => {
    const landlordContracts = (filterMode === "brand" ? (selectedStationGroup?.contracts || brandFilteredContracts) : (selectedBrandGroup?.contracts || brandFilteredContracts));
    const siteContracts = landlordContracts.filter((c: any) => c.contract_type === "场地合同");
    const brandContracts = landlordContracts.filter((c: any) => c.contract_type === "品牌方合同");

    const totalRentCost = siteContracts.reduce((sum: number, c: any) => sum + Number(c.monthly_rent || 0) * 12, 0);
    const totalRentIncome = brandContracts.reduce((sum: number, c: any) => {
      const cabinets = Number(c.cabinets_count || 0);
      const unitRent = Number(c.unit_monthly_rent || c.monthly_rent || 0);
      return sum + cabinets * unitRent * 12;
    }, 0);
    const totalProfit = totalRentIncome - totalRentCost;

    return { totalRentCost, totalRentIncome, totalProfit, siteCount: groupedByStation.length };
  }, [selectedStationGroup, selectedBrandGroup, brandFilteredContracts, groupedByStation]);

  const invalidate = () => queryClient.invalidateQueries();

  const delContract = useMutation({
    mutationFn: deleteContract,
    onSuccess: () => { toast.success("已删除"); invalidate(); },
  });

  const savePaymentRecord = useMutation({
    mutationFn: upsertPaymentRecord,
    onSuccess: () => { toast.success("已保存"); queryClient.invalidateQueries({ queryKey: ["payment-records"] }); },
  });

  const saveIncomeRecord = useMutation({
    mutationFn: upsertIncomeRecord,
    onSuccess: () => { toast.success("已保存"); queryClient.invalidateQueries({ queryKey: ["income-records"] }); },
  });

  const toggleStation = (key: string) => {
    setExpandedStations(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const doExport = () => {
    const data = selectedStationGroup?.contracts || selectedBrandGroup?.contracts || brandFilteredContracts;
    if (data.length === 0) { toast.error("暂无数据可导出"); return; }

    const excelStations = excelDataQ.data?.stations ?? [];
    const allPayRecords = paymentRecordsQ.data ?? [];
    const allIncRecords = incomeRecordsQ.data ?? [];

    // 日期格式转换：2025-05-23 -> 2025.5.23
    const fmtDateDot = (v: unknown): string => {
      if (!v) return "";
      const s = String(v).slice(0, 10);
      const [y, m, d] = s.split("-");
      if (!y || !m || !d) return s;
      return `${y}.${Number(m)}.${Number(d)}`;
    };

    // 按站点分组
    const stationMap = new Map<number, { stationName: string; siteContract: any; brandContract: any }>();
    for (const c of data) {
      const sid = c.station_id || 0;
      if (!stationMap.has(sid)) {
        stationMap.set(sid, { stationName: c.station_name || "", siteContract: null, brandContract: null });
      }
      const entry = stationMap.get(sid)!;
      if (c.contract_type === "场地合同") entry.siteContract = c;
      if (c.contract_type === "品牌方合同") entry.brandContract = c;
    }

    // 品牌方筛选后 data 里没有场地合同，需要从完整 contracts 补上（站点维度）
    for (const [sid, entry] of stationMap) {
      if (!entry.siteContract) {
        entry.siteContract = contracts.find(
          (c: any) => c.contract_type === "场地合同" &&
            (c.station_id === sid || c.station_name === entry.stationName)
        );
      }
    }

    // 构建导出数据，严格按Excel列格式
    const rows: Record<string, unknown>[] = [];
    let seq = 0;
    for (const [, entry] of stationMap) {
      seq++;
      const sc = entry.siteContract;
      const bc = entry.brandContract;

      // 查找Excel台账数据
      const excelRow = excelStations.find((e: any) =>
        entry.stationName.includes(e.station_name) || e.station_name.includes(entry.stationName)
      );

      const cabinets = Number(bc?.cabinets_count || 0);
      const unitRent = Number(bc?.unit_monthly_rent || bc?.monthly_rent || 0);
      const monthlyRent = Number(bc?.monthly_rent || 0);
      const monthlyIncome = unitRent > 0 && cabinets > 0 ? cabinets * unitRent : monthlyRent;
      const annualIncome = monthlyIncome * 12;
      const monthlyCost = Number(bc?.venue_cost || sc?.monthly_rent || 0);
      const annualCost = monthlyCost * 12;
      const chargingCabinets = cabinets || Number(excelRow?.site_config?.charging_cabinets || 0);
      const storageCabinets = Number(excelRow?.site_config?.storage_cabinets || 0);
      const totalCabinets = chargingCabinets + storageCabinets || chargingCabinets;
      const unitCost = totalCabinets > 0 ? Math.round(annualCost / totalCabinets) : 0;
      // 合作年限
      const calcCoopYears = () => {
        if (!sc?.start_date) return excelRow?.payment_info?.cooperation_years || "";
        const start = new Date(sc.start_date);
        const end = new Date(sc.early_end_date || sc.end_date || new Date());
        const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        return Math.max(1, Math.ceil(months / 12)) + "年";
      };
      // 付款记录
      const payRecords = allPayRecords.filter((r: any) =>
        Number(r.station_id) === (sc?.station_id || 0) && Number(r.brand_id) === Number(bc?.brand_id || 0)
      );
      // 收款记录
      const incRecords = allIncRecords.filter((r: any) =>
        Number(r.station_id) === (sc?.station_id || 0) && Number(r.brand_id) === Number(bc?.brand_id || 0)
      );
      // 年度付款情况拼接
      const payStatusByYear = payRecords.map((r: any) => `${r.fiscal_year}:${r.pay_status || ""}`).join("; ");
      const invoiceByYear = payRecords.map((r: any) => `${r.fiscal_year}:${r.invoice || ""}`).join("; ");
      // 年度收款情况拼接
      const incomeStatusByYear = incRecords.map((r: any) => `${r.fiscal_year}:${r.income_status || ""}`).join("; ");
      const inputCostByYear = incRecords.map((r: any) => `${r.fiscal_year}:${r.input_cost || ""}`).join("; ");
      // 进项成本
      const totalInputCost = incRecords.reduce((sum: number, r: any) => sum + Number(r.input_cost || 0), 0) || Number(excelRow?.income_info?.input_cost || 0);
      // 税率
      const taxRate = bc?.rent_tax_enabled && bc?.rent_tax_rate ? bc.rent_tax_rate : (excelRow?.income_info?.tax_rate || "");
      const annualIncomeNet = taxRate ? Math.round(annualIncome / (1 + Number(taxRate)) * 100) / 100 : annualIncome;
      // 租金利润 = 租金收入（含税） - 租金成本；有场地税率时租金收入按不含税算
      const profit = annualIncomeNet - annualCost;
      // 分红
      const dividendAmount = Number(excelRow?.income_info?.dividend_amount || 0);
      const profitAfterDividend = dividendAmount > 0 ? profit - dividendAmount : 0;

      rows.push({
        "序号": seq,
        "收款公司": bc?.brand_name || excelRow?.company || "",
        "占股": excelRow?.share_ratio || "",
        "站名": entry.stationName,
        "站点号": excelRow?.station_no || "",
        "充电柜": chargingCabinets || "",
        "储电柜": storageCabinets || "",
        "合计": totalCabinets || "",
        "负责人": sc?.partner || landlords.data?.find((l: any) => l.id === sc?.landlord_id)?.contact || excelRow?.payment_info?.manager || "",
        "合同租期": sc ? `${fmtDateDot(sc.start_date)}-${fmtDateDot(sc.end_date)}` : (excelRow?.payment_info?.contract_period || ""),
        "合作年限": calcCoopYears(),
        "租金成本": annualCost || "",
        "付款方式": sc?.pay_method || excelRow?.payment_info?.pay_method || "",
        "25年~26年付款情况": payRecords.length > 0 ? payStatusByYear : (excelRow?.payment_info?.pay_status_25_26 || ""),
        "26年~27年付款情况": payRecords.length > 0 ? payStatusByYear : (excelRow?.payment_info?.pay_status_26_27 || ""),
        "付款情况": sc?.pay_status || excelRow?.payment_info?.pay_status || "",
        "单台成本": unitCost || "",
        "发票": invoiceByYear || "",
        "押金": sc?.deposit || excelRow?.payment_info?.deposit || "",
        "合同收款租期": bc ? `${fmtDateDot(bc.start_date)}-${fmtDateDot(bc.end_date)}` : (excelRow?.income_info?.income_contract_period || ""),
        "到账情况": bc?.pay_status || excelRow?.income_info?.receipt_status || "",
        "26-27收款信息签约/开票/到账情况": incRecords.length > 0 ? incomeStatusByYear : (excelRow?.income_info?.income_detail_26_27 || ""),
        "单台月租金（含税）": unitRent || excelRow?.income_info?.unit_monthly_rent_tax || "",
        "单台年收入（含税）": unitRent > 0 ? unitRent * 12 : (excelRow?.income_info?.unit_annual_income_tax || ""),
        "租金收入（含税）": annualIncome || excelRow?.income_info?.annual_income_tax || "",
        "税率": taxRate || "",
        "租金收入（不含税）": annualIncomeNet || "",
        "进项成本": inputCostByYear || totalInputCost || "",
        "租金利润": profit || "",
        "分红金额": dividendAmount || "",
        "分红后租金利润": dividendAmount ? profitAfterDividend : "",
      });
    }

    exportXlsx(`场租台账_${new Date().toISOString().slice(0, 10)}`, [{
      name: "美团租金台账",
      rows,
    }]);
    toast.success("已导出 Excel");
  };

  const th = "px-2.5 py-2.5 text-left text-xs font-medium text-slate-500 whitespace-nowrap";
  const thR = "px-2.5 py-2.5 text-right text-xs font-medium text-slate-500 whitespace-nowrap";

  return (
    <div className="flex h-[calc(100vh-120px)] gap-0">
      {/* ─── 左侧面板 ─── */}
      <div className="w-64 shrink-0 flex flex-col border-r bg-white rounded-l-xl overflow-hidden">
        <div className="border-b p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-700">场租台账</h3>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-[11px] h-6 px-2"
              onClick={() => { setEditRecord(null); setFormOpen(true); }}>
              <Plus className="h-3 w-3 mr-1" />新增
            </Button>
          </div>
          {/* 筛选模式切换 */}
          <div className="flex rounded-md border overflow-hidden text-[11px]">
            <button className={`flex-1 py-1 transition-colors ${filterMode === "brand" ? "bg-emerald-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              onClick={() => { setFilterMode("brand"); setSelectedStationId(null); setSelectedBrandForStation(null); }}>
              按品牌方
            </button>
            <button className={`flex-1 py-1 transition-colors ${filterMode === "station" ? "bg-emerald-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              onClick={() => { setFilterMode("station"); setBrandId(""); setSelectedStationKey(null); }}>
              按场地
            </button>
          </div>
          {/* 年份选择 */}
          <select className={`${inputCls} w-full text-xs`} value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
            <option value="">全部年份</option>
            <option value="2024">2024年</option>
            <option value="2025">2025年</option>
            <option value="2026">2026年</option>
            <option value="2027">2027年</option>
            <option value="2028">2028年</option>
          </select>
          {/* 品牌方/站点选择 */}
          {filterMode === "brand" ? (
            <select className={`${inputCls} w-full text-xs`} value={brandId} onChange={(e) => { setBrandId(e.target.value); setSelectedStationKey(null); }}>
              <option value="">全部品牌方</option>
              {(brands.data ?? []).map((b: any) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
            </select>
          ) : (
            <select className={`${inputCls} w-full text-xs`} value={selectedStationId || ""} onChange={(e) => { setSelectedStationId(e.target.value || null); setSelectedBrandForStation(null); }}>
              <option value="">选择站点</option>
              {allStations.map((s: any) => <option key={s.key} value={s.key}>{s.name}</option>)}
            </select>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {filterMode === "brand" ? (
            // 按品牌方模式：显示汇总 + 站点列表
            groupedByStation.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">暂无数据</div>
            ) : (
              <>
                {/* 汇总选项 */}
                <button
                  onClick={() => setSelectedStationKey(null)}
                  className={`flex w-full items-center gap-2 border-b px-3 py-2.5 text-left text-xs transition-colors ${!selectedStationKey ? "bg-emerald-50 border-l-2 border-l-emerald-500" : "hover:bg-slate-50"}`}
                >
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-emerald-700 truncate">汇总</div>
                    <div className="text-[11px] text-slate-400">{groupedByStation.length} 个站点 · {brandFilteredContracts.length} 份合同</div>
                  </div>
                </button>
                {/* 站点列表 */}
                {groupedByStation.map(({ stationKey, stationName, contracts }) => {
                  const isSelected = selectedStationKey === stationKey;
                  return (
                    <button
                      key={stationKey}
                      onClick={() => setSelectedStationKey(isSelected ? null : stationKey)}
                      className={`flex w-full items-center gap-2 border-b px-3 py-2.5 text-left text-xs transition-colors ${isSelected ? "bg-emerald-50 border-l-2 border-l-emerald-500" : "hover:bg-slate-50"}`}
                    >
                      <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-800 truncate">{stationName}</div>
                        <div className="text-[11px] text-slate-400">{contracts.length} 份合同</div>
                      </div>
                    </button>
                  );
                })}
              </>
            )
          ) : (
            // 按场地模式：显示品牌方列表
            !selectedStationId ? (
              <div className="p-4 text-center text-xs text-slate-400">请先选择站点</div>
            ) : brandsForStation.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">该站点暂无合同</div>
            ) : (
              brandsForStation.map(({ brand, contracts }) => {
                const isSelected = selectedBrandForStation === brand.id;
                return (
                  <button
                    key={brand.id}
                    onClick={() => setSelectedBrandForStation(isSelected ? null : brand.id)}
                    className={`flex w-full items-center gap-2 border-b px-3 py-2.5 text-left text-xs transition-colors ${isSelected ? "bg-emerald-50 border-l-2 border-l-emerald-500" : "hover:bg-slate-50"}`}
                  >
                    <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-800 truncate">{brand.name}</div>
                      <div className="text-[11px] text-slate-400">{contracts.length} 份合同</div>
                    </div>
                  </button>
                );
              })
            )
          )}
        </div>

        {/* 底部汇总 */}
        <div className="border-t p-3 space-y-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">年租金成本</span>
            <span className="font-medium text-rose-600 tabular-nums">{fmtMoney(summary.totalRentCost)}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">年租金收入</span>
            <span className="font-medium text-emerald-600 tabular-nums">{fmtMoney(summary.totalRentIncome)}</span>
          </div>
          <div className="flex justify-between text-[11px] font-semibold border-t pt-1">
            <span className="text-slate-700">租金利润</span>
            <span className="tabular-nums text-emerald-600">{fmtMoney(summary.totalProfit)}</span>
          </div>
        </div>
      </div>

      {/* ─── 右侧内容区 ─── */}
      <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
        {/* 判断是否有选中项 */}
        {(filterMode === "brand" && !brandId) || (filterMode === "station" && !selectedBrandGroup) ? (
          <div className="flex h-full items-center justify-center text-slate-400">
            <div className="text-center">
              <Building2 className="h-12 w-12 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">{filterMode === "brand" ? "请先选择品牌方" : "请先选择站点和品牌方"}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 标题 */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">
                {filterMode === "brand"
                  ? `${brands.data?.find((b: any) => String(b.id) === brandId)?.name || ""}${selectedStationGroup ? ` - ${selectedStationGroup.stationName}` : "（汇总）"}`
                  : `${selectedStationId || ""} - ${selectedBrandGroup?.brand.name || ""}`}
              </h2>
              <Button variant="outline" size="sm" onClick={doExport}>
                <Download className="h-4 w-4 mr-1.5" />导出表格
              </Button>
            </div>

            {/* 站点列表 */}
            {(() => {
              // 按站点分组（用 station_name，因为 station_id 可能为 null）
              const activeContracts = filterMode === "brand"
                ? (selectedStationGroup?.contracts || brandFilteredContracts)
                : (selectedBrandGroup?.contracts || []);
              const stationGroups: Record<string, { stationName: string; contracts: any[] }> = {};
              for (const c of activeContracts) {
                const key = c.station_name || "未知站点";
                if (!stationGroups[key]) {
                  stationGroups[key] = { stationName: key, contracts: [] };
                }
                stationGroups[key].contracts.push(c);
              }
              const stationList = Object.values(stationGroups);

              return (
                <div className="space-y-3">
                  {stationList.map(({ stationName, contracts }) => {
                    const isExpanded = expandedStations.has(stationName);
                    const siteContract = findSiteContract(stationName, contracts);
                    const brandContract = contracts.find((c: any) => c.contract_type === "品牌方合同");
                    const cabinets = Number(brandContract?.cabinets_count || 0);
                    const unitRent = Number(brandContract?.unit_monthly_rent || brandContract?.monthly_rent || 0);
                    const monthlyRent = Number(brandContract?.monthly_rent || 0);
                    const monthlyIncome = unitRent > 0 && cabinets > 0 ? cabinets * unitRent : monthlyRent;
                    const annualIncome = monthlyIncome * 12;
                    const monthlyCost = Number(brandContract?.venue_cost || siteContract?.monthly_rent || 0);
                    const annualCost = monthlyCost * 12;
                    const profit = annualIncome - annualCost;

                    return (
                      <div key={stationName} className="rounded-xl border bg-white overflow-hidden">
                        {/* 站点头部 */}
                        <button
                          onClick={() => toggleStation(stationName)}
                          className="flex w-full items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <MapPin className="h-4 w-4 text-emerald-500" />
                            <div className="text-left">
                              <div className="font-medium text-slate-800">{stationName}</div>
                              <div className="text-[11px] text-slate-400">
                                {cabinets > 0 ? `${cabinets} 柜` : ""}
                                {siteContract?.partner ? ` · ${siteContract.partner}` : ""}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-xs text-slate-500">年租金收入</div>
                              <div className="font-semibold text-emerald-600 tabular-nums">{fmtMoney(annualIncome)}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-slate-500">年租金成本</div>
                              <div className="font-semibold text-rose-600 tabular-nums">{fmtMoney(annualCost)}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-slate-500">利润</div>
                              <div className={`font-semibold tabular-nums ${profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtMoney(profit)}</div>
                            </div>
                            {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                          </div>
                        </button>

                        {/* 展开详情 */}
                        {isExpanded && (
                          <div className="border-t px-4 py-4 space-y-4">
                            {/* 查找Excel台账数据 */}
                            {(() => {
                              const excelStations = excelDataQ.data?.stations ?? [];
                              const excelRow = excelStations.find((e: any) => stationName.includes(e.station_name) || e.station_name.includes(stationName));
                              const pi = excelRow?.payment_info || {};
                              const ii = excelRow?.income_info || {};
                              const sc = excelRow?.site_config || {};
                              // 计算单台成本
                              const totalCabinets = cabinets || Number(sc.total || 0);
                              const unitCost = totalCabinets > 0 ? Math.round(annualCost / totalCabinets) : 0;
                              // 税率
                              const taxRate = brandContract?.rent_tax_enabled && brandContract?.rent_tax_rate
                                ? brandContract.rent_tax_rate : (ii.tax_rate || "");
                              const annualIncomeNet = taxRate ? Math.round(annualIncome / (1 + Number(taxRate)) * 100) / 100 : annualIncome;
                              // 合作年限：从合同起止日期计算，不足1年按1年
                              const calcCoopYears = () => {
                                if (!siteContract?.start_date) return pi.cooperation_years || "-";
                                const start = new Date(siteContract.start_date);
                                const end = new Date(siteContract.early_end_date || siteContract.end_date || new Date());
                                const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
                                return Math.max(1, Math.ceil(months / 12)) + "年";
                              };
                              // 付款记录（用 station_name 匹配）
                              const payRecords = (paymentRecordsQ.data ?? []).filter((r: any) =>
                                r.station_name === stationName && Number(r.brand_id) === Number(brandContract?.brand_id || 0)
                              );
                              // 收款记录（用 station_name 匹配）
                              const incRecords = (incomeRecordsQ.data ?? []).filter((r: any) =>
                                r.station_name === stationName && Number(r.brand_id) === Number(brandContract?.brand_id || 0)
                              );
                              // 租金利润 = 租金收入（含税） - 租金成本；有场地税率时租金收入按不含税算
                              const calcProfit = annualIncomeNet - annualCost;
                              // 分红金额和分红后租金利润（从Excel读取）
                              const dividendAmount = Number(ii.dividend_amount || 0);
                              const profitAfterDividend = dividendAmount > 0 ? calcProfit - dividendAmount : 0;

                              return (
                                <>
                                  {/* 站点配置 */}
                                  <div className="grid grid-cols-4 gap-3">
                                    <div className="rounded-lg border bg-slate-50 px-3 py-2">
                                      <div className="text-[10px] text-slate-400">充电柜</div>
                                      <div className="text-sm font-semibold tabular-nums">{cabinets || sc.charging_cabinets || "-"}</div>
                                    </div>
                                    <div className="rounded-lg border bg-slate-50 px-3 py-2">
                                      <div className="text-[10px] text-slate-400">储电柜</div>
                                      <div className="text-sm font-semibold tabular-nums">{sc.storage_cabinets || "-"}</div>
                                    </div>
                                    <div className="rounded-lg border bg-slate-50 px-3 py-2">
                                      <div className="text-[10px] text-slate-400">合计</div>
                                      <div className="text-sm font-semibold tabular-nums">{totalCabinets || "-"}</div>
                                    </div>
                                    <div className="rounded-lg border bg-slate-50 px-3 py-2">
                                      <div className="text-[10px] text-slate-400">站点号</div>
                                      <div className="text-sm font-semibold">{excelRow?.station_no || "-"}</div>
                                    </div>
                                  </div>

                                  {/* 付款信息 */}
                                  <div className="rounded-lg border overflow-hidden">
                                    <div className="bg-rose-50 px-3 py-2 border-b flex items-center justify-between">
                                      <h4 className="text-xs font-semibold text-rose-700">付款信息</h4>
                                    </div>
                                    <div className="p-3">
                                      <table className="w-full text-xs">
                                        <tbody>
                                          <tr className="border-b"><td className="py-1.5 text-slate-500 w-24">负责人</td><td className="py-1.5 font-medium">{siteContract?.partner || landlords.data?.find((l: any) => l.id === siteContract?.landlord_id)?.contact || pi.manager || "-"}</td></tr>
                                          <tr className="border-b"><td className="py-1.5 text-slate-500">合同租期</td><td className="py-1.5 font-medium">{siteContract ? `${fmtDate(siteContract.start_date)} ~ ${fmtDate(siteContract.end_date)}` : (pi.contract_period || "-")}</td></tr>
                                          <tr className="border-b"><td className="py-1.5 text-slate-500">合作年限</td><td className="py-1.5">{calcCoopYears()}</td></tr>
                                          <tr className="border-b"><td className="py-1.5 text-slate-500">承担场地成本（元/月）</td><td className="py-1.5 font-medium tabular-nums">{monthlyCost ? fmtMoney(monthlyCost) : "-"}</td></tr>
                                          <tr className="border-b"><td className="py-1.5 text-slate-500">租金成本（元/年）</td><td className="py-1.5 font-medium tabular-nums">{fmtMoney(annualCost)}</td></tr>
                                          <tr className="border-b"><td className="py-1.5 text-slate-500">付款方式</td><td className="py-1.5">{siteContract?.pay_method || pi.pay_method || "-"}</td></tr>
                                          {/* 年度付款情况 - 从数据库记录读取 */}
                                          {payRecords.map((r: any) => (
                                            <tr key={r.id} className="border-b">
                                              <td className="py-1.5 text-slate-500">{r.fiscal_year}付款情况</td>
                                              <td className="py-1.5">{r.pay_status || "-"}</td>
                                            </tr>
                                          ))}
                                          {/* Excel中的历史数据（如果没有数据库记录则显示Excel） */}
                                          {payRecords.length === 0 && pi.pay_status_25_26 && (
                                            <tr className="border-b"><td className="py-1.5 text-slate-500">25年~26年付款情况</td><td className="py-1.5">{pi.pay_status_25_26}</td></tr>
                                          )}
                                          {payRecords.length === 0 && pi.pay_status_26_27 && (
                                            <tr className="border-b"><td className="py-1.5 text-slate-500">26年~27年付款情况</td><td className="py-1.5">{pi.pay_status_26_27}</td></tr>
                                          )}
                                          <tr className="border-b"><td className="py-1.5 text-slate-500">付款情况</td><td className="py-1.5"><StatusBadge status={siteContract?.pay_status || pi.pay_status || "未知"} /></td></tr>
                                          <tr className="border-b"><td className="py-1.5 text-slate-500">单台成本</td><td className="py-1.5 font-medium tabular-nums">{unitCost ? fmtMoney(unitCost) : (pi.unit_cost ? fmtMoney(Number(pi.unit_cost)) : "-")}</td></tr>
                                          {/* 发票 - 从数据库记录读取 */}
                                          {payRecords.map((r: any) => (
                                            <tr key={`inv-${r.id}`} className="border-b">
                                              <td className="py-1.5 text-slate-500">发票（{r.fiscal_year}）</td>
                                              <td className="py-1.5">{r.invoice || "-"}</td>
                                            </tr>
                                          ))}
                                          {payRecords.length === 0 && (
                                            <tr className="border-b"><td className="py-1.5 text-slate-500">发票</td><td className="py-1.5 text-slate-400">-</td></tr>
                                          )}
                                          <tr><td className="py-1.5 text-slate-500">押金</td><td className="py-1.5 tabular-nums">{siteContract?.deposit ? fmtMoney(siteContract.deposit) : (pi.deposit ? fmtMoney(Number(pi.deposit)) : "-")}</td></tr>
                                        </tbody>
                                      </table>
                                      {/* 添加付款记录按钮 */}
                                      {addPayForm?.stationName === stationName ? (
                                        <div className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3">
                                          <div>
                                            <label className="text-[10px] text-slate-400 block mb-0.5">年份范围</label>
                                            <input className={inputCls + " w-24 text-xs"} placeholder="如 25~26" value={payYear} onChange={e => setPayYear(e.target.value)} />
                                          </div>
                                          <div>
                                            <label className="text-[10px] text-slate-400 block mb-0.5">付款情况</label>
                                            <input className={inputCls + " w-40 text-xs"} placeholder="付款情况" value={payStatus} onChange={e => setPayStatus(e.target.value)} />
                                          </div>
                                          <div>
                                            <label className="text-[10px] text-slate-400 block mb-0.5">发票</label>
                                            <input className={inputCls + " w-32 text-xs"} placeholder="发票信息" value={payInvoice} onChange={e => setPayInvoice(e.target.value)} />
                                          </div>
                                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-[11px] h-7 px-3"
                                            onClick={() => {
                                              if (!payYear) { toast.error("请输入年份范围"); return; }
                                              savePaymentRecord.mutate({
                                                stationName: stationName,
                                                brandId: Number(brandContract?.brand_id || 0),
                                                fiscalYear: payYear,
                                                payStatus,
                                                invoice: payInvoice,
                                              });
                                              setAddPayForm(null); setPayYear(""); setPayStatus(""); setPayInvoice("");
                                            }}>保存</Button>
                                          <Button size="sm" variant="outline" className="text-[11px] h-7 px-3" onClick={() => { setAddPayForm(null); setPayYear(""); setPayStatus(""); setPayInvoice(""); }}>取消</Button>
                                        </div>
                                      ) : (
                                        <div className="mt-2">
                                          <Button size="sm" variant="outline" className="text-[11px] h-6 px-2"
                                            onClick={() => setAddPayForm({ stationName: stationName, brandId: Number(brandContract?.brand_id || 0) })}>
                                            + 添加付款记录
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* 收款信息 */}
                                  <div className="rounded-lg border overflow-hidden">
                                    <div className="bg-emerald-50 px-3 py-2 border-b flex items-center justify-between">
                                      <h4 className="text-xs font-semibold text-emerald-700">收款信息</h4>
                                    </div>
                                    <div className="p-3">
                                      <table className="w-full text-xs">
                                        <tbody>
                                          <tr className="border-b"><td className="py-1.5 text-slate-500 w-24">合同收款租期</td><td className="py-1.5 font-medium">{brandContract ? `${fmtDate(brandContract.start_date)} ~ ${fmtDate(brandContract.end_date)}` : (ii.income_contract_period || "-")}</td></tr>
                                          <tr className="border-b"><td className="py-1.5 text-slate-500">到账情况</td><td className="py-1.5"><StatusBadge status={brandContract?.pay_status || ii.receipt_status || "未知"} /></td></tr>
                                          {/* 年度收款记录 - 从数据库读取 */}
                                          {incRecords.map((r: any) => (
                                            <tr key={r.id} className="border-b">
                                              <td className="py-1.5 text-slate-500">{r.fiscal_year}收款信息签约/开票/到账情况</td>
                                              <td className="py-1.5">{r.income_status || "-"}</td>
                                            </tr>
                                          ))}
                                          {/* Excel历史数据 */}
                                          {incRecords.length === 0 && ii.income_detail_26_27 && (
                                            <tr className="border-b"><td className="py-1.5 text-slate-500">26-27收款信息签约/开票/到账情况</td><td className="py-1.5">{ii.income_detail_26_27}</td></tr>
                                          )}
                                          <tr className="border-b"><td className="py-1.5 text-slate-500">单台月租金（含税）</td><td className="py-1.5 font-medium tabular-nums">{unitRent ? fmtMoney(unitRent) : (ii.unit_monthly_rent_tax ? fmtMoney(Number(ii.unit_monthly_rent_tax)) : "-")}</td></tr>
                                          <tr className="border-b"><td className="py-1.5 text-slate-500">单台年收入（含税）</td><td className="py-1.5 font-medium tabular-nums">{unitRent ? fmtMoney(unitRent * 12) : (ii.unit_annual_income_tax ? fmtMoney(Number(ii.unit_annual_income_tax)) : "-")}</td></tr>
                                          <tr className="border-b"><td className="py-1.5 text-slate-500">租金收入（含税）</td><td className="py-1.5 font-medium tabular-nums text-emerald-600">{fmtMoney(annualIncome)}</td></tr>
                                          <tr className="border-b"><td className="py-1.5 text-slate-500">税率</td><td className="py-1.5">{taxRate ? `${(Number(taxRate) * 100).toFixed(0)}%` : "-"}</td></tr>
                                          <tr className="border-b"><td className="py-1.5 text-slate-500">租金收入（不含税）</td><td className="py-1.5 font-medium tabular-nums">{fmtMoney(annualIncomeNet)}</td></tr>
                                          {/* 进项成本 - 从数据库记录读取 */}
                                          {incRecords.map((r: any) => (
                                            <tr key={`ic-${r.id}`} className="border-b">
                                              <td className="py-1.5 text-slate-500">进项成本（{r.fiscal_year}）</td>
                                              <td className="py-1.5 tabular-nums">{r.input_cost ? fmtMoney(Number(r.input_cost)) : "-"}</td>
                                            </tr>
                                          ))}
                                          {incRecords.length === 0 && (
                                            <tr className="border-b"><td className="py-1.5 text-slate-500">进项成本</td><td className="py-1.5 tabular-nums">{ii.input_cost ? fmtMoney(Number(ii.input_cost)) : "-"}</td></tr>
                                          )}
                                          <tr className="border-b"><td className="py-1.5 text-slate-500">租金利润</td><td className="py-1.5 font-medium tabular-nums text-emerald-600">{fmtMoney(calcProfit)}</td></tr>
                                          <tr className="border-b"><td className="py-1.5 text-slate-500">分红金额</td><td className="py-1.5 tabular-nums">{dividendAmount ? fmtMoney(dividendAmount) : (ii.dividend_amount || "-")}</td></tr>
                                          <tr><td className="py-1.5 text-slate-500">分红后租金利润</td><td className="py-1.5 font-medium tabular-nums">{dividendAmount ? fmtMoney(profitAfterDividend) : "-"}</td></tr>
                                        </tbody>
                                      </table>
                                      {/* 添加收款记录按钮 */}
                                      {addIncomeForm?.stationName === stationName ? (
                                        <div className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3">
                                          <div>
                                            <label className="text-[10px] text-slate-400 block mb-0.5">年份范围</label>
                                            <input className={inputCls + " w-24 text-xs"} placeholder="如 26~27" value={incomeYear} onChange={e => setIncomeYear(e.target.value)} />
                                          </div>
                                          <div>
                                            <label className="text-[10px] text-slate-400 block mb-0.5">签约/开票/到账情况</label>
                                            <input className={inputCls + " w-48 text-xs"} placeholder="情况描述" value={incomeStatus} onChange={e => setIncomeStatus(e.target.value)} />
                                          </div>
                                          <div>
                                            <label className="text-[10px] text-slate-400 block mb-0.5">进项成本</label>
                                            <input className={inputCls + " w-28 text-xs"} type="number" placeholder="金额" value={incomeInputCost} onChange={e => setIncomeInputCost(e.target.value)} />
                                          </div>
                                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-[11px] h-7 px-3"
                                            onClick={() => {
                                              if (!incomeYear) { toast.error("请输入年份范围"); return; }
                                              saveIncomeRecord.mutate({
                                                stationName: stationName,
                                                brandId: Number(brandContract?.brand_id || 0),
                                                fiscalYear: incomeYear,
                                                incomeStatus,
                                                inputCost: incomeInputCost ? Number(incomeInputCost) : null,
                                              });
                                              setAddIncomeForm(null); setIncomeYear(""); setIncomeStatus(""); setIncomeInputCost("");
                                            }}>保存</Button>
                                          <Button size="sm" variant="outline" className="text-[11px] h-7 px-3" onClick={() => { setAddIncomeForm(null); setIncomeYear(""); setIncomeStatus(""); setIncomeInputCost(""); }}>取消</Button>
                                        </div>
                                      ) : (
                                        <div className="mt-2">
                                          <Button size="sm" variant="outline" className="text-[11px] h-6 px-2"
                                            onClick={() => setAddIncomeForm({ stationName: stationName, brandId: Number(brandContract?.brand_id || 0) })}>
                                            + 添加收款记录
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </>
                              );
                            })()}

                            {/* 操作按钮 */}
                            <div className="flex justify-end gap-2">
                              {contracts.map((c: any) => (
                                <Button key={c.id} variant="outline" size="sm" onClick={() => { setEditRecord(c); setFormOpen(true); }}>
                                  <Pencil className="h-3 w-3 mr-1" />编辑{c.contract_type === "场地合同" ? "付款" : "收款"}合同
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* 表单弹窗 */}
      <ContractForm open={formOpen} onClose={() => { setFormOpen(false); setEditRecord(null); }} record={editRecord} />
    </div>
  );
}
