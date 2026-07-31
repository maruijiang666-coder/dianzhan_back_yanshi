import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStationBoard } from "@/api/overview";
import { listBrands } from "@/api/directory";
import { Money, StatusBadge } from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/fields";
import { StationForm } from "@/components/StationForm";
import { StationDrawer } from "@/components/StationDrawer";
import { MonthPicker } from "@/components/MonthPicker";
import { exportXlsx } from "@/lib/export";
import { fmtMoney, fmtNum, fmtPct } from "@/lib/format";
import { Download, Plus, Search, Eye, Pencil, ChevronDown, ChevronRight, MapPin, Gauge } from "lucide-react";
import { toast } from "sonner";

// ─── 展开行详情组件 ───
function ExpandedDetail({ landlordId, meters, stations }: { landlordId: number; meters: any[]; stations: any[] }) {
  const th = "px-2.5 py-1.5 text-left text-[11px] font-medium text-slate-500";
  const thR = "px-2.5 py-1.5 text-right text-[11px] font-medium text-slate-500";
  const td = "px-2.5 py-1.5 text-[11px]";
  const tdR = "px-2.5 py-1.5 text-right text-[11px] tabular-nums";

  return (
    <div className="space-y-4 text-sm">
      {/* 电表列表 */}
      <div>
        <h4 className="mb-1.5 text-xs font-semibold text-slate-700">电表列表（{meters.length} 个）</h4>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className={th}>电表编号</th>
                <th className={th}>品牌方</th>
                <th className={th}>电表名称</th>
                <th className={thR}>互感器倍数</th>
                <th className={th}>状态</th>
              </tr>
            </thead>
            <tbody>
              {meters.map((m: any) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className={`${td} font-mono`}>{m.meter_no}</td>
                  <td className={td}>{m.brand_name ?? "-"}</td>
                  <td className={td}>{m.meter_name ?? "-"}</td>
                  <td className={tdR}>{fmtNum(m.transformer_ratio)}</td>
                  <td className={td}>{m.status}</td>
                </tr>
              ))}
              {meters.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-slate-400">暂无电表</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 站点信息 */}
      {stations.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-xs font-semibold text-slate-700">站点信息</h4>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className={th}>站点名称</th>
                  <th className={thR}>公司占股</th>
                  <th className={th}>状态</th>
                </tr>
              </thead>
              <tbody>
                {stations.map((s: any) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className={`${td} font-medium`}>{s.name}</td>
                    <td className={tdR}>{fmtPct(s.company_share)}</td>
                    <td className={td}><StatusBadge status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 主页面 ───
export default function Stations() {
  const [keyword, setKeyword] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [drawerId, setDrawerId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const brands = useQuery({ queryKey: ["brands"], queryFn: listBrands });
  const board = useQuery({
    queryKey: ["stationBoard", keyword, selectedMonth],
    queryFn: () => getStationBoard({ keyword: keyword || undefined, period: selectedMonth }),
  });

  const rows = useMemo(() => board.data ?? [], [board.data]);
  const totals = useMemo(() => rows.reduce(
    (t: any, r: any) => ({
      elecPay: t.elecPay + r.elecPay, elecCollect: t.elecCollect + r.elecCollect, elecProfit: t.elecProfit + r.elecProfit,
      rentCost: t.rentCost + r.rentCost, rentIncome: t.rentIncome + r.rentIncome, rentProfit: t.rentProfit + r.rentProfit,
      opExpense: t.opExpense + r.opExpense,
      totalProfit: t.totalProfit + r.totalProfit,
    }),
    { elecPay: 0, elecCollect: 0, elecProfit: 0, rentCost: 0, rentIncome: 0, rentProfit: 0, opExpense: 0, totalProfit: 0 },
  ), [rows]);

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const doExport = () => {
    if (rows.length === 0) { toast.error("暂无数据可导出"); return; }
    exportXlsx(`站点数据看板_${selectedMonth}`, [{
      name: "站点看板",
      rows: rows.map((r: any) => ({
        场地方: r.landlord.name, 联系人: r.landlord.contact ?? "", 电话: r.landlord.phone ?? "",
        电表数: r.meterCount, 站点数: r.stationCount,
        电费付款: r.elecPay, 电费收款: r.elecCollect, 电费利润: r.elecProfit,
        租金成本: r.rentCost, 租金收入: r.rentIncome, 租金利润: r.rentProfit,
        运营费用: r.opExpense, 总利润: r.totalProfit,
      })),
    }]);
    toast.success("已导出 Excel");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input className={`${inputCls} w-56 pl-8`} placeholder="搜索场地方名称…" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        </div>
        <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={doExport}><Download className="mr-1.5 h-4 w-4" />导出表格</Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
              <th className="w-8 px-1 py-2.5"></th>
              <th className="px-3 py-2.5 font-medium">场地方</th>
              <th className="px-3 py-2.5 text-center font-medium">电表数</th>
              <th className="px-3 py-2.5 text-right font-medium">电费付款</th>
              <th className="px-3 py-2.5 text-right font-medium">电费收款</th>
              <th className="px-3 py-2.5 text-right font-medium">电费利润</th>
              <th className="px-3 py-2.5 text-right font-medium">租金成本</th>
              <th className="px-3 py-2.5 text-right font-medium">租金收入</th>
              <th className="px-3 py-2.5 text-right font-medium">运营费用</th>
              <th className="px-3 py-2.5 text-right font-medium">总利润</th>
              <th className="px-3 py-2.5 text-center font-medium">合同</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => {
              const isExpanded = expandedId === r.landlord.id;
              return (
                <>
                  <tr key={r.landlord.id} className={`border-b hover:bg-slate-50/60 cursor-pointer ${isExpanded ? "bg-slate-50/80" : ""}`} onClick={() => toggleExpand(r.landlord.id)}>
                    <td className="px-1 py-2.5 text-center">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-300" />}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-emerald-600" />
                        <div>
                          <div className="font-medium text-slate-800">{r.landlord.name}</div>
                          <div className="text-[11px] text-slate-400">
                            {r.landlord.contact ? `联系人：${r.landlord.contact}` : ""}
                            {r.landlord.phone ? ` · ${r.landlord.phone}` : ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Gauge className="h-3.5 w-3.5 text-slate-400" />
                        <span className="tabular-nums">{r.meterCount}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right"><Money v={r.elecPay} /></td>
                    <td className="px-3 py-2.5 text-right"><Money v={r.elecCollect} /></td>
                    <td className="px-3 py-2.5 text-right"><Money v={r.elecProfit} strong /></td>
                    <td className="px-3 py-2.5 text-right"><Money v={r.rentCost} /></td>
                    <td className="px-3 py-2.5 text-right"><Money v={r.rentIncome} /></td>
                    <td className="px-3 py-2.5 text-right"><Money v={r.opExpense} /></td>
                    <td className="px-3 py-2.5 text-right"><Money v={r.totalProfit} strong /></td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="text-xs">
                        <span className="text-slate-500">{r.contractCount} 份</span>
                        {r.expiredContracts > 0 && <span className="ml-1 text-rose-600">({r.expiredContracts}到期)</span>}
                        {r.expiringContracts > 0 && <span className="ml-1 text-amber-600">({r.expiringContracts}临期)</span>}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${r.landlord.id}-expanded`}>
                      <td colSpan={11} className="border-b bg-white px-6 py-4">
                        <ExpandedDetail landlordId={r.landlord.id} meters={r.meters} stations={r.stations} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={11} className="py-16 text-center text-slate-400">{board.isLoading ? "加载中…" : "暂无站点数据"}</td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t bg-emerald-50/50 text-xs font-semibold text-slate-700">
                <td className="px-3 py-2.5" colSpan={2}>合计（{rows.length} 个场地方）</td>
                <td className="px-3 py-2.5 text-center tabular-nums">{rows.reduce((t: number, r: any) => t + r.meterCount, 0)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.elecPay)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.elecCollect)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.elecProfit)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.rentCost)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.rentIncome)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.opExpense)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.totalProfit)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <StationForm open={formOpen} onClose={() => setFormOpen(false)} record={editing} />
      {drawerId !== null && <StationDrawer stationId={drawerId} onClose={() => setDrawerId(null)} />}
    </div>
  );
}
