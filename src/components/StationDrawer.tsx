import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getStation, getStationMeterView } from "@/api/stations";
import { listLeases, deleteLease, listIncomes, deleteIncome } from "@/api/rent";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Money, StatusBadge } from "@/components/Stat";
import { LeaseForm, RentIncomeForm } from "./RentForms";
import { DividendForm } from "./DividendForm";
import { MonthPicker } from "./MonthPicker";
import { fmtNum, fmtPct, fmtMoney, fmtDate } from "@/lib/format";
import { Plus, Pencil, Trash2, Zap, Battery, Receipt, TrendingUp, Home } from "lucide-react";
import { toast } from "sonner";

function InfoRow({ label, value, className = "" }: { label: string; value: any; className?: string }) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <span className="shrink-0 text-slate-400">{label}：</span>
      <span className="font-medium text-slate-700">{value ?? "-"}</span>
    </div>
  );
}

function SectionCard({ icon: Icon, title, color, children }: { icon: any; title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white">
      <div className={`flex items-center gap-1.5 border-b px-3 py-1.5 ${color}`}>
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-semibold">{title}</span>
      </div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}

export function StationDrawer({ stationId, onClose }: { stationId: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const today = new Date();
  const defaultPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [period, setPeriod] = useState(defaultPeriod);

  const detail = useQuery({ queryKey: ["station", stationId], queryFn: () => getStation(stationId) });
  const meterView = useQuery({
    queryKey: ["stationMeterView", stationId, period],
    queryFn: () => getStationMeterView(stationId, period),
    enabled: !!period,
  });
  const leases = useQuery({ queryKey: ["rentLeases", stationId], queryFn: () => listLeases({ stationId }) });
  const incomes = useQuery({ queryKey: ["rentIncomes", stationId], queryFn: () => listIncomes({ stationId }) });

  const [leaseOpen, setLeaseOpen] = useState(false);
  const [leaseEdit, setLeaseEdit] = useState<any>(null);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [incomeEdit, setIncomeEdit] = useState<any>(null);
  const [dividendOpen, setDividendOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"meters" | "rent" | "shareholder">("meters");

  const invalidate = () => queryClient.invalidateQueries();

  const delLease = useMutation({
    mutationFn: deleteLease,
    onSuccess: () => { toast.success("已删除"); invalidate(); },
  });
  const delIncome = useMutation({
    mutationFn: deleteIncome,
    onSuccess: () => { toast.success("已删除"); invalidate(); },
  });

  if (!detail.data) return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[1100px] sm:max-w-[1100px]"><div className="py-20 text-center text-slate-400">加载中…</div></SheetContent>
    </Sheet>
  );

  const d = detail.data;
  const mv = meterView.data;
  const th = "px-2.5 py-2 text-left text-xs font-medium text-slate-500";
  const thR = "px-2.5 py-2 text-right text-xs font-medium text-slate-500";

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[1100px] sm:max-w-[1100px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="text-lg">{d.name}</span>
            <span className="text-sm text-slate-400">{d.code ?? ""}</span>
          </SheetTitle>
        </SheetHeader>

        {/* 站点概况 */}
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-600">
          <span>区域：<b>{d.region ?? "-"}</b></span>
          <span>场地方：<b>{d.landlordName ?? "-"}</b></span>
          <span>公司占股：<b>{fmtPct(d.company_share)}</b></span>
          <span>电表数量：<b>{d.meters?.length ?? 0}</b></span>
          <span>状态：<b>{d.status}</b></span>
        </div>

        {/* Tab 导航 */}
        <div className="mt-4 flex gap-1 border-b">
          {(["meters", "rent", "shareholder"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              {tab === "meters" ? "电表总览" : tab === "rent" ? "场地租金" : "股东配置"}
            </button>
          ))}
        </div>

        {/* 电表总览 */}
        {activeTab === "meters" && (
          <div className="mt-4 space-y-4">
            {/* 月份选择 */}
            <div className="flex items-center gap-3">
              <MonthPicker value={period} onChange={setPeriod} />
            </div>

            {meterView.isLoading && <div className="py-10 text-center text-slate-400">加载中…</div>}

            {mv && mv.brandGroups && mv.brandGroups.length === 0 && (
              <div className="rounded-lg border border-dashed py-10 text-center text-sm text-slate-400">
                暂无电表数据，请先在「电表管理」中添加电表
              </div>
            )}

            {mv && mv.brandGroups.map((group: any) => (
              <div key={group.brandName} className="space-y-3">
                {/* 品牌分组标题 */}
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="shrink-0 text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1 rounded-full border">
                    {group.brandName}
                  </span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                {group.meters.map((meter: any) => (
                  <div key={meter.meterId} className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                    {/* 电表标题 */}
                    <div className="flex items-center justify-between bg-white border-b px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-semibold text-slate-800">{meter.meterNo || meter.meterName || `电表#${meter.meterId}`}</span>
                        {meter.meterName && meter.meterNo && (
                          <span className="text-xs text-slate-400">({meter.meterName})</span>
                        )}
                      </div>
                    </div>

                    <div className="p-3 space-y-2.5">
                      {/* 1. 站点配置 */}
                      <SectionCard icon={Battery} title="站点配置" color="text-violet-600 bg-violet-50 border-violet-100">
                        <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
                          <InfoRow label="电表品牌" value={meter.brandName} />
                          <InfoRow label="柜子数量" value={`${meter.cabinetCount} 个`} />
                          <InfoRow label="柜子编号" value={meter.cabinetNos} />
                        </div>
                      </SectionCard>

                      {/* 2. 电费付款情况 */}
                      <SectionCard icon={Zap} title="电费付款情况" color="text-amber-600 bg-amber-50 border-amber-100">
                        <div className="grid grid-cols-4 gap-x-4 gap-y-1 text-xs">
                          <InfoRow label="电表编号" value={meter.meterNo} />
                          <InfoRow label="上月抄表度数" value={meter.prevEndReading != null ? fmtNum(meter.prevEndReading) : "-"} />
                          <InfoRow label="本月抄表度数" value={meter.endReading != null ? fmtNum(meter.endReading) : "-"} />
                          <InfoRow label="付款度数" value={meter.payKwh != null ? fmtNum(meter.payKwh) : "-"} />
                          <InfoRow label="付款单价" value={meter.payUnitPrice != null ? `${fmtNum(meter.payUnitPrice)} 元/度` : "-"} />
                          <InfoRow label="付款金额" value={meter.payAmount != null ? <Money v={meter.payAmount} /> : "-"} />
                          <div className="flex items-center gap-1">
                            <span className="shrink-0 text-slate-400">电费付款情况：</span>
                            {meter.payStatus ? <StatusBadge status={meter.payStatus} /> : <span className="text-slate-300">-</span>}
                          </div>
                        </div>
                      </SectionCard>

                      {/* 3. 电费收款情况 */}
                      <SectionCard icon={Receipt} title="电费收款情况" color="text-emerald-600 bg-emerald-50 border-emerald-100">
                        <div className="grid grid-cols-4 gap-x-4 gap-y-1 text-xs">
                          <InfoRow
                            label="电费收款区间"
                            value={
                              meter.collectStartDate && meter.collectEndDate
                                ? `${fmtDate(meter.collectStartDate)} ~ ${fmtDate(meter.collectEndDate)}`
                                : "-"
                            }
                          />
                          <InfoRow label="收款度数" value={meter.payKwh != null ? fmtNum(meter.payKwh) : "-"} />
                          <InfoRow label="电费收款单价" value={meter.collectUnitPrice != null ? `${fmtNum(meter.collectUnitPrice)} 元/度` : "-"} />
                          <InfoRow label="电费收入（含税）" value={meter.collectAmount != null ? <Money v={meter.collectAmount} /> : "-"} />
                          <div className="flex items-center gap-1">
                            <span className="shrink-0 text-slate-400">电费收款情况：</span>
                            {meter.collectStatus ? <StatusBadge status={meter.collectStatus} /> : <span className="text-slate-300">-</span>}
                          </div>
                        </div>
                      </SectionCard>

                      {/* 4. 电费利润明细 */}
                      <SectionCard icon={TrendingUp} title="电费利润明细" color="text-blue-600 bg-blue-50 border-blue-100">
                        <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
                          <InfoRow label="税率" value={meter.taxRate != null ? `${(meter.taxRate * 100).toFixed(1)}%` : "-"} />
                          <InfoRow label="收入单价（不含税）" value={meter.collectUnitPrice != null ? `${fmtNum(meter.collectUnitPrice)} 元/度` : "-"} />
                          <InfoRow label="电费收入（不含税）" value={meter.collectNet != null ? <Money v={meter.collectNet} /> : "-"} />
                        </div>
                      </SectionCard>

                      {/* 5. 场地租金收款情况 */}
                      <SectionCard icon={Home} title="场地租金收款情况" color="text-rose-600 bg-rose-50 border-rose-100">
                        {meter.rentReceipts && meter.rentReceipts.length > 0 ? (
                          <div className="space-y-1.5">
                            {meter.rentReceipts.map((r: any, idx: number) => (
                              <div key={idx} className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
                                <InfoRow
                                  label="场地收款期间"
                                  value={
                                    r.period_start && r.period_end
                                      ? `${String(r.period_start).slice(0, 10)} ~ ${String(r.period_end).slice(0, 10)}`
                                      : "-"
                                  }
                                />
                                <InfoRow label="场地租金" value={r.amount != null ? <Money v={r.amount} /> : "-"} />
                                <div className="flex items-center gap-1">
                                  <span className="shrink-0 text-slate-400">场地租金收款情况：</span>
                                  {r.status ? <StatusBadge status={r.status} /> : <span className="text-slate-300">-</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400">暂无租金收款记录</div>
                        )}
                      </SectionCard>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* 场地租金 */}
        {activeTab === "rent" && (
          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-600">付款合同（公司 → 业主）</span>
                <Button size="sm" variant="outline" onClick={() => { setLeaseEdit(null); setLeaseOpen(true); }}>
                  <Plus className="mr-1 h-3.5 w-3.5" />新增
                </Button>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead><tr className="border-b bg-slate-50">
                    <th className={th}>租期</th><th className={thR}>年租金</th><th className={th}>付款方式</th>
                    <th className={th}>付款状态</th><th className={`${th} text-center`}>操作</th>
                  </tr></thead>
                  <tbody>
                    {(leases.data ?? []).map((l: any) => (
                      <tr key={l.id} className="border-b last:border-0">
                        <td className="px-2.5 py-2">{fmtDate(l.contract_start)} ~ {fmtDate(l.contract_end)}</td>
                        <td className="px-2.5 py-2 text-right"><Money v={l.annual_rent} strong /></td>
                        <td className="px-2.5 py-2">{l.pay_method ?? "-"}</td>
                        <td className="px-2.5 py-2"><StatusBadge status={l.pay_status} /></td>
                        <td className="px-2.5 py-2">
                          <div className="flex justify-center gap-0.5">
                            <button className="rounded p-1 text-slate-400 hover:text-emerald-600" onClick={() => { setLeaseEdit(l); setLeaseOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
                            <button className="rounded p-1 text-slate-400 hover:text-rose-500" onClick={() => window.confirm("删除？") && delLease.mutate(l.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(leases.data ?? []).length === 0 && <tr><td colSpan={5} className="py-4 text-center text-slate-400">暂无付款合同</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-600">收款合同（品牌方 → 公司）</span>
                <Button size="sm" variant="outline" onClick={() => { setIncomeEdit(null); setIncomeOpen(true); }}>
                  <Plus className="mr-1 h-3.5 w-3.5" />新增
                </Button>
              </div>
              <div className="space-y-2">
                {(incomes.data ?? []).map((i: any) => (
                  <div key={i.id} className="rounded-lg border">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-slate-50 px-3 py-1.5 text-[11px]">
                      <span className="font-medium">{i.brand_name ?? "未指定品牌"}</span>
                      <span>单柜月租 <b>{fmtMoney(i.unit_monthly_rent)}</b></span>
                      <span>柜数 <b>{fmtNum(i.cabinets_count)}</b></span>
                      <span>年收入 <b>{fmtMoney(i.annual_income)}</b></span>
                      <div className="ml-auto flex gap-0.5">
                        <button className="rounded p-1 text-slate-400 hover:text-emerald-600" onClick={() => { setIncomeEdit(i); setIncomeOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
                        <button className="rounded p-1 text-slate-400 hover:text-rose-500" onClick={() => window.confirm("删除？") && delIncome.mutate(i.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  </div>
                ))}
                {(incomes.data ?? []).length === 0 && <div className="rounded-lg border border-dashed py-4 text-center text-xs text-slate-400">暂无收款合同</div>}
              </div>
            </div>
          </div>
        )}

        {/* 股东配置（保留原有） */}
        {activeTab === "shareholder" && (
          <div className="mt-4 space-y-3">
            <div className="text-xs text-slate-500">
              分红配置请在「股东分红」页面的「分红配置」中设置
            </div>
            {d.shareholderConfigs && d.shareholderConfigs.length > 0 && (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead><tr className="border-b bg-slate-50">
                    <th className={th}>股东</th><th className={th}>品牌</th><th className={th}>分红模式</th><th className={thR}>比例</th>
                    <th className={thR}>固定金额</th><th className={th}>结算周期</th>
                  </tr></thead>
                  <tbody>
                    {d.shareholderConfigs.map((c: any) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="px-2.5 py-2 font-medium">{c.shareholder_name}</td>
                        <td className="px-2.5 py-2">{c.brand_name || "全场"}</td>
                        <td className="px-2.5 py-2">{c.mode}</td>
                        <td className="px-2.5 py-2 text-right">{c.ratio ? fmtNum(c.ratio) : "-"}</td>
                        <td className="px-2.5 py-2 text-right">{c.fixed_amount ? fmtMoney(c.fixed_amount) : "-"}</td>
                        <td className="px-2.5 py-2">{c.settlement_period}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setDividendOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />新增分红月结
            </Button>
          </div>
        )}
      </SheetContent>

      <LeaseForm open={leaseOpen} onClose={() => { setLeaseOpen(false); setLeaseEdit(null); }} stationId={stationId} record={leaseEdit} />
      <RentIncomeForm open={incomeOpen} onClose={() => { setIncomeOpen(false); setIncomeEdit(null); }} stationId={stationId} record={incomeEdit} />
      <DividendForm open={dividendOpen} onClose={() => setDividendOpen(false)} presetStationId={stationId} />
    </Sheet>
  );
}
