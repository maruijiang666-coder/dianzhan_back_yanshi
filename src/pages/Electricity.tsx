import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listElectricity, listPeriods, deleteElectricity, generateElectricity } from "@/api/electricity";
import { listBrands } from "@/api/directory";
import { listStations } from "@/api/stations";
import { Money, StatusBadge } from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/fields";
import { ElecForm } from "@/components/ElecForm";
import { exportXlsx } from "@/lib/export";
import { fmtMoney, fmtNum, fmtDate } from "@/lib/format";
import { Download, Plus, Pencil, Trash2, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function Electricity() {
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [stationId, setStationId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [edit, setEdit] = useState<any>(null);
  const [formOpen, setFormOpen] = useState(false);

  const queryClient = useQueryClient();
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

  const rows = useMemo(() => {
    let data = list.data ?? [];
    if (stationId) data = data.filter((r: any) => r.station_id === Number(stationId));
    if (keyword) data = data.filter((r: any) => r.station_name?.includes(keyword));
    return data;
  }, [list.data, stationId, keyword]);

  const totals = useMemo(() => rows.reduce(
    (t: any, r: any) => ({
      payKwh: t.payKwh + Number(r.pay_kwh ?? 0), payAmount: t.payAmount + Number(r.pay_amount ?? 0),
      collectKwh: t.collectKwh + Number(r.collect_kwh ?? 0), collectAmount: t.collectAmount + Number(r.collect_amount ?? 0),
      collectNet: t.collectNet + Number(r.collect_net ?? 0), profit: t.profit + Number(r.profit ?? 0),
    }),
    { payKwh: 0, payAmount: 0, collectKwh: 0, collectAmount: 0, collectNet: 0, profit: 0 },
  ), [rows]);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input className={`${inputCls} w-48 pl-8`} placeholder="搜索站点名称…" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
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
        <table className="w-full min-w-[1200px] text-xs">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className={th}>期间</th><th className={th}>站点</th><th className={th}>场地方</th>
              <th className={thR}>付款度数</th><th className={thR}>付款单价</th><th className={thR}>付款金额</th><th className={th}>付款</th>
              <th className={thR}>收款度数</th><th className={thR}>收款单价</th><th className={thR}>收款金额</th><th className={thR}>不含税收入</th><th className={th}>到账</th>
              <th className={thR}>利润</th><th className={`${th} text-center`}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50/60">
                <td className="px-2.5 py-2 font-medium whitespace-nowrap">{r.period}</td>
                <td className="max-w-[220px] truncate px-2.5 py-2" title={r.station_name}>{r.station_name}</td>
                <td className="px-2.5 py-2 text-slate-600">{r.landlord_name ?? "-"}</td>
                <td className="px-2.5 py-2 text-right tabular-nums">{fmtNum(r.pay_kwh)}</td>
                <td className="px-2.5 py-2 text-right tabular-nums">{fmtNum(r.pay_unit_price)}</td>
                <td className="px-2.5 py-2 text-right"><Money v={r.pay_amount} /></td>
                <td className="px-2.5 py-2"><StatusBadge status={r.pay_status} /></td>
                <td className="px-2.5 py-2 text-right tabular-nums">{fmtNum(r.collect_kwh)}</td>
                <td className="px-2.5 py-2 text-right tabular-nums">{fmtNum(r.collect_unit_price)}</td>
                <td className="px-2.5 py-2 text-right"><Money v={r.collect_amount} /></td>
                <td className="px-2.5 py-2 text-right"><Money v={r.collect_net} /></td>
                <td className="px-2.5 py-2"><StatusBadge status={r.collect_status} /></td>
                <td className="px-2.5 py-2 text-right"><Money v={r.profit} strong /></td>
                <td className="px-2.5 py-2">
                  <div className="flex justify-center gap-0.5">
                    <button className="rounded p-1 text-slate-400 hover:text-emerald-600" onClick={() => { setEdit(r); setFormOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
                    <button className="rounded p-1 text-slate-400 hover:text-rose-500" onClick={() => window.confirm("删除该记录？") && del.mutate(r.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={14} className="py-16 text-center text-slate-400">{list.isLoading ? "加载中…" : "暂无电费记录"}</td></tr>}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t bg-emerald-50/50 font-semibold text-slate-700">
                <td className="px-2.5 py-2.5" colSpan={3}>合计（{rows.length} 条）</td>
                <td className="px-2.5 py-2.5 text-right tabular-nums">{fmtNum(totals.payKwh)}</td>
                <td></td>
                <td className="px-2.5 py-2.5 text-right tabular-nums">{fmtMoney(totals.payAmount)}</td>
                <td></td>
                <td className="px-2.5 py-2.5 text-right tabular-nums">{fmtNum(totals.collectKwh)}</td>
                <td></td>
                <td className="px-2.5 py-2.5 text-right tabular-nums">{fmtMoney(totals.collectAmount)}</td>
                <td className="px-2.5 py-2.5 text-right tabular-nums">{fmtMoney(totals.collectNet)}</td>
                <td></td>
                <td className="px-2.5 py-2.5 text-right tabular-nums">{fmtMoney(totals.profit)}</td>
                <td></td>
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
