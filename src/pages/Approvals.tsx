import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { StatCard, Money, StatusBadge } from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, NumInput, TextInput, DateInput, SelectInput, inputCls } from "@/components/fields";
import { exportXlsx } from "@/lib/export";
import { fmtMoney, fmtNum, fmtDateTime, numOrNull, strOrNull } from "@/lib/format";
import {
  Plus, FileCheck2, Clock, CheckCircle2, XCircle, Printer, Download,
  Bell,
} from "lucide-react";
import { toast } from "sonner";

type FlowNode = { name: string; approver: string; timeoutHours?: number | null };
type Req = {
  id: number; bizType: string; title: string; reason: string | null;
  amount: number | null; applicant: string; attachments: { name: string; size?: number }[];
  flowNodes: FlowNode[]; currentNode: number; status: string; urgeCount: number;
  createdAt: Date; finishedAt: Date | null; currentNodeName: string | null;
  currentApprover: string | null; elapsedHours: number;
};

// ─── 审批操作弹窗（通过/驳回/转办/加签）───
function ActDialog(props: {
  open: boolean; onClose: () => void; req: Req | null;
  action: "通过" | "驳回" | "转办" | "加签"; approver: string;
}) {
  const [comment, setComment] = useState("");
  const [target, setTarget] = useState("");
  const [extraName, setExtraName] = useState("加签审批");
  const [extraApprover, setExtraApprover] = useState("");
  const utils = trpc.useUtils();
  const act = trpc.approval.act.useMutation({
    onSuccess: () => {
      toast.success(`${props.action}成功`);
      utils.invalidate(); setComment(""); setTarget(""); setExtraApprover("");
      props.onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const submit = () => {
    if (!props.req) return;
    if (props.action === "转办" && !target.trim()) { toast.error("请填写转办人"); return; }
    if (props.action === "加签" && !extraApprover.trim()) { toast.error("请填写加签人"); return; }
    act.mutate({
      requestId: props.req.id, action: props.action, approver: props.approver,
      comment: strOrNull(comment),
      targetApprover: props.action === "转办" ? target.trim() : undefined,
      extraNode: props.action === "加签" ? { name: extraName.trim() || "加签审批", approver: extraApprover.trim() } : undefined,
    });
  };
  const tone = props.action === "通过" ? "bg-emerald-600 hover:bg-emerald-700" : props.action === "驳回" ? "bg-rose-600 hover:bg-rose-700" : "bg-slate-700 hover:bg-slate-800";
  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{props.action} · {props.req?.title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {props.action === "转办" && (
            <Field label="转办给 *"><TextInput value={target} onChange={setTarget} placeholder="新审批人姓名" /></Field>
          )}
          {props.action === "加签" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="节点名称"><TextInput value={extraName} onChange={setExtraName} /></Field>
              <Field label="加签人 *"><TextInput value={extraApprover} onChange={setExtraApprover} /></Field>
            </div>
          )}
          <Field label="审批意见">
            <textarea className={`${inputCls} w-full`} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="可填写审批意见…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={props.onClose}>取消</Button>
            <Button className={tone} disabled={act.isPending} onClick={submit}>确认{props.action}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 审批单预览（流程图 + 意见 + 签名区，可打印为PDF）───
function PreviewDialog(props: { open: boolean; onClose: () => void; id: number | null }) {
  const detail = trpc.approval.detail.useQuery({ id: props.id ?? 0 }, { enabled: props.open && props.id !== null });
  const d = detail.data;
  const doPrint = () => {
    document.body.classList.add("printing-approval");
    setTimeout(() => { window.print(); document.body.classList.remove("printing-approval"); }, 50);
  };
  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            审批单预览
            <Button size="sm" variant="outline" onClick={doPrint}><Printer className="mr-1.5 h-4 w-4" />下载 PDF（打印）</Button>
          </DialogTitle>
        </DialogHeader>
        {!d ? <div className="py-16 text-center text-slate-400">加载中…</div> : (
          <div className="approval-sheet rounded-lg border bg-white p-6 text-sm">
            <div className="text-center">
              <div className="text-xl font-bold text-slate-800">付款 / 事项审批单</div>
              <div className="mt-1 text-xs text-slate-400">编号 AP-{String(d.id).padStart(5, "0")} · {d.bizType}</div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 border-t pt-4 text-sm">
              <div><span className="text-slate-400">审批事由：</span><b>{d.title}</b></div>
              <div><span className="text-slate-400">金额：</span><b className="tabular-nums">{d.amount !== null ? `¥ ${fmtMoney(d.amount)}` : "-"}</b></div>
              <div><span className="text-slate-400">申请人：</span>{d.applicant}</div>
              <div><span className="text-slate-400">申请时间：</span>{fmtDateTime(d.createdAt)}</div>
              <div className="col-span-2"><span className="text-slate-400">事由说明：</span>{d.reason ?? "-"}</div>
              <div className="col-span-2"><span className="text-slate-400">附件：</span>{d.attachments.length ? d.attachments.map((a) => a.name).join("、") : "无"}</div>
              <div><span className="text-slate-400">状态：</span><StatusBadge status={d.status} /></div>
              <div><span className="text-slate-400">总耗时：</span>{d.elapsedHours} 小时{d.urgeCount > 0 ? ` · 催办 ${d.urgeCount} 次` : ""}</div>
            </div>

            {/* 流程图 */}
            <div className="mt-5 border-t pt-4">
              <div className="mb-3 text-xs font-semibold text-slate-500">审批流程</div>
              <div className="flex flex-wrap items-center gap-1">
                {d.flowNodes.map((n, i) => {
                  const done = i < d.currentNode || d.status !== "审批中";
                  const current = i === d.currentNode && d.status === "审批中";
                  const rejected = d.status === "已驳回" && i === d.currentNode;
                  return (
                    <div key={i} className="flex items-center gap-1">
                      {i > 0 && <span className="text-slate-300">→</span>}
                      <div className={`rounded-lg border px-3 py-1.5 text-center text-xs ${
                        rejected ? "border-rose-300 bg-rose-50 text-rose-700"
                        : current ? "border-amber-400 bg-amber-50 text-amber-700 ring-1 ring-amber-400"
                        : done ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 text-slate-400"}`}>
                        <div className="font-semibold">{n.name}</div>
                        <div>{n.approver}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 审批记录 */}
            <div className="mt-5 border-t pt-4">
              <div className="mb-2 text-xs font-semibold text-slate-500">审批记录（全程留痕）</div>
              <table className="w-full text-xs">
                <thead><tr className="border-b text-left text-slate-400">
                  <th className="py-1.5 pr-2 font-medium">节点</th><th className="py-1.5 pr-2 font-medium">操作人</th>
                  <th className="py-1.5 pr-2 font-medium">动作</th><th className="py-1.5 pr-2 font-medium">意见</th>
                  <th className="py-1.5 font-medium">时间</th>
                </tr></thead>
                <tbody>
                  {d.records.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-1.5 pr-2">{r.nodeName ?? "-"}</td>
                      <td className="py-1.5 pr-2">{r.approver}</td>
                      <td className={`py-1.5 pr-2 font-semibold ${r.action === "通过" ? "text-emerald-600" : r.action === "驳回" ? "text-rose-600" : "text-slate-600"}`}>{r.action}</td>
                      <td className="py-1.5 pr-2 text-slate-500">{r.comment ?? "-"}</td>
                      <td className="py-1.5 text-slate-400">{fmtDateTime(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 电子签名区 */}
            <div className="mt-6 grid grid-cols-3 gap-4 border-t pt-4">
              {d.flowNodes.filter((_, i) => i > 0).map((n, i) => (
                <div key={i} className="rounded-lg border border-dashed p-3 text-xs text-slate-500">
                  <div className="font-semibold text-slate-600">{n.name}</div>
                  <div className="mt-4">签名：{d.records.find((r) => r.nodeIndex === i + 1 && (r.action === "通过" || r.action === "驳回"))?.approver ?? "＿＿＿＿＿"}</div>
                  <div className="mt-1">日期：{(() => { const rec = d.records.find((r) => r.nodeIndex === i + 1 && (r.action === "通过" || r.action === "驳回")); return rec ? fmtDateTime(rec.createdAt).slice(0, 10) : "＿＿＿＿＿"; })()}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── 主页面 ───
export default function Approvals() {
  const [tab, setTab] = useState<"submit" | "todo" | "ledger">("todo");
  const stats = trpc.approval.stats.useQuery();
  const bizTypes = trpc.approval.bizTypes.useQuery();
  const utils = trpc.useUtils();

  // 提交表单
  const blank = { bizType: "电费付款", title: "", amount: "", applicant: "", reason: "", attachmentNames: "" };
  const [form, setForm] = useState(blank);
  const create = trpc.approval.create.useMutation({
    onSuccess: () => { toast.success("审批单已提交"); setForm(blank); utils.invalidate(); setTab("todo"); },
    onError: (e) => toast.error(e.message),
  });

  // 台账筛选
  const [filter, setFilter] = useState({ bizType: "", status: "", applicant: "", dateFrom: "", dateTo: "" });
  const listInput = useMemo(() => ({
    bizType: filter.bizType || undefined, status: filter.status || undefined,
    applicant: filter.applicant || undefined,
    dateFrom: filter.dateFrom || undefined, dateTo: filter.dateTo || undefined,
  }), [filter]);
  const list = trpc.approval.list.useQuery(listInput);
  const todoList = trpc.approval.list.useQuery({ status: "审批中" });

  // 操作弹窗
  const [actState, setActState] = useState<{ req: Req; action: "通过" | "驳回" | "转办" | "加签" } | null>(null);
  const [operator, setOperator] = useState("陈总");
  const [previewId, setPreviewId] = useState<number | null>(null);
  const urge = trpc.approval.act.useMutation({ onSuccess: () => { toast.success("已催办"); utils.invalidate(); } });


  const doExport = () => {
    const rows = list.data ?? [];
    if (rows.length === 0) { toast.error("暂无数据可导出"); return; }
    exportXlsx(`审批台账_${new Date().toISOString().slice(0, 10)}`, [{
      name: "审批台账",
      rows: rows.map((r) => ({
        编号: `AP-${String(r.id).padStart(5, "0")}`, 业务类型: r.bizType, 审批事由: r.title,
        金额: r.amount ?? "", 申请人: r.applicant, 申请时间: fmtDateTime(r.createdAt, ""),
        当前节点: r.currentNodeName ?? "", 当前审批人: r.currentApprover ?? "",
        状态: r.status, 耗时小时: r.elapsedHours, 催办次数: r.urgeCount,
        事由说明: r.reason ?? "", 附件: r.attachments.map((a) => a.name).join("、"),
      })),
    }]);
    toast.success("已导出 Excel");
  };

  const tabs = [
    { key: "todo", label: `待办审批${stats.data ? `（${stats.data.pendingCount}）` : ""}` },
    { key: "submit", label: "提交审批" },
    { key: "ledger", label: "审批台账" },
  ] as const;

  const ReqTable = ({ rows, actionable }: { rows: Req[]; actionable: boolean }) => (
    <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
      <table className="w-full min-w-[1000px] text-xs">
        <thead><tr className="border-b bg-slate-50 text-left text-slate-500">
          <th className="px-3 py-2.5 font-medium">编号</th><th className="px-3 py-2.5 font-medium">类型</th>
          <th className="px-3 py-2.5 font-medium">审批事由</th><th className="px-3 py-2.5 text-right font-medium">金额</th>
          <th className="px-3 py-2.5 font-medium">申请人</th><th className="px-3 py-2.5 font-medium">申请时间</th>
          <th className="px-3 py-2.5 font-medium">当前节点 / 审批人</th><th className="px-3 py-2.5 font-medium">耗时</th>
          <th className="px-3 py-2.5 font-medium">状态</th><th className="px-3 py-2.5 text-center font-medium">操作</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50/60">
              <td className="px-3 py-2.5 tabular-nums text-slate-400">AP-{String(r.id).padStart(5, "0")}</td>
              <td className="px-3 py-2.5">{r.bizType}</td>
              <td className="max-w-[220px] truncate px-3 py-2.5 font-medium" title={r.title}>
                <button className="hover:text-emerald-600" onClick={() => setPreviewId(r.id)}>{r.title}</button>
              </td>
              <td className="px-3 py-2.5 text-right"><Money v={r.amount} /></td>
              <td className="px-3 py-2.5">{r.applicant}</td>
              <td className="px-3 py-2.5 text-slate-500">{fmtDateTime(r.createdAt)}</td>
              <td className="px-3 py-2.5 text-slate-600">{r.status === "审批中" ? `${r.currentNodeName} · ${r.currentApprover}` : "-"}</td>
              <td className="px-3 py-2.5 tabular-nums">{r.elapsedHours}h{r.urgeCount > 0 && <span className="ml-1 text-amber-500">催{r.urgeCount}</span>}</td>
              <td className="px-3 py-2.5"><StatusBadge status={r.status} /></td>
              <td className="px-3 py-2.5">
                <div className="flex flex-wrap justify-center gap-1">
                  {actionable && r.status === "审批中" && (
                    <>
                      <Button size="sm" className="h-7 bg-emerald-600 px-2 text-xs hover:bg-emerald-700" onClick={() => setActState({ req: r, action: "通过" })}>通过</Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-rose-600" onClick={() => setActState({ req: r, action: "驳回" })}>驳回</Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setActState({ req: r, action: "转办" })}>转办</Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setActState({ req: r, action: "加签" })}>加签</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-amber-600" title="催办"
                        onClick={() => urge.mutate({ requestId: r.id, action: "催办", approver: operator || "系统" })}>
                        <Bell className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setPreviewId(r.id)}>预览</Button>
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={10} className="py-14 text-center text-slate-400">暂无审批单</td></tr>}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="待审批" value={`${stats.data?.pendingCount ?? 0}`} sub={`涉及金额 ¥${fmtMoney(stats.data?.pendingAmount ?? 0)}`} icon={Clock} tone="amber" />
        <StatCard label="已通过" value={`${stats.data?.approvedCount ?? 0}`} icon={CheckCircle2} tone="green" />
        <StatCard label="已驳回" value={`${stats.data?.rejectedCount ?? 0}`} icon={XCircle} tone="red" />
        <StatCard label="累计审批单" value={`${stats.data?.totalCount ?? 0}`} icon={FileCheck2} tone="blue" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border bg-white p-1">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`rounded-md px-4 py-1.5 text-sm ${tab === t.key ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
          当前操作人：
          <input className={`${inputCls} w-28`} value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="审批人姓名" />
        </div>
      </div>

      {/* ═══ 待办 ═══ */}
      {tab === "todo" && <ReqTable rows={(todoList.data ?? []) as Req[]} actionable />}

      {/* ═══ 提交 ═══ */}
      {tab === "submit" && (
        <div className="max-w-3xl rounded-xl border bg-white p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <Field label="业务类型 *">
              <SelectInput value={form.bizType} onChange={(v) => setForm((p) => ({ ...p, bizType: v }))}
                options={(bizTypes.data ?? []).map((b) => ({ value: b, label: b }))} />
            </Field>
            <Field label="申请人 *"><TextInput value={form.applicant} onChange={(v) => setForm((p) => ({ ...p, applicant: v }))} placeholder="经办人姓名" /></Field>
            <Field label="审批事由 *" span><TextInput value={form.title} onChange={(v) => setForm((p) => ({ ...p, title: v }))} placeholder="如：XX站点6月电费付款" /></Field>
            <Field label="金额（元）"><NumInput value={form.amount} onChange={(v) => setForm((p) => ({ ...p, amount: v }))} /></Field>
            <Field label="附件（文件名，逗号分隔）"><TextInput value={form.attachmentNames} onChange={(v) => setForm((p) => ({ ...p, attachmentNames: v }))} placeholder="合同扫描件.pdf, 发票.jpg" /></Field>
            <Field label="事由说明" span>
              <textarea className={`${inputCls} w-full`} rows={4} value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} placeholder="付款依据、合同条款、计算过程等…" />
            </Field>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
            提交后按「{form.bizType}」配置的审批流程逐级流转
            <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={create.isPending}
              onClick={() => {
                if (!form.title.trim() || !form.applicant.trim()) { toast.error("请填写审批事由和申请人"); return; }
                create.mutate({
                  bizType: form.bizType, title: form.title.trim(), applicant: form.applicant.trim(),
                  amount: numOrNull(form.amount), reason: strOrNull(form.reason),
                  attachments: form.attachmentNames.split(/[,，]/).map((s) => s.trim()).filter(Boolean).map((name) => ({ name })),
                });
              }}>
              <Plus className="mr-1.5 h-4 w-4" />提交审批
            </Button>
          </div>
        </div>
      )}

      {/* ═══ 台账 ═══ */}
      {tab === "ledger" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select className={`${inputCls} w-32`} value={filter.bizType} onChange={(e) => setFilter((p) => ({ ...p, bizType: e.target.value }))}>
              <option value="">全部类型</option>
              {(bizTypes.data ?? []).map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <select className={`${inputCls} w-32`} value={filter.status} onChange={(e) => setFilter((p) => ({ ...p, status: e.target.value }))}>
              <option value="">全部状态</option>
              {["审批中", "已通过", "已驳回"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input className={`${inputCls} w-32`} placeholder="申请人" value={filter.applicant} onChange={(e) => setFilter((p) => ({ ...p, applicant: e.target.value }))} />
            <div className="flex shrink-0 items-center gap-1">
              <DateInput value={filter.dateFrom} onChange={(v) => setFilter((p) => ({ ...p, dateFrom: v }))} />
              <span className="text-xs text-slate-400">至</span>
              <DateInput value={filter.dateTo} onChange={(v) => setFilter((p) => ({ ...p, dateTo: v }))} />
            </div>
            <Button variant="outline" className="ml-auto" onClick={doExport}><Download className="mr-1.5 h-4 w-4" />导出 Excel</Button>
          </div>
          <ReqTable rows={(list.data ?? []) as Req[]} actionable={false} />
        </div>
      )}

      <ActDialog open={actState !== null} onClose={() => setActState(null)}
        req={actState?.req ?? null} action={actState?.action ?? "通过"} approver={operator || "未指定"} />
      <PreviewDialog open={previewId !== null} onClose={() => setPreviewId(null)} id={previewId} />
    </div>
  );
}

// 防止未使用告警
void fmtNum;
