import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listBrands, createBrand, updateBrand, deleteBrand,
  listEntities, createEntity, updateEntity, deleteEntity,
  listLandlords, createLandlord, updateLandlord, deleteLandlord,
  listShareholders, createShareholder, updateShareholder, deleteShareholder,
  listIntroducers, createIntroducer, updateIntroducer, deleteIntroducer,
  listPlatformUsers, createPlatformUser, updatePlatformUser, deletePlatformUser,
} from "@/api/directory";
import { listStations, deleteStation } from "@/api/stations";
import { StationForm } from "@/components/StationForm";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/fields";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { exportXlsx } from "@/lib/export";
import { Plus, Pencil, Trash2, Check, X, Search, Download } from "lucide-react";
import { toast } from "sonner";

type RowDef = { key: string; label: string; placeholder?: string }[];

function CrudTable(props: {
  title: string;
  columns: RowDef;
  rows: any[] | undefined;
  onCreate: (v: Record<string, string | null>) => Promise<any>;
  onUpdate: (id: number, v: Record<string, string | null>) => Promise<any>;
  onDelete: (id: number) => Promise<any>;
}) {
  const queryClient = useQueryClient();
  const blank = Object.fromEntries(props.columns.map((c) => [c.key, ""]));
  const [draft, setDraft] = useState(blank);
  const [editId, setEditId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState(blank);
  const [keyword, setKeyword] = useState("");

  const invalidate = () => queryClient.invalidateQueries();

  const filteredRows = useMemo(() => {
    if (!keyword || !props.rows) return props.rows ?? [];
    return props.rows.filter((r: any) =>
      props.columns.some((c) => String(r[c.key] ?? "").includes(keyword))
    );
  }, [props.rows, keyword, props.columns]);

  const create = async () => {
    if (!draft[props.columns[0].key]?.trim()) { toast.error(`请填写${props.columns[0].label}`); return; }
    try {
      await props.onCreate(Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, (v as string).trim() || null])));
      setDraft(blank);
      toast.success("已保存");
      invalidate();
    } catch (e: any) { toast.error(e.message); }
  };
  const startEdit = (row: any) => {
    setEditId(row.id);
    setEditDraft(Object.fromEntries(props.columns.map((c) => [c.key, String(row[c.key] ?? "")])));
  };
  const saveEdit = async () => {
    if (editId === null) return;
    try {
      await props.onUpdate(editId, Object.fromEntries(Object.entries(editDraft).map(([k, v]) => [k, (v as string).trim() || null])));
      setEditId(null);
      toast.success("已保存");
      invalidate();
    } catch (e: any) { toast.error(e.message); }
  };

  const doExport = () => {
    if (!filteredRows.length) { toast.error("暂无数据可导出"); return; }
    exportXlsx(`${props.title}_${new Date().toISOString().slice(0, 10)}`, [{
      name: props.title,
      rows: filteredRows.map((r: any) => {
        const row: Record<string, any> = {};
        props.columns.forEach((c) => { row[c.label] = r[c.key] ?? ""; });
        return row;
      }),
    }]);
    toast.success("已导出 Excel");
  };

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-semibold text-slate-700">{props.title}（{filteredRows.length}）</span>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
            <input className={`${inputCls} w-40 pl-7 text-xs`} placeholder="搜索…" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          </div>
          <Button size="sm" variant="outline" onClick={doExport}><Download className="mr-1 h-3 w-3" />导出</Button>
        </div>
      </div>
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
          {filteredRows.map((row: any) => (
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
                        onClick={() => window.confirm("删除该档案？") && props.onDelete(row.id).then(() => { toast.success("已删除"); invalidate(); })}><Trash2 className="h-4 w-4" /></button>
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

// ─── 站点管理 ───
function StationsTable() {
  const queryClient = useQueryClient();
  const stations = useQuery({ queryKey: ["stations"], queryFn: () => listStations() });
  const [formOpen, setFormOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<any>(null);
  const [keyword, setKeyword] = useState("");

  const invalidate = () => queryClient.invalidateQueries();

  const filteredRows = useMemo(() => {
    if (!keyword || !stations.data) return stations.data ?? [];
    return stations.data.filter((r: any) =>
      r.name?.includes(keyword) || r.code?.includes(keyword) || r.landlord_name?.includes(keyword) || r.region?.includes(keyword)
    );
  }, [stations.data, keyword]);

  const statusColor = (s: string) =>
    s === "运营中" ? "bg-emerald-100 text-emerald-700" :
    s === "筹建中" ? "bg-amber-100 text-amber-700" :
    "bg-slate-100 text-slate-600";

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-semibold text-slate-700">站点管理（{filteredRows.length}）</span>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
            <input className={`${inputCls} w-40 pl-7 text-xs`} placeholder="搜索…" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          </div>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEditRecord(null); setFormOpen(true); }}>
            <Plus className="mr-1 h-3.5 w-3.5" />新增站点
          </Button>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
          <th className="px-4 py-2.5 font-medium">站点名称</th>
          <th className="px-4 py-2.5 font-medium">站点编号</th>
          <th className="px-4 py-2.5 font-medium">场地方</th>
          <th className="px-4 py-2.5 font-medium">区域</th>
          <th className="px-4 py-2.5 font-medium">电表数</th>
          <th className="px-4 py-2.5 font-medium">状态</th>
          <th className="px-4 py-2.5 font-medium">备注</th>
          <th className="px-4 py-2.5 text-center font-medium">操作</th>
        </tr></thead>
        <tbody>
          {filteredRows.map((row: any) => (
            <tr key={row.id} className="border-b last:border-0 hover:bg-slate-50/60">
              <td className="px-4 py-2.5 font-medium">{row.name}</td>
              <td className="px-4 py-2.5 text-slate-600">{row.code ?? "-"}</td>
              <td className="px-4 py-2.5 text-slate-600">{row.landlord_name ?? "-"}</td>
              <td className="px-4 py-2.5 text-slate-600">{row.region ?? "-"}</td>
              <td className="px-4 py-2.5 text-slate-600">{row.meter_count ?? 0}</td>
              <td className="px-4 py-2.5">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${statusColor(row.status)}`}>{row.status ?? "运营中"}</span>
              </td>
              <td className="px-4 py-2.5 text-slate-600">{row.remark ?? "-"}</td>
              <td className="px-4 py-2.5">
                <div className="flex justify-center gap-1">
                  <button className="rounded p-1 text-slate-400 hover:text-emerald-600" onClick={() => { setEditRecord(row); setFormOpen(true); }}><Pencil className="h-4 w-4" /></button>
                  <button className="rounded p-1 text-slate-400 hover:text-rose-500"
                    onClick={() => window.confirm("删除该站点？") && deleteStation(row.id).then(() => { toast.success("已删除"); invalidate(); })}><Trash2 className="h-4 w-4" /></button>
                </div>
              </td>
            </tr>
          ))}
          {filteredRows.length === 0 && (
            <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">暂无站点数据</td></tr>
          )}
        </tbody>
      </table>
      <StationForm open={formOpen} onClose={() => { setFormOpen(false); setEditRecord(null); }} record={editRecord} />
    </div>
  );
}

const ROLE_OPTIONS = [
  { value: "boss", label: "老板" },
  { value: "finance", label: "财务" },
  { value: "finance_supervisor", label: "财务主管" },
  { value: "shareholder", label: "股东" },
];

const roleLabel = (role: string) => ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;

function PlatformUsersTable({ shareholders }: { shareholders: any[] | undefined }) {
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: ["platformUsers"], queryFn: listPlatformUsers });
  const [draft, setDraft] = useState({ name: "", role: "boss", shareholderId: "", phone: "", remark: "" });
  const [editId, setEditId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState({ name: "", role: "boss", shareholderId: "", phone: "", remark: "" });
  const [keyword, setKeyword] = useState("");

  const invalidate = () => queryClient.invalidateQueries();

  const filteredRows = useMemo(() => {
    if (!keyword || !users.data) return users.data ?? [];
    return users.data.filter((r: any) =>
      r.name?.includes(keyword) || roleLabel(r.role).includes(keyword) || r.shareholder_name?.includes(keyword) || r.phone?.includes(keyword)
    );
  }, [users.data, keyword]);

  const toPayload = (d: typeof draft) => ({
    name: d.name.trim(),
    role: d.role,
    shareholderId: d.role === "shareholder" && d.shareholderId ? Number(d.shareholderId) : null,
    phone: d.phone.trim() || null,
    remark: d.remark.trim() || null,
  });

  const create = async () => {
    if (!draft.name.trim()) { toast.error("请填写姓名"); return; }
    if (draft.role === "shareholder" && !draft.shareholderId) { toast.error("请选择关联的股东"); return; }
    try {
      await createPlatformUser(toPayload(draft));
      setDraft({ name: "", role: "boss", shareholderId: "", phone: "", remark: "" });
      toast.success("已保存");
      invalidate();
    } catch (e: any) { toast.error(e.message); }
  };

  const startEdit = (row: any) => {
    setEditId(row.id);
    setEditDraft({
      name: row.name ?? "",
      role: row.role ?? "boss",
      shareholderId: row.shareholder_id ? String(row.shareholder_id) : "",
      phone: row.phone ?? "",
      remark: row.remark ?? "",
    });
  };

  const saveEdit = async () => {
    if (editId === null) return;
    try {
      await updatePlatformUser(editId, toPayload(editDraft));
      setEditId(null);
      toast.success("已保存");
      invalidate();
    } catch (e: any) { toast.error(e.message); }
  };

  const doExport = () => {
    if (!filteredRows.length) { toast.error("暂无数据可导出"); return; }
    exportXlsx(`平台使用人员_${new Date().toISOString().slice(0, 10)}`, [{
      name: "平台使用人员",
      rows: filteredRows.map((r: any) => ({
        姓名: r.name,
        角色: roleLabel(r.role),
        关联股东: r.shareholder_name ?? "-",
        电话: r.phone ?? "-",
        备注: r.remark ?? "-",
      })),
    }]);
    toast.success("已导出 Excel");
  };

  const renderRow = (d: typeof draft, setD: any, isCreate: boolean) => (
    <>
      <td className="px-3 py-2">
        <input className={`${inputCls} w-24`} placeholder="姓名" value={d.name}
          onChange={(e) => setD((p: any) => ({ ...p, name: e.target.value }))} />
      </td>
      <td className="px-3 py-2">
        <select className={`${inputCls} w-28`} value={d.role}
          onChange={(e) => setD((p: any) => ({ ...p, role: e.target.value, shareholderId: "" }))}>
          {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </td>
      <td className="px-3 py-2">
        {d.role === "shareholder" ? (
          <select className={`${inputCls} w-28`} value={d.shareholderId}
            onChange={(e) => setD((p: any) => ({ ...p, shareholderId: e.target.value }))}>
            <option value="">选择股东…</option>
            {(shareholders ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        ) : (
          <span className="text-xs text-slate-400">-</span>
        )}
      </td>
      <td className="px-3 py-2">
        <input className={`${inputCls} w-28`} placeholder="电话" value={d.phone}
          onChange={(e) => setD((p: any) => ({ ...p, phone: e.target.value }))} />
      </td>
      <td className="px-3 py-2">
        <input className={`${inputCls} w-32`} placeholder="备注" value={d.remark}
          onChange={(e) => setD((p: any) => ({ ...p, remark: e.target.value }))} />
      </td>
    </>
  );

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-semibold text-slate-700">平台使用人员（{filteredRows.length}）</span>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
            <input className={`${inputCls} w-40 pl-7 text-xs`} placeholder="搜索…" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          </div>
          <Button size="sm" variant="outline" onClick={doExport}><Download className="mr-1 h-3 w-3" />导出</Button>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
          <th className="px-4 py-2.5 font-medium">姓名</th>
          <th className="px-4 py-2.5 font-medium">角色</th>
          <th className="px-4 py-2.5 font-medium">关联股东</th>
          <th className="px-4 py-2.5 font-medium">电话</th>
          <th className="px-4 py-2.5 font-medium">备注</th>
          <th className="px-4 py-2.5 text-center font-medium">操作</th>
        </tr></thead>
        <tbody>
          <tr className="border-b bg-emerald-50/40">
            {renderRow(draft, setDraft, true)}
            <td className="px-3 py-2 text-center">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={create}><Plus className="mr-1 h-3.5 w-3.5" />添加</Button>
            </td>
          </tr>
          {filteredRows.map((row: any) => (
            <tr key={row.id} className="border-b last:border-0 hover:bg-slate-50/60">
              {editId === row.id ? (
                <>
                  {renderRow(editDraft, setEditDraft, false)}
                  <td className="px-4 py-2.5">
                    <div className="flex justify-center gap-1">
                      <button className="rounded p-1 text-emerald-600 hover:bg-emerald-50" onClick={saveEdit}><Check className="h-4 w-4" /></button>
                      <button className="rounded p-1 text-slate-400 hover:bg-slate-100" onClick={() => setEditId(null)}><X className="h-4 w-4" /></button>
                    </div>
                  </td>
                </>
              ) : (
                <>
                  <td className="px-4 py-2.5 font-medium">{row.name}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                      row.role === "boss" ? "bg-amber-100 text-amber-700" :
                      row.role === "shareholder" ? "bg-blue-100 text-blue-700" :
                      "bg-emerald-100 text-emerald-700"
                    }`}>{roleLabel(row.role)}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{row.shareholder_name ?? "-"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{row.phone ?? "-"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{row.remark ?? "-"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-center gap-1">
                      <button className="rounded p-1 text-slate-400 hover:text-emerald-600" onClick={() => startEdit(row)}><Pencil className="h-4 w-4" /></button>
                      <button className="rounded p-1 text-slate-400 hover:text-rose-500"
                        onClick={() => window.confirm("删除该人员？") && deletePlatformUser(row.id).then(() => { toast.success("已删除"); invalidate(); })}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Directory() {
  const brands = useQuery({ queryKey: ["brands"], queryFn: listBrands });
  const entities = useQuery({ queryKey: ["entities"], queryFn: listEntities });
  const landlords = useQuery({ queryKey: ["landlords"], queryFn: listLandlords });
  const shareholders = useQuery({ queryKey: ["shareholders"], queryFn: listShareholders });
  const introducers = useQuery({ queryKey: ["introducers"], queryFn: listIntroducers });

  return (
    <Tabs defaultValue="brands">
      <TabsList>
        <TabsTrigger value="brands">品牌方（{brands.data?.length ?? 0}）</TabsTrigger>
        <TabsTrigger value="entities">公司主体（{entities.data?.length ?? 0}）</TabsTrigger>
        <TabsTrigger value="landlords">场地方/业主（{landlords.data?.length ?? 0}）</TabsTrigger>
        <TabsTrigger value="stations">站点</TabsTrigger>
        <TabsTrigger value="shareholders">股东（{shareholders.data?.length ?? 0}）</TabsTrigger>
        <TabsTrigger value="introducers">介绍人（{introducers.data?.length ?? 0}）</TabsTrigger>
        <TabsTrigger value="users">平台人员</TabsTrigger>
      </TabsList>
      <div className="mt-4">
        <TabsContent value="brands">
          <CrudTable title="品牌方档案" rows={brands.data}
            columns={[{ key: "name", label: "名称" }, { key: "contact", label: "联系人" }, { key: "remark", label: "备注" }]}
            onCreate={createBrand} onUpdate={(id, v) => updateBrand(id, v)} onDelete={deleteBrand} />
        </TabsContent>
        <TabsContent value="entities">
          <CrudTable title="公司主体档案" rows={entities.data}
            columns={[{ key: "name", label: "公司全称" }, { key: "short_name", label: "简称" }, { key: "remark", label: "备注" }]}
            onCreate={(v) => createEntity({ name: v.name, shortName: v.short_name, remark: v.remark })} onUpdate={(id, v) => updateEntity(id, { name: v.name, shortName: v.short_name, remark: v.remark })} onDelete={deleteEntity} />
        </TabsContent>
        <TabsContent value="landlords">
          <CrudTable title="场地方 / 业主档案" rows={landlords.data}
            columns={[{ key: "name", label: "名称" }, { key: "contact", label: "联系人" }, { key: "phone", label: "电话" }, { key: "remark", label: "备注" }]}
            onCreate={createLandlord} onUpdate={(id, v) => updateLandlord(id, v)} onDelete={deleteLandlord} />
        </TabsContent>
        <TabsContent value="shareholders">
          <CrudTable title="股东档案" rows={shareholders.data}
            columns={[{ key: "name", label: "姓名" }, { key: "phone", label: "电话" }, { key: "remark", label: "备注" }]}
            onCreate={createShareholder} onUpdate={(id, v) => updateShareholder(id, v)} onDelete={deleteShareholder} />
        </TabsContent>
        <TabsContent value="introducers">
          <CrudTable title="介绍人档案" rows={introducers.data}
            columns={[{ key: "name", label: "姓名" }, { key: "phone", label: "电话" }, { key: "remark", label: "备注" }]}
            onCreate={createIntroducer} onUpdate={(id, v) => updateIntroducer(id, v)} onDelete={deleteIntroducer} />
        </TabsContent>
        <TabsContent value="stations">
          <StationsTable />
        </TabsContent>
        <TabsContent value="users">
          <PlatformUsersTable shareholders={shareholders.data} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
