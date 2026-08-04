import { Fragment, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listElectricity, listPeriods, deleteElectricity, generateElectricity, updateElectricity } from "@/api/electricity";
import { listStations } from "@/api/stations";
import { Money, StatusBadge } from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/fields";
import { ElecForm } from "@/components/ElecForm";
import { exportXlsx } from "@/lib/export";
import { fmtMoney, fmtNum } from "@/lib/format";
import { Download, Plus, Pencil, Trash2, Search, RefreshCw, ChevronDown, ChevronRight, MapPin } from "lucide-react";
import { toast } from "sonner";

// ─── 按场地方分组的类型 ───
interface LandlordGroup {
  landlordId: number | null;
  landlordName: string;
  rows: any[];
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
  const [stationId, setStationId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [edit, setEdit] = useState<any>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<number | string>>(new Set());
  const [inlineEdit, setInlineEdit] = useState<{ id: number; field: string } | null>(null);
  const [inlineValue, setInlineValue] = useState("");

  const queryClient = useQueryClient();

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateElectricity(id, data),
    onSuccess: () => { toast.success("已更新"); queryClient.invalidateQueries({ queryKey: ["electricity"] }); setInlineEdit(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const periods = useQuery({ queryKey: ["electricityPeriods"], queryFn: listPeriods });
  const stations = useQuery({ queryKey: ["stations"], queryFn: () => listStations() });
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
    if (stationId) data = data.filter((r: any) => r.station_id === Number(stationId));
    if (keyword) data = data.filter((r: any) => r.station_name?.includes(keyword) || r.landlord_name?.includes(keyword));
    return data;
  }, [list.data, stationId, keyword]);

  // 按场地方分组
  const grouped = useMemo(() => {
    const map = new Map<number | string, LandlordGroup>();
    for (const r of rows) {
      const lid = r.landlord_id ?? `no_landlord_${r.station_id}`;
      const lname = r.landlord_name || "未分配场地方";
      if (!map.has(lid)) {
        map.set(lid, {
          landlordId: r.landlord_id ?? null,
          landlordName: lname,
          rows: [],
          payKwh: 0, payAmount: 0,
          collectKwh: 0, collectAmount: 0, collectNet: 0, profit: 0,
          payStatuses: new Set(),
          collectStatuses: new Set(),
        });
      }
      const g = map.get(lid)!;
      g.rows.push(r);
      g.payKwh += Number(r.pay_kwh ?? 0);
      g.payAmount += Number(r.pay_amount ?? 0);
      g.collectKwh += Number(r.collect_kwh ?? 0);
      g.collectAmount += Number(r.collect_amount ?? 0);
      g.collectNet += Number(r.collect_net ?? 0);
      g.profit += Number(r.profit ?? 0);
      if (r.pay_status) g.payStatuses.add(r.pay_status);
      if (r.collect_status) g.collectStatuses.add(r.collect_status);
    }
    return Array.from(map.values());
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
    // 重新算利润
    const payAmt = isPay ? data.payAmount : Number(r.pay_amount) || 0;
    const collectNet = isPay ? (Number(r.collect_net) || 0) : data.collectNet;
    data.profit = Math.round((collectNet - payAmt) * 100) / 100;
    updateMut.mutate({ id: r.id, data });
  };

  const toggleExpand = (id: number | string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (expandedIds.size === grouped.length) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(grouped.map((_, i) => i)));
    }
  };

  const doExport = () => {
    if (rows.length === 0) { toast.error("暂无数据可导出"); return; }
    exportXlsx(`电费收付明细台账${period ? `_${period}` : ""}`, [{
      name: "电费台账",
      rows: rows.map((r: any) => ({
        期间: r.period, 站点: r.station_name, 场地方: r.landlord_name ?? "",
        付款度数: fmtNum(r.pay_kwh, ""), 付款单价: fmtNum(r.pay_unit_price, ""),
        付款金额: fmtNum(r.pay_amount, ""), 付款情况: r.pay_status,
        收款度数: fmtNum(r.collect_kwh, ""), 收款单价: fmtNum(r.collect_unit_price, ""),
        收款金额: fmtNum(r.collect_amount, ""), 不含税收入: fmtNum(r.collect_net, ""),
        到账情况: r.collect_status, 利润: fmtNum(r.profit, ""),
      })),
    }]);
    toast.success("已导出 Excel");
  };

  const th = "px-2.5 py-2.5 text-left text-xs font-medium text-slate-500 whitespace-nowrap";
  const thR = "px-2.5 py-2.5 text-right text-xs font-medium text-slate-500 whitespace-nowrap";
  const td = "px-2.5 py-2 text-xs";
  const tdR = "px-2.5 py-2 text-xs text-right tabular-nums";

