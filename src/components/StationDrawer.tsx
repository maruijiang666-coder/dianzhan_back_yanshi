import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Money, StatusBadge } from "@/components/Stat";
import { ElecForm } from "./ElecForm";
import { LeaseForm, RentIncomeForm, ReceiptForm } from "./RentForms";
import { DividendForm } from "./DividendForm";
import { inputCls } from "./fields";
import { fmtDate, fmtDateTime, fmtNum, fmtPct, fmtMoney, numOrNull } from "@/lib/format";
import { Plus, Pencil, Trash2, Gauge } from "lucide-react";
import { toast } from "sonner";

export function StationDrawer({ stationId, onClose }: { stationId: number; onClose: () => void }) {
  const detail = trpc.ledger.stationDetail.useQuery({ id: stationId });
  const utils = trpc.useUtils();
  const shareholders = trpc.ledger.shareholders.useQuery();

  const [elecOpen, setElecOpen] = useState(false);
  const [elecEdit, setElecEdit] = useState<Record<string, unknown> | null>(null);
  const [leaseOpen, setLeaseOpen] = useState(false);
  const [leaseEdit, setLeaseEdit] = useState<Record<string, unknown> | null>(null);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [incomeEdit, setIncomeEdit] = useState<Record<string, unknown> | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptEdit, setReceiptEdit] = useState<Record<string, unknown> | null>(null);
  const [receiptIncomeId, setReceiptIncomeId] = useState<number>(0);
  const [dividendOpen, setDividendOpen] = useState(false);
  const [shareDraft, setShareDraft] = useState<{ shareholderId: string; ratio: string }[]>([]);
  const [sharesEditing, setSharesEditing] = useState(false);
  const [readingDraft, setReadingDraft] = useState({ reading: "", readingAt: "" });

  const delElec = trpc.mut.deleteElectricity.useMutation({ onSuccess: () => { toast.success("已删除"); utils.invalidate(); } });
  const delLease = trpc.mut.deleteLease.useMutation({ onSuccess: () => { toast.success("已删除"); utils.invalidate(); } });
  const delIncome = trpc.mut.deleteRentIncome.useMutation({ onSuccess: () => { toast.success("已删除"); utils.invalidate(); } });
  const delReceipt = trpc.mut.deleteReceipt.useMutation({ onSuccess: () => { toast.success("已删除"); utils.invalidate(); } });
  const setShares = trpc.mut.setStationShares.useMutation({
    onSuccess: () => { toast.success("股东占股已保存"); setSharesEditing(false); utils.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const addReading = trpc.mut.addMeterReading.useMutation({
    onSuccess: () => { toast.success("抄表记录已补录"); setReadingDraft({ reading: "", readingAt: "" }); utils.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const delReading = trpc.mut.deleteMeterReading.useMutation({ onSuccess: () => { toast.success("已删除"); utils.invalidate(); } });

  if (!detail.data) return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[900px] sm:max-w-[900px]"><div className="py-20 text-center text-slate-400">加载中…</div></SheetContent>
    </Sheet>
  );

  const d = detail.data;
  const st = d.station;
  const th = "px-2.5 py-2 text-left text-xs font-medium text-slate-500";
  const thR = "px-2.5 py-2 text-right text-xs font-medium text-slate-500";
  const confirm = (msg: string, fn: () => void) => { if (window.confirm(msg)) fn(); };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[920px] overflow-y-auto sm:max-w-[920px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            {st.name}
            <StatusBadge status={st.status} />
          </SheetTitle>
          <div className="text-xs text-slate-400">
            {[st.region, d.brandName, d.entityName, d.landlordName ? `业主：${d.landlordName}` : null, st.meterNo ? `电表 ${st.meterNo}（${fmtNum(st.transformerRatio)}倍）` : null].filter(Boolean).join(" · ")}
          </div>
        </SheetHeader>

        <Tabs defaultValue="elec" className="mt-4">
          <TabsList>
            <TabsTrigger value="elec">电费月结（{d.electricity.length}）</TabsTrigger>
            <TabsTrigger value="rent">场租合同（{d.leases.length + d.incomes.length}）</TabsTrigger>
            <TabsTrigger value="dividend">分红（{d.dividends.length}）</TabsTrigger>
            <TabsTrigger value="shares">股东占股</TabsTrigger>
            <TabsTrigger value="meter">抄表记录（{d.readings.length}）</TabsTrigger>
          </TabsList>

          {/* ═══ 电费月结 ═══ */}
          <TabsContent value="elec" className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setElecEdit(null); setElecOpen(true); }}>
                <Plus className="mr-1 h-3.5 w-3.5" />录入月结
              </Button>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[820px] text-xs">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className={th}>期间</th><th className={thR}>付款度数</th><th className={thR}>付款单价</th><th className={thR}>付款金额</th><th className={th}>付款</th>
                    <th className={thR}>收款度数</th><th className={thR}>收款单价</th><th className={thR}>收款金额</th><th className={thR}>不含税</th><th className={th}>到账</th>
                    <th className={thR}>利润</th><th className={th}>来源</th><th className="px-2.5 py-2 text-center text-xs font-medium text-slate-500">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {d.electricity.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50/60">
                      <td className="px-2.5 py-2 font-medium">{r.period}</td>
                      <td className="px-2.5 py-2 text-right tabular-nums">{fmtNum(r.payKwh)}</td>
                      <td className="px-2.5 py-2 text-right tabular-nums">{fmtNum(r.payUnitPrice)}</td>
                      <td className="px-2.5 py-2 text-right"><Money v={r.payAmount} /></td>
                      <td className="px-2.5 py-2"><StatusBadge status={r.payStatus} /></td>
                      <td className="px-2.5 py-2 text-right tabular-nums">{fmtNum(r.collectKwh)}</td>
                      <td className="px-2.5 py-2 text-right tabular-nums">{fmtNum(r.collectUnitPrice)}</td>
                      <td className="px-2.5 py-2 text-right"><Money v={r.collectAmount} /></td>
                      <td className="px-2.5 py-2 text-right"><Money v={r.collectNet} /></td>
                      <td className="px-2.5 py-2"><StatusBadge status={r.collectStatus} /></td>
                      <td className="px-2.5 py-2 text-right"><Money v={r.profit} strong /></td>
                      <td className="px-2.5 py-2"><StatusBadge status={r.source} /></td>
                      <td className="px-2.5 py-2">
                        <div className="flex justify-center gap-0.5">
                          <button className="rounded p-1 text-slate-400 hover:text-emerald-600" onClick={() => { setElecEdit(r as never); setElecOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
                          <button className="rounded p-1 text-slate-400 hover:text-rose-500" onClick={() => confirm("删除该月结记录？", () => delElec.mutate({ id: r.id }))}><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {d.electricity.length === 0 && <tr><td colSpan={13} className="py-10 text-center text-slate-400">暂无电费月结，点击右上角录入</td></tr>}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ═══ 场租合同 ═══ */}
          <TabsContent value="rent" className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-semibold text-rose-600">付款合同（公司 → 业主）</h4>
                <Button size="sm" variant="outline" onClick={() => { setLeaseEdit(null); setLeaseOpen(true); }}><Plus className="mr-1 h-3.5 w-3.5" />新增付款合同</Button>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[700px] text-xs">
                  <thead><tr className="border-b bg-slate-50">
                    <th className={th}>合同租期</th><th className={thR}>年租金</th><th className={th}>付款方式</th><th className={thR}>每期金额</th><th className={thR}>押金</th><th className={th}>付款截止</th><th className={th}>情况</th><th className="px-2.5 py-2 text-center text-xs font-medium text-slate-500">操作</th>
                  </tr></thead>
                  <tbody>
                    {d.leases.map((l) => (
                      <tr key={l.id} className="border-b last:border-0">
                        <td className="px-2.5 py-2">{fmtDate(l.contractStart)} ~ {fmtDate(l.contractEnd)}</td>
                        <td className="px-2.5 py-2 text-right"><Money v={l.annualRent} strong /></td>
                        <td className="px-2.5 py-2">{l.payMethod ?? "-"}</td>
                        <td className="px-2.5 py-2 text-right"><Money v={l.payAmount} /></td>
                        <td className="px-2.5 py-2 text-right"><Money v={l.deposit} /></td>
                        <td className="px-2.5 py-2">{fmtDate(l.payDeadline)}</td>
                        <td className="px-2.5 py-2"><StatusBadge status={l.payStatus} /></td>
                        <td className="px-2.5 py-2">
                          <div className="flex justify-center gap-0.5">
                            <button className="rounded p-1 text-slate-400 hover:text-emerald-600" onClick={() => { setLeaseEdit(l as never); setLeaseOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
                            <button className="rounded p-1 text-slate-400 hover:text-rose-500" onClick={() => confirm("删除该付款合同？", () => delLease.mutate({ id: l.id }))}><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {d.leases.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-slate-400">暂无付款合同</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-semibold text-emerald-600">收款合同（品牌方 → 公司）</h4>
                <Button size="sm" variant="outline" onClick={() => { setIncomeEdit(null); setIncomeOpen(true); }}><Plus className="mr-1 h-3.5 w-3.5" />新增收款合同</Button>
              </div>
              <div className="space-y-3">
                {d.incomes.map((ic) => (
                  <div key={ic.id} className="rounded-lg border">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-slate-50 px-3 py-2 text-xs">
                      <span className="font-medium">{fmtDate(ic.contractStart)} ~ {fmtDate(ic.contractEnd)}</span>
                      <span>单柜月租 <b className="tabular-nums">{fmtMoney(ic.unitMonthlyRent)}</b></span>
                      <span>柜数 <b>{fmtNum(ic.cabinetsCount)}</b></span>
                      <span>年收入(含税) <b className="tabular-nums">{fmtMoney(ic.annualIncome)}</b></span>
                      <span>利润 <b className="text-emerald-600 tabular-nums">{fmtMoney(ic.profit)}</b></span>
                      <span className="ml-auto flex gap-0.5">
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => { setReceiptIncomeId(ic.id); setReceiptEdit(null); setReceiptOpen(true); }}><Plus className="mr-0.5 h-3 w-3" />分期收款</Button>
                        <button className="rounded p-1 text-slate-400 hover:text-emerald-600" onClick={() => { setIncomeEdit(ic as never); setIncomeOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
                        <button className="rounded p-1 text-slate-400 hover:text-rose-500" onClick={() => confirm("删除该收款合同及其分期？", () => delIncome.mutate({ id: ic.id }))}><Trash2 className="h-3.5 w-3.5" /></button>
                      </span>
                    </div>
                    <table className="w-full text-xs">
                      <thead><tr className="border-b text-slate-400">
                        <th className={th}>期次</th><th className={th}>收款区间</th><th className={thR}>金额</th><th className={th}>到账</th><th className="px-2.5 py-2 text-center text-xs font-medium text-slate-400">操作</th>
                      </tr></thead>
                      <tbody>
                        {ic.receipts.map((rc: any) => (
                          <tr key={rc.id} className="border-b last:border-0">
                            <td className="px-2.5 py-1.5">第 {fmtNum(rc.seq)} 次</td>
                            <td className="px-2.5 py-1.5">{fmtDate(rc.periodStart)} ~ {fmtDate(rc.periodEnd)}</td>
                            <td className="px-2.5 py-1.5 text-right"><Money v={rc.amount} /></td>
                            <td className="px-2.5 py-1.5"><StatusBadge status={rc.status} /></td>
                            <td className="px-2.5 py-1.5">
                              <div className="flex justify-center gap-0.5">
                                <button className="rounded p-1 text-slate-400 hover:text-emerald-600" onClick={() => { setReceiptIncomeId(ic.id); setReceiptEdit(rc as never); setReceiptOpen(true); }}><Pencil className="h-3 w-3" /></button>
                                <button className="rounded p-1 text-slate-400 hover:text-rose-500" onClick={() => confirm("删除该分期？", () => delReceipt.mutate({ id: rc.id }))}><Trash2 className="h-3 w-3" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {ic.receipts.length === 0 && <tr><td colSpan={5} className="py-3 text-center text-slate-400">暂无分期收款</td></tr>}
                      </tbody>
                    </table>
                  </div>
                ))}
                {d.incomes.length === 0 && <div className="rounded-lg border border-dashed py-6 text-center text-xs text-slate-400">暂无收款合同</div>}
              </div>
            </div>
          </TabsContent>

          {/* ═══ 分红 ═══ */}
          <TabsContent value="dividend" className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setDividendOpen(true)}><Plus className="mr-1 h-3.5 w-3.5" />新增分红月结</Button>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[640px] text-xs">
                <thead><tr className="border-b bg-slate-50">
                  <th className={th}>月份</th><th className={thR}>电量</th><th className={thR}>付款金额</th><th className={thR}>收款合计</th><th className={thR}>利润</th><th className={th}>状态</th>
                </tr></thead>
                <tbody>
                  {d.dividends.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-2.5 py-2 font-medium">{r.period}</td>
                      <td className="px-2.5 py-2 text-right tabular-nums">{fmtNum(r.kwh)}</td>
                      <td className="px-2.5 py-2 text-right"><Money v={r.payAmount} /></td>
                      <td className="px-2.5 py-2 text-right"><Money v={r.totalIncome} /></td>
                      <td className="px-2.5 py-2 text-right"><Money v={r.profit} strong /></td>
                      <td className="px-2.5 py-2"><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                  {d.dividends.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-400">暂无分红记录</td></tr>}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ═══ 股东占股 ═══ */}
          <TabsContent value="shares" className="space-y-3">
            {!sharesEditing ? (
              <>
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => { setShareDraft(d.shares.map((sh) => ({ shareholderId: String(sh.shareholderId), ratio: sh.ratio }))); setSharesEditing(true); }}>
                    <Pencil className="mr-1 h-3.5 w-3.5" />编辑占股
                  </Button>
                </div>
                <div className="rounded-lg border">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b bg-slate-50"><th className={th}>股东</th><th className={thR}>分红比例</th></tr></thead>
                    <tbody>
                      {d.shares.map((sh) => (
                        <tr key={sh.id} className="border-b last:border-0">
                          <td className="px-2.5 py-2 font-medium">{sh.shareholderName}</td>
                          <td className="px-2.5 py-2 text-right tabular-nums">{fmtPct(sh.ratio)}</td>
                        </tr>
                      ))}
                      {d.shares.length === 0 && <tr><td colSpan={2} className="py-6 text-center text-slate-400">未设置股东占股</td></tr>}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                {shareDraft.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select className={`${inputCls} w-56`} value={row.shareholderId}
                      onChange={(e) => setShareDraft((p) => p.map((x, j) => (j === i ? { ...x, shareholderId: e.target.value } : x)))}>
                      <option value="">选择股东</option>
                      {(shareholders.data ?? []).map((h) => <option key={h.id} value={String(h.id)}>{h.name}</option>)}
                    </select>
                    <input type="number" step="any" className={`${inputCls} w-32 tabular-nums`} placeholder="比例 0.3" value={row.ratio}
                      onChange={(e) => setShareDraft((p) => p.map((x, j) => (j === i ? { ...x, ratio: e.target.value } : x)))} />
                    <button className="text-slate-300 hover:text-rose-500" onClick={() => setShareDraft((p) => p.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShareDraft((p) => [...p, { shareholderId: "", ratio: "" }])}><Plus className="mr-1 h-3.5 w-3.5" />添加</Button>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={setShares.isPending}
                    onClick={() => setShares.mutate({ stationId, shares: shareDraft.filter((x) => x.shareholderId && x.ratio).map((x) => ({ shareholderId: Number(x.shareholderId), ratio: Number(x.ratio) })) })}>
                    保存占股
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSharesEditing(false)}>取消</Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ═══ 抄表记录 ═══ */}
          <TabsContent value="meter" className="space-y-3">
            {st.meterNo ? (
              <div className="flex items-end gap-2 rounded-lg border border-sky-100 bg-sky-50/50 p-3">
                <Gauge className="mb-1.5 h-4 w-4 text-sky-500" />
                <span className="mb-1 text-xs text-sky-700">电表 {st.meterNo} · 手工补录：</span>
                <input type="number" className={`${inputCls} w-36 tabular-nums`} placeholder="表码" value={readingDraft.reading}
                  onChange={(e) => setReadingDraft((p) => ({ ...p, reading: e.target.value }))} />
                <input type="datetime-local" className={`${inputCls} w-52`} value={readingDraft.readingAt}
                  onChange={(e) => setReadingDraft((p) => ({ ...p, readingAt: e.target.value }))} />
                <Button size="sm" className="bg-sky-600 hover:bg-sky-700" disabled={addReading.isPending}
                  onClick={() => {
                    const v = numOrNull(readingDraft.reading);
                    if (v === null || !readingDraft.readingAt) { toast.error("请填写表码和抄表时间"); return; }
                    addReading.mutate({ stationId, meterNo: st.meterNo!, reading: v, readingAt: new Date(readingDraft.readingAt).toISOString() });
                  }}>补录</Button>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed py-4 text-center text-xs text-slate-400">该站点未配置电表编号，请先在站点信息中填写</div>
            )}
            <div className="rounded-lg border">
              <table className="w-full text-xs">
                <thead><tr className="border-b bg-slate-50"><th className={th}>抄表时间</th><th className={thR}>表码（度）</th><th className={th}>来源</th><th className="px-2.5 py-2 text-center text-xs font-medium text-slate-500">操作</th></tr></thead>
                <tbody>
                  {d.readings.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-2.5 py-2">{fmtDateTime(r.readingAt)}</td>
                      <td className="px-2.5 py-2 text-right font-semibold tabular-nums">{fmtNum(r.reading)}</td>
                      <td className="px-2.5 py-2"><StatusBadge status={r.source} /></td>
                      <td className="px-2.5 py-2 text-center">
                        <button className="rounded p-1 text-slate-400 hover:text-rose-500" onClick={() => confirm("删除该抄表记录？", () => delReading.mutate({ id: r.id }))}><Trash2 className="h-3.5 w-3.5" /></button>
                      </td>
                    </tr>
                  ))}
                  {d.readings.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-slate-400">暂无抄表记录（智慧电表API推送后自动出现）</td></tr>}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>

        {/* 表单弹窗 */}
        <ElecForm open={elecOpen} onClose={() => setElecOpen(false)} stationId={stationId} stationName={st.name} record={elecEdit as never} />
        <LeaseForm open={leaseOpen} onClose={() => setLeaseOpen(false)} stationId={stationId} stationName={st.name} record={leaseEdit as never} />
        <RentIncomeForm open={incomeOpen} onClose={() => setIncomeOpen(false)} stationId={stationId} stationName={st.name} record={incomeEdit as never} />
        <ReceiptForm open={receiptOpen} onClose={() => setReceiptOpen(false)} rentIncomeId={receiptIncomeId} record={receiptEdit as never}
          nextSeq={(d.incomes.find((i) => i.id === receiptIncomeId)?.receipts.length ?? 0) + 1} />
        <DividendForm open={dividendOpen} onClose={() => setDividendOpen(false)} presetStationId={stationId} />
      </SheetContent>
    </Sheet>
  );
}
