import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listContracts, createContract, updateContract, deleteContract } from "@/api/contracts";
import { listBrands, listLandlords } from "@/api/directory";
import { listStations } from "@/api/stations";
import { listMeters } from "@/api/meters";
import { listCabinets } from "@/api/cabinets";
import { Money, StatusBadge } from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Field, NumInput, TextInput, DateInput, SelectInput, inputCls } from "@/components/fields";
import { exportXlsx } from "@/lib/export";
import { fmtMoney, fmtNum, fmtDate } from "@/lib/format";
import { Download, Plus, Search, Pencil, Trash2, AlertTriangle, FileText, ArrowDownCircle, ArrowUpCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function Contracts() {
  const [keyword, setKeyword] = useState("");
  const [brandId, setBrandId] = useState("");
  const [landlordId, setLandlordId] = useState("");
  const [contractType, setContractType] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formType, setFormType] = useState("场地合同");

  const queryClient = useQueryClient();
  const brands = useQuery({ queryKey: ["brands"], queryFn: listBrands });
  const landlords = useQuery({ queryKey: ["landlords"], queryFn: listLandlords });
  const list = useQuery({
    queryKey: ["contracts", keyword, brandId, landlordId, contractType],
    queryFn: () => listContracts({
      keyword: keyword || undefined,
      brandId: brandId ? Number(brandId) : undefined,
      landlordId: landlordId ? Number(landlordId) : undefined,
      contractType: contractType || undefined,
    }),
  });

  const del = useMutation({
    mutationFn: deleteContract,
    onSuccess: () => { toast.success("已删除"); queryClient.invalidateQueries({ queryKey: ["contracts"] }); },
  });

  const rows = useMemo(() => {
    let data = list.data ?? [];
    if (statusFilter) data = data.filter((c: any) => c.status === statusFilter);
    return data;
  }, [list.data, statusFilter]);

  const counts = useMemo(() => {
    const all = list.data ?? [];
    return {
      total: all.length,
      normal: all.filter((c: any) => c.status === "正常").length,
      expiring: all.filter((c: any) => c.status === "临期").length,
      expired: all.filter((c: any) => c.status === "已到期").length,
    };
  }, [list.data]);

  // 按站点分组，并分离场地合同和品牌方合同
  const groupedByStation = useMemo(() => {
    const groups = new Map<number, any>();
    for (const r of rows) {
      const sid = r.station_id || 0;
      if (!groups.has(sid)) {
        groups.set(sid, {
          stationId: sid,
          stationName: r.station_name,
          landlordName: r.landlord_name,
          costContracts: [],   // 场地合同
          incomeContracts: [], // 品牌方合同
        });
      }
      const group = groups.get(sid);
      if (r.contract_type === "品牌方合同") {
        group.incomeContracts.push(r);
      } else {
        group.costContracts.push(r);
      }
    }
    return [...groups.values()];
  }, [rows]);

  const doExport = () => {
    if (rows.length === 0) { toast.error("暂无数据可导出"); return; }
    exportXlsx(`合同管理_${new Date().toISOString().slice(0, 10)}`, [{
      name: "合同管理",
      rows: rows.map((c: any) => ({
        站点: c.station_name, 场地方: c.landlord_name ?? "", 品牌方: c.brand_name ?? "",
        合同类型: c.contract_type, 电费单价_税前: c.electricity_price ?? "",
        税后计算: c.tax_enabled ? "是" : "否", 税率: c.tax_enabled ? `${(Number(c.tax_rate) * 100).toFixed(0)}%` : "",
        电费单价_税后: c.tax_enabled && c.post_tax_electricity_price ? c.post_tax_electricity_price : "",
        租金金额: c.rent_amount ?? "", 月租金: c.monthly_rent ?? "",
        付款方式: c.pay_method ?? "", 合作方: c.partner ?? "",
        开始日期: fmtDate(c.start_date, ""), 结束日期: fmtDate(c.end_date, ""),
        剩余天数: c.days_left ?? "", 状态: c.status, 备注: c.remark ?? "",
      })),
    }]);
    toast.success("已导出 Excel");
  };

  const openCreate = (type: string) => {
    setFormType(type);
    setEditing(null);
    setFormOpen(true);
  };

  const th = "px-3 py-2.5 text-left text-xs font-medium text-slate-500 whitespace-nowrap";
  const thR = "px-3 py-2.5 text-right text-xs font-medium text-slate-500 whitespace-nowrap";

  return (
    <div className="space-y-4">
      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "合同总数", value: counts.total, cls: "text-slate-800", filter: "" },
          { label: "正常", value: counts.normal, cls: "text-emerald-600", filter: "正常" },
          { label: "临期（90天内）", value: counts.expiring, cls: "text-amber-600", filter: "临期" },
          { label: "已到期", value: counts.expired, cls: "text-rose-600", filter: "已到期" },
        ].map((c) => (
          <button key={c.label} onClick={() => setStatusFilter(statusFilter === c.filter ? "" : c.filter)}
            className={`rounded-xl border bg-white p-4 text-left shadow-sm transition-colors hover:border-emerald-300 ${statusFilter === c.filter && c.filter ? "border-emerald-500 ring-1 ring-emerald-500" : ""}`}>
            <div className="text-xs text-slate-500">{c.label}</div>
            <div className={`mt-1 text-2xl font-bold tabular-nums ${c.cls}`}>{c.value}</div>
          </button>
        ))}
      </div>

      {(counts.expiring > 0 || counts.expired > 0) && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
          <AlertTriangle className="h-4 w-4" />
          有 {counts.expiring} 份合同 90 天内到期、{counts.expired} 份已到期，请及时跟进续约。
        </div>
      )}

      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input className={`${inputCls} w-48 pl-8`} placeholder="搜索站点 / 合作方…" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        </div>
        <select className={`${inputCls} w-40`} value={landlordId} onChange={(e) => setLandlordId(e.target.value)}>
          <option value="">全部场地方</option>
          {(landlords.data ?? []).map((l: any) => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
        </select>
        <select className={`${inputCls} w-40`} value={brandId} onChange={(e) => setBrandId(e.target.value)}>
          <option value="">全部品牌方</option>
          {(brands.data ?? []).map((b: any) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={doExport}><Download className="mr-1.5 h-4 w-4" />导出表格</Button>
          <Button variant="outline" className="text-rose-600" onClick={() => openCreate("场地合同")}>
            <Plus className="mr-1 h-4 w-4" />场地合同
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => openCreate("品牌方合同")}>
            <Plus className="mr-1 h-4 w-4" />品牌方合同
          </Button>
        </div>
      </div>

      {/* 按站点分组展示 */}
      <div className="space-y-6">
        {groupedByStation.map((group: any) => {
          const totalCost = group.costContracts.reduce((t: number, c: any) => t + (c.monthly_rent ? Number(c.monthly_rent) : 0), 0);
          const totalIncome = group.incomeContracts.reduce((t: number, c: any) => t + (c.monthly_rent ? Number(c.monthly_rent) : 0), 0);

          return (
            <div key={group.stationId} className="rounded-xl border bg-white shadow-sm">
              {/* 站点头部 */}
              <div className="border-b px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-slate-700">{group.stationName || "未关联站点"}</span>
                  {group.landlordName && <span className="text-xs text-slate-400">场地方：{group.landlordName}</span>}
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-rose-600">月成本 <b className="tabular-nums">{fmtMoney(totalCost)}</b></span>
                  <span className="text-emerald-600">月收入 <b className="tabular-nums">{fmtMoney(totalIncome)}</b></span>
                  <span className="text-slate-600">月利润 <b className="tabular-nums">{fmtMoney(totalIncome - totalCost)}</b></span>
                </div>
              </div>

              {/* 成本合同（场地合同） */}
              <div className="border-b">
                <div className="flex items-center gap-2 bg-rose-50/50 px-5 py-2">
                  <ArrowDownCircle className="h-4 w-4 text-rose-500" />
                  <span className="text-xs font-semibold text-rose-600">场地合同（{group.costContracts.length} 份）</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b bg-slate-50">
                      <th className={th}>合同类型</th>
                      <th className={th}>场地方</th>
                      <th className={thR}>电费单价</th>
                      <th className={thR}>年租金</th>
                      <th className={thR}>月租金</th>
                      <th className={th}>场地租金付款方式</th>
                      <th className={th}>合同期限</th>
                      <th className={thR}>剩余天数</th>
                      <th className={th}>状态</th>
                      <th className={th}>备注</th>
                      <th className={`${th} text-center`}>操作</th>
                    </tr></thead>
                    <tbody>
                      {group.costContracts.map((c: any) => (
                        <tr key={c.id} className={`border-b last:border-0 hover:bg-slate-50/60 ${c.status === "已到期" ? "bg-rose-50/30" : c.status === "临期" ? "bg-amber-50/30" : ""}`}>
                          <td className="px-3 py-2.5 font-medium">{c.contract_type}</td>
                          <td className="px-3 py-2.5 text-slate-600">{c.landlord_name ?? "-"}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{c.electricity_price ? fmtNum(c.electricity_price) : "-"}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{c.rent_amount ? fmtMoney(c.rent_amount) : "-"}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{c.monthly_rent ? fmtMoney(c.monthly_rent) : "-"}</td>
                          <td className="px-3 py-2.5">{c.pay_method ?? "-"}</td>
                          <td className="whitespace-nowrap px-3 py-2.5">{fmtDate(c.start_date)} ~ {fmtDate(c.end_date)}</td>
                          <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${c.status === "已到期" ? "text-rose-600" : c.status === "临期" ? "text-amber-600" : "text-slate-600"}`}>
                            {c.days_left ?? "-"}
                          </td>
                          <td className="px-3 py-2.5"><StatusBadge status={c.status} /></td>
                          <td className="max-w-[120px] truncate px-3 py-2.5 text-slate-500" title={c.remark ?? ""}>{c.remark ?? "-"}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex justify-center gap-0.5">
                              <button className="rounded p-1 text-slate-400 hover:text-emerald-600" onClick={() => { setEditing(c); setFormType(c.contract_type); setFormOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
                              <button className="rounded p-1 text-slate-400 hover:text-rose-500" onClick={() => window.confirm("删除？") && del.mutate(c.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {group.costContracts.length === 0 && (
                        <tr><td colSpan={11} className="py-4 text-center text-slate-400">暂无成本合同</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 收入合同（品牌方合同） */}
              <div>
                <div className="flex items-center gap-2 bg-emerald-50/50 px-5 py-2">
                  <ArrowUpCircle className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-semibold text-emerald-600">收入合同（{group.incomeContracts.length} 份）</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b bg-slate-50">
                      <th className={th}>品牌方</th>
                      <th className={thR}>单柜场地月租</th>
                      <th className={thR}>计费柜数</th>
                      <th className={thR}>场地月租金</th>
                      <th className={thR}>电费单价（税前）</th>
                      <th className={thR}>电费单价（税后）</th>
                      <th className={th}>场地租金付款方式</th>
                      <th className={th}>合同期限</th>
                      <th className={thR}>剩余天数</th>
                      <th className={th}>状态</th>
                      <th className={th}>备注</th>
                      <th className={`${th} text-center`}>操作</th>
                    </tr></thead>
                    <tbody>
                      {group.incomeContracts.map((c: any) => (
                        <tr key={c.id} className={`border-b last:border-0 hover:bg-slate-50/60 ${c.status === "已到期" ? "bg-rose-50/30" : c.status === "临期" ? "bg-amber-50/30" : ""}`}>
                          <td className="px-3 py-2.5 font-medium">{c.brand_name ?? "-"}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{c.unit_monthly_rent ? fmtMoney(c.unit_monthly_rent) : "-"}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{c.cabinets_count ? fmtNum(c.cabinets_count) : "-"}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{c.monthly_rent ? fmtMoney(c.monthly_rent) : "-"}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{c.electricity_price ? fmtNum(c.electricity_price) : "-"}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {c.tax_enabled && c.post_tax_electricity_price
                              ? <span className="text-emerald-600 font-medium">{fmtNum(c.post_tax_electricity_price)}</span>
                              : "-"}
                          </td>
                          <td className="px-3 py-2.5">{c.pay_method ?? "-"}</td>
                          <td className="whitespace-nowrap px-3 py-2.5">{fmtDate(c.start_date)} ~ {fmtDate(c.end_date)}</td>
                          <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${c.status === "已到期" ? "text-rose-600" : c.status === "临期" ? "text-amber-600" : "text-slate-600"}`}>
                            {c.days_left ?? "-"}
                          </td>
                          <td className="px-3 py-2.5"><StatusBadge status={c.status} /></td>
                          <td className="max-w-[120px] truncate px-3 py-2.5 text-slate-500" title={c.remark ?? ""}>{c.remark ?? "-"}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex justify-center gap-0.5">
                              <button className="rounded p-1 text-slate-400 hover:text-emerald-600" onClick={() => { setEditing(c); setFormType("品牌方合同"); setFormOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
                              <button className="rounded p-1 text-slate-400 hover:text-rose-500" onClick={() => window.confirm("删除？") && del.mutate(c.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {group.incomeContracts.length === 0 && (
                        <tr><td colSpan={11} className="py-4 text-center text-slate-400">暂无收入合同</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}
        {groupedByStation.length === 0 && (
          <div className="rounded-xl border border-dashed py-16 text-center text-slate-400">
            {list.isLoading ? "加载中…" : "暂无合同数据"}
          </div>
        )}
      </div>

      <ContractForm open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} record={editing} defaultType={formType} />
    </div>
  );
}

// ─── 合同表单 ───
function ContractForm({ open, onClose, record, defaultType }: { open: boolean; onClose: () => void; record?: any; defaultType?: string }) {
  const blank = {
    stationId: "", stationName: "", landlordId: "", brandId: "", contractType: defaultType || "场地合同",
    electricityPrice: "", rentAmount: "", cabinetsCount: "", unitMonthlyRent: "", monthlyRent: "",
    rentCalcMethod: "按柜子数量", payMethod: "", address: "", partner: "", payEntity: "",
    startDate: "", endDate: "", payStatus: "未付款",
    taxEnabled: false, taxRate: "0.01", postTaxElectricityPrice: "",
    remark: "",
  };
  const [f, setF] = useState(blank);
  const queryClient = useQueryClient();
  const stations = useQuery({ queryKey: ["stations"], queryFn: () => listStations(), enabled: open });
  const brands = useQuery({ queryKey: ["brands"], queryFn: listBrands, enabled: open });
  const landlords = useQuery({ queryKey: ["landlords"], queryFn: listLandlords, enabled: open });
  const meters = useQuery({ queryKey: ["meters"], queryFn: () => listMeters(), enabled: open });
  const cabinets = useQuery({ queryKey: ["allCabinets"], queryFn: () => listCabinets(), enabled: open });

  // 根据选中的场地方和品牌方，自动计算柜子数量
  const autoCabinetCount = useMemo(() => {
    if (!f.landlordId || !f.brandId) return null;
    // 找到匹配的电表
    const matchedMeters = (meters.data ?? []).filter((m: any) =>
      m.landlord_id === Number(f.landlordId) && m.brand_id === Number(f.brandId)
    );
    const meterIds = new Set(matchedMeters.map((m: any) => m.id));
    // 计算这些电表下的柜子总数
    const cabinetCount = (cabinets.data ?? []).filter((c: any) => meterIds.has(c.meter_id)).length;
    return cabinetCount;
  }, [f.landlordId, f.brandId, meters.data, cabinets.data]);

  // 当自动计算的柜子数变化时，更新表单
  useEffect(() => {
    if (autoCabinetCount !== null && autoCabinetCount > 0) {
      setF((prev) => ({ ...prev, cabinetsCount: String(autoCabinetCount) }));
    }
  }, [autoCabinetCount]);

  // 当使用"按柜子数量"方式时，自动计算场地月租金
  useEffect(() => {
    if (f.rentCalcMethod === "按柜子数量" && f.unitMonthlyRent && f.cabinetsCount) {
      const calculated = Number(f.unitMonthlyRent) * Number(f.cabinetsCount);
      setF((prev) => ({ ...prev, monthlyRent: String(calculated) }));
    }
  }, [f.rentCalcMethod, f.unitMonthlyRent, f.cabinetsCount]);

  // 自动计算年租金 = 场地月租金 × 12
  useEffect(() => {
    if (f.monthlyRent) {
      const annualRent = Number(f.monthlyRent) * 12;
      setF((prev) => ({ ...prev, rentAmount: String(annualRent) }));
    }
  }, [f.monthlyRent]);

  useEffect(() => {
    if (!open) return;
    if (record) {
      setF({
        stationId: record.station_id ? String(record.station_id) : "", stationName: record.station_name ?? "",
        landlordId: record.landlord_id ? String(record.landlord_id) : "", brandId: record.brand_id ? String(record.brand_id) : "",
        contractType: record.contract_type ?? "场地合同",
        electricityPrice: record.electricity_price ? String(record.electricity_price) : "", rentAmount: record.rent_amount ? String(record.rent_amount) : "",
        cabinetsCount: record.cabinets_count ? String(record.cabinets_count) : "", unitMonthlyRent: record.unit_monthly_rent ? String(record.unit_monthly_rent) : "",
        rentCalcMethod: record.rent_calc_method || "按柜子数量",
        monthlyRent: record.monthly_rent ? String(record.monthly_rent) : "", payMethod: record.pay_method ?? "",
        address: record.address ?? "", partner: record.partner ?? "", payEntity: record.pay_entity ?? "",
        startDate: record.start_date ? String(record.start_date).slice(0, 10) : "", endDate: record.end_date ? String(record.end_date).slice(0, 10) : "",
        payStatus: record.pay_status ?? "未付款",
        taxEnabled: record.tax_enabled ?? false, taxRate: record.tax_rate ? String(record.tax_rate) : "0.01",
        postTaxElectricityPrice: record.post_tax_electricity_price ? String(record.post_tax_electricity_price) : "",
        remark: record.remark ?? "",
      });
    } else {
      setF({ ...blank, contractType: defaultType || "场地合同" });
    }
  }, [open, record]);

  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: (data: any) => record ? updateContract(record.id, data) : createContract(data),
    onSuccess: () => { toast.success("合同已保存"); queryClient.invalidateQueries(); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  const submit = () => {
    if (!f.stationName.trim() && f.landlordId) {
      const l = (landlords.data ?? []).find((l: any) => String(l.id) === f.landlordId);
      if (l) setF((p) => ({ ...p, stationName: l.name }));
    }
    if (!f.stationName.trim() && !f.landlordId) { toast.error("请选择场地方"); return; }
    if (f.contractType === "品牌方合同" && !f.landlordId) { toast.error("品牌方合同必须关联场地方"); return; }
    // 计算税后电费单价
    const taxEnabled = f.taxEnabled;
    const taxRate = taxEnabled ? Number(f.taxRate) : null;
    const elecPrice = f.electricityPrice ? Number(f.electricityPrice) : null;
    const postTaxPrice = taxEnabled && elecPrice && taxRate !== null
      ? Math.round((elecPrice / (1 + taxRate)) * 100) / 100
      : null;

    save.mutate({
      stationId: f.stationId ? Number(f.stationId) : null,
      stationName: f.stationName.trim(),
      landlordId: f.landlordId ? Number(f.landlordId) : null,
      brandId: f.brandId ? Number(f.brandId) : null,
      contractType: f.contractType,
      electricityPrice: elecPrice,
      rentAmount: f.rentAmount ? Number(f.rentAmount) : null,
      cabinetsCount: f.cabinetsCount ? Number(f.cabinetsCount) : null,
      unitMonthlyRent: f.unitMonthlyRent ? Number(f.unitMonthlyRent) : null,
      rentCalcMethod: f.rentCalcMethod,
      monthlyRent: f.monthlyRent ? Number(f.monthlyRent) : null,
      payMethod: f.payMethod || null,
      address: f.address || null,
      partner: f.partner || null,
      payEntity: f.payEntity || null,
      startDate: f.startDate || null,
      endDate: f.endDate || null,
      payStatus: f.payStatus,
      taxEnabled,
      taxRate,
      postTaxElectricityPrice: postTaxPrice,
      remark: f.remark || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{record ? "编辑合同" : "新增合同"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          <Field label="合同类型 *">
            <SelectInput value={f.contractType} onChange={set("contractType")}
              options={[{ value: "场地合同", label: "场地合同" }, { value: "品牌方合同", label: "品牌方合同" }]} />
          </Field>

          {f.contractType === "场地合同" && (
            <>
              <Field label="场地方 *">
                <SelectInput value={f.landlordId} onChange={(v) => {
                  set("landlordId")(v);
                  const l = (landlords.data ?? []).find((l: any) => String(l.id) === v);
                  if (l) set("stationName")(l.name);
                }}
                  options={[{ value: "", label: "请选择场地方" }, ...(landlords.data ?? []).map((l: any) => ({ value: String(l.id), label: l.name }))]} />
              </Field>
              <Field label="年租金（元）"><NumInput value={f.rentAmount} onChange={set("rentAmount")} /></Field>
              <Field label="月租金（元）"><NumInput value={f.monthlyRent} onChange={set("monthlyRent")} /></Field>
              <Field label="电费单价（元/度）"><NumInput value={f.electricityPrice} onChange={set("electricityPrice")} placeholder="0.65" /></Field>
              <Field label="场地租金付款方式">
                <SelectInput value={f.payMethod} onChange={set("payMethod")}
                  options={[{ value: "", label: "请选择" }, { value: "月付", label: "月付" }, { value: "季付", label: "季付" }, { value: "半年付", label: "半年付" }, { value: "年付", label: "年付" }]} />
              </Field>
            </>
          )}

          {f.contractType === "品牌方合同" && (
            <>
              <Field label="关联场地 *">
                <SelectInput value={f.landlordId} onChange={(v) => {
                  set("landlordId")(v);
                  const l = (landlords.data ?? []).find((l: any) => String(l.id) === v);
                  if (l) set("stationName")(l.name);
                }}
                  options={[{ value: "", label: "请选择场地方" }, ...(landlords.data ?? []).map((l: any) => ({ value: String(l.id), label: l.name }))]} />
              </Field>
              <Field label="品牌方">
                <SelectInput value={f.brandId} onChange={set("brandId")}
                  options={[{ value: "", label: "请选择品牌方" }, ...(brands.data ?? []).map((b: any) => ({ value: String(b.id), label: b.name }))]} />
              </Field>
              <Field label="计费方式">
                <SelectInput value={f.rentCalcMethod} onChange={set("rentCalcMethod")}
                  options={[{ value: "按柜子数量", label: "按柜子数量" }, { value: "固定价格", label: "固定价格" }]} />
              </Field>
              {f.rentCalcMethod === "按柜子数量" && (
                <>
                  <Field label="单柜场地月租金（元）"><NumInput value={f.unitMonthlyRent} onChange={set("unitMonthlyRent")} /></Field>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">计费柜数</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        className="w-16 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-600 text-center cursor-not-allowed"
                        value={autoCabinetCount ?? f.cabinetsCount ?? ""}
                        readOnly
                        placeholder="-"
                      />
                      {autoCabinetCount !== null && (
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <span>（来自电表管理）</span>
                          <button
                            type="button"
                            className="inline-flex items-center gap-0.5 text-emerald-600 hover:text-emerald-700 hover:underline"
                            onClick={() => { onClose(); window.location.href = `/meters?landlord=${f.landlordId}&brand=${f.brandId}&highlight=cabinet`; }}
                          >
                            去修改 <ExternalLink className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                      {autoCabinetCount === null && !f.cabinetsCount && (
                        <span className="text-xs text-slate-400">请先选择场地和品牌</span>
                      )}
                    </div>
                  </div>
                </>
              )}
              <Field label="场地月租金（元）">
                <NumInput
                  value={f.monthlyRent}
                  onChange={set("monthlyRent")}
                  disabled={f.rentCalcMethod === "按柜子数量"}
                  placeholder={f.rentCalcMethod === "按柜子数量" ? "自动计算" : "请输入"}
                />
              </Field>
              <Field label="年租金（元）">
                <NumInput
                  value={f.rentAmount}
                  onChange={set("rentAmount")}
                  disabled
                  placeholder="自动计算"
                />
              </Field>
              <Field label="电费单价（税前·元/度）"><NumInput value={f.electricityPrice} onChange={set("electricityPrice")} placeholder="1.20" /></Field>
              <Field label="场地租金付款方式">
                <SelectInput value={f.payMethod} onChange={set("payMethod")}
                  options={[{ value: "", label: "请选择" }, { value: "月付", label: "月付" }, { value: "季付", label: "季付" }, { value: "半年付", label: "半年付" }, { value: "年付", label: "年付" }]} />
              </Field>
              <div className="col-span-3">
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <Switch checked={f.taxEnabled} onCheckedChange={(v) => setF((p) => ({ ...p, taxEnabled: v }))} />
                  <span className="text-sm text-slate-700">计算税后电费单价</span>
                  {f.taxEnabled && (
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-xs text-slate-500">税率</span>
                      <select
                        className="rounded border border-slate-200 px-2 py-1 text-sm"
                        value={f.taxRate}
                        onChange={(e) => set("taxRate")(e.target.value)}
                      >
                        <option value="0.01">1%</option>
                        <option value="0.03">3%</option>
                        <option value="0.05">5%</option>
                        <option value="0.06">6%</option>
                        <option value="0.09">9%</option>
                        <option value="0.13">13%</option>
                      </select>
                      <span className="text-xs text-slate-500">或自定义</span>
                      <input
                        type="number"
                        className="w-20 rounded border border-slate-200 px-2 py-1 text-sm"
                        placeholder="0.01"
                        value={f.taxRate}
                        onChange={(e) => set("taxRate")(e.target.value)}
                        step="0.01"
                        min="0"
                        max="1"
                      />
                      {f.electricityPrice && (
                        <span className="ml-2 text-sm font-medium text-emerald-600">
                          税后单价 ≈ {fmtNum(Math.round((Number(f.electricityPrice) / (1 + Number(f.taxRate))) * 100) / 100)} 元/度
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <Field label="开始日期"><DateInput value={f.startDate} onChange={set("startDate")} /></Field>
          <Field label="结束日期"><DateInput value={f.endDate} onChange={set("endDate")} /></Field>
          <Field label="付款状态">
            <SelectInput value={f.payStatus} onChange={set("payStatus")}
              options={[{ value: "未付款", label: "未付款" }, { value: "已付款", label: "已付款" }]} />
          </Field>
          <Field label="合作方"><TextInput value={f.partner} onChange={set("partner")} /></Field>
          <Field label="备注"><TextInput value={f.remark} onChange={set("remark")} /></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={save.isPending} onClick={submit}>保存</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
