import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, NumInput, TextInput, SelectInput } from "./fields";
import { numOrNull, strOrNull, fmtMoney } from "@/lib/format";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

export type DividendRow = {
  record: {
    id: number; stationId: number; period: string; kwh: string | null; payUnitPrice: string | null;
    payAmount: string | null; elecIncomeTax: string | null; elecIncomeNet: string | null;
    rentIncomeTax: string | null; rentIncomeNet: string | null;
    status: "未结算" | "已结算"; remark: string | null;
  };
  stationName: string;
  shares: { shareholderId: number; ratio: string; shareholderName: string | null }[];
};

export function DividendForm(props: { open: boolean; onClose: () => void; record?: DividendRow | null; presetStationId?: number }) {
  const blank = {
    stationId: "", period: new Date().toISOString().slice(0, 7), kwh: "", payUnitPrice: "", payAmount: "",
    elecIncomeTax: "", elecIncomeNet: "", rentIncomeTax: "", rentIncomeNet: "", status: "未结算", remark: "",
  };
  const [f, setF] = useState(blank);
  const [shares, setShares] = useState<{ shareholderId: string; ratio: string }[]>([]);
  const utils = trpc.useUtils();
  const shareholders = trpc.ledger.shareholders.useQuery();
  const stations = trpc.ledger.stations.useQuery();
  const stationShares = trpc.ledger.stationDetail.useQuery(
    { id: Number(f.stationId) || 0 },
    { enabled: !!f.stationId && Number(f.stationId) > 0 },
  );

  useEffect(() => {
    if (!props.open) return;
    if (props.record) {
      const r = props.record.record;
      setF({
        stationId: String(r.stationId), period: r.period, kwh: r.kwh ?? "", payUnitPrice: r.payUnitPrice ?? "",
        payAmount: r.payAmount ?? "", elecIncomeTax: r.elecIncomeTax ?? "", elecIncomeNet: r.elecIncomeNet ?? "",
        rentIncomeTax: r.rentIncomeTax ?? "", rentIncomeNet: r.rentIncomeNet ?? "",
        status: r.status, remark: r.remark ?? "",
      });
      setShares(props.record.shares.map((sh) => ({ shareholderId: String(sh.shareholderId), ratio: sh.ratio })));
    } else {
      setF({ ...blank, stationId: props.presetStationId ? String(props.presetStationId) : "" });
      setShares([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, props.record]);

  // 选择站点后自动带出该站股东比例
  useEffect(() => {
    if (!props.open || props.record || !f.stationId) return;
    const detail = stationShares.data;
    if (detail && detail.station.id === Number(f.stationId) && detail.shares.length > 0) {
      setShares(detail.shares.map((sh) => ({ shareholderId: String(sh.shareholderId), ratio: sh.ratio })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationShares.data, f.stationId, props.open]);

  const set = (k: keyof typeof blank) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const elecNet = numOrNull(f.elecIncomeNet);
  const rentNet = numOrNull(f.rentIncomeNet);
  const payAmount = numOrNull(f.payAmount);
  const total = elecNet !== null || rentNet !== null ? Math.round(((elecNet ?? 0) + (rentNet ?? 0)) * 100) / 100 : null;
  const profit = total !== null || payAmount !== null ? Math.round(((total ?? 0) - (payAmount ?? 0)) * 100) / 100 : null;

  const save = trpc.mut.saveDividend.useMutation({
    onSuccess: () => { toast.success("分红记录已保存"); utils.invalidate(); props.onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const submit = () => {
    if (!f.stationId) { toast.error("请选择站点"); return; }
    save.mutate({
      id: props.record?.record.id, stationId: Number(f.stationId), period: f.period,
      kwh: numOrNull(f.kwh), payUnitPrice: numOrNull(f.payUnitPrice), payAmount,
      elecIncomeTax: numOrNull(f.elecIncomeTax), elecIncomeNet: elecNet,
      rentIncomeTax: numOrNull(f.rentIncomeTax), rentIncomeNet: rentNet,
      status: f.status as "未结算" | "已结算", remark: strOrNull(f.remark),
      shares: shares.filter((sh) => sh.shareholderId && sh.ratio).map((sh) => ({ shareholderId: Number(sh.shareholderId), ratio: Number(sh.ratio) })),
    });
  };

  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{props.record ? "编辑" : "新增"}股东分红月结</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Field label="站点 *">
              <SelectInput value={f.stationId} onChange={set("stationId")} options={[{ value: "", label: "请选择站点" }, ...(stations.data ?? []).map((st) => ({ value: String(st.station.id), label: st.station.name }))]} />
            </Field>
            <Field label="分红月份">
              <input type="month" className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm" value={f.period} onChange={(e) => set("period")(e.target.value)} />
            </Field>
            <Field label="结算状态"><SelectInput value={f.status} onChange={set("status")} options={[{ value: "未结算", label: "未结算" }, { value: "已结算", label: "已结算" }]} /></Field>
          </div>

          <div className="rounded-lg border border-rose-100 bg-rose-50/40 p-3">
            <div className="mb-2 text-xs font-semibold text-rose-600">付款情况</div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="电量（度）"><NumInput value={f.kwh} onChange={set("kwh")} /></Field>
              <Field label="付款单价（元/度）"><NumInput value={f.payUnitPrice} onChange={set("payUnitPrice")} /></Field>
              <Field label="付款金额（元）"><NumInput value={f.payAmount} onChange={set("payAmount")} /></Field>
            </div>
          </div>

          <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
            <div className="mb-2 text-xs font-semibold text-emerald-600">收款情况</div>
            <div className="grid grid-cols-4 gap-3">
              <Field label="收款电费·含税（元）"><NumInput value={f.elecIncomeTax} onChange={set("elecIncomeTax")} /></Field>
              <Field label="电费·不含税（元）"><NumInput value={f.elecIncomeNet} onChange={set("elecIncomeNet")} /></Field>
              <Field label="收款租金·含税（元）"><NumInput value={f.rentIncomeTax} onChange={set("rentIncomeTax")} /></Field>
              <Field label="租金·不含税（元）"><NumInput value={f.rentIncomeNet} onChange={set("rentIncomeNet")} /></Field>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">分红明细（利润 × 比例）</span>
              <Button size="sm" variant="outline" onClick={() => setShares((p) => [...p, { shareholderId: "", ratio: "" }])}>
                <Plus className="mr-1 h-3.5 w-3.5" />添加股东
              </Button>
            </div>
            <div className="space-y-2">
              {shares.map((sh, i) => {
                const amt = profit !== null && sh.ratio ? Math.round(profit * Number(sh.ratio) * 100) / 100 : null;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <select className="w-56 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm" value={sh.shareholderId}
                      onChange={(e) => setShares((p) => p.map((x, j) => (j === i ? { ...x, shareholderId: e.target.value } : x)))}>
                      <option value="">选择股东</option>
                      {(shareholders.data ?? []).map((h) => <option key={h.id} value={String(h.id)}>{h.name}</option>)}
                    </select>
                    <input type="number" step="any" className="w-32 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm tabular-nums" placeholder="比例 0.3" value={sh.ratio}
                      onChange={(e) => setShares((p) => p.map((x, j) => (j === i ? { ...x, ratio: e.target.value } : x)))} />
                    <span className="text-sm text-slate-500">应分：<span className="font-semibold text-emerald-600 tabular-nums">{amt !== null ? fmtMoney(amt) : "-"}</span> 元</span>
                    <button className="ml-auto text-slate-300 hover:text-rose-500" onClick={() => setShares((p) => p.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button>
                  </div>
                );
              })}
              {shares.length === 0 && <div className="rounded-md border border-dashed py-3 text-center text-xs text-slate-400">选择站点后自动带出股东比例，或手动添加</div>}
            </div>
          </div>

          <Field label="备注" span><TextInput value={f.remark} onChange={set("remark")} /></Field>

          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <div className="text-sm text-slate-600">
              收款合计 <span className="font-semibold tabular-nums">{total !== null ? fmtMoney(total) : "-"}</span> 元 ·
              利润 <span className={`text-lg font-bold tabular-nums ${(profit ?? 0) < 0 ? "text-rose-600" : "text-emerald-600"}`}>{profit !== null ? fmtMoney(profit) : "-"}</span> 元
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={props.onClose}>取消</Button>
              <Button onClick={submit} disabled={save.isPending} className="bg-emerald-600 hover:bg-emerald-700">保存</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
