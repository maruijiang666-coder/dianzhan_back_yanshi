import { Fragment, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listElectricity, listPeriods, deleteElectricity, generateElectricity, updateElectricity } from "@/api/electricity";
import { getMonthlyKwh } from "@/api/meterEnergy";
import { listMeters } from "@/api/meters";
import { Money, StatusBadge } from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { inputCls } from "@/components/fields";
import { ElecForm } from "@/components/ElecForm";
import { exportXlsxWithTitle } from "@/lib/export";
import { fmtMoney, fmtNum, fmtDate } from "@/lib/format";
import { Download, Plus, Pencil, Trash2, Search, RefreshCw, ChevronDown, ChevronRight, MapPin, Zap, Eye, Copy, Printer } from "lucide-react";
import { toast } from "sonner";

// ─── 类型定义 ───
interface MeterItem {
  meter_id: number;
  meter_no: string;
  meter_name: string | null;
  brand_name: string | null;
  kwh: number;
  pay_unit_price: number;
  pay_amount: number;
  collect_unit_price: number;
  collect_amount: number;
  collect_net: number;
}

interface BrandGroup {
  brandName: string;
  meters: MeterItem[];
  payKwh: number;
  payAmount: number;
  collectKwh: number;
  collectAmount: number;
  collectNet: number;
  profit: number;
  // 品牌方下所有站点的电费记录（用于编辑/删除）
  records: any[];
}

interface LandlordGroup {
  landlordId: number | null;
  landlordName: string;
  brands: BrandGroup[];
  payKwh: number;
  payAmount: number;
  collectKwh: number;
  collectAmount: number;
  collectNet: number;
  profit: number;
  payStatuses: Set<string>;
  collectStatuses: Set<string>;
}