  // 状态徽章：多状态时用逗号分隔
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
        <select className={`${inputCls} w-48`} value={stationId} onChange={(e) => setStationId(e.target.value)}>
          <option value="">全部站点</option>
          {(stations.data ?? []).map((s: any) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
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
        <table className="w-full min-w-[1100px] text-xs">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="w-8 px-1 py-2.5">
                <button onClick={toggleAll} className="text-slate-400 hover:text-slate-600">
                  {expandedIds.size === grouped.length && grouped.length > 0
                    ? <ChevronDown className="h-4 w-4" />
                    : <ChevronRight className="h-4 w-4" />}
                </button>
              </th>
              <th className={th}>场地方</th>
              <th className={`${th} text-center`}>站点数</th>
              <th className={thR}>付款度数</th>
              <th className={thR}>付款金额</th>
              <th className={th}>付款</th>
              <th className={thR}>收款度数</th>
              <th className={thR}>收款金额</th>
              <th className={thR}>不含税收入</th>
              <th className={th}>到账</th>
              <th className={thR}>利润</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((g, gi) => {
              const isExpanded = expandedIds.has(gi);
              const groupKey = g.landlordId ?? `no_${gi}`;
              return (
                <Fragment key={groupKey}>
                  {/* 场地方汇总行 */}
                  <tr className={`border-b hover:bg-slate-50/60 ${isExpanded ? "bg-slate-50/80" : ""}`}>
                    <td className="px-1 py-2.5 text-center cursor-pointer" onClick={() => toggleExpand(gi)}>
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4 text-slate-400" />
                        : <ChevronRight className="h-4 w-4 text-slate-300" />}
                    </td>
                    <td className="px-2.5 py-2.5 cursor-pointer" onClick={() => toggleExpand(gi)}>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-emerald-600" />
                        <span className="font-medium text-slate-800">{g.landlordName}</span>
                      </div>
                    </td>
                    <td className={`${td} text-center`}>{g.rows.length}</td>
                    <td className={tdR}>{fmtNum(g.payKwh)}</td>
                    <td className={tdR}><Money v={g.payAmount} /></td>
                    <td className={td}><StatusBadges statuses={g.payStatuses} /></td>
                    <td className={tdR}>{fmtNum(g.collectKwh)}</td>
                    <td className={tdR}><Money v={g.collectAmount} /></td>
                    <td className={tdR}><Money v={g.collectNet} /></td>
                    <td className={td}><StatusBadges statuses={g.collectStatuses} /></td>
                    <td className={tdR}><Money v={g.profit} strong /></td>
                  </tr>

                  {/* 展开的明细行 */}
                  {isExpanded && g.rows.map((r: any) => (
                    <tr key={r.id} className="border-b bg-white hover:bg-emerald-50/30">
                      <td className="px-1 py-1.5" />
                      <td className="px-2.5 py-1.5 text-slate-500">
                        <div className="pl-6">{r.station_name}</div>
                      </td>
                      <td className={`${td} text-center text-slate-400`}>{r.period}</td>
                      <td className={`${tdR} cursor-pointer hover:bg-amber-50`} onClick={() => { setInlineEdit({ id: r.id, field: "pay_kwh" }); setInlineValue(String(r.pay_kwh ?? "")); }}>
                        {inlineEdit?.id === r.id && inlineEdit.field === "pay_kwh" ? (
                          <input type="number" className="w-20 rounded border border-amber-300 px-1 py-0.5 text-right text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                            value={inlineValue} onChange={(e) => setInlineValue(e.target.value)}
                            onBlur={() => saveInline(r)}
                            onKeyDown={(e) => e.key === "Enter" && saveInline(r)}
                            autoFocus />
                        ) : fmtNum(r.pay_kwh)}
                      </td>
                      <td className={tdR}><Money v={r.pay_amount} /></td>
                      <td className={td}><StatusBadge status={r.pay_status} /></td>
                      <td className={`${tdR} cursor-pointer hover:bg-amber-50`} onClick={() => { setInlineEdit({ id: r.id, field: "collect_kwh" }); setInlineValue(String(r.collect_kwh ?? "")); }}>
                        {inlineEdit?.id === r.id && inlineEdit.field === "collect_kwh" ? (
                          <input type="number" className="w-20 rounded border border-amber-300 px-1 py-0.5 text-right text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                            value={inlineValue} onChange={(e) => setInlineValue(e.target.value)}
                            onBlur={() => saveInline(r)}
                            onKeyDown={(e) => e.key === "Enter" && saveInline(r)}
                            autoFocus />
                        ) : fmtNum(r.collect_kwh)}
                      </td>
                      <td className={tdR}><Money v={r.collect_amount} /></td>
                      <td className={tdR}><Money v={r.collect_net} /></td>
                      <td className={td}><StatusBadge status={r.collect_status} /></td>
                      <td className="px-2.5 py-1.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Money v={r.profit} strong />
                          <button className="rounded p-0.5 text-slate-300 hover:text-emerald-600" onClick={() => { setEdit(r); setFormOpen(true); }}><Pencil className="h-3 w-3" /></button>
                          <button className="rounded p-0.5 text-slate-300 hover:text-rose-500" onClick={() => window.confirm("删除该记录？") && del.mutate(r.id)}><Trash2 className="h-3 w-3" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
            {grouped.length === 0 && (
              <tr><td colSpan={11} className="py-16 text-center text-slate-400">{list.isLoading ? "加载中…" : "暂无电费记录"}</td></tr>
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
                <td className="px-2.5 py-2.5 text-right tabular-nums">{fmtMoney(totals.profit)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <ElecForm open={formOpen} onClose={() => { setFormOpen(false); setEdit(null); }}
        stationId={edit?.station_id ?? 0} record={edit} />
    </div>
  );
}
