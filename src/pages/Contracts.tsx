import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { StatusBadge } from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/fields";
import { ContractForm, type ContractRow } from "@/components/ContractForm";
import { exportXlsx } from "@/lib/export";
import { fmtDate } from "@/lib/format";
import { Download, Plus, Search, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function Contracts() {
  const [keyword, setKeyword] = useState("");
  const [brandId, setBrandId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ContractRow | null>(null);

  const brands = trpc.ledger.brands.useQuery();
  const list = trpc.ledger.contracts.useQuery(
    keyword || brandId ? { keyword: keyword || undefined, brandId: brandId ? Number(brandId) : undefined } : undefined,
  );
  const utils = trpc.useUtils();
  const del = trpc.mut.deleteContract.useMutation({ onSuccess: () => { toast.success("已删除"); utils.invalidate(); } });

  const rows = useMemo(() => (list.data ?? []).filter((c) => !statusFilter || c.status === statusFilter), [list.data, statusFilter]);
  const counts = useMemo(() => {
    const all = list.data ?? [];
    return {
      total: all.length,
      normal: all.filter((c) => c.status === "正常").length,
      expiring: all.filter((c) => c.status === "临期").length,
      expired: all.filter((c) => c.status === "已到期").length,
    };
  }, [list.data]);

  const doExport = () => {
    if (rows.length === 0) { toast.error("暂无数据可导出"); return; }
    exportXlsx(`合同监控表_${new Date().toISOString().slice(0, 10)}`, [{
      name: "合同监控",
      rows: rows.map((c) => ({
        品牌方: c.brandName ?? "", 付款主体: c.payEntity ?? "", 站点名称: c.stationName,
        站点地址: c.address ?? "", 合作方: c.partner ?? "", 合同类型: c.contractType,
        开始日期: fmtDate(c.startDate, ""), 结束日期: fmtDate(c.endDate, ""),
        剩余天数: c.daysLeft ?? "", 状态: c.status, 备注: c.remark ?? "",
      })),
    }]);
    toast.success("已导出 Excel");
  };

  const th = "px-3 py-2.5 text-left text-xs font-medium text-slate-500 whitespace-nowrap";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "合同总数", value: counts.total, cls: "text-slate-800", filter: "" },
          { label: "正常", value: counts.normal, cls: "text-emerald-600", filter: "正常" },
          { label: "临期（90天内）", value: counts.expiring, cls: "text-amber-600", filter: "临期" },
          { label: "已到期", value: counts.expired, cls: "text-rose-600", filter: "已到期" },
        ].map((c) => (
          <button key={c.label} onClick={() => setStatusFilter(statusFilter === c.filter ? "" : c.filter)}
            className={`rounded-xl border bg-white p-4 text-left shadow-sm transition-colors hover:border-emerald-300 ${statusFilter === c.filter && c.filter ? "border-emerald-500 ring-1 ring-emerald-500" : ""}`}>
            <div className="text-xs text-slate-500">{c.label}</div>
            <div className={`mt-1 text-2xl font-bold tabular-nums ${c.cls}`}>{c.value}</div>
          </button>
        ))}
      </div>

      {(counts.expiring > 0 || counts.expired > 0) && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
          <AlertTriangle className="h-4 w-4" />
          有 {counts.expiring} 份合同 90 天内到期、{counts.expired} 份已到期，请及时跟进续约。
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input className={`${inputCls} w-56 pl-8`} placeholder="搜索站点 / 合作方…" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        </div>
        <select className={`${inputCls} w-40`} value={brandId} onChange={(e) => setBrandId(e.target.value)}>
          <option value="">全部品牌方</option>
          {(brands.data ?? []).map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={doExport}><Download className="mr-1.5 h-4 w-4" />导出表格</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" />新增合同
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[1100px] text-xs">
          <thead><tr className="border-b bg-slate-50">
            <th className={th}>品牌方</th><th className={th}>站点名称</th><th className={th}>站点地址</th>
            <th className={th}>付款主体</th><th className={th}>合作方</th><th className={th}>类型</th>
            <th className={th}>开始日期</th><th className={th}>结束日期</th><th className="px-3 py-2.5 text-right text-xs font-medium text-slate-500">剩余天数</th>
            <th className={th}>状态</th><th className={th}>备注</th><th className={`${th} text-center`}>操作</th>
          </tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className={`border-b last:border-0 hover:bg-slate-50/60 ${c.status === "已到期" ? "bg-rose-50/30" : c.status === "临期" ? "bg-amber-50/30" : ""}`}>
                <td className="px-3 py-2.5">{c.brandName ?? "-"}</td>
                <td className="max-w-[200px] truncate px-3 py-2.5 font-medium" title={c.stationName}>{c.stationName}</td>
                <td className="max-w-[220px] truncate px-3 py-2.5 text-slate-600" title={c.address ?? ""}>{c.address ?? "-"}</td>
                <td className="px-3 py-2.5 text-slate-600">{c.payEntity ?? "-"}</td>
                <td className="px-3 py-2.5 text-slate-600">{c.partner ?? "-"}</td>
                <td className="px-3 py-2.5 text-slate-600">{c.contractType}</td>
                <td className="whitespace-nowrap px-3 py-2.5">{fmtDate(c.startDate)}</td>
                <td className="whitespace-nowrap px-3 py-2.5">{fmtDate(c.endDate)}</td>
                <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${c.status === "已到期" ? "text-rose-600" : c.status === "临期" ? "text-amber-600" : "text-slate-600"}`}>
                  {c.daysLeft ?? "-"}
                </td>
                <td className="px-3 py-2.5"><StatusBadge status={c.status} /></td>
                <td className="max-w-[140px] truncate px-3 py-2.5 text-slate-500" title={c.remark ?? ""}>{c.remark ?? "-"}</td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-center gap-0.5">
                    <button className="rounded p-1 text-slate-400 hover:text-emerald-600" onClick={() => { setEditing(c as never); setFormOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
                    <button className="rounded p-1 text-slate-400 hover:text-rose-500" onClick={() => window.confirm("删除该合同？") && del.mutate({ id: c.id })}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={12} className="py-16 text-center text-slate-400">{list.isLoading ? "加载中…" : "暂无合同"}</td></tr>}
          </tbody>
        </table>
      </div>

      <ContractForm open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} record={editing ?? undefined} />
    </div>
  );
}
