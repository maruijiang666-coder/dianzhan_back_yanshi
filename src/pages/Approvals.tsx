import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listApprovals, createApproval, actOnApproval, getApprovalStats, listFlows } from "@/api/approvals";
import { StatCard, Money, StatusBadge } from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, NumInput, TextInput, SelectInput, inputCls } from "@/components/fields";
import { exportXlsx } from "@/lib/export";
import { fmtMoney, fmtNum, fmtDateTime, numOrNull, strOrNull } from "@/lib/format";
import {
  Plus, FileCheck2, Clock, CheckCircle2, XCircle, Printer, Download, Bell,
} from "lucide-react";
import { toast } from "sonner";

type FlowNode = { name: string; approver: string; timeoutHours?: number | null };

// ─── 审批操作弹窗 ───
function ActDialog(props: {
  open: boolean; onClose: () => void; req: any | null;
  action: "通过" | "驳回" | "转办" | "加签"; approver: string;
}) {
  const [comment, setComment] = useState("");
  const [target, setTarget] = useState("");
  const [extraName, setExtraName] = useState("加签审批");
  const [extraApprover, setExtraApprover] = useState("");
  const queryClient = useQueryClient();

  const act = useMutation({
    mutationFn: (data: any) => actOnApproval(props.req?.id, data),
    onSuccess: () => {
      toast.success(`${props.action}成功`);
      queryClient.invalidateQueries();
      setComment(""); setTarget(""); setExtraApprover("");
      props.onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const submit = () => {
    if (!props.req) return;
    if (props.action === "转办" && !target.trim()) { toast.error("请填写转办人"); return; }
    if (props.action === "加签" && !extraApprover.trim()) { toast.error("请填写加签人"); return; }
    act.mutate({
      action: props.action, approver: props.approver,
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

// ─── 主页面 ───
export default function Approvals() {
  const [tab, setTab] = useState<"submit" | "todo" | "ledger">("todo");
  const queryClient = useQueryClient();

  const stats = useQuery({ queryKey: ["approvalStats"], queryFn: getApprovalStats });
  const flows = useQuery({ queryKey: ["approvalFlows"], queryFn: listFlows });

  // 提交表单
  const blank = { bizType: "电费付款", title: "", amount: "", applicant: "", reason: "", attachmentNames: "" };
  const [form, setForm] = useState(blank);
  const create = useMutation({
    mutationFn: createApproval,
    onSuccess: () => { toast.success("审批单已提交"); setForm(blank); queryClient.invalidateQueries(); setTab("todo"); },
    onError: (e: any) => toast.error(e.message),
  });

  // 台账筛选
  const [filter, setFilter] = useState({ bizType: "", status: "", applicant: "" });
  const list = useQuery({
    queryKey: ["approvals", filter],
    queryFn: () => listApprovals({
      bizType: filter.bizType || undefined,
      status: filter.status || undefined,
      applicant: filter.applicant || undefined,
    }),
  });
  const todoList = useQuery({
    queryKey: ["approvals", "todo"],
    queryFn: () => listApprovals({ status: "审批中" }),
  });

  // 操作弹窗
  const [actState, setActState] = useState<{ req: any; action: "通过" | "驳回" | "转办" | "加签" } | null>(null);
  const [operator, setOperator] = useState("陈总");
  const urge = useMutation({
    mutationFn: (data: any) => actOnApproval(data.requestId, data),
    onSuccess: () => { toast.success("已催办"); queryClient.invalidateQueries(); },
  });

  const doExport = () => {
    const rows = list.data ?? [];
    if (rows.length === 0) { toast.error("暂无数据可导出"); return; }
    exportXlsx(`审批台账_${new Date().toISOString().slice(0, 10)}`, [{
      name: "审批台账",
      rows: rows.map((r: any) => ({
        编号: `AP-${String(r.id).padStart(5, "0")}`, 业务类型: r.biz_type, 审批事由: r.title,
        金额: r.amount ?? "", 申请人: r.applicant, 申请时间: fmtDateTime(r.created_at, ""),
        状态: r.status,
      })),
    }]);
    toast.success("已导出 Excel");
  };

  const bizTypes = (flows.data ?? []).map((f: any) => f.biz_type);

  const tabs = [
    { key: "todo", label: `待办审批` },
    { key: "submit", label: "提交审批" },
    { key: "ledger", label: "审批台账" },
  ] as const;

  const ReqTable = ({ rows, actionable }: { rows: any[]; actionable: boolean }) => (
    <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
      <table className="w-full min-w-[1000px] text-xs">
        <thead><tr className="border-b bg-slate-50 text-left text-slate-500">
          <th className="px-3 py-2.5 font-medium">编号</th><th className="px-3 py-2.5 font-medium">类型</th>
          <th className="px-3 py-2.5 font-medium">审批事由</th><th className="px-3 py-2.5 text-right font-medium">金额</th>
          <th className="px-3 py-2.5 font-medium">申请人</th><th className="px-3 py-2.5 font-medium">申请时间</th>
          <th className="px-3 py-2.5 font-medium">状态</th><th className="px-3 py-2.5 text-center font-medium">操作</th>
        </tr></thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50/60">
              <td className="px-3 py-2.5 tabular-nums text-slate-400">AP-{String(r.id).padStart(5, "0")}</td>
              <td className="px-3 py-2.5">{r.biz_type}</td>
              <td className="max-w-[220px] truncate px-3 py-2.5 font-medium" title={r.title}>{r.title}</td>
              <td className="px-3 py-2.5 text-right"><Money v={r.amount} /></td>
              <td className="px-3 py-2.5">{r.applicant}</td>
              <td className="px-3 py-2.5 text-slate-500">{fmtDateTime(r.created_at)}</td>
              <td className="px-3 py-2.5"><StatusBadge status={r.status} /></td>
              <td className="px-3 py-2.5">
                <div className="flex flex-wrap justify-center gap-1">
                  {actionable && r.status === "审批中" && (
                    <>
                      <Button size="sm" className="h-7 bg-emerald-600 px-2 text-xs hover:bg-emerald-700" onClick={() => setActState({ req: r, action: "通过" })}>通过</Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-rose-600" onClick={() => setActState({ req: r, action: "驳回" })}>驳回</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-amber-600" title="催办"
                        onClick={() => urge.mutate({ requestId: r.id, action: "催办", approver: operator || "系统" })}>
                        <Bell className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={8} className="py-14 text-center text-slate-400">暂无审批单</td></tr>}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="待审批" value={`${stats.data?.pending ?? 0}`} icon={Clock} tone="amber" />
        <StatCard label="已通过" value={`${stats.data?.approved ?? 0}`} icon={CheckCircle2} tone="green" />
        <StatCard label="已驳回" value={`${stats.data?.rejected ?? 0}`} icon={XCircle} tone="red" />
        <StatCard label="累计审批单" value={`${stats.data?.total ?? 0}`} icon={FileCheck2} tone="blue" />
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

      {tab === "todo" && <ReqTable rows={todoList.data ?? []} actionable />}

      {tab === "submit" && (
        <div className="max-w-3xl rounded-xl border bg-white p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <Field label="业务类型 *">
              <SelectInput value={form.bizType} onChange={(v) => setForm((p) => ({ ...p, bizType: v }))}
                options={bizTypes.map((b: string) => ({ value: b, label: b }))} />
            </Field>
            <Field label="申请人 *"><TextInput value={form.applicant} onChange={(v) => setForm((p) => ({ ...p, applicant: v }))} placeholder="经办人姓名" /></Field>
            <Field label="审批事由 *" span><TextInput value={form.title} onChange={(v) => setForm((p) => ({ ...p, title: v }))} placeholder="如：XX站点6月电费付款" /></Field>
            <Field label="金额（元）"><NumInput value={form.amount} onChange={(v) => setForm((p) => ({ ...p, amount: v }))} /></Field>
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
                });
              }}>
              <Plus className="mr-1.5 h-4 w-4" />提交审批
            </Button>
          </div>
        </div>
      )}

      {tab === "ledger" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select className={`${inputCls} w-32`} value={filter.bizType} onChange={(e) => setFilter((p) => ({ ...p, bizType: e.target.value }))}>
              <option value="">全部类型</option>
              {bizTypes.map((b: string) => <option key={b} value={b}>{b}</option>)}
            </select>
            <select className={`${inputCls} w-32`} value={filter.status} onChange={(e) => setFilter((p) => ({ ...p, status: e.target.value }))}>
              <option value="">全部状态</option>
              {["审批中", "已通过", "已驳回"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input className={`${inputCls} w-32`} placeholder="申请人" value={filter.applicant} onChange={(e) => setFilter((p) => ({ ...p, applicant: e.target.value }))} />
            <Button variant="outline" className="ml-auto" onClick={doExport}><Download className="mr-1.5 h-4 w-4" />导出 Excel</Button>
          </div>
          <ReqTable rows={list.data ?? []} actionable={false} />
        </div>
      )}

      <ActDialog open={actState !== null} onClose={() => setActState(null)}
        req={actState?.req ?? null} action={actState?.action ?? "通过"} approver={operator || "未指定"} />
    </div>
  );
}
