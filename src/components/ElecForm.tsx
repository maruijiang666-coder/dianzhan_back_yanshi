import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, NumInput, TextInput, DateInput, SelectInput } from "./fields";
import { numOrNull, strOrNull, fmtMoney } from "@/lib/format";
import { toast } from "sonner";

type ElecRecord = {
  id: number; stationId: number; period: string;
  payStartDate: string | null; payStartReading: string | null; payEndDate: string | null; payEndReading: string | null;
  payKwh: string | null; payUnitPrice: string | null; payAmount: string | null; payStatus: "未付款" | "已付款";
  collectStartDate: string | null; collectStartReading: string | null; collectEndDate: string | null; collectEndReading: string | null;
  collectKwh: string | null; collectUnitPrice: string | null; collectAmount: string | null;
  taxRate: string | null; collectNet: string | null; collectStatus: "未到账" | "已到账";
  opExpense: string | null; companyShare: string | null; remark: string | null;
};

const blank = {
  period: new Date().toISOString().slice(0, 7),
  payStartDate: "", payStartReading: "", payEndDate: "", payEndReading: "",
  payKwh: "", payUnitPrice: "", payAmount: "", payStatus: "未付款",
  collectStartDate: "", collectStartReading: "", collectEndDate: "", collectEndReading: "",
  collectKwh: "", collectUnitPrice: "", collectAmount: "", taxRate: "0.01",
  collectNet: "", collectStatus: "未到账", opExpense: "", companyShare: "", remark: "",
};

