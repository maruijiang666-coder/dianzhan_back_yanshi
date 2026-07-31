import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listMeters, createMeter, updateMeter, deleteMeter, getMeter } from "@/api/meters";
import { listCabinets, createCabinet, updateCabinet, deleteCabinet } from "@/api/cabinets";
import { listStations } from "@/api/stations";
import { listBrands, listLandlords } from "@/api/directory";
import { StatusBadge } from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, NumInput, TextInput, SelectInput, inputCls } from "@/components/fields";
import { exportXlsx } from "@/lib/export";
import { fmtNum, fmtDateTime } from "@/lib/format";
import { Download, Search, Plus, Pencil, Trash2, Eye, Gauge, ChevronDown, ChevronRight, Box } from "lucide-react";
import { toast } from "sonner";

export default function Meters() {
  const [keyword, setKeyword] = useState("");
  const [landlordId, setLandlordId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<any>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [expandedMeterId, setExpandedMeterId] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const meters = useQuery({ queryKey: ["meters"], queryFn: () => listMeters() });
  const landlords = useQuery({ queryKey: ["landlords"], queryFn: listLandlords });
  const brands = useQuery({ queryKey: ["brands"], queryFn: listBrands });

  const del = useMutation({
    mutationFn: deleteMeter,
    onSuccess: () => { toast.success("已删除"); queryClient.invalidateQueries({ queryKey: ["meters"] }); },
  });

  const rows = useMemo(() => {
    let data = meters.data ?? [];
    if (keyword) data = data.filter((m: any) =>
      m.meter_no?.includes(keyword) || m.station_name?.includes(keyword) ||
      m.meter_name?.includes(keyword) || m.landlord_name?.includes(keyword)
    );
    if (landlordId) data = data.filter((m: any) => m.landlord_id === Number(landlordId));
    if (brandId) data = data.filter((m: any) => m.brand_id === Number(brandId));
    return data;
  }, [meters.data, keyword, landlordId, brandId]);

  // 按场地方分组
  const groupedByLandlord = useMemo(() => {
    const groups = new Map<number, any>();
    for (const r of rows) {
      const lid = r.landlord_id || 0;
      if (!groups.has(lid)) {
        groups.set(lid, {
          landlordId: lid,
          landlordName: r.landlord_name || "未设置场地方",
          meters: [],
        });
      }
      groups.get(lid).meters.push(r);
    }
    return [...groups.values()];
  }, [rows]);

  const doExport = () => {
    if (rows.length === 0) { toast.error("暂无数据可导出"); return; }
    exportXlsx(`电表台账_${new Date().toISOString().slice(0, 10)}`, [{
      name: "电表台账",
      rows: rows.map((m: any) => ({
        场地方: m.landlord_name ?? "", 品牌方: m.brand_name ?? "", 电表编号: m.meter_no,
        电表名称: m.meter_name ?? "", 采集器号: m.collector_id ?? "",
        互感器倍数: fmtNum(m.transformer_ratio), 状态: m.status,
      })),
    }]);
    toast.success("已导出 Excel");
  };

  const toggleExpand = (id: number) => {
    setExpandedMeterId((prev) => (prev === id ? null : id));
  };

  const th = "px-3 py-2.5 text-left text-xs font-medium text-slate-500 whitespace-nowrap";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input className={`${inputCls} w-56 pl-8`} placeholder="搜索电表编号 / 场地方…" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        </div>
        <select className={`${inputCls} w-40`} value={landlordId} onChange={(e) => setLandlordId(e.target.value)}>
          <option value="">全部场地方</option>
          {(landlords.data ?? []).map((l: any) => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
        </select>
        <select className={`${inputCls} w-40`} value={brandId} onChange={(e) => setBrandId(e.target.value)}>
          <option value="">全部品牌方</option>
          {(brands.data ?? []).map((b: any) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={doExport}><Download className="mr-1.5 h-4 w-4" />导出表格</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEditRecord(null); setFormOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" />新增电表
          </Button>
        </div>
      </div>

      {/* 按场地方分组展示 */}
      <div className="space-y-4">
        {groupedByLandlord.map((group: any) => (
          <div key={group.landlordId} className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-5 py-3 flex items-center gap-2">
              <Gauge className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-semibold text-slate-700">{group.landlordName}</span>
              <span className="text-xs text-slate-400">（{group.meters.length} 个电表）</span>
            </div>
            <div className="p-3 space-y-2">
              {group.meters.map((m: any) => (
                <MeterCard
                  key={m.id}
                  meter={m}
                  isExpanded={expandedMeterId === m.id}
                  onToggle={() => toggleExpand(m.id)}
                  onEdit={() => { setEditRecord(m); setFormOpen(true); }}
                  onDelete={() => window.confirm("删除该电表？") && del.mutate(m.id)}
                />
              ))}
            </div>
          </div>
        ))}
        {groupedByLandlord.length === 0 && (
          <div className="rounded-xl border border-dashed py-16 text-center text-slate-400">
            {meters.isLoading ? "加载中…" : "暂无电表数据"}
          </div>
        )}
      </div>

      <MeterForm open={formOpen} onClose={() => { setFormOpen(false); setEditRecord(null); }} record={editRecord} />
    </div>
  );
}

// ─── 电表卡片组件 ───
function MeterCard({ meter, isExpanded, onToggle, onEdit, onDelete }: {
  meter: any; isExpanded: boolean; onToggle: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const queryClient = useQueryClient();
  const cabinets = useQuery({
    queryKey: ["cabinets", meter.id],
    queryFn: () => listCabinets({ meterId: meter.id }),
    enabled: isExpanded,
  });

  const [cabinetFormOpen, setCabinetFormOpen] = useState(false);
  const [editCabinet, setEditCabinet] = useState<any>(null);

  const delCabinet = useMutation({
    mutationFn: deleteCabinet,
    onSuccess: () => { toast.success("已删除"); queryClient.invalidateQueries({ queryKey: ["cabinets"] }); },
  });

  return (
    <div className="rounded-lg border bg-slate-50/50">
      {/* 电表头部 */}
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-slate-100/50"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-300" />}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium">{meter.meter_no}</span>
              <span className="text-xs text-slate-500">{meter.brand_name ?? "未设置品牌"}</span>
              <StatusBadge status={meter.status} />
            </div>
            <div className="text-[11px] text-slate-400">{meter.meter_name ?? ""}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">互感器倍数：{fmtNum(meter.transformer_ratio)}</span>
          <span className="text-xs text-slate-400">柜数：{cabinets.data ? Math.max(1, cabinets.data.length) : 1}</span>
          <button className="rounded p-1 text-slate-400 hover:text-emerald-600" onClick={(e) => { e.stopPropagation(); onEdit(); }}><Pencil className="h-3.5 w-3.5" /></button>
          <button className="rounded p-1 text-slate-400 hover:text-rose-500" onClick={(e) => { e.stopPropagation(); onDelete(); }}><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* 展开内容：柜子列表 */}
      {isExpanded && (
        <div className="border-t px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-600">柜子列表（{Math.max(1, (cabinets.data ?? []).length)} 个）</span>
            <Button size="sm" variant="outline" onClick={() => { setEditCabinet(null); setCabinetFormOpen(true); }}>
              <Plus className="mr-1 h-3 w-3" />添加柜子
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-white">
                  <th className="px-2.5 py-1.5 text-left font-medium text-slate-500">柜子编号</th>
                  <th className="px-2.5 py-1.5 text-left font-medium text-slate-500">柜子类型</th>
                  <th className="px-2.5 py-1.5 text-left font-medium text-slate-500">备注</th>
                  <th className="px-2.5 py-1.5 text-center font-medium text-slate-500">操作</th>
                </tr>
              </thead>
              <tbody>
                {(cabinets.data ?? []).map((c: any) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-white/50">
                    <td className="px-2.5 py-1.5 font-medium">{c.cabinet_no}</td>
                    <td className="px-2.5 py-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${c.cabinet_type === "防爆柜" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                        {c.cabinet_type}
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5 text-slate-500">{c.remark ?? "-"}</td>
                    <td className="px-2.5 py-1.5">
                      <div className="flex justify-center gap-0.5">
                        <button className="rounded p-1 text-slate-400 hover:text-emerald-600" onClick={() => { setEditCabinet(c); setCabinetFormOpen(true); }}><Pencil className="h-3 w-3" /></button>
                        <button className="rounded p-1 text-slate-400 hover:text-rose-500" onClick={() => window.confirm("删除？") && delCabinet.mutate(c.id)}><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(cabinets.data ?? []).length === 0 && (
                  <tr><td colSpan={4} className="py-4 text-center text-slate-400">暂无柜子，点击"添加柜子"添加</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CabinetForm
        open={cabinetFormOpen}
        onClose={() => { setCabinetFormOpen(false); setEditCabinet(null); }}
        meterId={meter.id}
        record={editCabinet}
      />
    </div>
  );
}

// ─── 电表表单 ───
function MeterForm({ open, onClose, record }: { open: boolean; onClose: () => void; record?: any }) {
  const blank = { stationId: "", brandId: "", landlordId: "", meterNo: "", meterName: "", collectorId: "", transformerRatio: "", remark: "" };
  const [f, setF] = useState(blank);
  const queryClient = useQueryClient();
  const stations = useQuery({ queryKey: ["stations"], queryFn: () => listStations(), enabled: open });
  const brands = useQuery({ queryKey: ["brands"], queryFn: listBrands, enabled: open });
  const landlords = useQuery({ queryKey: ["landlords"], queryFn: listLandlords, enabled: open });

  useEffect(() => {
    if (!open) return;
    if (record) {
      setF({
        stationId: record.station_id ? String(record.station_id) : "",
        brandId: record.brand_id ? String(record.brand_id) : "",
        landlordId: record.landlord_id ? String(record.landlord_id) : "",
        meterNo: record.meter_no ?? "", meterName: record.meter_name ?? "",
        collectorId: record.collector_id ?? "", transformerRatio: String(record.transformer_ratio ?? ""),
        remark: record.remark ?? "",
      });
    } else setF(blank);
  }, [open, record]);

  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: (data: any) => record ? updateMeter(record.id, data) : createMeter(data),
    onSuccess: () => { toast.success("电表已保存"); queryClient.invalidateQueries({ queryKey: ["meters"] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  const submit = () => {
    if (!f.meterNo.trim()) { toast.error("请填写电表编号"); return; }
    save.mutate({
      stationId: f.stationId ? Number(f.stationId) : null,
      brandId: f.brandId ? Number(f.brandId) : null,
      landlordId: f.landlordId ? Number(f.landlordId) : null,
      meterNo: f.meterNo.trim(),
      meterName: f.meterName.trim() || null,
      collectorId: f.collectorId.trim() || null,
      transformerRatio: f.transformerRatio ? Number(f.transformerRatio) : 1,
      remark: f.remark.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{record ? "编辑电表" : "新增电表"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="场地方 *">
            <SelectInput value={f.landlordId} onChange={set("landlordId")}
              options={[{ value: "", label: "请选择场地方" }, ...(landlords.data ?? []).map((l: any) => ({ value: String(l.id), label: l.name }))]} />
          </Field>
          <Field label="品牌方">
            <SelectInput value={f.brandId} onChange={set("brandId")}
              options={[{ value: "", label: "未指定" }, ...(brands.data ?? []).map((b: any) => ({ value: String(b.id), label: b.name }))]} />
          </Field>
          <Field label="电表编号 *"><TextInput value={f.meterNo} onChange={set("meterNo")} /></Field>
          <Field label="电表名称"><TextInput value={f.meterName} onChange={set("meterName")} /></Field>
          <Field label="采集器号"><TextInput value={f.collectorId} onChange={set("collectorId")} /></Field>
          <Field label="互感器倍数"><NumInput value={f.transformerRatio} onChange={set("transformerRatio")} placeholder="1" /></Field>
          <Field label="备注"><TextInput value={f.remark} onChange={set("remark")} /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={save.isPending} onClick={submit}>保存</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 柜子表单 ───
function CabinetForm({ open, onClose, meterId, record }: { open: boolean; onClose: () => void; meterId: number; record?: any }) {
  const blank = { cabinetNo: "", cabinetType: "普通柜", count: "1", remark: "" };
  const [f, setF] = useState(blank);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    if (record) {
      setF({
        cabinetNo: record.cabinet_no ?? "",
        cabinetType: record.cabinet_type ?? "普通柜",
        count: "1",
        remark: record.remark ?? "",
      });
    } else setF(blank);
  }, [open, record]);

  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: async (data: any) => {
      if (record) {
        // 编辑模式：更新单个柜子
        return updateCabinet(record.id, data);
      } else {
        // 新增模式：批量创建柜子
        const count = parseInt(data.count) || 1;
        const baseNo = data.cabinetNo;
        const results = [];
        for (let i = 0; i < count; i++) {
          const cabinetNo = count === 1 ? baseNo : `${baseNo}-${String(i + 1).padStart(2, '0')}`;
          const result = await createCabinet({
            meterId: data.meterId,
            cabinetNo,
            cabinetType: data.cabinetType,
            remark: data.remark,
          });
          results.push(result);
        }
        return results;
      }
    },
    onSuccess: () => { toast.success("柜子已保存"); queryClient.invalidateQueries({ queryKey: ["cabinets"] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  const submit = () => {
    if (!f.cabinetNo.trim()) { toast.error("请填写柜子编号"); return; }
    save.mutate({
      meterId,
      cabinetNo: f.cabinetNo.trim(),
      cabinetType: f.cabinetType,
      count: f.count,
      remark: f.remark.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{record ? "编辑柜子" : "添加柜子"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="柜子编号 *"><TextInput value={f.cabinetNo} onChange={set("cabinetNo")} placeholder="如：C001" /></Field>
          <Field label="柜子类型">
            <SelectInput value={f.cabinetType} onChange={set("cabinetType")}
              options={[{ value: "普通柜", label: "普通柜" }, { value: "防爆柜", label: "防爆柜" }]} />
          </Field>
          {!record && (
            <Field label="柜子数量"><NumInput value={f.count} onChange={set("count")} placeholder="1" /></Field>
          )}
          <Field label="备注"><TextInput value={f.remark} onChange={set("remark")} /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={save.isPending} onClick={submit}>
              {record ? "保存" : `添加${parseInt(f.count) > 1 ? ` (${f.count}个)` : ""}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
