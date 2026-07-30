import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { StatCard, Money, StatusBadge } from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { DividendForm, type DividendRow } from "@/components/DividendForm";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportXlsx } from "@/lib/export";
import { fmtMoney, fmtNum, fmtPct } from "@/lib/format";
import { Download, Plus, Users, Wallet, Clock, ChevronDown, ChevronRight, Building2 } from "lucide-react";
import { toast } from "sonner";

type ViewMode = "shareholder" | "station";

export default function Shareholders() {
  const [mode, setMode] = useState<ViewMode>("shareholder");
  const [selectedHolder, setSelectedHolder] = useState<number | null>(null);
  const [selectedStation, setSelectedStation] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DividendRow | null>(null);
  const [expandedRecord, setExpandedRecord] = useState<number | null>(null);

  const board = trpc.ledger.shareholderBoard.useQuery();
  const stations = trpc.ledger.stations.useQuery();
  const dividends = trpc.ledger.dividends.useQuery(
    selectedHolder ? { shareholderId: selectedHolder } : undefined,
  );
  const stationDividends = trpc.ledger.dividends.useQuery(
    selectedStation ? { stationId: selectedStation } : undefined,
    { enabled: mode === "station" && selectedStation !== null },
  );

  const holders = useMemo(() => board.data ?? [], [board.data]);
  const records = useMemo(() => dividends.data ?? [], [dividends.data]);
  const stRecords = useMemo(() => stationDividends.data ?? [], [stationDividends.data]);
  const totalPaid = holders.reduce((t, h) => t + h.totalAmount, 0);
  const totalPending = holders.reduce((t, h) => t + h.pendingAmount, 0);

  // 当前股东的当月数据
  const currentHolder = holders.find((h) => h.id === selectedHolder);
  const latestPeriod = holders.flatMap((h) => h.dividends.map((d) => d.period)).sort().reverse()[0] ?? "";
  const currentHolderMonth = currentHolder?.dividends.filter((d) => d.period === latestPeriod) ?? [];

  // 当前站点的当月数据
  const currentStation = (stations.data ?? []).find((s) => s.station.id === selectedStation);
  const latestStationRecord = stRecords[0] ?? null;

  const doExport = () => {
    if (holders.length === 0) { toast.error("暂无数据可导出"); return; }
    exportXlsx(`股东分红_${new Date().toISOString().slice(0, 10)}`, [
      {
        name: "股东汇总",
        rows: holders.map((h) => ({
          股东: h.name, 联系电话: h.phone ?? "",
          持股站点: h.stations.map((st) => `${st.stationName}(${fmtPct(st.ratio, "")})`).join("、"),
          累计应分: h.totalAmount, 已结算: h.settledAmount, 未结算: h.pendingAmount,
        })),
      },
      {
        name: "分红明细",
        rows: holders.flatMap((h) => h.dividends.map((d) => ({
          股东: h.name, 月份: d.period, 站点: d.stationName, 比例: fmtPct(d.ratio, ""), 金额: d.amount, 状态: d.status,
        }))),
      },
      {
        name: "站点月结",
        rows: records.map((r) => ({
          月份: r.record.period, 站点: r.stationName, 品牌方: r.brandName ?? "",
          电量: fmtNum(r.record.kwh, ""), 付款单价: r.record.payUnitPrice ?? "", 付款金额: fmtNum(r.record.payAmount, ""),
          电费含税: fmtNum(r.record.elecIncomeTax, ""), 电费不含税: fmtNum(r.record.elecIncomeNet, ""),
          租金含税: fmtNum(r.record.rentIncomeTax, ""), 租金不含税: fmtNum(r.record.rentIncomeNet, ""),
          收款合计: fmtNum(r.record.totalIncome, ""), 利润: fmtNum(r.record.profit, ""), 状态: r.record.status,
          分红明细: r.shares.map((sh) => `${sh.shareholderName}:${fmtMoney(sh.amount)}`).join("、"),
          备注: r.record.remark ?? "",
        })),
      },
    ]);
    toast.success("已导出 Excel");
  };

  const th = "px-3 py-2.5 text-left text-xs font-medium text-slate-500 whitespace-nowrap";
  const thR = "px-3 py-2.5 text-right text-xs font-medium text-slate-500 whitespace-nowrap";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="股东人数" value={`${holders.length}`} icon={Users} tone="blue" />
        <StatCard label="累计应分红（元）" value={fmtMoney(totalPaid)} icon={Wallet} tone="green" />
        <StatCard label="未结算分红（元）" value={fmtMoney(totalPending)} icon={Clock} tone="amber" />
        <StatCard label="分红月结记录" value={`${records.length}`} icon={Wallet} />
      </div>

      {/* 操作按钮 */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={doExport}><Download className="mr-1.5 h-4 w-4" />导出表格</Button>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="mr-1.5 h-4 w-4" />新增分红月结
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ═══ 左侧列表 ═══ */}
        <div className="space-y-2">
          {/* 列表上方选择框 */}
          <div className="px-1">
            <Select value={mode} onValueChange={(v: ViewMode) => { setMode(v); if (v === "shareholder") setSelectedStation(null); else setSelectedHolder(null); }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shareholder"><Users className="mr-2 inline h-4 w-4" />股东</SelectItem>
                <SelectItem value="station"><Building2 className="mr-2 inline h-4 w-4" />站点</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "shareholder" ? (
            <>
              {holders.map((h) => (
                <button key={h.id} onClick={() => setSelectedHolder(selectedHolder === h.id ? null : h.id)}
                  className={`w-full rounded-xl border bg-white p-3.5 text-left shadow-sm transition-colors hover:border-emerald-300 ${selectedHolder === h.id ? "border-emerald-500 ring-1 ring-emerald-500" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-800">{h.name}</span>
                    <span className="text-sm font-bold text-emerald-600 tabular-nums">{fmtMoney(h.totalAmount)}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {h.stations.map((st) => (
                      <span key={st.stationId} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                        {st.stationName} {fmtPct(st.ratio)}
                      </span>
                    ))}
                  </div>
                  <div className="mt-1.5 text-[11px] text-slate-400">已结算 {fmtMoney(h.settledAmount)} · 未结算 {fmtMoney(h.pendingAmount)}</div>
                </button>
              ))}
              {holders.length === 0 && <div className="rounded-xl border border-dashed py-10 text-center text-slate-400">暂无股东</div>}
            </>
          ) : (
            <>
              {(stations.data ?? []).map((s) => (
                <button key={s.station.id} onClick={() => setSelectedStation(selectedStation === s.station.id ? null : s.station.id)}
                  className={`w-full rounded-xl border bg-white p-3.5 text-left shadow-sm transition-colors hover:border-emerald-300 ${selectedStation === s.station.id ? "border-emerald-500 ring-1 ring-emerald-500" : ""}`}>
                  <div className="font-semibold text-sm text-slate-800">{s.station.name}</div>
                  <div className="mt-1 text-[11px] text-slate-400">{[s.station.region, s.brandName].filter(Boolean).join(" · ")}</div>
                </button>
              ))}
              {(stations.data ?? []).length === 0 && <div className="rounded-xl border border-dashed py-10 text-center text-slate-400">暂无站点</div>}
            </>
          )}
        </div>

        {/* ═══ 右侧详情 ═══ */}
        <div className="lg:col-span-2">
          {mode === "shareholder" ? (
            /* ─── 股东模式 ─── */
            !selectedHolder ? (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed text-slate-400">
                请在左侧选择一个股东
              </div>
            ) : !currentHolder ? (
              <div className="py-16 text-center text-slate-400">加载中…</div>
            ) : (
              <div className="space-y-4">
                {/* 当月概览 */}
                <div className="rounded-xl border bg-white p-5 shadow-sm">
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">
                    {currentHolder.name} · {latestPeriod || "当月"} 分红概览
                  </h3>
                  {currentHolderMonth.length > 0 ? (
                    <div className="space-y-2">
                      {currentHolderMonth.map((d) => (
                        <div key={`${d.stationName}-${d.period}`} className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border bg-slate-50 px-4 py-2.5 text-xs">
                          <span className="font-medium text-slate-700">{d.stationName}</span>
                          <span>持股比例 <b>{fmtPct(d.ratio)}</b></span>
                          <span>月份 <b>{d.period}</b></span>
                          <span className="ml-auto text-lg font-bold text-emerald-600 tabular-nums">{fmtMoney(d.amount)} 元</span>
                          <StatusBadge status={d.status} />
                        </div>
                      ))}
                      <div className="text-right text-sm font-semibold text-slate-700">
                        当月合计：<span className="text-emerald-600">{fmtMoney(currentHolderMonth.reduce((t, d) => t + d.amount, 0))} 元</span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-400">暂无当月分红数据</div>
                  )}
                </div>

                {/* 历史明细（可展开） */}
                <div className="rounded-xl border bg-white shadow-sm">
                  <div className="border-b px-5 py-3 text-sm font-semibold text-slate-700">历史分红明细</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b bg-slate-50">
                        <th className="w-8 px-1 py-2"></th>
                        <th className={th}>月份</th><th className={th}>站点</th>
                        <th className={thR}>比例</th><th className={thR}>金额</th><th className={th}>状态</th>
                      </tr></thead>
                      <tbody>
                        {currentHolder.dividends.map((d, i) => {
                          const key = `${d.stationName}-${d.period}-${i}`;
                          const isExpanded = expandedRecord === i;
                          return (
                            <>
                              <tr key={key} className={`cursor-pointer border-b hover:bg-slate-50/60 ${isExpanded ? "bg-slate-50" : ""}`}
                                onClick={() => setExpandedRecord(isExpanded ? null : i)}>
                                <td className="px-1 py-2 text-center">
                                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-300" />}
                                </td>
                                <td className="px-3 py-2 font-medium">{d.period}</td>
                                <td className="px-3 py-2">{d.stationName}</td>
                                <td className="px-3 py-2 text-right">{fmtPct(d.ratio)}</td>
                                <td className="px-3 py-2 text-right font-semibold"><Money v={d.amount} strong /></td>
                                <td className="px-3 py-2"><StatusBadge status={d.status} /></td>
                              </tr>
                              {isExpanded && (
                                <tr key={`${key}-detail`}>
                                  <td colSpan={6} className="border-b bg-slate-50/50 px-6 py-3">
                                    <ShareholderDividendDetail stationName={d.stationName} period={d.period} ratio={d.ratio} amount={d.amount} status={d.status} />
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })}
                        {currentHolder.dividends.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-slate-400">暂无分红记录</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
          ) : (
            /* ─── 站点模式 ─── */
            !selectedStation ? (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed text-slate-400">
                请在左侧选择一个站点
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border bg-white p-5 shadow-sm">
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">
                    {currentStation?.station.name ?? "站点"} · 分红月结
                  </h3>
                  {latestStationRecord ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <div className="rounded-lg border bg-slate-50 p-3">
                          <div className="text-[11px] text-slate-400">电量</div>
                          <div className="mt-1 text-lg font-bold tabular-nums">{fmtNum(latestStationRecord.record.kwh)} 度</div>
                        </div>
                        <div className="rounded-lg border bg-slate-50 p-3">
                          <div className="text-[11px] text-slate-400">付款金额</div>
                          <div className="mt-1 text-lg font-bold tabular-nums"><Money v={latestStationRecord.record.payAmount} /></div>
                        </div>
                        <div className="rounded-lg border bg-slate-50 p-3">
                          <div className="text-[11px] text-slate-400">收款合计</div>
                          <div className="mt-1 text-lg font-bold tabular-nums"><Money v={latestStationRecord.record.totalIncome} /></div>
                        </div>
                        <div className="rounded-lg border bg-slate-50 p-3">
                          <div className="text-[11px] text-slate-400">利润</div>
                          <div className="mt-1 text-lg font-bold text-emerald-600 tabular-nums"><Money v={latestStationRecord.record.profit} strong /></div>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500">期间：{latestStationRecord.record.period} · <StatusBadge status={latestStationRecord.record.status} /></div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-400">暂无分红月结数据</div>
                  )}
                </div>

                {/* 分红明细 */}
                {latestStationRecord && latestStationRecord.shares.length > 0 && (
                  <div className="rounded-xl border bg-white p-5 shadow-sm">
                    <h4 className="mb-3 text-xs font-semibold text-slate-600">股东分红明细（{latestStationRecord.record.period}）</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b bg-slate-50">
                          <th className={th}>股东</th><th className={thR}>持股比例</th><th className={thR}>分红金额</th>
                        </tr></thead>
                        <tbody>
                          {latestStationRecord.shares.map((sh) => (
                            <tr key={sh.id} className="border-b last:border-0">
                              <td className="px-3 py-2 font-medium">{sh.shareholderName}</td>
                              <td className="px-3 py-2 text-right">{fmtPct(sh.ratio)}</td>
                              <td className="px-3 py-2 text-right font-semibold"><Money v={sh.amount} strong /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 历史月结 */}
                {stRecords.length > 1 && (
                  <div className="rounded-xl border bg-white shadow-sm">
                    <div className="border-b px-5 py-3 text-sm font-semibold text-slate-700">历史月结</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b bg-slate-50">
                          <th className={th}>月份</th><th className={thR}>电量</th><th className={thR}>付款</th><th className={thR}>收款</th><th className={thR}>利润</th><th className={th}>状态</th>
                        </tr></thead>
                        <tbody>
                          {stRecords.map((r) => (
                            <tr key={r.record.id} className="border-b last:border-0">
                              <td className="px-3 py-2 font-medium">{r.record.period}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.record.kwh)}</td>
                              <td className="px-3 py-2 text-right"><Money v={r.record.payAmount} /></td>
                              <td className="px-3 py-2 text-right"><Money v={r.record.totalIncome} /></td>
                              <td className="px-3 py-2 text-right"><Money v={r.record.profit} strong /></td>
                              <td className="px-3 py-2"><StatusBadge status={r.record.status} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>

      <DividendForm open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} record={editing ?? undefined} />
    </div>
  );
}

// ─── 股东分红展开详情 ───
function ShareholderDividendDetail({ stationName, period, ratio, amount, status }: {
  stationName: string; period: string; ratio: number; amount: number; status: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-x-5 text-xs text-slate-600">
        <span>站点：<b>{stationName}</b></span>
        <span>月份：<b>{period}</b></span>
        <span>持股比例：<b>{fmtPct(ratio)}</b></span>
        <span>分红金额：<b className="text-emerald-600">{fmtMoney(amount)} 元</b></span>
        <span>状态：<StatusBadge status={status} /></span>
      </div>
    </div>
  );
}