export function ElecForm(props: {
  open: boolean;
  onClose: () => void;
  stationId: number;
  stationName?: string;
  record?: ElecRecord | null;
}) {
  const [f, setF] = useState(blank);
  const utils = trpc.useUtils();
  useEffect(() => {
    if (!props.open) return;
    if (props.record) {
      const r = props.record;
      setF({
        period: r.period,
        payStartDate: r.payStartDate ?? "", payStartReading: r.payStartReading ?? "",
        payEndDate: r.payEndDate ?? "", payEndReading: r.payEndReading ?? "",
        payKwh: r.payKwh ?? "", payUnitPrice: r.payUnitPrice ?? "", payAmount: r.payAmount ?? "",
        payStatus: r.payStatus,
        collectStartDate: r.collectStartDate ?? "", collectStartReading: r.collectStartReading ?? "",
        collectEndDate: r.collectEndDate ?? "", collectEndReading: r.collectEndReading ?? "",
        collectKwh: r.collectKwh ?? "", collectUnitPrice: r.collectUnitPrice ?? "",
        collectAmount: r.collectAmount ?? "", taxRate: r.taxRate ?? "0.01",
        collectNet: r.collectNet ?? "", collectStatus: r.collectStatus,
        opExpense: r.opExpense ?? "", companyShare: r.companyShare ?? "", remark: r.remark ?? "",
      });
    } else setF(blank);
  }, [props.open, props.record]);

  const set = (k: keyof typeof blank) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  // 自动计算
  const payKwh = numOrNull(f.payKwh);
  const payUnitPrice = numOrNull(f.payUnitPrice);
  const payAmount = numOrNull(f.payAmount) ?? (payKwh !== null && payUnitPrice !== null ? Math.round(payKwh * payUnitPrice * 100) / 100 : null);
  const collectKwh = numOrNull(f.collectKwh);
  const collectUnitPrice = numOrNull(f.collectUnitPrice);
  const collectAmount = numOrNull(f.collectAmount) ?? (collectKwh !== null && collectUnitPrice !== null ? Math.round(collectKwh * collectUnitPrice * 100) / 100 : null);
  const taxRate = numOrNull(f.taxRate);
  const collectNet = numOrNull(f.collectNet) ?? (collectAmount !== null && taxRate !== null ? Math.round((collectAmount / (1 + taxRate)) * 100) / 100 : null);
  const profit = collectNet !== null || payAmount !== null ? Math.round(((collectNet ?? 0) - (payAmount ?? 0)) * 100) / 100 : null;

  const save = trpc.mut.createElectricity.useMutation({
    onSuccess: () => { toast.success("电费月结已保存"); utils.invalidate(); props.onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.mut.updateElectricity.useMutation({
    onSuccess: () => { toast.success("电费月结已更新"); utils.invalidate(); props.onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const submit = () => {
    const payload = {
      stationId: props.stationId, period: f.period,
      payStartDate: strOrNull(f.payStartDate), payStartReading: numOrNull(f.payStartReading),
      payEndDate: strOrNull(f.payEndDate), payEndReading: numOrNull(f.payEndReading),
      payKwh, payUnitPrice, payAmount, payStatus: f.payStatus as "未付款" | "已付款",
      collectStartDate: strOrNull(f.collectStartDate), collectStartReading: numOrNull(f.collectStartReading),
      collectEndDate: strOrNull(f.collectEndDate), collectEndReading: numOrNull(f.collectEndReading),
      collectKwh, collectUnitPrice, collectAmount, taxRate, collectNet,
      collectStatus: f.collectStatus as "未到账" | "已到账",
      opExpense: numOrNull(f.opExpense), companyShare: numOrNull(f.companyShare), remark: strOrNull(f.remark),
    };
    if (props.record) update.mutate({ ...payload, id: props.record.id });
    else save.mutate(payload);
  };

  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{props.record ? "编辑" : "新增"}电费月结{props.stationName ? ` · ${props.stationName}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <Field label="结算期间（月）">
              <input type="month" className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm" value={f.period} onChange={(e) => set("period")(e.target.value)} />
            </Field>
          </div>

          <div className="rounded-lg border border-rose-100 bg-rose-50/40 p-3">
            <div className="mb-2 text-xs font-semibold text-rose-600">付款侧（向业主 / 电网支付）</div>
            <div className="grid grid-cols-4 gap-3">
              <Field label="上月抄表时间"><DateInput value={f.payStartDate} onChange={set("payStartDate")} /></Field>
              <Field label="起始度数"><NumInput value={f.payStartReading} onChange={set("payStartReading")} /></Field>
              <Field label="抄表时间"><DateInput value={f.payEndDate} onChange={set("payEndDate")} /></Field>
              <Field label="抄表度数"><NumInput value={f.payEndReading} onChange={set("payEndReading")} /></Field>
              <Field label="区间度数（kWh）"><NumInput value={f.payKwh} onChange={set("payKwh")} /></Field>
              <Field label="付款单价（元/度）"><NumInput value={f.payUnitPrice} onChange={set("payUnitPrice")} placeholder="0.60" /></Field>
              <Field label={`付款金额（元）${payAmount !== null && f.payAmount === "" ? `≈${fmtMoney(payAmount)}` : ""}`}><NumInput value={f.payAmount} onChange={set("payAmount")} placeholder="留空自动=度数×单价" /></Field>
              <Field label="付款情况"><SelectInput value={f.payStatus} onChange={set("payStatus")} options={[{ value: "未付款", label: "未付款" }, { value: "已付款", label: "已付款" }]} /></Field>
            </div>
          </div>

          <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
            <div className="mb-2 text-xs font-semibold text-emerald-600">收款侧（向品牌方收取）</div>
            <div className="grid grid-cols-4 gap-3">
              <Field label="起始度数"><NumInput value={f.collectStartReading} onChange={set("collectStartReading")} /></Field>
              <Field label="抄表时间"><DateInput value={f.collectEndDate} onChange={set("collectEndDate")} /></Field>
              <Field label="抄表度数"><NumInput value={f.collectEndReading} onChange={set("collectEndReading")} /></Field>
              <Field label="区间度数（kWh）"><NumInput value={f.collectKwh} onChange={set("collectKwh")} /></Field>
              <Field label="收款单价（元/度）"><NumInput value={f.collectUnitPrice} onChange={set("collectUnitPrice")} placeholder="0.75" /></Field>
              <Field label={`收款金额含税（元）${collectAmount !== null && f.collectAmount === "" ? `≈${fmtMoney(collectAmount)}` : ""}`}><NumInput value={f.collectAmount} onChange={set("collectAmount")} placeholder="留空自动=度数×单价" /></Field>
              <Field label="税率"><SelectInput value={f.taxRate} onChange={set("taxRate")} options={[{ value: "0.01", label: "1%" }, { value: "0.03", label: "3%" }, { value: "0.05", label: "5%" }, { value: "0.06", label: "6%" }, { value: "0.13", label: "13%" }]} /></Field>
              <Field label={`不含税收入（元）${collectNet !== null && f.collectNet === "" ? `≈${fmtMoney(collectNet)}` : ""}`}><NumInput value={f.collectNet} onChange={set("collectNet")} placeholder="留空自动换算" /></Field>
              <Field label="到账情况"><SelectInput value={f.collectStatus} onChange={set("collectStatus")} options={[{ value: "未到账", label: "未到账" }, { value: "已到账", label: "已到账" }]} /></Field>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <Field label="运营费用（元）"><NumInput value={f.opExpense} onChange={set("opExpense")} /></Field>
            <Field label="公司占股（0~1）"><NumInput value={f.companyShare} onChange={set("companyShare")} placeholder="1" /></Field>
            <Field label="备注" span><TextInput value={f.remark} onChange={set("remark")} /></Field>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <div className="text-sm text-slate-600">
              预计利润：<span className={`text-lg font-bold ${(profit ?? 0) < 0 ? "text-rose-600" : "text-emerald-600"}`}>{profit !== null ? fmtMoney(profit) : "-"}</span> 元
              <span className="ml-2 text-xs text-slate-400">（不含税收入 − 付款金额）</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={props.onClose}>取消</Button>
              <Button onClick={submit} disabled={save.isPending || update.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                {props.record ? "保存修改" : "确认录入"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
