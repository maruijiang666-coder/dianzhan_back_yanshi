import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getStation } from "@/api/stations";
import { listElectricity, deleteElectricity } from "@/api/electricity";
import { listLeases, deleteLease, listIncomes, deleteIncome } from "@/api/rent";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Money, StatusBadge } from "@/components/Stat";
import { ElecForm } from "./ElecForm";
import { LeaseForm, RentIncomeForm, ReceiptForm } from "./RentForms";
import { DividendForm } from "./DividendForm";
import { fmtDate, fmtNum, fmtPct, fmtMoney } from "@/lib/format";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function StationDrawer({ stationId, onClose }: { stationId: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ["station", stationId], queryFn: () => getStation(stationId) });
  const elec = useQuery({ queryKey: ["electricity", stationId], queryFn: () => listElectricity({ stationId }) });
  const leases = useQuery({ queryKey: ["rentLeases", stationId], queryFn: () => listLeases({ stationId }) });
  const incomes = useQuery({ queryKey: ["rentIncomes", stationId], queryFn: () => listIncomes({ stationId }) });

  const [elecOpen, setElecOpen] = useState(false);
  const [elecEdit, setElecEdit] = useState<any>(null);
  const [leaseOpen, setLeaseOpen] = useState(false);
  const [leaseEdit, setLeaseEdit] = useState<any>(null);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [incomeEdit, setIncomeEdit] = useState<any>(null);
  const [dividendOpen, setDividendOpen] = useState(false);

  const invalidate = () => queryClient.invalidateQueries();

  const delElec = useMutation({
    mutationFn: deleteElectricity,
    onSuccess: () => { toast.success("已删除"); invalidate(); },
  });
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
      <SheetContent className="w-[900px] sm:max-w-[900px]"><div className="py-20 text-center text-slate-400">加载中…</div></SheetContent>
    </Sheet>
  );

  const d = detail.data;
  const th = "px-2.5 py-2 text-left text-xs font-medium text-slate-500";
  const thR = "px-2.5 py-2 text-right text-xs font-medium text-slate-500";

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[900px] sm:max-w-[900px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="text-lg">{d.name}</span>
            <span className="text-sm text-slate-400">{d.code ?? ""}</span>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* 站点概况 */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
            <span>区域：<b>{d.region ?? "-"}</b></span>
            <span>场地方：<b>{d.landlordName ?? "-"}</b></span>
            <span>公司占股：<b>{fmtPct(d.company_share)}</b></span>
            <span>电表数量：<b>{d.meters?.length ?? 0}</b></span>
            <span>状态：<b>{d.status}</b></span>
          </div>

          <Tabs defaultValue="elec">
            <TabsList>
              <TabsTrigger value="elec">电费台账</TabsTrigger>
              <TabsTrigger value="rent">场地租金</TabsTrigger>
              <TabsTrigger value="shareholder">股东配置</TabsTrigger>
            </TabsList>

            {/* 电费台账 */}
            <TabsContent value="elec">
              <div className="space-y-3">
                <div className="flex justify-end">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setElecEdit(null); setElecOpen(true); }}>
                    <Plus className="mr-1 h-3.5 w-3.5" />新增电费
                  </Button>
                </div>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b bg-slate-50">
                      <th className={th}>期间</th><th className={thR}>付款金额</th><th className={th}>付款</th>
                      <th className={thR}>收款金额</th><th className={th}>到账</th><th className={thR}>利润</th>
                      <th className={`${th} text-center`}>操作</th>
                    </tr></thead>
                    <tbody>
                      {(elec.data ?? []).map((r: any) => (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="px-2.5 py-2 font-medium">{r.period}</td>
                          <td className="px-2.5 py-2 text-right"><Money v={r.pay_amount} /></td>
                          <td className="px-2.5 py-2"><StatusBadge status={r.pay_status} /></td>
                          <td className="px-2.5 py-2 text-right"><Money v={r.collect_amount} /></td>
                          <td className="px-2.5 py-2"><StatusBadge status={r.collect_status} /></td>
                          <td className="px-2.5 py-2 text-right"><Money v={r.profit} strong /></td>
                          <td className="px-2.5 py-2">
                            <div className="flex justify-center gap-0.5">
                              <button className="rounded p-1 text-slate-400 hover:text-emerald-600" onClick={() => { setElecEdit(r); setElecOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
                              <button className="rounded p-1 text-slate-400 hover:text-rose-500" onClick={() => window.confirm("删除？") && delElec.mutate(r.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {(elec.data ?? []).length === 0 && <tr><td colSpan={7} className="py-6 text-center text-slate-400">暂无电费记录</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* 场地租金 */}
            <TabsContent value="rent">
              <div className="space-y-4">
                {/* 付款合同 */}
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

                {/* 收款合同 */}
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
            </TabsContent>

            {/* 股东配置 */}
            <TabsContent value="shareholder">
              <div className="space-y-3">
                <div className="text-xs text-slate-500">
                  分红配置请在「股东分红」页面的「分红配置」中设置
                </div>
                {d.shareholderConfigs && d.shareholderConfigs.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b bg-slate-50">
                        <th className={th}>股东</th><th className={th}>分红模式</th><th className={thR}>比例</th>
                        <th className={thR}>固定金额</th><th className={th}>结算周期</th>
                      </tr></thead>
                      <tbody>
                        {d.shareholderConfigs.map((c: any) => (
                          <tr key={c.id} className="border-b last:border-0">
                            <td className="px-2.5 py-2 font-medium">{c.shareholder_name}</td>
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
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>

      <ElecForm open={elecOpen} onClose={() => { setElecOpen(false); setElecEdit(null); }} stationId={stationId} record={elecEdit} />
      <LeaseForm open={leaseOpen} onClose={() => { setLeaseOpen(false); setLeaseEdit(null); }} stationId={stationId} record={leaseEdit} />
      <RentIncomeForm open={incomeOpen} onClose={() => { setIncomeOpen(false); setIncomeEdit(null); }} stationId={stationId} record={incomeEdit} />
      <DividendForm open={dividendOpen} onClose={() => setDividendOpen(false)} presetStationId={stationId} />
    </Sheet>
  );
}
