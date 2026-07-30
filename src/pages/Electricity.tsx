import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { Money, StatusBadge } from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/fields";
import { ElecForm } from "@/components/ElecForm";
import { exportXlsx } from "@/lib/export";
import { fmtMoney, fmtNum, fmtDate } from "@/lib/format";
import { Download, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Electricity() {
  const [period, setPeriod] = useState("");
  const [brandId, setBrandId] = useState("");
  const [edit, setEdit] = useState<Record<string, unknown> | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const periods = trpc.ledger.electricityPeriods.useQuery();
  const brands = trpc.ledger.brands.useQuery();
  const list = trpc.ledger.electricity.useQuery(
    period || brandId ? { period: period || undefined, brandId: brandId ? Number(brandId) : undefined } : undefined,
  );
  const utils = trpc.useUtils();
  const del = trpc.mut.deleteElectricity.useMutation({ onSuccess: () => { toast.success("已删除"); utils.invalidate(); } });

  const rows = useMemo(() => list.data ?? [], [list.data]);
  const totals = useMemo(() => rows.reduce(
    (t, r) => ({
      payKwh: t.payKwh + Number(r.record.payKwh ?? 0), payAmount: t.payAmount + Number(r.record.payAmount ?? 0),
      collectKwh: t.collectKwh + Number(r.record.collectKwh ?? 0), collectAmount: t.collectAmount + Number(r.record.collectAmount ?? 0),
      collectNet: t.collectNet + Number(r.record.collectNet ?? 0), profit: t.profit + Number(r.record.profit ?? 0),
    }),
    { payKwh: 0, payAmount: 0, collectKwh: 0, collectAmount: 0, collectNet: 0, profit: 0 },
  ), [rows]);

  const doExport = () => {
    if (rows.length === 0) { toast.error("暂无数据可导出"); return; }
    exportXlsx(`电费收付明细台账${period ? `_${period}` : ""}`, [{
      name: "电费台账",
      rows: rows.map((r) => ({
        期间: r.record.period, 站点: r.stationName, 品牌方: r.brandName ?? "", 公司主体: r.entityName ?? "",
        业主方: r.landlordName ?? "", 电表编号: r.meterNo ?? "",
        上月抄表时间: fmtDate(r.record.payStartDate, ""), 付款起始度数: fmtNum(r.record.payStartReading, ""),
        付款抄表时间: fmtDate(r.record.payEndDate, ""), 付款抄表度数: fmtNum(r.record.payEndReading, ""),
        付款区间度数: fmtNum(r.record.payKwh, ""), 付款单价: fmtNum(r.record.payUnitPrice, ""),
        付款金额: fmtNum(r.record.payAmount, ""), 付款情况: r.record.payStatus,
        收款起始度数: fmtNum(r.record.collectStartReading, ""), 收款抄表时间: fmtDate(r.record.collectEndDate, ""),
        收款抄表度数: fmtNum(r.record.collectEndReading, ""), 收款区间度数: fmtNum(r.record.collectKwh, ""),
        收款单价: fmtNum(r.record.collectUnitPrice, ""), 收款金额: fmtNum(r.record.collectAmount, ""),
        不含税收入: fmtNum(r.record.collectNet, ""), 到账情况: r.record.collectStatus,
        利润: fmtNum(r.record.profit, ""), 运营费用: fmtNum(r.record.opExpense, ""),
        运营费用后利润: fmtNum(r.record.profitAfterOp, ""), 公司占股: r.record.companyShare ?? "",
        公司净利润: fmtNum(r.record.companyNetProfit, ""), 来源: r.record.source === "meter_api" ? "电表API" : "手工",
        备注: r.record.remark ?? "",
      })),
    }]);
    toast.success("已导出 Excel");
  };

  const th = "px-2.5 py-2.5 text-left text-xs font-medium text-slate-500 whitespace-nowrap";
  const thR = "px-2.5 py-2.5 text-right text-xs font-medium text-slate-500 whitespace-nowrap";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${inputCls} w-40`} value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="">全部月份</option>
          {(periods.data ?? []).map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className={`${inputCls} w-40`} value={brandId} onChange={(e) => setBrandId(e.target.value)}>
          <option value="">全部品牌方</option>
          {(brands.data ?? []).map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
        </select>
        <Button variant="outline" className="ml-auto" onClick={doExport}><Download className="mr-1.5 h-4 w-4" />导出表格</Button>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[1500px] text-xs">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className={th}>期间</th><th className={th}>站点</th><th className={th}>品牌方</th><th className={th}>业主方</th>
              <th className={thR}>付款度数</th><th className={thR}>付款单价</th><th className={thR}>付款金额</th><th className={th}>付款</th>
              <th className={thR}>收款度数</th><th className={thR}>收款单价</th><th className={thR}>收款金额</th><th className={thR}>不含税收入</th><th className={th}>到账</th>
              <th className={thR}>利润</th><th className={th}>来源</th><th className={`${th} text-center`}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.record.id} className="border-b last:border-0 hover:bg-slate-50/60">
                <td className="px-2.5 py-2 font-medium whitespace-nowrap">{r.record.period}</td>
                <td className="max-w-[220px] truncate px-2.5 py-2" title={r.stationName}>{r.stationName}</td>
                <td className="px-2.5 py-2 text-slate-600">{r.brandName ?? "-"}</td>
                <td className="px-2.5 py-2 text-slate-600">{r.landlordName ?? "-"}</td>
                <td className="px-2.5 py-2 text-right tabular-nums">{fmtNum(r.record.payKwh)}</td>
                <td className="px-2.5 py-2 text-right tabular-nums">{fmtNum(r.record.payUnitPrice)}</td>
                <td className="px-2.5 py-2 text-right"><Money v={r.record.payAmount} /></td>
                <td className="px-2.5 py-2"><StatusBadge status={r.record.payStatus} /></td>
                <td className="px-2.5 py-2 text-right tabular-nums">{fmtNum(r.record.collectKwh)}</td>
                <td className="px-2.5 py-2 text-right tabular-nums">{fmtNum(r.record.collectUnitPrice)}</td>
                <td className="px-2.5 py-2 text-right"><Money v={r.record.collectAmount} /></td>
                <td className="px-2.5 py-2 text-right"><Money v={r.record.collectNet} /></td>
                <td className="px-2.5 py-2"><StatusBadge status={r.record.collectStatus} /></td>
                <td className="px-2.5 py-2 text-right"><Money v={r.record.profit} strong /></td>
                <td className="px-2.5 py-2"><StatusBadge status={r.record.source} /></td>
                <td className="px-2.5 py-2">
                  <div className="flex justify-center gap-0.5">
                    <button className="rounded p-1 text-slate-400 hover:text-emerald-600" onClick={() => { setEdit(r.record as never); setFormOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
                    <button className="rounded p-1 text-slate-400 hover:text-rose-500" onClick={() => window.confirm("删除该记录？") && del.mutate({ id: r.record.id })}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={16} className="py-16 text-center text-slate-400">{list.isLoading ? "加载中…" : "暂无电费记录"}</td></tr>}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t bg-emerald-50/50 font-semibold text-slate-700">
                <td className="px-2.5 py-2.5" colSpan={4}>合计（{rows.length} 条）</td>
                <td className="px-2.5 py-2.5 text-right tabular-nums">{fmtNum(totals.payKwh)}</td>
                <td></td>
                <td className="px-2.5 py-2.5 text-right tabular-nums">{fmtMoney(totals.payAmount)}</td>
                <td></td>
                <td className="px-2.5 py-2.5 text-right tabular-nums">{fmtNum(totals.collectKwh)}</td>
                <td></td>
                <td className="px-2.5 py-2.5 text-right tabular-nums">{fmtMoney(totals.collectAmount)}</td>
                <td className="px-2.5 py-2.5 text-right tabular-nums">{fmtMoney(totals.collectNet)}</td>
                <td></td>
                <td className="px-2.5 py-2.5 text-right tabular-nums">{fmtMoney(totals.profit)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {edit && (
        <ElecForm open={formOpen} onClose={() => { setFormOpen(false); setEdit(null); }}
          stationId={(edit as { stationId: number }).stationId} record={edit as never} />
      )}
    </div>
  );
}
