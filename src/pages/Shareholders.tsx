import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shareholderSummary, listDividends, listShareholderConfigs, saveShareholderConfig, deleteShareholderConfig, listIntroducerConfigs, saveIntroducerConfig, deleteIntroducerConfig, createDividend, submitDividend, approveDividend, rejectDividend, settleDividend } from "@/api/dividends";
import { listStations } from "@/api/stations";
import { listShareholders, listIntroducers } from "@/api/directory";
import { StatCard, Money, StatusBadge } from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, NumInput, TextInput, SelectInput, inputCls } from "@/components/fields";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportXlsx } from "@/lib/export";
import { fmtMoney, fmtNum, fmtPct } from "@/lib/format";
import { Download, Users, Wallet, Clock, Building2, Plus, Settings, Pencil, Trash2, Send, CheckCircle2, XCircle, DollarSign } from "lucide-react";
import { toast } from "sonner";

type ViewMode = "shareholder" | "station" | "config";

export default function Shareholders() {
  const [mode, setMode] = useState<ViewMode>("shareholder");
  const [selectedHolder, setSelectedHolder] = useState<number | null>(null);
  const [selectedStation, setSelectedStation] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [configFormOpen, setConfigFormOpen] = useState(false);
  const [introConfigFormOpen, setIntroConfigFormOpen] = useState(false);
  const [dividendFormOpen, setDividendFormOpen] = useState(false);

  const queryClient = useQueryClient();
  const board = useQuery({ queryKey: ["shareholderBoard"], queryFn: shareholderSummary });
  const stations = useQuery({ queryKey: ["stations"], queryFn: () => listStations() });
  const shareholders = useQuery({ queryKey: ["shareholders"], queryFn: listShareholders });
  const introducers = useQuery({ queryKey: ["introducers"], queryFn: listIntroducers });
  const dividends = useQuery({
    queryKey: ["dividends", selectedHolder, statusFilter],
    queryFn: () => listDividends({ status: statusFilter || undefined }),
    enabled: mode === "shareholder",
  });
  const stationDividends = useQuery({
    queryKey: ["stationDividends", selectedStation],
    queryFn: () => listDividends(selectedStation ? { stationId: selectedStation } : undefined),
    enabled: mode === "station" && selectedStation !== null,
  });
  const shareholderConfigs = useQuery({
    queryKey: ["shareholderConfigs", selectedStation],
    queryFn: () => listShareholderConfigs({ stationId: selectedStation! }),
    enabled: mode === "config" && selectedStation !== null,
  });
  const introducerConfigs = useQuery({
    queryKey: ["introducerConfigs", selectedStation],
    queryFn: () => listIntroducerConfigs({ stationId: selectedStation! }),
    enabled: mode === "config" && selectedStation !== null,
  });

  const holders = useMemo(() => board.data ?? [], [board.data]);
  const records = useMemo(() => dividends.data ?? [], [dividends.data]);
  const stRecords = useMemo(() => stationDividends.data ?? [], [stationDividends.data]);
  const totalPaid = holders.reduce((t: number, h: any) => t + h.totalAmount, 0);
  const totalPending = holders.reduce((t: number, h: any) => t + h.pendingAmount, 0);

  const currentHolder = holders.find((h: any) => h.shareholderId === selectedHolder);

  const invalidate = () => queryClient.invalidateQueries();

  // 分红状态流转操作
  const submitMut = useMutation({
    mutationFn: ({ id, applicant }: { id: number; applicant: string }) => submitDividend(id, { applicant }),
    onSuccess: () => { toast.success("已提交审批"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const approveMut = useMutation({
    mutationFn: (id: number) => approveDividend(id, {}),
    onSuccess: () => { toast.success("已通过"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const rejectMut = useMutation({
    mutationFn: (id: number) => rejectDividend(id, {}),
    onSuccess: () => { toast.success("已驳回"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const settleMut = useMutation({
    mutationFn: (id: number) => settleDividend(id, {}),
    onSuccess: () => { toast.success("已结算"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const doExport = () => {
    if (holders.length === 0) { toast.error("暂无数据可导出"); return; }
    exportXlsx(`股东分红_${new Date().toISOString().slice(0, 10)}`, [{
      name: "股东汇总",
      rows: holders.map((h: any) => ({
        股东: h.shareholderName, 累计应分: h.totalAmount, 已结算: h.settledAmount, 未结算: h.pendingAmount,
      })),
    }]);
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
        <StatCard label="分红记录" value={`${records.length}`} icon={Wallet} />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={doExport}><Download className="mr-1.5 h-4 w-4" />导出表格</Button>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setDividendFormOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />新增分红月结
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 左侧列表 */}
        <div className="space-y-2">
          <div className="px-1">
            <Select value={mode} onValueChange={(v: ViewMode) => { setMode(v); }}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="shareholder"><Users className="mr-2 inline h-4 w-4" />股东</SelectItem>
                <SelectItem value="station"><Building2 className="mr-2 inline h-4 w-4" />站点</SelectItem>
                <SelectItem value="config"><Settings className="mr-2 inline h-4 w-4" />分红配置</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "shareholder" ? (
            <>
              {holders.map((h: any) => (
                <button key={h.shareholderId} onClick={() => setSelectedHolder(selectedHolder === h.shareholderId ? null : h.shareholderId)}
                  className={`w-full rounded-xl border bg-white p-3.5 text-left shadow-sm transition-colors hover:border-emerald-300 ${selectedHolder === h.shareholderId ? "border-emerald-500 ring-1 ring-emerald-500" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-800">{h.shareholderName}</span>
                    <span className="text-sm font-bold text-emerald-600 tabular-nums">{fmtMoney(h.totalAmount)}</span>
                  </div>
                  <div className="mt-1.5 text-[11px] text-slate-400">已结算 {fmtMoney(h.settledAmount)} · 未结算 {fmtMoney(h.pendingAmount)}</div>
                </button>
              ))}
              {holders.length === 0 && <div className="rounded-xl border border-dashed py-10 text-center text-slate-400">暂无股东</div>}
            </>
          ) : mode === "station" ? (
            <>
              {(stations.data ?? []).map((s: any) => (
                <button key={s.id} onClick={() => setSelectedStation(selectedStation === s.id ? null : s.id)}
                  className={`w-full rounded-xl border bg-white p-3.5 text-left shadow-sm transition-colors hover:border-emerald-300 ${selectedStation === s.id ? "border-emerald-500 ring-1 ring-emerald-500" : ""}`}>
                  <div className="font-semibold text-sm text-slate-800">{s.name}</div>
                  <div className="mt-1 text-[11px] text-slate-400">{s.region ?? ""}</div>
                </button>
              ))}
              {(stations.data ?? []).length === 0 && <div className="rounded-xl border border-dashed py-10 text-center text-slate-400">暂无站点</div>}
            </>
          ) : (
            <>
              <div className="px-1 text-xs text-slate-500">选择站点配置分红规则</div>
              {(stations.data ?? []).map((s: any) => (
                <button key={s.id} onClick={() => setSelectedStation(selectedStation === s.id ? null : s.id)}
                  className={`w-full rounded-xl border bg-white p-3.5 text-left shadow-sm transition-colors hover:border-emerald-300 ${selectedStation === s.id ? "border-emerald-500 ring-1 ring-emerald-500" : ""}`}>
                  <div className="font-semibold text-sm text-slate-800">{s.name}</div>
                  <div className="mt-1 text-[11px] text-slate-400">{s.region ?? ""}</div>
                </button>
              ))}
            </>
          )}
        </div>

        {/* 右侧详情 */}
        <div className="lg:col-span-2">
          {mode === "shareholder" ? (
            !selectedHolder ? (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed text-slate-400">请在左侧选择一个股东</div>
            ) : !currentHolder ? (
              <div className="py-16 text-center text-slate-400">加载中…</div>
            ) : (
              <div className="space-y-4">
                {/* 状态筛选 */}
                <div className="flex gap-2">
                  {["", "未结算", "申报中", "已通过", "已驳回", "已结算"].map((s) => (
                    <button key={s} onClick={() => setStatusFilter(s)}
                      className={`rounded-full px-3 py-1 text-xs ${statusFilter === s ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                      {s || "全部"}
                    </button>
                  ))}
                </div>

                <div className="rounded-xl border bg-white p-5 shadow-sm">
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">{currentHolder.shareholderName} 分红明细</h3>
                  {records.length > 0 ? (
                    <div className="space-y-2">
                      {records.map((r: any) => (
                        <div key={r.id} className="rounded-lg border bg-slate-50 p-3">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                            <span className="font-medium text-slate-700">{r.station_name}</span>
                            <span>月份 <b>{r.period}</b></span>
                            <span>类型 <b>{r.type}</b></span>
                            <span>利润 <b className="text-emerald-600">{fmtMoney(r.profit)}</b></span>
                            <StatusBadge status={r.status} />
                            <div className="ml-auto flex gap-1">
                              {r.status === "未结算" && (
                                <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => submitMut.mutate({ id: r.id, applicant: "系统" })}>
                                  <Send className="mr-1 h-3 w-3" />提交审批
                                </Button>
                              )}
                              {r.status === "申报中" && (
                                <>
                                  <Button size="sm" className="h-6 px-2 text-xs bg-emerald-600" onClick={() => approveMut.mutate(r.id)}>
                                    <CheckCircle2 className="mr-1 h-3 w-3" />通过
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-6 px-2 text-xs text-rose-600" onClick={() => rejectMut.mutate(r.id)}>
                                    <XCircle className="mr-1 h-3 w-3" />驳回
                                  </Button>
                                </>
                              )}
                              {r.status === "已通过" && (
                                <Button size="sm" className="h-6 px-2 text-xs bg-blue-600" onClick={() => settleMut.mutate(r.id)}>
                                  <DollarSign className="mr-1 h-3 w-3" />标记已结算
                                </Button>
                              )}
                            </div>
                          </div>
                          {r.shares && r.shares.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {r.shares.map((sh: any) => (
                                <div key={sh.id} className="flex items-center gap-3 pl-4 text-[11px] text-slate-500">
                                  <span>{sh.shareholder_name ?? sh.introducer_name}</span>
                                  <span>模式 {sh.mode}</span>
                                  <span>比例 {sh.ratio ? fmtPct(sh.ratio) : "-"}</span>
                                  <span className="ml-auto font-semibold text-emerald-600">{fmtMoney(sh.amount)} 元</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-400">暂无分红数据</div>
                  )}
                </div>
              </div>
            )
          ) : mode === "station" ? (
            !selectedStation ? (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed text-slate-400">请在左侧选择一个站点</div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border bg-white shadow-sm">
                  <div className="border-b px-5 py-3 text-sm font-semibold text-slate-700">站点分红记录</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b bg-slate-50">
                        <th className={th}>月份</th><th className={th}>类型</th><th className={thR}>总收入</th><th className={thR}>总成本</th><th className={thR}>利润</th><th className={th}>状态</th><th className={`${th} text-center`}>操作</th>
                      </tr></thead>
                      <tbody>
                        {stRecords.map((r: any) => (
                          <tr key={r.id} className="border-b last:border-0">
                            <td className="px-3 py-2 font-medium">{r.period}</td>
                            <td className="px-3 py-2">{r.type}</td>
                            <td className="px-3 py-2 text-right"><Money v={r.total_income} /></td>
                            <td className="px-3 py-2 text-right"><Money v={r.total_cost} /></td>
                            <td className="px-3 py-2 text-right"><Money v={r.profit} strong /></td>
                            <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                            <td className="px-3 py-2">
                              <div className="flex justify-center gap-1">
                                {r.status === "未结算" && (
                                  <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => submitMut.mutate({ id: r.id, applicant: "系统" })}>提交</Button>
                                )}
                                {r.status === "申报中" && (
                                  <>
                                    <Button size="sm" className="h-6 px-2 text-xs bg-emerald-600" onClick={() => approveMut.mutate(r.id)}>通过</Button>
                                    <Button size="sm" variant="outline" className="h-6 px-2 text-xs text-rose-600" onClick={() => rejectMut.mutate(r.id)}>驳回</Button>
                                  </>
                                )}
                                {r.status === "已通过" && (
                                  <Button size="sm" className="h-6 px-2 text-xs bg-blue-600" onClick={() => settleMut.mutate(r.id)}>结算</Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {stRecords.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-slate-400">暂无分红记录</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
          ) : (
            /* 分红配置模式 */
            !selectedStation ? (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed text-slate-400">请在左侧选择一个站点</div>
            ) : (
              <div className="space-y-4">
                {/* 股东分红配置 */}
                <div className="rounded-xl border bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b px-5 py-3">
                    <span className="text-sm font-semibold text-slate-700">股东分红配置</span>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setConfigFormOpen(true)}>
                      <Plus className="mr-1 h-3.5 w-3.5" />添加配置
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b bg-slate-50">
                        <th className={th}>股东</th><th className={th}>分红模式</th><th className={thR}>比例</th><th className={thR}>固定金额</th><th className={th}>结算周期</th><th className={`${th} text-center`}>操作</th>
                      </tr></thead>
                      <tbody>
                        {(shareholderConfigs.data ?? []).map((c: any) => (
                          <tr key={c.id} className="border-b last:border-0">
                            <td className="px-3 py-2 font-medium">{c.shareholder_name}</td>
                            <td className="px-3 py-2">{c.mode}</td>
                            <td className="px-3 py-2 text-right">{c.ratio ? fmtNum(c.ratio) : "-"}</td>
                            <td className="px-3 py-2 text-right">{c.fixed_amount ? fmtMoney(c.fixed_amount) : "-"}</td>
                            <td className="px-3 py-2">{c.settlement_period}</td>
                            <td className="px-3 py-2">
                              <div className="flex justify-center gap-0.5">
                                <button className="rounded p-1 text-slate-400 hover:text-rose-500"
                                  onClick={() => window.confirm("删除该配置？") && deleteShareholderConfig(c.id).then(() => { toast.success("已删除"); invalidate(); })}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {(shareholderConfigs.data ?? []).length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-400">暂无配置</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 商务分红配置 */}
                <div className="rounded-xl border bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b px-5 py-3">
                    <span className="text-sm font-semibold text-slate-700">商务分红配置（介绍人）</span>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setIntroConfigFormOpen(true)}>
                      <Plus className="mr-1 h-3.5 w-3.5" />添加配置
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b bg-slate-50">
                        <th className={th}>介绍人</th><th className={th}>分红模式</th><th className={thR}>比例</th><th className={thR}>固定金额</th><th className={th}>结算周期</th><th className={th}>计入成本</th><th className={`${th} text-center`}>操作</th>
                      </tr></thead>
                      <tbody>
                        {(introducerConfigs.data ?? []).map((c: any) => (
                          <tr key={c.id} className="border-b last:border-0">
                            <td className="px-3 py-2 font-medium">{c.introducer_name}</td>
                            <td className="px-3 py-2">{c.mode}</td>
                            <td className="px-3 py-2 text-right">{c.ratio ? fmtNum(c.ratio) : "-"}</td>
                            <td className="px-3 py-2 text-right">{c.fixed_amount ? fmtMoney(c.fixed_amount) : "-"}</td>
                            <td className="px-3 py-2">{c.settlement_period}</td>
                            <td className="px-3 py-2">{c.count_as_cost ? "是" : "否"}</td>
                            <td className="px-3 py-2">
                              <div className="flex justify-center gap-0.5">
                                <button className="rounded p-1 text-slate-400 hover:text-rose-500"
                                  onClick={() => window.confirm("删除该配置？") && deleteIntroducerConfig(c.id).then(() => { toast.success("已删除"); invalidate(); })}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {(introducerConfigs.data ?? []).length === 0 && <tr><td colSpan={7} className="py-6 text-center text-slate-400">暂无配置</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* 股东分红配置表单 */}
      <ShareholderConfigForm open={configFormOpen} onClose={() => setConfigFormOpen(false)} stationId={selectedStation!} />

      {/* 商务分红配置表单 */}
      <IntroducerConfigForm open={introConfigFormOpen} onClose={() => setIntroConfigFormOpen(false)} stationId={selectedStation!} />

      {/* 新增分红月结表单 */}
      <DividendCreateForm open={dividendFormOpen} onClose={() => setDividendFormOpen(false)} />
    </div>
  );
}

// ─── 股东分红配置表单 ───
function ShareholderConfigForm({ open, onClose, stationId }: { open: boolean; onClose: () => void; stationId: number }) {
  const [f, setF] = useState({ shareholderId: "", mode: "利润分红", ratio: "", fixedAmount: "", settlementPeriod: "月" });
  const queryClient = useQueryClient();
  const shareholders = useQuery({ queryKey: ["shareholders"], queryFn: listShareholders, enabled: open });

  const save = useMutation({
    mutationFn: saveShareholderConfig,
    onSuccess: () => { toast.success("配置已保存"); queryClient.invalidateQueries(); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = () => {
    if (!f.shareholderId) { toast.error("请选择股东"); return; }
    save.mutate({
      stationId,
      shareholderId: Number(f.shareholderId),
      mode: f.mode,
      ratio: f.mode !== "固定金额" ? Number(f.ratio) : null,
      fixedAmount: f.mode === "固定金额" ? Number(f.fixedAmount) : null,
      settlementPeriod: f.settlementPeriod,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>添加股东分红配置</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="股东 *">
            <SelectInput value={f.shareholderId} onChange={set("shareholderId")}
              options={[{ value: "", label: "请选择" }, ...(shareholders.data ?? []).map((s: any) => ({ value: String(s.id), label: s.name }))]} />
          </Field>
          <Field label="分红模式 *">
            <SelectInput value={f.mode} onChange={set("mode")}
              options={[{ value: "收入分红", label: "收入分红" }, { value: "利润分红", label: "利润分红" }, { value: "固定金额", label: "固定金额" }]} />
          </Field>
          {f.mode !== "固定金额" ? (
            <Field label="比例 *"><NumInput value={f.ratio} onChange={set("ratio")} placeholder="0.3 表示 30%" /></Field>
          ) : (
            <Field label="固定金额（元）*"><NumInput value={f.fixedAmount} onChange={set("fixedAmount")} /></Field>
          )}
          <Field label="结算周期">
            <SelectInput value={f.settlementPeriod} onChange={set("settlementPeriod")}
              options={[{ value: "月", label: "每月" }, { value: "季", label: "每季度" }, { value: "年", label: "每年" }]} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={save.isPending} onClick={submit}>保存</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 商务分红配置表单 ───
function IntroducerConfigForm({ open, onClose, stationId }: { open: boolean; onClose: () => void; stationId: number }) {
  const [f, setF] = useState({ introducerId: "", mode: "利润分红", ratio: "", fixedAmount: "", settlementPeriod: "月", countAsCost: "true" });
  const queryClient = useQueryClient();
  const introducers = useQuery({ queryKey: ["introducers"], queryFn: listIntroducers, enabled: open });

  const save = useMutation({
    mutationFn: saveIntroducerConfig,
    onSuccess: () => { toast.success("配置已保存"); queryClient.invalidateQueries(); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = () => {
    if (!f.introducerId) { toast.error("请选择介绍人"); return; }
    save.mutate({
      stationId,
      introducerId: Number(f.introducerId),
      mode: f.mode,
      ratio: f.mode !== "固定金额" ? Number(f.ratio) : null,
      fixedAmount: f.mode === "固定金额" ? Number(f.fixedAmount) : null,
      settlementPeriod: f.settlementPeriod,
      countAsCost: f.countAsCost === "true",
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>添加商务分红配置</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="介绍人 *">
            <SelectInput value={f.introducerId} onChange={set("introducerId")}
              options={[{ value: "", label: "请选择" }, ...(introducers.data ?? []).map((i: any) => ({ value: String(i.id), label: i.name }))]} />
          </Field>
          <Field label="分红模式 *">
            <SelectInput value={f.mode} onChange={set("mode")}
              options={[{ value: "收入分红", label: "收入分红" }, { value: "利润分红", label: "利润分红" }, { value: "固定金额", label: "固定金额" }]} />
          </Field>
          {f.mode !== "固定金额" ? (
            <Field label="比例 *"><NumInput value={f.ratio} onChange={set("ratio")} placeholder="0.1 表示 10%" /></Field>
          ) : (
            <Field label="固定金额（元）*"><NumInput value={f.fixedAmount} onChange={set("fixedAmount")} /></Field>
          )}
          <Field label="结算周期">
            <SelectInput value={f.settlementPeriod} onChange={set("settlementPeriod")}
              options={[{ value: "月", label: "每月" }, { value: "季", label: "每季度" }, { value: "年", label: "每年" }]} />
          </Field>
          <Field label="是否计入成本">
            <SelectInput value={f.countAsCost} onChange={set("countAsCost")}
              options={[{ value: "true", label: "是（影响股东分红基数）" }, { value: "false", label: "否（不影响股东分红）" }]} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={save.isPending} onClick={submit}>保存</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 新增分红月结表单 ───
function DividendCreateForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [f, setF] = useState({ stationId: "", period: new Date().toISOString().slice(0, 7), type: "股东分红", remark: "" });
  const queryClient = useQueryClient();
  const stations = useQuery({ queryKey: ["stations"], queryFn: () => listStations(), enabled: open });

  const save = useMutation({
    mutationFn: createDividend,
    onSuccess: () => { toast.success("分红记录已创建"); queryClient.invalidateQueries(); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = () => {
    if (!f.stationId) { toast.error("请选择站点"); return; }
    save.mutate({
      stationId: Number(f.stationId),
      period: f.period,
      type: f.type,
      remark: f.remark || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>新增分红月结</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="站点 *">
            <SelectInput value={f.stationId} onChange={set("stationId")}
              options={[{ value: "", label: "请选择站点" }, ...(stations.data ?? []).map((s: any) => ({ value: String(s.id), label: s.name }))]} />
          </Field>
          <Field label="分红月份">
            <input type="month" className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm" value={f.period} onChange={(e) => set("period")(e.target.value)} />
          </Field>
          <Field label="分红类型">
            <SelectInput value={f.type} onChange={set("type")}
              options={[{ value: "股东分红", label: "股东分红" }, { value: "商务分红", label: "商务分红" }]} />
          </Field>
          <Field label="备注"><TextInput value={f.remark} onChange={set("remark")} /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={save.isPending} onClick={submit}>保存</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
