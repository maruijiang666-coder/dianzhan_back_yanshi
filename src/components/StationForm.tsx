import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, NumInput, TextInput, SelectInput } from "./fields";
import { numOrNull, strOrNull } from "@/lib/format";
import { toast } from "sonner";

type StationRow = {
  station: {
    id: number; name: string; code: string | null; region: string | null; address: string | null;
    brandId: number | null; entityId: number | null; landlordId: number | null;
    meterNo: string | null; transformerRatio: string | null; cabinets: string | null;
    storageCabinets: string | null; companyShare: string | null;
    status: "运营中" | "筹建中" | "已关停"; remark: string | null;
  };
};

export function StationForm(props: { open: boolean; onClose: () => void; record?: StationRow | null }) {
  const blank = {
    name: "", code: "", region: "", address: "", brandId: "", entityId: "", landlordId: "",
    meterNo: "", transformerRatio: "", cabinets: "", storageCabinets: "", companyShare: "", status: "运营中", remark: "",
  };
  const [f, setF] = useState(blank);
  const utils = trpc.useUtils();
  const brands = trpc.ledger.brands.useQuery();
  const entities = trpc.ledger.entities.useQuery();
  const landlords = trpc.ledger.landlords.useQuery();

  useEffect(() => {
    if (!props.open) return;
    if (props.record) {
      const s = props.record.station;
      setF({
        name: s.name, code: s.code ?? "", region: s.region ?? "", address: s.address ?? "",
        brandId: s.brandId ? String(s.brandId) : "", entityId: s.entityId ? String(s.entityId) : "",
        landlordId: s.landlordId ? String(s.landlordId) : "",
        meterNo: s.meterNo ?? "", transformerRatio: s.transformerRatio ?? "",
        cabinets: s.cabinets ?? "", storageCabinets: s.storageCabinets ?? "",
        companyShare: s.companyShare ?? "", status: s.status, remark: s.remark ?? "",
      });
    } else setF(blank);
  }, [props.open, props.record]);

  const set = (k: keyof typeof blank) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const onSuccess = () => { toast.success("站点已保存"); utils.invalidate(); props.onClose(); };
  const create = trpc.mut.createStation.useMutation({ onSuccess, onError: (e) => toast.error(e.message) });
  const update = trpc.mut.updateStation.useMutation({ onSuccess, onError: (e) => toast.error(e.message) });

  const submit = () => {
    if (!f.name.trim()) { toast.error("请填写站点名称"); return; }
    const payload = {
      name: f.name.trim(), code: strOrNull(f.code), region: strOrNull(f.region), address: strOrNull(f.address),
      brandId: numOrNull(f.brandId), entityId: numOrNull(f.entityId), landlordId: numOrNull(f.landlordId),
      meterNo: strOrNull(f.meterNo), transformerRatio: numOrNull(f.transformerRatio),
      cabinets: numOrNull(f.cabinets), storageCabinets: numOrNull(f.storageCabinets),
      companyShare: numOrNull(f.companyShare), status: f.status as "运营中" | "筹建中" | "已关停",
      remark: strOrNull(f.remark),
    };
    if (props.record) update.mutate({ ...payload, id: props.record.station.id });
    else create.mutate(payload);
  };

  const dirOptions = (list?: { id: number; name: string }[]) => [
    { value: "", label: "未指定" },
    ...(list ?? []).map((x) => ({ value: String(x.id), label: x.name })),
  ];

  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{props.record ? "编辑站点" : "新增站点"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          <Field label="站点名称 *" span><TextInput value={f.name} onChange={set("name")} /></Field>
          <Field label="站点号"><TextInput value={f.code} onChange={set("code")} /></Field>
          <Field label="区域"><TextInput value={f.region} onChange={set("region")} placeholder="五华 / 盘龙 / 官渡…" /></Field>
          <Field label="状态"><SelectInput value={f.status} onChange={set("status")} options={["运营中", "筹建中", "已关停"].map((v) => ({ value: v, label: v }))} /></Field>
          <Field label="详细地址" span><TextInput value={f.address} onChange={set("address")} /></Field>
          <Field label="品牌方"><SelectInput value={f.brandId} onChange={set("brandId")} options={dirOptions(brands.data)} /></Field>
          <Field label="公司主体"><SelectInput value={f.entityId} onChange={set("entityId")} options={dirOptions(entities.data)} /></Field>
          <Field label="场地方（业主）"><SelectInput value={f.landlordId} onChange={set("landlordId")} options={dirOptions(landlords.data)} /></Field>
          <Field label="电表编号"><TextInput value={f.meterNo} onChange={set("meterNo")} placeholder="智慧电表API以此关联" /></Field>
          <Field label="互感器倍数"><NumInput value={f.transformerRatio} onChange={set("transformerRatio")} placeholder="40" /></Field>
          <Field label="公司占股（0~1）"><NumInput value={f.companyShare} onChange={set("companyShare")} placeholder="1" /></Field>
          <Field label="换电柜数量"><NumInput value={f.cabinets} onChange={set("cabinets")} /></Field>
          <Field label="储电/防爆柜数量"><NumInput value={f.storageCabinets} onChange={set("storageCabinets")} /></Field>
          <Field label="备注" span><TextInput value={f.remark} onChange={set("remark")} /></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={props.onClose}>取消</Button>
          <Button onClick={submit} disabled={create.isPending || update.isPending} className="bg-emerald-600 hover:bg-emerald-700">保存</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
