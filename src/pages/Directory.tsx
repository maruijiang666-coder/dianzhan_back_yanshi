import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/fields";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";

type RowDef = { key: string; label: string; placeholder?: string }[];

function CrudTable(props: {
  title: string;
  columns: RowDef;
  rows: { id: number; [k: string]: unknown }[] | undefined;
  onCreate: (v: Record<string, string | null>) => Promise<unknown>;
  onUpdate: (id: number, v: Record<string, string | null>) => Promise<unknown>;
  onDelete: (id: number) => Promise<unknown>;
}) {
  const blank = Object.fromEntries(props.columns.map((c) => [c.key, ""]));
  const [draft, setDraft] = useState(blank);
  const [editId, setEditId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState(blank);

  const create = async () => {
    if (!draft[props.columns[0].key]?.trim()) { toast.error(`请填写${props.columns[0].label}`); return; }
    await props.onCreate(Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, (v as string).trim() || null])));
    setDraft(blank);
  };
  const startEdit = (row: { id: number; [k: string]: unknown }) => {
    setEditId(row.id);
    setEditDraft(Object.fromEntries(props.columns.map((c) => [c.key, String(row[c.key] ?? "")])));
  };
  const saveEdit = async () => {
    if (editId === null) return;
    await props.onUpdate(editId, Object.fromEntries(Object.entries(editDraft).map(([k, v]) => [k, (v as string).trim() || null])));
    setEditId(null);
  };

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="border-b px-4 py-3 text-sm font-semibold text-slate-700">{props.title}</div>
      <table className="w-full text-sm">
        <thead><tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
          {props.columns.map((c) => <th key={c.key} className="px-4 py-2.5 font-medium">{c.label}</th>)}
          <th className="px-4 py-2.5 text-center font-medium">操作</th>
        </tr></thead>
        <tbody>
          <tr className="border-b bg-emerald-50/40">
            {props.columns.map((c) => (
              <td key={c.key} className="px-3 py-2">
                <input className={`${inputCls} w-full`} placeholder={c.placeholder ?? c.label} value={draft[c.key] as string}
                  onChange={(e) => setDraft((p) => ({ ...p, [c.key]: e.target.value }))} />
              </td>
            ))}
            <td className="px-3 py-2 text-center">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={create}><Plus className="mr-1 h-3.5 w-3.5" />添加</Button>
            </td>
          </tr>
          {(props.rows ?? []).map((row) => (
            <tr key={row.id} className="border-b last:border-0 hover:bg-slate-50/60">
              {props.columns.map((c) => (
                <td key={c.key} className="px-4 py-2.5">
                  {editId === row.id ? (
                    <input className={`${inputCls} w-full`} value={editDraft[c.key] as string}
                      onChange={(e) => setEditDraft((p) => ({ ...p, [c.key]: e.target.value }))} />
                  ) : (
                    <span className={c.key === props.columns[0].key ? "font-medium" : "text-slate-600"}>{String(row[c.key] ?? "-")}</span>
                  )}
                </td>
              ))}
              <td className="px-4 py-2.5">
                <div className="flex justify-center gap-1">
                  {editId === row.id ? (
                    <>
                      <button className="rounded p-1 text-emerald-600 hover:bg-emerald-50" onClick={saveEdit}><Check className="h-4 w-4" /></button>
                      <button className="rounded p-1 text-slate-400 hover:bg-slate-100" onClick={() => setEditId(null)}><X className="h-4 w-4" /></button>
                    </>
                  ) : (
                    <>
                      <button className="rounded p-1 text-slate-400 hover:text-emerald-600" onClick={() => startEdit(row)}><Pencil className="h-4 w-4" /></button>
                      <button className="rounded p-1 text-slate-400 hover:text-rose-500"
                        onClick={() => window.confirm("删除该档案？关联站点将变为未指定。") && props.onDelete(row.id)}><Trash2 className="h-4 w-4" /></button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Directory() {
  const utils = trpc.useUtils();
  const brands = trpc.ledger.brands.useQuery();
  const entities = trpc.ledger.entities.useQuery();
  const landlords = trpc.ledger.landlords.useQuery();
  const shareholders = trpc.ledger.shareholders.useQuery();

  const wrap = <T,>(p: Promise<T>) => p.then(() => { toast.success("已保存"); utils.invalidate(); }).catch((e: Error) => toast.error(e.message));

  const createBrand = trpc.mut.createBrand.useMutation();
  const updateBrand = trpc.mut.updateBrand.useMutation();
  const deleteBrand = trpc.mut.deleteBrand.useMutation();
  const createEntity = trpc.mut.createEntity.useMutation();
  const updateEntity = trpc.mut.updateEntity.useMutation();
  const deleteEntity = trpc.mut.deleteEntity.useMutation();
  const createLandlord = trpc.mut.createLandlord.useMutation();
  const updateLandlord = trpc.mut.updateLandlord.useMutation();
  const deleteLandlord = trpc.mut.deleteLandlord.useMutation();
  const createShareholder = trpc.mut.createShareholder.useMutation();
  const updateShareholder = trpc.mut.updateShareholder.useMutation();
  const deleteShareholder = trpc.mut.deleteShareholder.useMutation();

  return (
    <Tabs defaultValue="brands">
      <TabsList>
        <TabsTrigger value="brands">品牌方（{brands.data?.length ?? 0}）</TabsTrigger>
        <TabsTrigger value="entities">公司主体（{entities.data?.length ?? 0}）</TabsTrigger>
        <TabsTrigger value="landlords">场地方/业主（{landlords.data?.length ?? 0}）</TabsTrigger>
        <TabsTrigger value="shareholders">股东（{shareholders.data?.length ?? 0}）</TabsTrigger>
      </TabsList>
      <div className="mt-4">
        <TabsContent value="brands">
          <CrudTable title="品牌方档案" rows={brands.data as never}
            columns={[{ key: "name", label: "名称" }, { key: "contact", label: "联系人" }, { key: "remark", label: "备注" }]}
            onCreate={(v) => wrap(createBrand.mutateAsync(v as never))}
            onUpdate={(id, v) => wrap(updateBrand.mutateAsync({ id, ...v } as never))}
            onDelete={(id) => wrap(deleteBrand.mutateAsync({ id }))} />
        </TabsContent>
        <TabsContent value="entities">
          <CrudTable title="公司主体档案" rows={entities.data as never}
            columns={[{ key: "name", label: "公司全称" }, { key: "shortName", label: "简称" }, { key: "remark", label: "备注" }]}
            onCreate={(v) => wrap(createEntity.mutateAsync(v as never))}
            onUpdate={(id, v) => wrap(updateEntity.mutateAsync({ id, ...v } as never))}
            onDelete={(id) => wrap(deleteEntity.mutateAsync({ id }))} />
        </TabsContent>
        <TabsContent value="landlords">
          <CrudTable title="场地方 / 业主档案" rows={landlords.data as never}
            columns={[{ key: "name", label: "名称" }, { key: "contact", label: "联系人" }, { key: "phone", label: "电话" }, { key: "remark", label: "备注" }]}
            onCreate={(v) => wrap(createLandlord.mutateAsync(v as never))}
            onUpdate={(id, v) => wrap(updateLandlord.mutateAsync({ id, ...v } as never))}
            onDelete={(id) => wrap(deleteLandlord.mutateAsync({ id }))} />
        </TabsContent>
        <TabsContent value="shareholders">
          <CrudTable title="股东档案" rows={shareholders.data as never}
            columns={[{ key: "name", label: "姓名" }, { key: "phone", label: "电话" }, { key: "remark", label: "备注" }]}
            onCreate={(v) => wrap(createShareholder.mutateAsync(v as never))}
            onUpdate={(id, v) => wrap(updateShareholder.mutateAsync({ id, ...v } as never))}
            onDelete={(id) => wrap(deleteShareholder.mutateAsync({ id }))} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
