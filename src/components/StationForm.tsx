import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createStation, updateStation } from "@/api/stations";
import { listBrands, listEntities, listLandlords } from "@/api/directory";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, NumInput, TextInput, SelectInput } from "./fields";
import { numOrNull, strOrNull } from "@/lib/format";
import { toast } from "sonner";

export function StationForm(props: { open: boolean; onClose: () => void; record?: any | null }) {
  const blank = {
    name: "", code: "", region: "", address: "", landlordId: "",
    companyShare: "", status: "运营中", remark: "",
  };
  const [f, setF] = useState(blank);
  const queryClient = useQueryClient();
  const brands = useQuery({ queryKey: ["brands"], queryFn: listBrands, enabled: props.open });
  const entities = useQuery({ queryKey: ["entities"], queryFn: listEntities, enabled: props.open });
  const landlords = useQuery({ queryKey: ["landlords"], queryFn: listLandlords, enabled: props.open });

  useEffect(() => {
    if (!props.open) return;
    if (props.record) {
      const s = props.record;
      setF({
        name: s.name ?? "", code: s.code ?? "", region: s.region ?? "", address: s.address ?? "",
        landlordId: s.landlord_id ? String(s.landlord_id) : "",
        companyShare: s.company_share ?? "", status: s.status ?? "运营中", remark: s.remark ?? "",
      });
    } else setF(blank);
  }, [props.open, props.record]);

  const set = (k: keyof typeof blank) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const onSuccess = () => { toast.success("站点已保存"); queryClient.invalidateQueries(); props.onClose(); };

  const create = useMutation({
    mutationFn: createStation,
    onSuccess, onError: (e: any) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: (data: any) => updateStation(data.id, data),
    onSuccess, onError: (e: any) => toast.error(e.message),
  });

  const submit = () => {
    if (!f.name.trim()) { toast.error("请填写站点名称"); return; }
    const payload = {
      name: f.name.trim(), code: strOrNull(f.code), region: strOrNull(f.region), address: strOrNull(f.address),
      landlordId: numOrNull(f.landlordId),
      companyShare: numOrNull(f.companyShare), status: f.status,
      remark: strOrNull(f.remark),
    };
    if (props.record) update.mutate({ ...payload, id: props.record.id });
    else create.mutate(payload);
  };

  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{props.record ? "编辑站点" : "新增站点"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <Field label="站点名称 *"><TextInput value={f.name} onChange={set("name")} /></Field>
          <Field label="站点编号"><TextInput value={f.code} onChange={set("code")} /></Field>
          <Field label="区域"><TextInput value={f.region} onChange={set("region")} /></Field>
          <Field label="地址"><TextInput value={f.address} onChange={set("address")} /></Field>
          <Field label="场地方">
            <SelectInput value={f.landlordId} onChange={set("landlordId")}
              options={[{ value: "", label: "未指定" }, ...(landlords.data ?? []).map((l: any) => ({ value: String(l.id), label: l.name }))]} />
          </Field>
          <Field label="公司占股"><NumInput value={f.companyShare} onChange={set("companyShare")} /></Field>
          <Field label="状态">
            <SelectInput value={f.status} onChange={set("status")}
              options={[{ value: "运营中", label: "运营中" }, { value: "筹建中", label: "筹建中" }, { value: "已关停", label: "已关停" }]} />
          </Field>
          <Field label="备注"><TextInput value={f.remark} onChange={set("remark")} /></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={props.onClose}>取消</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={create.isPending || update.isPending} onClick={submit}>保存</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