export default function Electricity() {
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [landlordId, setLandlordId] = useState("");
  const [brandName, setBrandName] = useState("");
  const [keyword, setKeyword] = useState("");
  const [edit, setEdit] = useState<any>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [expandedLandlords, setExpandedLandlords] = useState<Set<number | string>>(new Set());
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());
  const [inlineEdit, setInlineEdit] = useState<{ id: number; field: string } | null>(null);
  const [inlineValue, setInlineValue] = useState("");
  const [previewBrand, setPreviewBrand] = useState<BrandGroup | null>(null);
  const [previewLandlord, setPreviewLandlord] = useState<string>("");

  const queryClient = useQueryClient();

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateElectricity(id, data),
    onSuccess: () => { toast.success("已更新"); queryClient.invalidateQueries({ queryKey: ["electricity"] }); setInlineEdit(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const periods = useQuery({ queryKey: ["electricityPeriods"], queryFn: listPeriods });

  // 获取当月电表月度读数（起始度数、抄表度数等）
  const monthlyReadings = useQuery({
    queryKey: ["meterMonthly", period],
    queryFn: () => getMonthlyKwh({ startMonth: period, endMonth: period }),
    enabled: !!period,
  });

  // 按电表编号建立索引
  const readingsMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of monthlyReadings.data ?? []) {
      if (r.address) map.set(r.address, r);
    }
    return map;
  }, [monthlyReadings.data]);

  // 加载电表列表，获取 entity_name（收款公司）
  const meters = useQuery({ queryKey: ["meters"], queryFn: () => listMeters() });
  const entityMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of meters.data ?? []) {
      if (m.meter_no && m.entity_name) map.set(m.meter_no, m.entity_name);
    }
    return map;
  }, [meters.data]);

  const list = useQuery({
    queryKey: ["electricity", period],
    queryFn: () => listElectricity({ period: period || undefined }),
  });

  const del = useMutation({
    mutationFn: deleteElectricity,
    onSuccess: () => { toast.success("已删除"); queryClient.invalidateQueries({ queryKey: ["electricity"] }); },
  });

  const gen = useMutation({
    mutationFn: () => {
      if (!period) throw new Error("请先选择月份");
      return generateElectricity({ period });
    },
    onSuccess: (res: any) => {
      toast.success(res.detail || `生成 ${res.created} 条`);
      queryClient.invalidateQueries({ queryKey: ["electricity"] });
      queryClient.invalidateQueries({ queryKey: ["electricityPeriods"] });
    },
    onError: (e: any) => toast.error(e.message || "生成失败"),
  });

  // 过滤后的平铺数据
  const rows = useMemo(() => {
    let data = list.data ?? [];
    if (landlordId) data = data.filter((r: any) => String(r.landlord_id) === landlordId);
    if (keyword) data = data.filter((r: any) => r.station_name?.includes(keyword) || r.landlord_name?.includes(keyword));
    if (brandName) {
      data = data
        .map((r: any) => {
          const details = (r.meterDetails ?? []).filter((d: any) => d.brand_name === brandName);
          return details.length > 0 ? { ...r, meterDetails: details } : null;
        })
        .filter(Boolean);
    }
    return data;
  }, [list.data, landlordId, keyword, brandName]);

  // 从数据中提取场地方列表
  const landlordOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of list.data ?? []) {
      if (r.landlord_id && !map.has(String(r.landlord_id))) {
        map.set(String(r.landlord_id), r.landlord_name || "未分配场地方");
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [list.data]);

  // 从数据中提取品牌方列表
  const brandOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of list.data ?? []) {
      for (const d of r.meterDetails ?? []) {
        if (d.brand_name) set.add(d.brand_name);
      }
    }
    return Array.from(set).sort();
  }, [list.data]);

  // 按 场地方 → 品牌方 → 电表 三级分组
  const grouped = useMemo(() => {
    const landlordMap = new Map<number | string, LandlordGroup>();

    for (const r of rows) {
      const lid = r.landlord_id ?? `no_landlord_${r.station_id}`;
      const lname = r.landlord_name || "未分配场地方";

      if (!landlordMap.has(lid)) {
        landlordMap.set(lid, {
          landlordId: r.landlord_id ?? null,
          landlordName: lname,
          brands: [],
          payKwh: 0, payAmount: 0,
          collectKwh: 0, collectAmount: 0, collectNet: 0, profit: 0,
          payStatuses: new Set(),
          collectStatuses: new Set(),
        });
      }
      const lg = landlordMap.get(lid)!;

      // 遍历该记录下的电表，按品牌分组
      const meterDetails: MeterItem[] = r.meterDetails ?? [];
      // 如果没有明细，用记录本身构造一条
      const items = meterDetails.length > 0 ? meterDetails : [{
        meter_id: 0, meter_no: "", meter_name: r.station_name, brand_name: null,
        kwh: r.pay_kwh ?? 0, pay_unit_price: r.pay_unit_price ?? 0, pay_amount: r.pay_amount ?? 0,
        collect_unit_price: r.collect_unit_price ?? 0, collect_amount: r.collect_amount ?? 0, collect_net: r.collect_net ?? 0,
      }];

      for (const m of items) {
        const bname = m.brand_name || "未设置品牌";
        let bg = lg.brands.find(b => b.brandName === bname);
        if (!bg) {
          bg = { brandName: bname, meters: [], payKwh: 0, payAmount: 0, collectKwh: 0, collectAmount: 0, collectNet: 0, profit: 0, records: [] };
          lg.brands.push(bg);
        }
        bg.meters.push({ ...m, _stationName: r.station_name, _stationId: r.station_id, _recordId: r.id });
        bg.payKwh += Number(m.kwh ?? 0);
        bg.payAmount += Number(m.pay_amount ?? 0);
        bg.collectKwh += Number(m.kwh ?? 0);
        bg.collectAmount += Number(m.collect_amount ?? 0);
        bg.collectNet += Number(m.collect_net ?? 0);
        bg.records.push(r);
      }

      // 汇总到场地方
      lg.payKwh += Number(r.pay_kwh ?? 0);
      lg.payAmount += Number(r.pay_amount ?? 0);
      lg.collectKwh += Number(r.collect_kwh ?? 0);
      lg.collectAmount += Number(r.collect_amount ?? 0);
      lg.collectNet += Number(r.collect_net ?? 0);
      lg.profit += Number(r.profit ?? 0);
      if (r.pay_status) lg.payStatuses.add(r.pay_status);
      if (r.collect_status) lg.collectStatuses.add(r.collect_status);
    }

    // 去重 brands 中的 records
    for (const lg of landlordMap.values()) {
      for (const bg of lg.brands) {
        const seen = new Set();
        bg.records = bg.records.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
        bg.profit = bg.collectNet - bg.payAmount;
      }
    }

    return Array.from(landlordMap.values());
  }, [rows]);

  // 全局合计
  const totals = useMemo(() => rows.reduce(
    (t: any, r: any) => ({
      payKwh: t.payKwh + Number(r.pay_kwh ?? 0), payAmount: t.payAmount + Number(r.pay_amount ?? 0),
      collectKwh: t.collectKwh + Number(r.collect_kwh ?? 0), collectAmount: t.collectAmount + Number(r.collect_amount ?? 0),
      collectNet: t.collectNet + Number(r.collect_net ?? 0), profit: t.profit + Number(r.profit ?? 0),
    }),
    { payKwh: 0, payAmount: 0, collectKwh: 0, collectAmount: 0, collectNet: 0, profit: 0 },
  ), [rows]);

  // 保存行内编辑
  const saveInline = (r: any) => {
    const val = parseFloat(inlineValue);
    if (isNaN(val) || val < 0) { toast.error("请输入有效数值"); return; }
    const payPrice = Number(r.pay_unit_price) || 0;
    const collectPrice = Number(r.collect_unit_price) || 0;
    const taxRate = Number(r.tax_rate) || 0.01;
    const isPay = inlineEdit!.field === "pay_kwh";
    const data: any = {};
    if (isPay) {
      data.payKwh = val;
      data.payAmount = Math.round(val * payPrice * 100) / 100;
    } else {
      data.collectKwh = val;
      data.collectAmount = Math.round(val * collectPrice * 100) / 100;
      data.collectNet = Math.round((val * collectPrice) / (1 + taxRate) * 100) / 100;
    }
    const payAmt = isPay ? data.payAmount : Number(r.pay_amount) || 0;
    const collectNet = isPay ? (Number(r.collect_net) || 0) : data.collectNet;
    data.profit = Math.round((collectNet - payAmt) * 100) / 100;
    updateMut.mutate({ id: r.id, data });
  };

  const toggleLandlord = (id: number | string) => {
    setExpandedLandlords(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleBrand = (key: string) => {
    setExpandedBrands(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleAllLandlords = () => {
    if (expandedLandlords.size === grouped.length) {
      setExpandedLandlords(new Set());
      setExpandedBrands(new Set());
    } else {
      setExpandedLandlords(new Set(grouped.map((_, i) => i)));
    }
  };

  // 日期转 Excel 序列号
  const toExcelDate = (d: string | Date): number => {
    const date = typeof d === "string" ? new Date(d) : d;
    const excelEpoch = new Date(1899, 11, 30);
    return Math.floor((date.getTime() - excelEpoch.getTime()) / 86400000);
  };

  const doExport = () => {
    if (rows.length === 0) { toast.error("暂无数据可导出"); return; }

    const headers = [
      "序号", "收款公司", "站名", "业主方", "电表编号", "互感器倍数",
      "上月抄表时间", "起始度数", "抄表时间", "抄表度数", "区间度数",
      "付款单价", "付款金额", "付款情况",
      "起始度数", "抄表时间", "抄表度数", "区间度数",
      "收款单价", "收款金额", "不含税收入", "到账情况",
      "利润", "运营费用", "运营费用后利润", "公司占股", "公司净利润", "备注",
    ];

    const exportRows: unknown[][] = [];
    let seq = 0;

    for (const lg of grouped) {
      for (const bg of lg.brands) {
        for (let mi = 0; mi < bg.meters.length; mi++) {
          const m: any = bg.meters[mi];
          seq++;
          const parentRecord = bg.records.find((rec: any) => rec.station_id === m._stationId);
          const payStatus = parentRecord?.pay_status || "";
          const collectStatus = parentRecord?.collect_status || "";
          const reading = readingsMap.get(m.meter_no);
          const prevReading = reading?.prev_reading;
          const prevReadingDate = reading?.prev_reading_date;
          const currReading = reading?.curr_reading;
          const currReadingDate = reading?.curr_reading_date;

          exportRows.push([
            seq,                                         // 序号
            mi === 0 ? (entityMap.get(m.meter_no) || bg.brandName) : "",  // 收款公司（仅首行显示，优先用 entity_name）
            m._stationName || "",                        // 站名
            lg.landlordName,                             // 业主方
            m.meter_no || "",                            // 电表编号
            "",                                          // 互感器倍数
            prevReadingDate ? toExcelDate(prevReadingDate) : "",  // 上月抄表时间
            prevReading != null ? prevReading : "",      // 起始度数（付款）
            currReadingDate ? toExcelDate(currReadingDate) : "",  // 抄表时间（付款）
            currReading != null ? currReading : "",      // 抄表度数（付款）
            m.kwh ?? "",                                 // 区间度数（付款）
            m.pay_unit_price ?? "",                      // 付款单价
            m.pay_amount ?? "",                          // 付款金额
            payStatus,                                   // 付款情况
            prevReading != null ? prevReading : "",      // 起始度数（收款）
            currReadingDate ? toExcelDate(currReadingDate) : "",  // 抄表时间（收款）
            currReading != null ? currReading : "",      // 抄表度数（收款）
            m.kwh ?? "",                                 // 区间度数（收款）
            m.collect_unit_price ?? "",                  // 收款单价
            m.collect_amount ?? "",                      // 收款金额
            m.collect_net ?? "",                         // 不含税收入
            collectStatus,                               // 到账情况
            Math.round((Number(m.collect_net ?? 0) - Number(m.pay_amount ?? 0)) * 100) / 100,  // 利润
            "",                                          // 运营费用
            "",                                          // 运营费用后利润
            "",                                          // 公司占股
            "",                                          // 公司净利润
            "",                                          // 备注
          ]);
        }
      }
    }

    // 合计行
    exportRows.push([
      "", "合计", "", "", "", "",
      "", "", "", "", "",
      "", totals.payAmount, "",
      "", "", "", "",
      "", totals.collectAmount, totals.collectNet, "",
      totals.profit, "", "", "", "", "",
    ]);

    const title = `${brandName || "全部"}项目电费收付明细台账`;
    exportXlsxWithTitle(
      `电费收付明细台账${brandName ? `_${brandName}` : ""}${period ? `_${period}` : ""}`,
      { sheetName: brandName || "电费台账", title, headers, rows: exportRows },
    );
    toast.success("已导出 Excel");
  };

  const th = "px-2.5 py-2.5 text-left text-xs font-medium text-slate-500 whitespace-nowrap";
  const thR = "px-2.5 py-2.5 text-right text-xs font-medium text-slate-500 whitespace-nowrap";
  const td = "px-2.5 py-2 text-xs";
  const tdR = "px-2.5 py-2 text-xs text-right tabular-nums";

  const StatusBadges = ({ statuses }: { statuses: Set<string> }) => {
    if (statuses.size === 0) return <span className="text-slate-300">-</span>;
    return (
      <div className="flex flex-wrap gap-0.5">
        {[...statuses].map((s, i) => <StatusBadge key={i} status={s} />)}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input className={`${inputCls} w-48 pl-8`} placeholder="搜索站点或场地方…" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        </div>
        <input className={`${inputCls} w-36`} type="month" value={period ? `${period.slice(0, 4)}-${period.slice(4)}` : ""} onChange={(e) => setPeriod(e.target.value ? e.target.value.replace("-", "") : "")} />
        <select className={`${inputCls} w-48`} value={landlordId} onChange={(e) => setLandlordId(e.target.value)}>
          <option value="">全部场地方</option>
          {landlordOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select className={`${inputCls} w-40`} value={brandName} onChange={(e) => setBrandName(e.target.value)}>
          <option value="">全部品牌</option>
          {brandOptions.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" disabled={gen.isPending || !period} onClick={() => gen.mutate()}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${gen.isPending ? "animate-spin" : ""}`} />自动生成
          </Button>
          <Button variant="outline" onClick={doExport}><Download className="mr-1.5 h-4 w-4" />导出表格</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEdit(null); setFormOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" />新增电费
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[1400px] text-xs">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="w-8 px-1 py-2.5">
                <button onClick={toggleAllLandlords} className="text-slate-400 hover:text-slate-600">
                  {expandedLandlords.size === grouped.length && grouped.length > 0
                    ? <ChevronDown className="h-4 w-4" />
                    : <ChevronRight className="h-4 w-4" />}
                </button>
              </th>
              <th className={th}>场地方 / 品牌方 / 电表</th>
              <th className={`${th} text-center`}>数量</th>
              <th className={thR}>付款度数</th>
              <th className={thR}>付款金额</th>
              <th className={th}>付款情况</th>
              <th className={thR}>收款度数</th>
              <th className={thR}>收款金额</th>
              <th className={thR}>不含税收入</th>
              <th className={thR}>起始度数</th>
              <th className={th}>抄表时间</th>
              <th className={thR}>抄表度数</th>
              <th className={thR}>利润</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((lg, li) => {
              const isLandlordExpanded = expandedLandlords.has(li);
              return (
                <Fragment key={lg.landlordId ?? `no_${li}`}>
                  {/* 一级：场地方汇总行 */}
                  <tr className={`border-b hover:bg-slate-50/60 ${isLandlordExpanded ? "bg-slate-50/80" : ""}`}>
                    <td className="px-1 py-2.5 text-center cursor-pointer" onClick={() => toggleLandlord(li)}>
                      {isLandlordExpanded
                        ? <ChevronDown className="h-4 w-4 text-slate-400" />
                        : <ChevronRight className="h-4 w-4 text-slate-300" />}
                    </td>
                    <td className="px-2.5 py-2.5 cursor-pointer" onClick={() => toggleLandlord(li)}>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-emerald-600" />
                        <span className="font-semibold text-slate-800">{lg.landlordName}</span>
                      </div>
                    </td>
                    <td className={`${td} text-center`}>{lg.brands.length} 品牌</td>
                    <td className={tdR}>{fmtNum(lg.payKwh)}</td>
                    <td className={tdR}><Money v={lg.payAmount} /></td>
                    <td className={td}><StatusBadges statuses={lg.payStatuses} /></td>
                    <td className={tdR}>{fmtNum(lg.collectKwh)}</td>
                    <td className={tdR}><Money v={lg.collectAmount} /></td>
                    <td className={tdR}><Money v={lg.collectNet} /></td>
                    <td className={td}>-</td>
                    <td className={td}>-</td>
                    <td className={td}>-</td>
                    <td className={tdR}><Money v={lg.profit} strong /></td>
                  </tr>

                  {/* 二级：品牌方 */}
                  {isLandlordExpanded && lg.brands.map((bg) => {
                    const brandKey = `${li}_${bg.brandName}`;
                    const isBrandExpanded = expandedBrands.has(brandKey);
                    // 汇总该品牌下所有记录的付款/到账状态
                    const brandPayStatuses = new Set(bg.records.map((r: any) => r.pay_status).filter(Boolean));
                    const brandCollectStatuses = new Set(bg.records.map((r: any) => r.collect_status).filter(Boolean));
                    const brandPayStatus = brandPayStatuses.size === 1 ? [...brandPayStatuses][0] : brandPayStatuses.size > 1 ? "部分付款" : "";
                    const brandCollectStatus = brandCollectStatuses.size === 1 ? [...brandCollectStatuses][0] : brandCollectStatuses.size > 1 ? "部分到账" : "";
                    return (
                      <Fragment key={brandKey}>
                        <tr className="border-b bg-emerald-50/30 hover:bg-emerald-50/50">
                          <td className="px-1 py-2 pl-6 text-center cursor-pointer" onClick={() => toggleBrand(brandKey)}>
                            {isBrandExpanded
                              ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                              : <ChevronRight className="h-3.5 w-3.5 text-slate-300" />}
                          </td>
                          <td className="px-2.5 py-2 cursor-pointer" onClick={() => toggleBrand(brandKey)}>
                            <div className="flex items-center gap-2 pl-4">
                              <Zap className="h-3.5 w-3.5 text-amber-500" />
                              <span className="font-medium text-slate-700">{bg.brandName}</span>
                              <button
                                className="ml-1 rounded p-0.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                onClick={(e) => { e.stopPropagation(); setPreviewBrand(bg); setPreviewLandlord(lg.landlordName); }}
                                title="预览对账单"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className={`${td} text-center text-slate-500`}>{bg.meters.length} 表</td>
                          <td className={tdR}>{fmtNum(bg.payKwh)}</td>
                          <td className={tdR}><Money v={bg.payAmount} /></td>
                          <td className={td}>{brandPayStatus ? <StatusBadge status={brandPayStatus} /> : "-"}</td>
                          <td className={tdR}>{fmtNum(bg.collectKwh)}</td>
                          <td className={tdR}><Money v={bg.collectAmount} /></td>
                          <td className={tdR}><Money v={bg.collectNet} /></td>
                          <td className={td}>-</td>
                          <td className={td}>-</td>
                          <td className={td}>-</td>
                          <td className={tdR}><Money v={bg.profit} strong /></td>
                        </tr>

                        {/* 三级：电表明细 */}
                        {isBrandExpanded && bg.meters.map((m: any, mi) => {
                          const parentRecord = bg.records.find((rec: any) => rec.station_id === m._stationId);
                          const payStatus = parentRecord?.pay_status || "";
                          const reading = readingsMap.get(m.meter_no);
                          const prevReading = reading?.prev_reading;
                          const prevReadingDate = reading?.prev_reading_date;
                          const currReading = reading?.curr_reading;
                          const currReadingDate = reading?.curr_reading_date;
                          return (
                          <tr key={`${brandKey}_${m.meter_id}_${mi}`} className="border-b bg-white hover:bg-amber-50/20">
                            <td className="px-1 py-1.5" />
                            <td className="px-2.5 py-1.5 text-slate-500">
                              <div className="pl-10">
                                <span className="font-mono text-[11px] text-slate-400">{m.meter_no}</span>
                                <span className="ml-2">{m.meter_name || m._stationName}</span>
                              </div>
                            </td>
                            <td className={`${td} text-center text-slate-400`}>{m._stationName}</td>
                            <td className={tdR}>{fmtNum(m.kwh)}</td>
                            <td className={tdR}><Money v={m.pay_amount} /></td>
                            <td className={td}>{payStatus ? <StatusBadge status={payStatus} /> : "-"}</td>
                            <td className={tdR}>{fmtNum(m.kwh)}</td>
                            <td className={tdR}><Money v={m.collect_amount} /></td>
                            <td className={tdR}><Money v={m.collect_net} /></td>
                            <td className={tdR}>{prevReading != null ? fmtNum(prevReading) : "-"}</td>
                            <td className={td}>{currReadingDate ? fmtDate(currReadingDate) : "-"}</td>
                            <td className={tdR}>{currReading != null ? fmtNum(currReading) : "-"}</td>
                            <td className="px-2.5 py-1.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Money v={m.collect_net - m.pay_amount} strong />
                              </div>
                            </td>
                          </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </Fragment>
              );
            })}
            {grouped.length === 0 && (
              <tr><td colSpan={13} className="py-16 text-center text-slate-400">{list.isLoading ? "加载中…" : "暂无电费记录"}</td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t bg-emerald-50/50 font-semibold text-slate-700">
                <td className="px-2.5 py-2.5" colSpan={2}>合计（{rows.length} 条 · {grouped.length} 个场地方）</td>
                <td></td>
                <td className="px-2.5 py-2.5 text-right tabular-nums">{fmtNum(totals.payKwh)}</td>
                <td className="px-2.5 py-2.5 text-right tabular-nums">{fmtMoney(totals.payAmount)}</td>
                <td></td>
                <td className="px-2.5 py-2.5 text-right tabular-nums">{fmtNum(totals.collectKwh)}</td>
                <td className="px-2.5 py-2.5 text-right tabular-nums">{fmtMoney(totals.collectAmount)}</td>
                <td className="px-2.5 py-2.5 text-right tabular-nums">{fmtMoney(totals.collectNet)}</td>
                <td></td>
                <td></td>
                <td></td>
                <td className="px-2.5 py-2.5 text-right tabular-nums">{fmtMoney(totals.profit)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <ElecForm open={formOpen} onClose={() => { setFormOpen(false); setEdit(null); }}
        stationId={edit?.station_id ?? 0} record={edit} />

      {/* 品牌方对账单预览弹窗 */}
      <BrandReconciliationDialog
        open={!!previewBrand}
        onClose={() => { setPreviewBrand(null); setPreviewLandlord(""); }}
        brand={previewBrand}
        landlordName={previewLandlord}
        period={period}
      />
    </div>
  );
}

// ─── 品牌方对账单预览弹窗 ───
function BrandReconciliationDialog({ open, onClose, brand, landlordName, period }: {
  open: boolean;
  onClose: () => void;
  brand: BrandGroup | null;
  landlordName: string;
  period: string;
}) {
  if (!open || !brand) return null;

  const periodDisplay = period ? `${period.slice(0, 4)}年${parseInt(period.slice(4))}月` : "";

  const handleCopy = () => {
    const text = generateReconciliationText(brand, landlordName, periodDisplay);
    navigator.clipboard.writeText(text).then(() => {
      toast.success("已复制到剪贴板");
    }).catch(() => {
      toast.error("复制失败");
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>电费对账单预览</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />复制文本
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="mr-1.5 h-3.5 w-3.5" />打印
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* 标题 */}
          <div className="text-center border-b pb-4">
            <h2 className="text-lg font-bold text-slate-800">电费对账单</h2>
            <p className="text-slate-500 mt-1">{periodDisplay}</p>
          </div>

          {/* 基本信息 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-slate-500">场地方：</span>
              <span className="font-medium text-slate-700">{landlordName}</span>
            </div>
            <div>
              <span className="text-slate-500">品牌方：</span>
              <span className="font-medium text-slate-700">{brand.brandName}</span>
            </div>
          </div>

          {/* 电表明细 */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-3 py-2 text-left font-medium text-slate-600">电表编号</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">电表名称</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">站点</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">用电量(度)</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">单价(元/度)</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">金额(元)</th>
                </tr>
              </thead>
              <tbody>
                {brand.meters.map((m: any, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2 font-mono text-slate-500">{m.meter_no}</td>
                    <td className="px-3 py-2 text-slate-700">{m.meter_name || "-"}</td>
                    <td className="px-3 py-2 text-slate-500">{m._stationName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(m.kwh)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(m.collect_unit_price)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtMoney(m.collect_amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-slate-50 font-semibold">
                  <td className="px-3 py-2" colSpan={3}>合计</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(brand.collectKwh)}</td>
                  <td className="px-3 py-2 text-right">-</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{fmtMoney(brand.collectAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* 汇总信息 */}
          <div className="grid grid-cols-3 gap-4 pt-2">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-xs text-blue-600">总用电量</div>
              <div className="text-lg font-bold text-blue-700">{fmtNum(brand.collectKwh)} <span className="text-xs font-normal">度</span></div>
            </div>
            <div className="text-center p-3 bg-emerald-50 rounded-lg">
              <div className="text-xs text-emerald-600">总金额</div>
              <div className="text-lg font-bold text-emerald-700">{fmtMoney(brand.collectAmount)}</div>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <div className="text-xs text-amber-600">不含税收入</div>
              <div className="text-lg font-bold text-amber-700">{fmtMoney(brand.collectNet)}</div>
            </div>
          </div>

          {/* 备注 */}
          <div className="text-xs text-slate-400 border-t pt-3">
            <p>※ 此对账单仅用于双方核对电费数据，如有异议请及时沟通。</p>
            <p>※ 生成时间：{new Date().toLocaleString('zh-CN')}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 生成对账单纯文本 ───
function generateReconciliationText(brand: BrandGroup, landlordName: string, period: string): string {
  let text = `电费对账单\n`;
  text += `${period}\n\n`;
  text += `场地方：${landlordName}\n`;
  text += `品牌方：${brand.brandName}\n\n`;
  text += `电表明细：\n`;
  text += `${"电表编号".padEnd(15)} ${"电表名称".padEnd(15)} ${"站点".padEnd(15)} ${"用电量(度)".padStart(10)} ${"单价".padStart(8)} ${"金额(元)".padStart(12)}\n`;
  text += `${"─".repeat(80)}\n`;

  for (const m of brand.meters) {
    text += `${(m.meter_no || "").padEnd(15)} ${(m.meter_name || "-").padEnd(15)} ${(m._stationName || "").padEnd(15)} ${fmtNum(m.kwh).padStart(10)} ${fmtNum(m.collect_unit_price).padStart(8)} ${fmtMoney(m.collect_amount).padStart(12)}\n`;
  }

  text += `${"─".repeat(80)}\n`;
  text += `${"合计".padEnd(45)} ${fmtNum(brand.collectKwh).padStart(10)} ${"-".padStart(8)} ${fmtMoney(brand.collectAmount).padStart(12)}\n\n`;
  text += `总用电量：${fmtNum(brand.collectKwh)} 度\n`;
  text += `总金额：${fmtMoney(brand.collectAmount)}\n`;
  text += `不含税收入：${fmtMoney(brand.collectNet)}\n`;

  return text;
}
