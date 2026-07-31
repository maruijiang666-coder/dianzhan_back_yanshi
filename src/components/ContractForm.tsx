import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createContract, updateContract } from "@/api/contracts";
import { listBrands } from "@/api/directory";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, TextInput, DateInput, SelectInput } from "./fields";
import { numOrNull, strOrNull } from "@/lib/format";
import { toast } from "sonner";

export type ContractRow = {
  id: number; brand_id: number | null; station_id: number | null; station_name: string;
  address: string | null; pay_entity: string | null; partner: string | null;
  contract_type: string; start_date: string | null; end_date: string | null; remark: string | null;
};

export function ContractForm(props: { open: boolean; onClose: () => void; record?: ContractRow | null }) {
  const blank = { brandId: "", stationName: "", address: "", payEntity: "", partner: "", contractType: "合作", startDate: "", endDate: "", remark: "" };
  const [f, setF] = useState(blank);
  const queryClient = useQueryClient();
  const brands = useQuery({ queryKey: ["brands"], queryFn: listBrands, enabled: props.open });

  useEffect(() => {
    if (!props.open) return;
    if (props.record) {
      const r = props.record;
      setF({
        brandId: r.brand_id ? String(r.brand_id) : "", stationName: r.station_name, address: r.address ?? "",
        payEntity: r.pay_entity ?? "", partner: r.partner ?? "", contractType: r.contract_type ?? "合作",
        startDate: r.start_date ?? "", endDate: r.end_date ?? "", remark: r.remark ?? "",
      });
    } else setF(blank);
  }, [props.open, props.record]);

  const set = (k: keyof typeof blank) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: (data: any) => props.record ? updateContract(props.record.id, data) : createContract(data),
    onSuccess: () => { toast.success("合同已保存"); queryClient.invalidateQueries(); props.onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  const submit = () => {
    if (!f.stationName.trim()) { toast.error("请填写站点名称"); return; }
    save.mutate({
      brandId: numOrNull(f.brandId), stationId: props.record?.station_id ?? null,
      stationName: f.stationName.trim(), address: strOrNull(f.address), payEntity: strOrNull(f.payEntity),
      partner: strOrNull(f.partner), contractType: f.contractType,
      startDate: strOrNull(f.startDate), endDate: strOrNull(f.endDate), remark: strOrNull(f.remark),
    });
  };

  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{props.record ? "编辑合同" : "新增合同"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          <Field label="品牌方">
            <SelectInput value={f.brandId} onChange={set("brandId")}
              options={[{ value: "", label: "未指定" }, ...(brands.data ?? []).map((b: any) => ({ value: String(b.id), label: b.name }))]} />
          </Field>
          <Field label="站点名称 *"><TextInput value={f.stationName} onChange={set("stationName")} /></Field>
          <Field label="合同类型">
            <SelectInput value={f.contractType} onChange={set("contractType")}
              options={["场租付款", "场租收款", "电费", "合作", "其他"].map((t) => ({ value: t, label: t }))} />
          </Field>
          <Field label="站点地址"><TextInput value={f.address} onChange={set("address")} /></Field>
          <Field label="付款主体"><TextInput value={f.payEntity} onChange={set("payEntity")} /></Field>
          <Field label="合作方"><TextInput value={f.partner} onChange={set("partner")} /></Field>
          <Field label="开始日期"><DateInput value={f.startDate} onChange={set("startDate")} /></Field>
          <Field label="结束日期"><DateInput value={f.endDate} onChange={set("endDate")} /></Field>
          <Field label="备注"><TextInput value={f.remark} onChange={set("remark")} /></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={props.onClose}>取消</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={save.isPending} onClick={submit}>保存</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
