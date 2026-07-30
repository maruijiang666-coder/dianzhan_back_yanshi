import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { Money, StatusBadge } from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/fields";
import { StationForm } from "@/components/StationForm";
import { StationDrawer } from "@/components/StationDrawer";
import { exportXlsx } from "@/lib/export";
import { fmtMoney, fmtNum, fmtDate, fmtPct } from "@/lib/format";
import { Download, Plus, Search, Eye, Pencil, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

// ─── 展开行详情组件 ───
function ExpandedDetail({ stationId }: { stationId: number }) {
  const detail = trpc.ledger.stationDetail.useQuery({ id: stationId });
  const d = detail.data;

  if (!d) return (
    <div className="py-8 text-center text-sm text-slate-400">加载中…</div>
  );

  const st = d.station;
  const th = "px-2.5 py-1.5 text-left text-[11px] font-medium text-slate-500";
  const thR = "px-2.5 py-1.5 text-right text-[11px] font-medium text-slate-500";
  const td = "px-2.5 py-1.5 text-[11px]";
  const tdR = "px-2.5 py-1.5 text-right text-[11px] tabular-nums";

  return (
    <div className="space-y-4 text-sm">
      {/* ── 站点概况 ── */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
        <span>品牌方：<b>{d.brandName ?? "-"}</b></span>
        <span>公司主体：<b>{d.entityName ?? "-"}</b></span>
        <span>场地方：<b>{d.landlordName ?? "-"}</b></span>
        <span>电表编号：<b>{st.meterNo ?? "-"}</b>{st.transformerRatio ? `（${fmtNum(st.transformerRatio)}倍互感器）` : ""}</span>
        <span>换电柜：<b>{fmtNum(st.cabinets)}</b> 个</span>
        {st.storageCabinets && <span>储电柜：<b>{fmtNum(st.storageCabinets)}</b> 个</span>}
        <span>公司占股：<b>{fmtPct(st.companyShare)}</b></span>
      </div>

      {/* ── 电费收付款明细 ── */}
      <div>
        <h4 className="mb-1.5 text-xs font-semibold text-slate-700">电费收付款明细</h4>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className={th}>月份</th>
                <th className={th}>付款区间</th>
                <th className={thR}>付款单价</th>
                <th className={thR}>付款度数</th>
                <th className={thR}>付款金额</th>
                <th className={th}>付款状态</th>
                <th className={th}>收款区间</th>
                <th className={thR}>收款单价</th>
                <th className={thR}>收款度数</th>
                <th className={thR}>收款金额</th>
                <th className={th}>收款状态</th>
                <th className={thR}>利润</th>
              </tr>
            </thead>
            <tbody>
              {d.electricity.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50/60">
                  <td className={`${td} font-medium`}>{r.period}</td>
                  <td className={td}>{r.payStartDate && r.payEndDate ? `${fmtDate(r.payStartDate)} ~ ${fmtDate(r.payEndDate)}` : "-"}</td>
                  <td className={tdR}>{fmtNum(r.payUnitPrice)}</td>
                  <td className={tdR}>{fmtNum(r.payKwh)}</td>
                  <td className={tdR}><Money v={r.payAmount} /></td>
                  <td className={td}><StatusBadge status={r.payStatus} /></td>
                  <td className={td}>{r.collectStartDate && r.collectEndDate ? `${fmtDate(r.collectStartDate)} ~ ${fmtDate(r.collectEndDate)}` : "-"}</td>
                  <td className={tdR}>{fmtNum(r.collectUnitPrice)}</td>
                  <td className={tdR}>{fmtNum(r.collectKwh)}</td>
                  <td className={tdR}><Money v={r.collectAmount} /></td>
                  <td className={td}><StatusBadge status={r.collectStatus} /></td>
                  <td className={tdR}><Money v={r.profit} strong /></td>
                </tr>
              ))}
              {d.electricity.length === 0 && (
                <tr><td colSpan={12} className="py-6 text-center text-slate-400">暂无电费记录</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 场地租金 ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 付款合同 */}
        <div>
          <h4 className="mb-1.5 text-xs font-semibold text-rose-600">场地租金付款（公司 → 业主）</h4>
          <div className="rounded-lg border">
            <table className="w-full text-xs">
              <thead><tr className="border-b bg-slate-50">
                <th className={th}>租期</th><th className={thR}>年租金</th><th className={th}>付款方式</th><th className={thR}>每期金额</th><th className={th}>付款状态</th>
              </tr></thead>
              <tbody>
                {d.leases.map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className={td}>{fmtDate(l.contractStart)} ~ {fmtDate(l.contractEnd)}</td>
                    <td className={tdR}><Money v={l.annualRent} strong /></td>
                    <td className={td}>{l.payMethod ?? "-"}</td>
                    <td className={tdR}><Money v={l.payAmount} /></td>
                    <td className={td}><StatusBadge status={l.payStatus} /></td>
                  </tr>
                ))}
                {d.leases.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-slate-400">暂无付款合同</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* 收款合同 */}
        <div>
          <h4 className="mb-1.5 text-xs font-semibold text-emerald-600">场地租金收款（品牌方 → 公司）</h4>
          <div className="space-y-2">
            {d.incomes.map((ic) => (
              <div key={ic.id} className="rounded-lg border">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-slate-50 px-3 py-1.5 text-[11px]">
                  <span className="font-medium">{fmtDate(ic.contractStart)} ~ {fmtDate(ic.contractEnd)}</span>
                  <span>单柜月租 <b>{fmtMoney(ic.unitMonthlyRent)}</b></span>
                  <span>柜数 <b>{fmtNum(ic.cabinetsCount)}</b></span>
                  <span>年收入 <b>{fmtMoney(ic.annualIncome)}</b></span>
                </div>
                <table className="w-full text-xs">
                  <thead><tr className="border-b text-slate-400">
                    <th className={th}>期次</th><th className={th}>收款区间</th><th className={thR}>金额</th><th className={th}>到账状态</th>
                  </tr></thead>
                  <tbody>
                    {(ic as any).receipts.map((rc: any) => (
                      <tr key={rc.id} className="border-b last:border-0">
                        <td className={td}>第 {fmtNum(rc.seq)} 次</td>
                        <td className={td}>{fmtDate(rc.periodStart)} ~ {fmtDate(rc.periodEnd)}</td>
                        <td className={tdR}><Money v={rc.amount} /></td>
                        <td className={td}><StatusBadge status={rc.status} /></td>
                      </tr>
                    ))}
                    {(ic as any).receipts.length === 0 && <tr><td colSpan={4} className="py-3 text-center text-slate-400">暂无分期收款</td></tr>}
                  </tbody>
                </table>
              </div>
            ))}
            {d.incomes.length === 0 && <div className="rounded-lg border border-dashed py-4 text-center text-xs text-slate-400">暂无收款合同</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 主页面 ───
export default function Stations() {
  const [keyword, setKeyword] = useState("");
  const [brandId, setBrandId] = useState("");
  const [entityId, setEntityId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<{ station: { id: number } } & Record<string, unknown> | null>(null);
  const [drawerId, setDrawerId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const brands = trpc.ledger.brands.useQuery();
  const entities = trpc.ledger.entities.useQuery();
  const board = trpc.ledger.stationBoard.useQuery(
    keyword || brandId || entityId
      ? { keyword: keyword || undefined, brandId: brandId ? Number(brandId) : undefined, entityId: entityId ? Number(entityId) : undefined }
      : undefined,
  );

  const rows = useMemo(() => board.data ?? [], [board.data]);
  const totals = useMemo(() => rows.reduce(
    (t, r) => ({
      elecPay: t.elecPay + r.elecPay, elecCollect: t.elecCollect + r.elecCollect, elecProfit: t.elecProfit + r.elecProfit,
      rentCost: t.rentCost + r.rentCost, rentIncome: t.rentIncome + r.rentIncome, rentProfit: t.rentProfit + r.rentProfit,
      totalProfit: t.totalProfit + r.totalProfit,
    }),
    { elecPay: 0, elecCollect: 0, elecProfit: 0, rentCost: 0, rentIncome: 0, rentProfit: 0, totalProfit: 0 },
  ), [rows]);

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const doExport = () => {
    if (rows.length === 0) { toast.error("暂无数据可导出"); return; }
    exportXlsx(`站点数据看板_${new Date().toISOString().slice(0, 10)}`, [{
      name: "站点看板",
      rows: rows.map((r) => ({
        站点名称: r.station.name, 区域: r.station.region ?? "", 品牌方: r.brandName ?? "",
        公司主体: r.entityName ?? "", 场地方: r.landlordName ?? "", 电表编号: r.station.meterNo ?? "",
        换电柜: fmtNum(r.station.cabinets, ""), 储电柜: fmtNum(r.station.storageCabinets, ""),
        公司占股: fmtPct(r.station.companyShare, ""), 状态: r.station.status,
        电费付款: r.elecPay, 电费收款: r.elecCollect, 电费利润: r.elecProfit,
        年租金成本: r.rentCost, 年租金收入: r.rentIncome, 租金利润: r.rentProfit,
        租金已到账: r.rentReceived, 租金待收: r.rentPending, 总利润: r.totalProfit,
        涉及月份: r.periods.join("、"),
      })),
    }]);
    toast.success("已导出 Excel");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input className={`${inputCls} w-56 pl-8`} placeholder="搜索站点名称…" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        </div>
        <select className={`${inputCls} w-40`} value={brandId} onChange={(e) => setBrandId(e.target.value)}>
          <option value="">全部品牌方</option>
          {(brands.data ?? []).map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
        </select>
        <select className={`${inputCls} w-52`} value={entityId} onChange={(e) => setEntityId(e.target.value)}>
          <option value="">全部公司主体</option>
          {(entities.data ?? []).map((x) => <option key={x.id} value={String(x.id)}>{x.name}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={doExport}><Download className="mr-1.5 h-4 w-4" />导出表格</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" />新增站点
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[1200px] text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
              <th className="w-8 px-1 py-2.5"></th>
              <th className="px-3 py-2.5 font-medium">站点</th>
              <th className="px-3 py-2.5 font-medium">品牌方</th>
              <th className="px-3 py-2.5 font-medium">公司主体</th>
              <th className="px-3 py-2.5 font-medium">场地方</th>
              <th className="px-3 py-2.5 text-right font-medium">电费付款</th>
              <th className="px-3 py-2.5 text-right font-medium">电费收款</th>
              <th className="px-3 py-2.5 text-right font-medium">电费利润</th>
              <th className="px-3 py-2.5 text-right font-medium">年租金成本</th>
              <th className="px-3 py-2.5 text-right font-medium">年租金收入</th>
              <th className="px-3 py-2.5 text-right font-medium">总利润</th>
              <th className="px-3 py-2.5 font-medium">状态</th>
              <th className="px-3 py-2.5 text-center font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isExpanded = expandedId === r.station.id;
              return (
                <>
                  <tr key={r.station.id} className={`border-b hover:bg-slate-50/60 cursor-pointer ${isExpanded ? "bg-slate-50/80" : ""}`} onClick={() => toggleExpand(r.station.id)}>
                    <td className="px-1 py-2.5 text-center">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-300" />}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-slate-800">{r.station.name}</div>
                      <div className="text-[11px] text-slate-400">{[r.station.region, r.station.meterNo ? `电表 ${r.station.meterNo}` : ""].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{r.brandName ?? "-"}</td>
                    <td className="px-3 py-2.5 text-slate-600">{r.entityName ?? "-"}</td>
                    <td className="px-3 py-2.5 text-slate-600">{r.landlordName ?? "-"}</td>
                    <td className="px-3 py-2.5 text-right"><Money v={r.elecPay} /></td>
                    <td className="px-3 py-2.5 text-right"><Money v={r.elecCollect} /></td>
                    <td className="px-3 py-2.5 text-right"><Money v={r.elecProfit} strong /></td>
                    <td className="px-3 py-2.5 text-right"><Money v={r.rentCost} /></td>
                    <td className="px-3 py-2.5 text-right"><Money v={r.rentIncome} /></td>
                    <td className="px-3 py-2.5 text-right"><Money v={r.totalProfit} strong /></td>
                    <td className="px-3 py-2.5"><StatusBadge status={r.station.status} /></td>
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-center gap-1">
                        <button className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-emerald-600" title="站点详情 / 数据录入" onClick={() => setDrawerId(r.station.id)}><Eye className="h-4 w-4" /></button>
                        <button className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-emerald-600" title="编辑站点" onClick={() => { setEditing(r as never); setFormOpen(true); }}><Pencil className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${r.station.id}-expanded`}>
                      <td colSpan={13} className="border-b bg-white px-6 py-4">
                        <ExpandedDetail stationId={r.station.id} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={13} className="py-16 text-center text-slate-400">{board.isLoading ? "加载中…" : "暂无站点数据"}</td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t bg-emerald-50/50 text-xs font-semibold text-slate-700">
                <td className="px-3 py-2.5" colSpan={5}>合计（{rows.length} 个站点）</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.elecPay)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.elecCollect)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.elecProfit)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.rentCost)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.rentIncome)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.totalProfit)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <StationForm open={formOpen} onClose={() => setFormOpen(false)} record={editing as never} />
      {drawerId !== null && <StationDrawer stationId={drawerId} onClose={() => setDrawerId(null)} />}
    </div>
  );
}
