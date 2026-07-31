import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createDividend } from "@/api/dividends";
import { listShareholders } from "@/api/directory";
import { listStations, getStation } from "@/api/stations";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, NumInput, TextInput, SelectInput } from "./fields";
import { numOrNull, strOrNull, fmtMoney } from "@/lib/format";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

export type DividendRow = {
  id: number; station_id: number; period: string; type: string;
  profit: string | null; status: string; remark: string | null;
  shares: { shareholder_id: number; ratio: string; shareholder_name: string | null; amount: string | null }[];
};

export function DividendForm(props: { open: boolean; onClose: () => void; record?: DividendRow | null; presetStationId?: number }) {
  const blank = {
    stationId: "", period: new Date().toISOString().slice(0, 7), type: "股东分红", remark: "",
  };
  const [f, setF] = useState(blank);
  const queryClient = useQueryClient();
  const shareholders = useQuery({ queryKey: ["shareholders"], queryFn: listShareholders, enabled: props.open });
  const stations = useQuery({ queryKey: ["stations"], queryFn: () => listStations(), enabled: props.open });

  useEffect(() => {
    if (!props.open) return;
    if (props.record) {
      setF({
        stationId: String(props.record.station_id), period: props.record.period,
        type: props.record.type, remark: props.record.remark ?? "",
      });
    } else {
      setF({ ...blank, stationId: props.presetStationId ? String(props.presetStationId) : "" });
    }
  }, [props.open, props.record]);

  const set = (k: keyof typeof blank) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: createDividend,
    onSuccess: () => { toast.success("分红记录已保存"); queryClient.invalidateQueries(); props.onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  const submit = () => {
    if (!f.stationId) { toast.error("请选择站点"); return; }
    save.mutate({
      stationId: Number(f.stationId), period: f.period, type: f.type, remark: strOrNull(f.remark),
    });
  };

  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{props.record ? "编辑" : "新增"}分红月结</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Field label="站点 *">
              <SelectInput value={f.stationId} onChange={set("stationId")}
                options={[{ value: "", label: "请选择站点" }, ...(stations.data ?? []).map((st: any) => ({ value: String(st.id), label: st.name }))]} />
            </Field>
            <Field label="分红月份">
              <input type="month" className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm" value={f.period} onChange={(e) => set("period")(e.target.value)} />
            </Field>
            <Field label="分红类型">
              <SelectInput value={f.type} onChange={set("type")}
                options={[{ value: "股东分红", label: "股东分红" }, { value: "商务分红", label: "商务分红" }]} />
            </Field>
          </div>

          <Field label="备注" span><TextInput value={f.remark} onChange={set("remark")} /></Field>

          <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
            提交后系统将自动根据站点的分红配置计算分红金额
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={props.onClose}>取消</Button>
            <Button onClick={submit} disabled={save.isPending} className="bg-emerald-600 hover:bg-emerald-700">保存</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
