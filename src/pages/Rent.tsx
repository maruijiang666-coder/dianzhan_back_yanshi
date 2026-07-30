import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { Money, StatusBadge } from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/fields";
import { exportXlsx } from "@/lib/export";
import { fmtMoney, fmtNum, fmtDate } from "@/lib/format";
import { Download } from "lucide-react";
import { toast } from "sonner";

export default function Rent() {
  const [brandId, setBrandId] = useState("");
  const brands = trpc.ledger.brands.useQuery();
  const rent = trpc.ledger.rent.useQuery(brandId ? { brandId: Number(brandId) } : undefined);

  const leases = useMemo(() => rent.data?.leases ?? [], [rent.data]);
  const incomes = useMemo(() => rent.data?.incomes ?? [], [rent.data]);

  const leaseTotal = leases.reduce((t, l) => t + Number(l.lease.annualRent ?? 0), 0);
  const incomeTotal = incomes.reduce((t, i) => t + Number(i.income.annualIncome ?? 0), 0);
  const profitTotal = incomes.reduce((t, i) => t + Number(i.income.profit ?? 0), 0);

  const doExport = () => {
    if (leases.length === 0 && incomes.length === 0) { toast.error("暂无数据可导出"); return; }
    exportXlsx(`场地租金台账_${new Date().toISOString().slice(0, 10)}`, [
      {
        name: "租金付款合同",
        rows: leases.map((l) => ({
          站点: l.stationName, 区域: l.region ?? "", 品牌方: l.brandName ?? "", 公司主体: l.entityName ?? "", 场地方: l.landlordName ?? "",
          合同开始: fmtDate(l.lease.contractStart, ""), 合同结束: fmtDate(l.lease.contractEnd, ""),
          年租金成本: fmtNum(l.lease.annualRent, ""), 付款方式: l.lease.payMethod ?? "",
          每期付款金额: fmtNum(l.lease.payAmount, ""), 押金: fmtNum(l.lease.deposit, ""),
          付款截止时间: fmtDate(l.lease.payDeadline, ""), 付款情况: l.lease.payStatus,
          发票: l.lease.invoiceType ?? "", 备注: l.lease.remark ?? "",
        })),
      },
      {
        name: "租金收款合同",
        rows: incomes.flatMap((i) => {
          const base = {
            站点: i.stationName, 品牌方: i.brandName ?? "", 收款合同开始: fmtDate(i.income.contractStart, ""),
            收款合同结束: fmtDate(i.income.contractEnd, ""), 单柜月租金含税: fmtNum(i.income.unitMonthlyRent, ""),
            计费柜数: fmtNum(i.income.cabinetsCount, ""), 年租金收入含税: fmtNum(i.income.annualIncome, ""),
            月租金: fmtNum(i.income.monthlyRent, ""), 税率: i.income.taxRate ?? "",
            年收入不含税: fmtNum(i.income.annualIncomeNet, ""), 进项成本: fmtNum(i.income.inputCost, ""),
            租金利润: fmtNum(i.income.profit, ""), 分红金额: fmtNum(i.income.dividendAmount, ""),
            分红后利润: fmtNum(i.income.profitAfterDividend, ""), 签约开票到账: i.income.signStatus ?? "",
          };
          if (i.receipts.length === 0) return [{ ...base, 分期: "", 收款区间: "", 收款金额: "", 到账情况: "" }];
          return i.receipts.map((rc) => ({
            ...base, 分期: `第${fmtNum(rc.seq)}次`, 收款区间: `${fmtDate(rc.periodStart, "")}~${fmtDate(rc.periodEnd, "")}`,
            收款金额: fmtNum(rc.amount, ""), 到账情况: rc.status,
          }));
        }),
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
          {(brands.data ?? []).map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
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
        <h3 className="mb-2 text-sm font-semibold text-rose-600">租金付款合同（公司 → 业主，共 {leases.length} 份）</h3>
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="w-full min-w-[1100px] text-xs">
            <thead><tr className="border-b bg-slate-50">
              <th className={th}>站点</th><th className={th}>品牌方</th><th className={th}>场地方</th><th className={th}>合同租期</th>
              <th className={thR}>年租金成本</th><th className={th}>付款方式</th><th className={thR}>每期金额</th><th className={thR}>押金</th>
              <th className={th}>付款截止</th><th className={th}>付款情况</th>
            </tr></thead>
            <tbody>
              {leases.map((l) => (
                <tr key={l.lease.id} className="border-b last:border-0 hover:bg-slate-50/60">
                  <td className="max-w-[240px] truncate px-2.5 py-2 font-medium" title={l.stationName}>{l.stationName}</td>
                  <td className="px-2.5 py-2 text-slate-600">{l.brandName ?? "-"}</td>
                  <td className="px-2.5 py-2 text-slate-600">{l.landlordName ?? "-"}</td>
                  <td className="whitespace-nowrap px-2.5 py-2">{fmtDate(l.lease.contractStart)} ~ {fmtDate(l.lease.contractEnd)}</td>
                  <td className="px-2.5 py-2 text-right"><Money v={l.lease.annualRent} strong /></td>
                  <td className="px-2.5 py-2">{l.lease.payMethod ?? "-"}</td>
                  <td className="px-2.5 py-2 text-right"><Money v={l.lease.payAmount} /></td>
                  <td className="px-2.5 py-2 text-right"><Money v={l.lease.deposit} /></td>
                  <td className="px-2.5 py-2">{fmtDate(l.lease.payDeadline)}</td>
                  <td className="px-2.5 py-2"><StatusBadge status={l.lease.payStatus} /></td>
                </tr>
              ))}
              {leases.length === 0 && <tr><td colSpan={10} className="py-10 text-center text-slate-400">暂无付款合同</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* 收款合同 */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-emerald-600">租金收款合同（品牌方 → 公司，共 {incomes.length} 份）</h3>
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="w-full min-w-[1300px] text-xs">
            <thead><tr className="border-b bg-slate-50">
              <th className={th}>站点</th><th className={th}>品牌方</th><th className={th}>收款租期</th>
              <th className={thR}>单柜月租</th><th className={thR}>柜数</th><th className={thR}>年收入(含税)</th><th className={thR}>年收入(不含税)</th>
              <th className={thR}>进项成本</th><th className={thR}>租金利润</th><th className={thR}>分红后利润</th>
              <th className={th}>分期到账</th>
            </tr></thead>
            <tbody>
              {incomes.map((i) => {
                const received = i.receipts.filter((r) => r.status === "已到账").length;
                return (
                  <tr key={i.income.id} className="border-b last:border-0 hover:bg-slate-50/60">
                    <td className="max-w-[240px] truncate px-2.5 py-2 font-medium" title={i.stationName}>{i.stationName}</td>
                    <td className="px-2.5 py-2 text-slate-600">{i.brandName ?? "-"}</td>
                    <td className="whitespace-nowrap px-2.5 py-2">{fmtDate(i.income.contractStart)} ~ {fmtDate(i.income.contractEnd)}</td>
                    <td className="px-2.5 py-2 text-right tabular-nums">{fmtMoney(i.income.unitMonthlyRent)}</td>
                    <td className="px-2.5 py-2 text-right tabular-nums">{fmtNum(i.income.cabinetsCount)}</td>
                    <td className="px-2.5 py-2 text-right"><Money v={i.income.annualIncome} /></td>
                    <td className="px-2.5 py-2 text-right"><Money v={i.income.annualIncomeNet} /></td>
                    <td className="px-2.5 py-2 text-right"><Money v={i.income.inputCost} /></td>
                    <td className="px-2.5 py-2 text-right"><Money v={i.income.profit} strong /></td>
                    <td className="px-2.5 py-2 text-right"><Money v={i.income.profitAfterDividend} /></td>
                    <td className="px-2.5 py-2">
                      {i.receipts.length === 0 ? <span className="text-slate-300">-</span> : (
                        <span className="flex flex-wrap gap-1">
                          {i.receipts.map((rc) => (
                            <span key={rc.id} title={`${fmtDate(rc.periodStart)}~${fmtDate(rc.periodEnd)} ${fmtMoney(rc.amount)}元`}>
                              <StatusBadge status={rc.status} />
                            </span>
                          ))}
                          <span className="text-[11px] text-slate-400">{received}/{i.receipts.length}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {incomes.length === 0 && <tr><td colSpan={11} className="py-10 text-center text-slate-400">暂无收款合同</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
