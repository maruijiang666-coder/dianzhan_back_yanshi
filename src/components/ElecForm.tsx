import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createElectricity, updateElectricity } from "@/api/electricity";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, NumInput, TextInput, DateInput, SelectInput } from "./fields";
import { numOrNull, strOrNull, fmtMoney } from "@/lib/format";
import { toast } from "sonner";

type ElecRecord = {
  id: number; station_id: number; period: string;
  pay_start_date: string | null; pay_start_reading: string | null; pay_end_date: string | null; pay_end_reading: string | null;
  pay_kwh: string | null; pay_unit_price: string | null; pay_amount: string | null; pay_status: string;
  collect_start_date: string | null; collect_start_reading: string | null; collect_end_date: string | null; collect_end_reading: string | null;
  collect_kwh: string | null; collect_unit_price: string | null; collect_amount: string | null;
  tax_rate: string | null; collect_net: string | null; collect_status: string;
  remark: string | null;
};

const blank = {
  period: new Date().toISOString().slice(0, 7),
  payStartDate: "", payStartReading: "", payEndDate: "", payEndReading: "",
  payKwh: "", payUnitPrice: "", payAmount: "", payStatus: "未付款",
  collectStartDate: "", collectStartReading: "", collectEndDate: "", collectEndReading: "",
  collectKwh: "", collectUnitPrice: "", collectAmount: "", taxRate: "0.01",
  collectNet: "", collectStatus: "未到账", remark: "",
};

export function ElecForm(props: {
  open: boolean;
  onClose: () => void;
  stationId: number;
  stationName?: string;
  record?: ElecRecord | null;
}) {
  const [f, setF] = useState(blank);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!props.open) return;
    if (props.record) {
      const r = props.record;
      setF({
        period: r.period,
        payStartDate: r.pay_start_date ?? "", payStartReading: r.pay_start_reading ?? "",
        payEndDate: r.pay_end_date ?? "", payEndReading: r.pay_end_reading ?? "",
        payKwh: r.pay_kwh ?? "", payUnitPrice: r.pay_unit_price ?? "", payAmount: r.pay_amount ?? "",
        payStatus: r.pay_status ?? "未付款",
        collectStartDate: r.collect_start_date ?? "", collectStartReading: r.collect_start_reading ?? "",
        collectEndDate: r.collect_end_date ?? "", collectEndReading: r.collect_end_reading ?? "",
        collectKwh: r.collect_kwh ?? "", collectUnitPrice: r.collect_unit_price ?? "",
        collectAmount: r.collect_amount ?? "", taxRate: r.tax_rate ?? "0.01",
        collectNet: r.collect_net ?? "", collectStatus: r.collect_status ?? "未到账",
        remark: r.remark ?? "",
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

  const onSuccess = () => { toast.success("电费月结已保存"); queryClient.invalidateQueries(); props.onClose(); };

  const save = useMutation({
    mutationFn: createElectricity,
    onSuccess, onError: (e: any) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: (data: any) => updateElectricity(data.id, data),
    onSuccess, onError: (e: any) => toast.error(e.message),
  });

  const submit = () => {
    const payload = {
      stationId: props.stationId, period: f.period,
      payStartDate: strOrNull(f.payStartDate), payStartReading: numOrNull(f.payStartReading),
      payEndDate: strOrNull(f.payEndDate), payEndReading: numOrNull(f.payEndReading),
      payKwh, payUnitPrice, payAmount, payStatus: f.payStatus,
      collectStartDate: strOrNull(f.collectStartDate), collectStartReading: numOrNull(f.collectStartReading),
      collectEndDate: strOrNull(f.collectEndDate), collectEndReading: numOrNull(f.collectEndReading),
      collectKwh, collectUnitPrice, collectAmount, taxRate, collectNet,
      collectStatus: f.collectStatus,
      remark: strOrNull(f.remark),
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
