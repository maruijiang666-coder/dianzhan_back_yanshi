import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, NumInput, TextInput, DateInput, SelectInput } from "./fields";
import { numOrNull, strOrNull, fmtMoney } from "@/lib/format";
import { toast } from "sonner";

// ─── 场租付款合同（向业主） ───
type Lease = {
  id: number; stationId: number; contractStart: string | null; contractEnd: string | null;
  annualRent: string | null; payMethod: string | null; payAmount: string | null;
  deposit: string | null; payDeadline: string | null; payStatus: "未付款" | "已付款";
  invoiceType: string | null; remark: string | null;
};

export function LeaseForm(props: { open: boolean; onClose: () => void; stationId: number; stationName?: string; record?: Lease | null }) {
  const blank = { contractStart: "", contractEnd: "", annualRent: "", payMethod: "年付", payAmount: "", deposit: "", payDeadline: "", payStatus: "未付款", invoiceType: "对公", remark: "" };
  const [f, setF] = useState(blank);
  const utils = trpc.useUtils();
  useEffect(() => {
    if (!props.open) return;
    if (props.record) {
      const r = props.record;
      setF({
        contractStart: r.contractStart ?? "", contractEnd: r.contractEnd ?? "",
        annualRent: r.annualRent ?? "", payMethod: r.payMethod ?? "年付", payAmount: r.payAmount ?? "",
        deposit: r.deposit ?? "", payDeadline: r.payDeadline ?? "", payStatus: r.payStatus,
        invoiceType: r.invoiceType ?? "对公", remark: r.remark ?? "",
      });
    } else setF(blank);
  }, [props.open, props.record]);
  const set = (k: keyof typeof blank) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const save = trpc.mut.saveLease.useMutation({
    onSuccess: () => { toast.success("场租付款合同已保存"); utils.invalidate(); props.onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const submit = () => save.mutate({
    id: props.record?.id, stationId: props.stationId,
    contractStart: strOrNull(f.contractStart), contractEnd: strOrNull(f.contractEnd),
    annualRent: numOrNull(f.annualRent), payMethod: strOrNull(f.payMethod), payAmount: numOrNull(f.payAmount),
    deposit: numOrNull(f.deposit), payDeadline: strOrNull(f.payDeadline),
    payStatus: f.payStatus as "未付款" | "已付款", invoiceType: strOrNull(f.invoiceType), remark: strOrNull(f.remark),
  });
  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{props.record ? "编辑" : "新增"}场租付款合同{props.stationName ? ` · ${props.stationName}` : ""}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          <Field label="合同开始"><DateInput value={f.contractStart} onChange={set("contractStart")} /></Field>
          <Field label="合同结束"><DateInput value={f.contractEnd} onChange={set("contractEnd")} /></Field>
          <Field label="年租金成本（元）"><NumInput value={f.annualRent} onChange={set("annualRent")} /></Field>
          <Field label="付款方式"><SelectInput value={f.payMethod} onChange={set("payMethod")} options={["年付", "半年付", "季付", "月付"].map((v) => ({ value: v, label: v }))} /></Field>
          <Field label="每期付款金额（元）"><NumInput value={f.payAmount} onChange={set("payAmount")} /></Field>
          <Field label="押金（元）"><NumInput value={f.deposit} onChange={set("deposit")} /></Field>
          <Field label="付款截止时间"><DateInput value={f.payDeadline} onChange={set("payDeadline")} /></Field>
          <Field label="付款情况"><SelectInput value={f.payStatus} onChange={set("payStatus")} options={[{ value: "未付款", label: "未付款" }, { value: "已付款", label: "已付款" }]} /></Field>
          <Field label="发票类型"><SelectInput value={f.invoiceType} onChange={set("invoiceType")} options={[{ value: "对公", label: "对公" }, { value: "对私", label: "对私" }]} /></Field>
          <Field label="备注" span><TextInput value={f.remark} onChange={set("remark")} /></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={props.onClose}>取消</Button>
          <Button onClick={submit} disabled={save.isPending} className="bg-emerald-600 hover:bg-emerald-700">保存</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 场租收款合同（向品牌方） ───
type Income = {
  id: number; stationId: number; contractStart: string | null; contractEnd: string | null;
  unitMonthlyRent: string | null; cabinetsCount: string | null; annualIncome: string | null;
  monthlyRent: string | null; taxRate: string | null; annualIncomeNet: string | null;
  inputCost: string | null; dividendAmount: string | null; signStatus: string | null; remark: string | null;
};

export function RentIncomeForm(props: { open: boolean; onClose: () => void; stationId: number; stationName?: string; record?: Income | null }) {
  const blank = { contractStart: "", contractEnd: "", unitMonthlyRent: "", cabinetsCount: "", annualIncome: "", monthlyRent: "", taxRate: "0.05", annualIncomeNet: "", inputCost: "0", dividendAmount: "0", signStatus: "", remark: "" };
  const [f, setF] = useState(blank);
  const utils = trpc.useUtils();
  useEffect(() => {
    if (!props.open) return;
    if (props.record) {
      const r = props.record;
      setF({
        contractStart: r.contractStart ?? "", contractEnd: r.contractEnd ?? "",
        unitMonthlyRent: r.unitMonthlyRent ?? "", cabinetsCount: r.cabinetsCount ?? "",
        annualIncome: r.annualIncome ?? "", monthlyRent: r.monthlyRent ?? "", taxRate: r.taxRate ?? "0.05",
        annualIncomeNet: r.annualIncomeNet ?? "", inputCost: r.inputCost ?? "0",
        dividendAmount: r.dividendAmount ?? "0", signStatus: r.signStatus ?? "", remark: r.remark ?? "",
      });
    } else setF(blank);
  }, [props.open, props.record]);
  const set = (k: keyof typeof blank) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const unit = numOrNull(f.unitMonthlyRent);
  const cabs = numOrNull(f.cabinetsCount);
  const annualAuto = unit !== null && cabs !== null ? Math.round(unit * cabs * 12 * 100) / 100 : null;
  const annual = numOrNull(f.annualIncome) ?? annualAuto;
  const taxRate = numOrNull(f.taxRate);
  const net = numOrNull(f.annualIncomeNet) ?? (annual !== null && taxRate !== null ? Math.round((annual / (1 + taxRate)) * 100) / 100 : null);
  const inputCost = numOrNull(f.inputCost) ?? 0;
  const profit = net !== null ? Math.round((net - inputCost) * 100) / 100 : null;

  const save = trpc.mut.saveRentIncome.useMutation({
    onSuccess: () => { toast.success("场租收款合同已保存"); utils.invalidate(); props.onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const submit = () => save.mutate({
    id: props.record?.id, stationId: props.stationId,
    contractStart: strOrNull(f.contractStart), contractEnd: strOrNull(f.contractEnd),
    unitMonthlyRent: unit, cabinetsCount: cabs,
    annualIncome: annual, monthlyRent: numOrNull(f.monthlyRent), taxRate,
    annualIncomeNet: net, inputCost: numOrNull(f.inputCost),
    dividendAmount: numOrNull(f.dividendAmount), signStatus: strOrNull(f.signStatus), remark: strOrNull(f.remark),
  });
  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{props.record ? "编辑" : "新增"}场租收款合同{props.stationName ? ` · ${props.stationName}` : ""}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          <Field label="收款合同开始"><DateInput value={f.contractStart} onChange={set("contractStart")} /></Field>
          <Field label="收款合同结束"><DateInput value={f.contractEnd} onChange={set("contractEnd")} /></Field>
          <Field label="单柜月租金·含税（元）"><NumInput value={f.unitMonthlyRent} onChange={set("unitMonthlyRent")} placeholder="220" /></Field>
          <Field label="计费柜数"><NumInput value={f.cabinetsCount} onChange={set("cabinetsCount")} /></Field>
          <Field label={`年租金收入·含税（元）${annual !== null && f.annualIncome === "" ? `≈${fmtMoney(annual)}` : ""}`}><NumInput value={f.annualIncome} onChange={set("annualIncome")} placeholder="留空自动=单柜月租×柜数×12" /></Field>
          <Field label="月租金（元）"><NumInput value={f.monthlyRent} onChange={set("monthlyRent")} /></Field>
          <Field label="税率"><SelectInput value={f.taxRate} onChange={set("taxRate")} options={[{ value: "0.01", label: "1%" }, { value: "0.03", label: "3%" }, { value: "0.05", label: "5%" }, { value: "0.06", label: "6%" }]} /></Field>
          <Field label={`年收入·不含税（元）${net !== null && f.annualIncomeNet === "" ? `≈${fmtMoney(net)}` : ""}`}><NumInput value={f.annualIncomeNet} onChange={set("annualIncomeNet")} placeholder="留空自动换算" /></Field>
          <Field label="进项成本（元）"><NumInput value={f.inputCost} onChange={set("inputCost")} /></Field>
          <Field label="分红金额（元）"><NumInput value={f.dividendAmount} onChange={set("dividendAmount")} /></Field>
          <Field label="签约/开票/到账情况"><TextInput value={f.signStatus} onChange={set("signStatus")} placeholder="已到账（汉海）" /></Field>
          <Field label="备注" span><TextInput value={f.remark} onChange={set("remark")} /></Field>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
          <div className="text-sm text-slate-600">预计租金利润：<span className="text-lg font-bold text-emerald-600">{profit !== null ? fmtMoney(profit) : "-"}</span> 元</div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={props.onClose}>取消</Button>
            <Button onClick={submit} disabled={save.isPending} className="bg-emerald-600 hover:bg-emerald-700">保存</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 租金分期收款 ───
type Receipt = {
  id: number; rentIncomeId: number; seq: string; periodStart: string | null; periodEnd: string | null;
  amount: string | null; status: "未到账" | "已到账"; remark: string | null;
};

export function ReceiptForm(props: { open: boolean; onClose: () => void; rentIncomeId: number; nextSeq?: number; record?: Receipt | null }) {
  const blank = { seq: String(props.nextSeq ?? 1), periodStart: "", periodEnd: "", amount: "", status: "未到账", remark: "" };
  const [f, setF] = useState(blank);
  const utils = trpc.useUtils();
  useEffect(() => {
    if (!props.open) return;
    if (props.record) {
      const r = props.record;
      setF({ seq: r.seq, periodStart: r.periodStart ?? "", periodEnd: r.periodEnd ?? "", amount: r.amount ?? "", status: r.status, remark: r.remark ?? "" });
    } else setF({ ...blank, seq: String(props.nextSeq ?? 1) });
  }, [props.open, props.record, props.nextSeq]);
  const set = (k: keyof typeof blank) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const save = trpc.mut.saveReceipt.useMutation({
    onSuccess: () => { toast.success("分期收款已保存"); utils.invalidate(); props.onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const submit = () => save.mutate({
    id: props.record?.id, rentIncomeId: props.rentIncomeId, seq: Number(f.seq) || 1,
    periodStart: strOrNull(f.periodStart), periodEnd: strOrNull(f.periodEnd),
    amount: numOrNull(f.amount), status: f.status as "未到账" | "已到账", remark: strOrNull(f.remark),
  });
  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{props.record ? "编辑" : "新增"}分期收款</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="第几次收款"><NumInput value={f.seq} onChange={set("seq")} step="1" /></Field>
          <Field label="收款金额（元）"><NumInput value={f.amount} onChange={set("amount")} /></Field>
          <Field label="起始时间"><DateInput value={f.periodStart} onChange={set("periodStart")} /></Field>
          <Field label="截止时间"><DateInput value={f.periodEnd} onChange={set("periodEnd")} /></Field>
          <Field label="到账情况"><SelectInput value={f.status} onChange={set("status")} options={[{ value: "未到账", label: "未到账" }, { value: "已到账", label: "已到账" }]} /></Field>
          <Field label="备注"><TextInput value={f.remark} onChange={set("remark")} /></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={props.onClose}>取消</Button>
          <Button onClick={submit} disabled={save.isPending} className="bg-emerald-600 hover:bg-emerald-700">保存</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
