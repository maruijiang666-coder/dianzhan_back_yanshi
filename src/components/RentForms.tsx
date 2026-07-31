import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createLease, updateLease, createIncome, updateIncome, createReceipt, updateReceipt } from "@/api/rent";
import { listBrands } from "@/api/directory";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, NumInput, TextInput, DateInput, SelectInput } from "./fields";
import { numOrNull, strOrNull } from "@/lib/format";
import { toast } from "sonner";

// ─── 场租付款合同（向业主） ───
export function LeaseForm(props: { open: boolean; onClose: () => void; stationId: number; stationName?: string; record?: any | null }) {
  const blank = { contractStart: "", contractEnd: "", annualRent: "", payMethod: "年付", payAmount: "", deposit: "", payDeadline: "", payStatus: "未付款", invoiceType: "对公", remark: "" };
  const [f, setF] = useState(blank);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!props.open) return;
    if (props.record) {
      const r = props.record;
      setF({
        contractStart: r.contract_start ?? "", contractEnd: r.contract_end ?? "",
        annualRent: r.annual_rent ?? "", payMethod: r.pay_method ?? "年付", payAmount: r.pay_amount ?? "",
        deposit: r.deposit ?? "", payDeadline: r.pay_deadline ?? "", payStatus: r.pay_status ?? "未付款",
        invoiceType: r.invoice_type ?? "对公", remark: r.remark ?? "",
      });
    } else setF(blank);
  }, [props.open, props.record]);

  const set = (k: keyof typeof blank) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: (data: any) => props.record ? updateLease(props.record.id, data) : createLease(data),
    onSuccess: () => { toast.success("场租付款合同已保存"); queryClient.invalidateQueries(); props.onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  const submit = () => save.mutate({
    stationId: props.stationId,
    contractStart: strOrNull(f.contractStart), contractEnd: strOrNull(f.contractEnd),
    annualRent: numOrNull(f.annualRent), payMethod: strOrNull(f.payMethod), payAmount: numOrNull(f.payAmount),
    deposit: numOrNull(f.deposit), payDeadline: strOrNull(f.payDeadline),
    payStatus: f.payStatus, invoiceType: strOrNull(f.invoiceType), remark: strOrNull(f.remark),
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

// ─── 场租收款合同（品牌方→公司） ───
export function RentIncomeForm(props: { open: boolean; onClose: () => void; stationId: number; stationName?: string; record?: any | null }) {
  const blank = { brandId: "", contractStart: "", contractEnd: "", unitMonthlyRent: "", cabinetsCount: "", monthlyRent: "", annualIncome: "", taxRate: "0.01", inputCost: "", signStatus: "", remark: "" };
  const [f, setF] = useState(blank);
  const queryClient = useQueryClient();
  const brands = useQuery({ queryKey: ["brands"], queryFn: listBrands, enabled: props.open });

  useEffect(() => {
    if (!props.open) return;
    if (props.record) {
      const r = props.record;
      setF({
        brandId: r.brand_id ? String(r.brand_id) : "", contractStart: r.contract_start ?? "", contractEnd: r.contract_end ?? "",
        unitMonthlyRent: r.unit_monthly_rent ?? "", cabinetsCount: r.cabinets_count ?? "",
        monthlyRent: r.monthly_rent ?? "", annualIncome: r.annual_income ?? "",
        taxRate: r.tax_rate ?? "0.01", inputCost: r.input_cost ?? "",
        signStatus: r.sign_status ?? "", remark: r.remark ?? "",
      });
    } else setF(blank);
  }, [props.open, props.record]);

  const set = (k: keyof typeof blank) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: (data: any) => props.record ? updateIncome(props.record.id, data) : createIncome(data),
    onSuccess: () => { toast.success("场租收款合同已保存"); queryClient.invalidateQueries(); props.onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  const submit = () => save.mutate({
    stationId: props.stationId, brandId: numOrNull(f.brandId),
    contractStart: strOrNull(f.contractStart), contractEnd: strOrNull(f.contractEnd),
    unitMonthlyRent: numOrNull(f.unitMonthlyRent), cabinetsCount: numOrNull(f.cabinetsCount),
    monthlyRent: numOrNull(f.monthlyRent), annualIncome: numOrNull(f.annualIncome),
    taxRate: numOrNull(f.taxRate), inputCost: numOrNull(f.inputCost),
    signStatus: strOrNull(f.signStatus), remark: strOrNull(f.remark),
  });

  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{props.record ? "编辑" : "新增"}场租收款合同{props.stationName ? ` · ${props.stationName}` : ""}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          <Field label="品牌方 *">
            <SelectInput value={f.brandId} onChange={set("brandId")}
              options={[{ value: "", label: "请选择品牌方" }, ...(brands.data ?? []).map((b: any) => ({ value: String(b.id), label: b.name }))]} />
          </Field>
          <Field label="合同开始"><DateInput value={f.contractStart} onChange={set("contractStart")} /></Field>
          <Field label="合同结束"><DateInput value={f.contractEnd} onChange={set("contractEnd")} /></Field>
          <Field label="单柜月租金（元）"><NumInput value={f.unitMonthlyRent} onChange={set("unitMonthlyRent")} /></Field>
          <Field label="计费柜数"><NumInput value={f.cabinetsCount} onChange={set("cabinetsCount")} /></Field>
          <Field label="月租金（元）"><NumInput value={f.monthlyRent} onChange={set("monthlyRent")} /></Field>
          <Field label="年收入（元）"><NumInput value={f.annualIncome} onChange={set("annualIncome")} /></Field>
          <Field label="税率"><SelectInput value={f.taxRate} onChange={set("taxRate")} options={[{ value: "0.01", label: "1%" }, { value: "0.03", label: "3%" }, { value: "0.05", label: "5%" }]} /></Field>
          <Field label="进项成本（元）"><NumInput value={f.inputCost} onChange={set("inputCost")} /></Field>
          <Field label="签约状态"><TextInput value={f.signStatus} onChange={set("signStatus")} /></Field>
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

// ─── 租金分期收款 ───
export function ReceiptForm(props: { open: boolean; onClose: () => void; rentIncomeId: number; record?: any | null }) {
  const blank = { seq: "", periodStart: "", periodEnd: "", amount: "", status: "未到账", remark: "" };
  const [f, setF] = useState(blank);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!props.open) return;
    if (props.record) {
      const r = props.record;
      setF({
        seq: r.seq ?? "", periodStart: r.period_start ?? "", periodEnd: r.period_end ?? "",
        amount: r.amount ?? "", status: r.status ?? "未到账", remark: r.remark ?? "",
      });
    } else setF(blank);
  }, [props.open, props.record]);

  const set = (k: keyof typeof blank) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: (data: any) => props.record ? updateReceipt(props.record.id, data) : createReceipt(data),
    onSuccess: () => { toast.success("分期收款已保存"); queryClient.invalidateQueries(); props.onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  const submit = () => save.mutate({
    rentIncomeId: props.rentIncomeId, seq: numOrNull(f.seq),
    periodStart: strOrNull(f.periodStart), periodEnd: strOrNull(f.periodEnd),
    amount: numOrNull(f.amount), status: f.status, remark: strOrNull(f.remark),
  });

  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{props.record ? "编辑" : "新增"}分期收款</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="期次"><NumInput value={f.seq} onChange={set("seq")} /></Field>
          <Field label="金额（元）"><NumInput value={f.amount} onChange={set("amount")} /></Field>
          <Field label="开始日期"><DateInput value={f.periodStart} onChange={set("periodStart")} /></Field>
          <Field label="结束日期"><DateInput value={f.periodEnd} onChange={set("periodEnd")} /></Field>
          <Field label="到账状态"><SelectInput value={f.status} onChange={set("status")} options={[{ value: "未到账", label: "未到账" }, { value: "已到账", label: "已到账" }]} /></Field>
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
