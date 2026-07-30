import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, TextInput, DateInput, SelectInput } from "./fields";
import { numOrNull, strOrNull } from "@/lib/format";
import { toast } from "sonner";

export type ContractRow = {
  id: number; brandId: number | null; stationId: number | null; stationName: string;
  address: string | null; payEntity: string | null; partner: string | null;
  contractType: "场租付款" | "场租收款" | "电费" | "合作" | "其他";
  startDate: string | null; endDate: string | null; remark: string | null;
};

export function ContractForm(props: { open: boolean; onClose: () => void; record?: ContractRow | null }) {
  const blank = { brandId: "", stationName: "", address: "", payEntity: "", partner: "", contractType: "合作", startDate: "", endDate: "", remark: "" };
  const [f, setF] = useState(blank);
  const utils = trpc.useUtils();
  const brands = trpc.ledger.brands.useQuery();
  useEffect(() => {
    if (!props.open) return;
    if (props.record) {
      const r = props.record;
      setF({
        brandId: r.brandId ? String(r.brandId) : "", stationName: r.stationName, address: r.address ?? "",
        payEntity: r.payEntity ?? "", partner: r.partner ?? "", contractType: r.contractType,
        startDate: r.startDate ?? "", endDate: r.endDate ?? "", remark: r.remark ?? "",
      });
    } else setF(blank);
  }, [props.open, props.record]);
  const set = (k: keyof typeof blank) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const save = trpc.mut.saveContract.useMutation({
    onSuccess: () => { toast.success("合同已保存"); utils.invalidate(); props.onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const submit = () => {
    if (!f.stationName.trim()) { toast.error("请填写站点名称"); return; }
    save.mutate({
      id: props.record?.id, brandId: numOrNull(f.brandId), stationId: props.record?.stationId ?? null,
      stationName: f.stationName.trim(), address: strOrNull(f.address), payEntity: strOrNull(f.payEntity),
      partner: strOrNull(f.partner), contractType: f.contractType as ContractRow["contractType"],
      startDate: strOrNull(f.startDate), endDate: strOrNull(f.endDate), remark: strOrNull(f.remark),
    });
  };
  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{props.record ? "编辑合同" : "新增合同"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          <Field label="品牌方">
            <SelectInput value={f.brandId} onChange={set("brandId")} options={[{ value: "", label: "未指定" }, ...(brands.data ?? []).map((b) => ({ value: String(b.id), label: b.name }))]} />
          </Field>
          <Field label="站点名称 *" span><TextInput value={f.stationName} onChange={set("stationName")} /></Field>
          <Field label="站点地址" span><TextInput value={f.address} onChange={set("address")} /></Field>
          <Field label="付款主体"><TextInput value={f.payEntity} onChange={set("payEntity")} /></Field>
          <Field label="合作方"><TextInput value={f.partner} onChange={set("partner")} /></Field>
          <Field label="合同类型"><SelectInput value={f.contractType} onChange={set("contractType")} options={["场租付款", "场租收款", "电费", "合作", "其他"].map((v) => ({ value: v, label: v }))} /></Field>
          <Field label="开始日期"><DateInput value={f.startDate} onChange={set("startDate")} /></Field>
          <Field label="结束日期"><DateInput value={f.endDate} onChange={set("endDate")} /></Field>
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
