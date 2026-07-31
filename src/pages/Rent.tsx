import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listLeases, listIncomes, deleteLease, deleteIncome } from "@/api/rent";
import { listBrands } from "@/api/directory";
import { listStations } from "@/api/stations";
import { Money, StatusBadge } from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/fields";
import { LeaseForm, RentIncomeForm } from "@/components/RentForms";
import { exportXlsx } from "@/lib/export";
import { fmtMoney, fmtNum, fmtDate } from "@/lib/format";
import { Download, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Rent() {
  const [brandId, setBrandId] = useState("");
  const [leaseFormOpen, setLeaseFormOpen] = useState(false);
  const [leaseEdit, setLeaseEdit] = useState<any>(null);
  const [incomeFormOpen, setIncomeFormOpen] = useState(false);
  const [incomeEdit, setIncomeEdit] = useState<any>(null);

  const queryClient = useQueryClient();
  const brands = useQuery({ queryKey: ["brands"], queryFn: listBrands });
  const stations = useQuery({ queryKey: ["stations"], queryFn: () => listStations() });
  const leasesQ = useQuery({ queryKey: ["rentLeases"], queryFn: () => listLeases() });
  const incomesQ = useQuery({ queryKey: ["rentIncomes"], queryFn: () => listIncomes() });

  const leases = useMemo(() => leasesQ.data ?? [], [leasesQ.data]);
  const incomes = useMemo(() => incomesQ.data ?? [], [incomesQ.data]);

  const leaseTotal = leases.reduce((t: number, l: any) => t + Number(l.annual_rent ?? 0), 0);
  const incomeTotal = incomes.reduce((t: number, i: any) => t + Number(i.annual_income ?? 0), 0);
  const profitTotal = incomes.reduce((t: number, i: any) => t + Number(i.profit ?? 0), 0);

  const invalidate = () => queryClient.invalidateQueries();

  const delLease = useMutation({
    mutationFn: deleteLease,
    onSuccess: () => { toast.success("已删除"); invalidate(); },
  });
  const delIncome = useMutation({
    mutationFn: deleteIncome,
    onSuccess: () => { toast.success("已删除"); invalidate(); },
  });

  const doExport = () => {
    if (leases.length === 0 && incomes.length === 0) { toast.error("暂无数据可导出"); return; }
    exportXlsx(`场地租金台账_${new Date().toISOString().slice(0, 10)}`, [
      {
        name: "租金付款合同",
        rows: leases.map((l: any) => ({
          站点: l.station_name,
          合同开始: fmtDate(l.contract_start, ""), 合同结束: fmtDate(l.contract_end, ""),
          年租金成本: fmtNum(l.annual_rent, ""), 付款方式: l.pay_method ?? "",
          每期付款金额: fmtNum(l.pay_amount, ""), 押金: fmtNum(l.deposit, ""),
          付款情况: l.pay_status,
        })),
      },
      {
        name: "租金收款合同",
        rows: incomes.map((i: any) => ({
          站点: i.station_name, 品牌方: i.brand_name ?? "",
          收款合同开始: fmtDate(i.contract_start, ""), 收款合同结束: fmtDate(i.contract_end, ""),
          单柜月租金: fmtNum(i.unit_monthly_rent, ""), 计费柜数: fmtNum(i.cabinets_count, ""),
          年租金收入: fmtNum(i.annual_income, ""), 租金利润: fmtNum(i.profit, ""),
        })),
      },
    ]);
    toast.success("已导出 Excel");
  };

  const th = "px-2.5 py-2.5 text-left text-xs font-medium text-slate-500 whitespace-nowrap";
  const thR = "px-2.5 py-2.5 text-right text-xs font-medium text-slate-500 whitespace-nowrap";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${inputCls} w-40`} value={brandId} onChange={(e) => setBrandId(e.target.value)}>
          <option value="">全部品牌方</option>
          {(brands.data ?? []).map((b: any) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-4">
          <div className="text-xs text-slate-500">
            年租金成本 <b className="text-rose-600 tabular-nums">{fmtMoney(leaseTotal)}</b> ·
            年收入 <b className="text-emerald-600 tabular-nums">{fmtMoney(incomeTotal)}</b> ·
            租金利润 <b className="text-emerald-600 tabular-nums">{fmtMoney(profitTotal)}</b>
          </div>
          <Button variant="outline" onClick={doExport}><Download className="mr-1.5 h-4 w-4" />导出表格</Button>
        </div>
      </div>

      {/* 付款合同 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-rose-600">租金付款合同（公司 → 业主，共 {leases.length} 份）</h3>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setLeaseEdit(null); setLeaseFormOpen(true); }}>
            <Plus className="mr-1 h-3.5 w-3.5" />新增付款合同
          </Button>
        </div>
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="w-full min-w-[1000px] text-xs">
            <thead><tr className="border-b bg-slate-50">
              <th className={th}>站点</th><th className={th}>合同租期</th>
              <th className={thR}>年租金成本</th><th className={th}>付款方式</th><th className={thR}>每期金额</th><th className={thR}>押金</th>
              <th className={th}>付款截止</th><th className={th}>付款情况</th><th className={`${th} text-center`}>操作</th>
            </tr></thead>
            <tbody>
              {leases.map((l: any) => (
                <tr key={l.id} className="border-b last:border-0 hover:bg-slate-50/60">
                  <td className="max-w-[240px] truncate px-2.5 py-2 font-medium" title={l.station_name}>{l.station_name}</td>
                  <td className="whitespace-nowrap px-2.5 py-2">{fmtDate(l.contract_start)} ~ {fmtDate(l.contract_end)}</td>
                  <td className="px-2.5 py-2 text-right"><Money v={l.annual_rent} strong /></td>
                  <td className="px-2.5 py-2">{l.pay_method ?? "-"}</td>
                  <td className="px-2.5 py-2 text-right"><Money v={l.pay_amount} /></td>
                  <td className="px-2.5 py-2 text-right"><Money v={l.deposit} /></td>
                  <td className="px-2.5 py-2">{fmtDate(l.pay_deadline)}</td>
                  <td className="px-2.5 py-2"><StatusBadge status={l.pay_status} /></td>
                  <td className="px-2.5 py-2">
                    <div className="flex justify-center gap-0.5">
                      <button className="rounded p-1 text-slate-400 hover:text-emerald-600" onClick={() => { setLeaseEdit(l); setLeaseFormOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
                      <button className="rounded p-1 text-slate-400 hover:text-rose-500" onClick={() => window.confirm("删除？") && delLease.mutate(l.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {leases.length === 0 && <tr><td colSpan={9} className="py-10 text-center text-slate-400">暂无付款合同</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* 收款合同 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-emerald-600">租金收款合同（品牌方 → 公司，共 {incomes.length} 份）</h3>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setIncomeEdit(null); setIncomeFormOpen(true); }}>
            <Plus className="mr-1 h-3.5 w-3.5" />新增收款合同
          </Button>
        </div>
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="w-full min-w-[1000px] text-xs">
            <thead><tr className="border-b bg-slate-50">
              <th className={th}>站点</th><th className={th}>品牌方</th><th className={th}>收款租期</th>
              <th className={thR}>单柜月租</th><th className={thR}>柜数</th><th className={thR}>年收入</th>
              <th className={thR}>租金利润</th><th className={`${th} text-center`}>操作</th>
            </tr></thead>
            <tbody>
              {incomes.map((i: any) => (
                <tr key={i.id} className="border-b last:border-0 hover:bg-slate-50/60">
                  <td className="max-w-[240px] truncate px-2.5 py-2 font-medium" title={i.station_name}>{i.station_name}</td>
                  <td className="px-2.5 py-2 text-slate-600">{i.brand_name ?? "-"}</td>
                  <td className="whitespace-nowrap px-2.5 py-2">{fmtDate(i.contract_start)} ~ {fmtDate(i.contract_end)}</td>
                  <td className="px-2.5 py-2 text-right tabular-nums">{fmtMoney(i.unit_monthly_rent)}</td>
                  <td className="px-2.5 py-2 text-right tabular-nums">{fmtNum(i.cabinets_count)}</td>
                  <td className="px-2.5 py-2 text-right"><Money v={i.annual_income} /></td>
                  <td className="px-2.5 py-2 text-right"><Money v={i.profit} strong /></td>
                  <td className="px-2.5 py-2">
                    <div className="flex justify-center gap-0.5">
                      <button className="rounded p-1 text-slate-400 hover:text-emerald-600" onClick={() => { setIncomeEdit(i); setIncomeFormOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
                      <button className="rounded p-1 text-slate-400 hover:text-rose-500" onClick={() => window.confirm("删除？") && delIncome.mutate(i.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {incomes.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-slate-400">暂无收款合同</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* 表单弹窗 */}
      <LeaseForm open={leaseFormOpen} onClose={() => { setLeaseFormOpen(false); setLeaseEdit(null); }} stationId={leaseEdit?.station_id ?? 0} record={leaseEdit} />
      <RentIncomeForm open={incomeFormOpen} onClose={() => { setIncomeFormOpen(false); setIncomeEdit(null); }} stationId={incomeEdit?.station_id ?? 0} record={incomeEdit} />
    </div>
  );
}
