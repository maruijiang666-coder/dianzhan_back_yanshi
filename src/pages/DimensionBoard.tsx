import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { StatCard, Money, StatusBadge } from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { exportXlsx } from "@/lib/export";
import { fmtMoney, fmtNum, fmtDate, fmtPct } from "@/lib/format";
import { Download, Building2, Zap, Home, TrendingUp, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type Kind = "brand" | "entity" | "landlord";
const KIND_LABEL: Record<Kind, string> = { brand: "品牌方", entity: "公司主体", landlord: "场地方" };

// ─── 公司主体展开详情 ───
function EntityExpandedDetail({ entityId }: { entityId: number }) {
  const detail = trpc.ledger.stationElecDetail.useQuery({ entityId });
  const rows = detail.data ?? [];

  const th = "px-2.5 py-1.5 text-left text-[11px] font-medium text-slate-500 whitespace-nowrap";
  const thR = "px-2.5 py-1.5 text-right text-[11px] font-medium text-slate-500 whitespace-nowrap";
  const td = "px-2.5 py-1.5 text-[11px]";
  const tdR = "px-2.5 py-1.5 text-right text-[11px] tabular-nums";

  if (detail.isLoading) return <div className="py-8 text-center text-sm text-slate-400">加载中…</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-slate-50">
            <th className={th}>站名</th>
            <th className={th}>电表编号</th>
            <th className={thR}>互感器倍数</th>
            <th className={th}>付款区间</th>
            <th className={thR}>起始读数</th>
            <th className={thR}>抄表读数</th>
            <th className={thR}>区间度数</th>
            <th className={thR}>付款单价</th>
            <th className={thR}>付款金额</th>
            <th className={th}>付款状态</th>
            <th className={th}>收款区间</th>
            <th className={thR}>收款单价</th>
            <th className={thR}>收款金额</th>
            <th className={th}>到账状态</th>
            <th className={thR}>电费利润</th>
            <th className={thR}>运营费用</th>
            <th className={thR}>扣费后利润</th>
            <th className={thR}>公司占股</th>
            <th className={thR}>公司净利润</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const e = r.latestElec;
            return (
              <tr key={r.station.id} className="border-b last:border-0 hover:bg-slate-50/60">
                <td className={`${td} font-medium`}>{r.station.name}</td>
                <td className={td}>{r.station.meterNo ?? "-"}</td>
                <td className={tdR}>{fmtNum(r.station.transformerRatio)}</td>
                {e ? (
                  <>
                    <td className={td}>{e.payStartDate && e.payEndDate ? `${fmtDate(e.payStartDate)} ~ ${fmtDate(e.payEndDate)}` : "-"}</td>
                    <td className={tdR}>{fmtNum(e.payStartReading)}</td>
                    <td className={tdR}>{fmtNum(e.payEndReading)}</td>
                    <td className={tdR}>{fmtNum(e.payKwh)}</td>
                    <td className={tdR}>{fmtNum(e.payUnitPrice)}</td>
                    <td className={tdR}><Money v={e.payAmount} /></td>
                    <td className={td}><StatusBadge status={e.payStatus} /></td>
                    <td className={td}>{e.collectStartDate && e.collectEndDate ? `${fmtDate(e.collectStartDate)} ~ ${fmtDate(e.collectEndDate)}` : "-"}</td>
                    <td className={tdR}>{fmtNum(e.collectUnitPrice)}</td>
                    <td className={tdR}><Money v={e.collectAmount} /></td>
                    <td className={td}><StatusBadge status={e.collectStatus} /></td>
                    <td className={tdR}><Money v={e.profit} strong /></td>
                    <td className={tdR}><Money v={e.opExpense} /></td>
                    <td className={tdR}><Money v={e.profitAfterOp} /></td>
                    <td className={tdR}>{fmtPct(e.companyShare)}</td>
                    <td className={tdR}><Money v={e.companyNetProfit} strong /></td>
                  </>
                ) : (
                  <td colSpan={15} className={`${td} text-center text-slate-400`}>暂无电费记录</td>
                )}
              </tr>
            );
          })}
          {rows.length === 0 && <tr><td colSpan={19} className="py-8 text-center text-slate-400">暂无站点数据</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ─── 品牌方展开详情（付款+收款）──
function BrandExpandedDetail({ brandId }: { brandId: number }) {
  const detail = trpc.ledger.brandDetail.useQuery({ brandId });
  const rows = detail.data ?? [];

  const th = "px-2 py-1.5 text-left text-[11px] font-medium text-slate-500 whitespace-nowrap";
  const thR = "px-2 py-1.5 text-right text-[11px] font-medium text-slate-500 whitespace-nowrap";
  const td = "px-2 py-1.5 text-[11px]";
  const tdR = "px-2 py-1.5 text-right text-[11px] tabular-nums";

  if (detail.isLoading) return <div className="py-8 text-center text-sm text-slate-400">加载中…</div>;

  const calcYears = (start: string | null, end: string | null) => {
    if (!start || !end) return "-";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const years = ms / (365.25 * 86400000);
    return years >= 1 ? `${years.toFixed(1)}年` : `${Math.round(years * 12)}个月`;
  };

  return (
    <div className="space-y-6">
      {/* ═══ 付款信息（公司→业主）═══ */}
      <div>
        <h4 className="mb-2 text-xs font-semibold text-rose-600">付款信息（公司 → 业主）</h4>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead><tr className="border-b bg-slate-50">
              <th className={th}>收款公司</th>
              <th className={thR}>占股</th>
              <th className={th}>站名</th>
              <th className={th}>站点号</th>
              <th className={thR}>充电柜</th>
              <th className={thR}>储电柜</th>
              <th className={th}>品牌方负责人</th>
              <th className={th}>合同租期</th>
              <th className={th}>合作年限</th>
              <th className={thR}>年租金成本</th>
              <th className={th}>付款方式</th>
              <th className={th}>付款情况</th>
              <th className={thR}>单台成本</th>
              <th className={th}>发票</th>
              <th className={thR}>押金</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => {
                const lease = r.leases[0]; // 主合同
                const cabNum = Number(r.station.cabinets ?? 0);
                const perCabCost = lease && cabNum > 0 ? Number(lease.annualRent ?? 0) / cabNum : null;
                return (
                  <tr key={r.station.id} className="border-b last:border-0 hover:bg-slate-50/60">
                    <td className={`${td} font-medium`}>{r.landlordName ?? "-"}</td>
                    <td className={tdR}>{fmtPct(r.station.companyShare)}</td>
                    <td className={td}>{r.station.name}</td>
                    <td className={td}>{r.station.code ?? "-"}</td>
                    <td className={tdR}>{fmtNum(r.station.cabinets)}</td>
                    <td className={tdR}>{fmtNum(r.station.storageCabinets)}</td>
                    <td className={td}>{r.brandContact ?? "-"}</td>
                    <td className={td}>{lease ? `${fmtDate(lease.contractStart)} ~ ${fmtDate(lease.contractEnd)}` : "-"}</td>
                    <td className={td}>{lease ? calcYears(lease.contractStart, lease.contractEnd) : "-"}</td>
                    <td className={tdR}>{lease ? <Money v={lease.annualRent} strong /> : "-"}</td>
                    <td className={td}>{lease?.payMethod ?? "-"}</td>
                    <td className={td}>{lease ? <StatusBadge status={lease.payStatus} /> : "-"}</td>
                    <td className={tdR}>{perCabCost !== null ? <Money v={perCabCost} /> : "-"}</td>
                    <td className={td}>{lease?.invoiceType ?? "-"}</td>
                    <td className={tdR}>{lease ? <Money v={lease.deposit} /> : "-"}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={15} className="py-6 text-center text-slate-400">暂无站点数据</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ 收款信息（品牌方→公司）═══ */}
      <div>
        <h4 className="mb-2 text-xs font-semibold text-emerald-600">收款信息（品牌方 → 公司）</h4>
        <div className="space-y-3">
          {rows.map((r) => (
            r.incomes.length > 0 && r.incomes.map((ic: any) => (
              <div key={ic.id} className="rounded-lg border">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-slate-50 px-3 py-1.5 text-[11px]">
                  <span className="font-medium">{r.station.name}</span>
                  <span>合同租期 <b>{fmtDate(ic.contractStart)} ~ {fmtDate(ic.contractEnd)}</b></span>
                  <span>签约状态 <b>{ic.signStatus ?? "-"}</b></span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b text-slate-400">
                      <th className={th}>期次</th>
                      <th className={th}>收款区间</th>
                      <th className={thR}>金额</th>
                      <th className={th}>到账</th>
                      <th className={thR}>单台月租</th>
                      <th className={thR}>柜数</th>
                      <th className={thR}>年收入(含税)</th>
                      <th className={thR}>税率</th>
                      <th className={thR}>年收入(净)</th>
                      <th className={thR}>进项成本</th>
                      <th className={thR}>租金利润</th>
                      <th className={thR}>分红金额</th>
                      <th className={thR}>分红后利润</th>
                    </tr></thead>
                    <tbody>
                      {ic.receipts.map((rc: any, idx: number) => (
                        <tr key={rc.id} className="border-b last:border-0">
                          <td className={td}>第 {fmtNum(rc.seq)} 次</td>
                          <td className={td}>{fmtDate(rc.periodStart)} ~ {fmtDate(rc.periodEnd)}</td>
                          <td className={tdR}><Money v={rc.amount} /></td>
                          <td className={td}><StatusBadge status={rc.status} /></td>
                          {idx === 0 ? (
                            <>
                              <td className={tdR} rowSpan={ic.receipts.length || 1}><Money v={ic.unitMonthlyRent} /></td>
                              <td className={tdR} rowSpan={ic.receipts.length || 1}>{fmtNum(ic.cabinetsCount)}</td>
                              <td className={tdR} rowSpan={ic.receipts.length || 1}><Money v={ic.annualIncome} /></td>
                              <td className={tdR} rowSpan={ic.receipts.length || 1}>{fmtPct(ic.taxRate)}</td>
                              <td className={tdR} rowSpan={ic.receipts.length || 1}><Money v={ic.annualIncomeNet} /></td>
                              <td className={tdR} rowSpan={ic.receipts.length || 1}><Money v={ic.inputCost} /></td>
                              <td className={tdR} rowSpan={ic.receipts.length || 1}><Money v={ic.profit} strong /></td>
                              <td className={tdR} rowSpan={ic.receipts.length || 1}><Money v={ic.dividendAmount} /></td>
                              <td className={tdR} rowSpan={ic.receipts.length || 1}><Money v={ic.profitAfterDividend} strong /></td>
                            </>
                          ) : null}
                        </tr>
                      ))}
                      {ic.receipts.length === 0 && (
                        <tr>
                          <td colSpan={4} className={`${td} text-center text-slate-400`}>暂无分期收款</td>
                          <td className={tdR}><Money v={ic.unitMonthlyRent} /></td>
                          <td className={tdR}>{fmtNum(ic.cabinetsCount)}</td>
                          <td className={tdR}><Money v={ic.annualIncome} /></td>
                          <td className={tdR}>{fmtPct(ic.taxRate)}</td>
                          <td className={tdR}><Money v={ic.annualIncomeNet} /></td>
                          <td className={tdR}><Money v={ic.inputCost} /></td>
                          <td className={tdR}><Money v={ic.profit} strong /></td>
                          <td className={tdR}><Money v={ic.dividendAmount} /></td>
                          <td className={tdR}><Money v={ic.profitAfterDividend} strong /></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          ))}
          {rows.every((r) => r.incomes.length === 0) && (
            <div className="rounded-lg border border-dashed py-6 text-center text-xs text-slate-400">暂无收款合同</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 场地方展开详情（支出明细）──
function LandlordExpandedDetail({ landlordId }: { landlordId: number }) {
  const detail = trpc.ledger.landlordDetail.useQuery({ landlordId });
  const rows = detail.data ?? [];

  const th = "px-2 py-1.5 text-left text-[11px] font-medium text-slate-500 whitespace-nowrap";
  const thR = "px-2 py-1.5 text-right text-[11px] font-medium text-slate-500 whitespace-nowrap";
  const td = "px-2 py-1.5 text-[11px]";
  const tdR = "px-2 py-1.5 text-right text-[11px] tabular-nums";

  if (detail.isLoading) return <div className="py-8 text-center text-sm text-slate-400">加载中…</div>;

  const today = new Date();
  const countdown = (end: string | null) => {
    if (!end) return null;
    const days = Math.ceil((new Date(end).getTime() - today.getTime()) / 86400000);
    return days;
  };

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-xs">
        <thead><tr className="border-b bg-slate-50">
          <th className={th}>站名</th>
          <th className={th}>站点号</th>
          <th className={th}>电表编号</th>
          <th className={thR}>充电柜</th>
          <th className={thR}>储电柜</th>
          <th className={th}>场地合同签收</th>
          <th className={th}>场地合同到期</th>
          <th className={th}>合同倒计时</th>
          <th className={th}>场地费付款方式</th>
          <th className={thR}>年租金</th>
          <th className={th}>场地费付款情况</th>
          <th className={th}>电费付款方式</th>
          <th className={thR}>电费付款单价</th>
          <th className={thR}>上期抄表</th>
          <th className={thR}>本期抄表</th>
          <th className={thR}>区间度数</th>
          <th className={thR}>电费金额</th>
          <th className={th}>电费付款情况</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => {
            const lease = r.lease;
            const elec = r.latestElec;
            const days = lease ? countdown(lease.contractEnd) : null;
            const countdownText = days === null ? "-" : days < 0 ? "已到期" : days <= 30 ? `${days}天(紧急)` : days <= 90 ? `${days}天(临期)` : `${days}天`;
            const countdownColor = days === null ? "text-slate-400" : days < 0 ? "text-rose-600 font-semibold" : days <= 30 ? "text-rose-600 font-semibold" : days <= 90 ? "text-amber-600" : "text-slate-600";
            return (
              <tr key={r.station.id} className="border-b last:border-0 hover:bg-slate-50/60">
                <td className={`${td} font-medium`}>{r.station.name}</td>
                <td className={td}>{r.station.code ?? "-"}</td>
                <td className={td}>{r.station.meterNo ?? "-"}</td>
                <td className={tdR}>{fmtNum(r.station.cabinets)}</td>
                <td className={tdR}>{fmtNum(r.station.storageCabinets)}</td>
                <td className={td}>{lease ? fmtDate(lease.contractStart) : "-"}</td>
                <td className={td}>{lease ? fmtDate(lease.contractEnd) : "-"}</td>
                <td className={`${td} ${countdownColor}`}>{countdownText}</td>
                <td className={td}>{lease?.payMethod ?? "-"}</td>
                <td className={tdR}>{lease ? <Money v={lease.annualRent} strong /> : "-"}</td>
                <td className={td}>{lease ? <StatusBadge status={lease.payStatus} /> : "-"}</td>
                <td className={td}>月付</td>
                <td className={tdR}>{elec ? <Money v={elec.payUnitPrice} /> : "-"}</td>
                <td className={tdR}>{elec ? `${fmtNum(elec.payStartReading)} (${fmtDate(elec.payStartDate)})` : "-"}</td>
                <td className={tdR}>{elec ? `${fmtNum(elec.payEndReading)} (${fmtDate(elec.payEndDate)})` : "-"}</td>
                <td className={tdR}>{elec ? fmtNum(elec.payKwh) : "-"}</td>
                <td className={tdR}>{elec ? <Money v={elec.payAmount} /> : "-"}</td>
                <td className={td}>{elec ? <StatusBadge status={elec.payStatus} /> : "-"}</td>
              </tr>
            );
          })}
          {rows.length === 0 && <tr><td colSpan={18} className="py-6 text-center text-slate-400">暂无站点数据</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default function DimensionBoard({ kind }: { kind: Kind }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const query = kind === "brand"
    ? trpc.ledger.brandBoard.useQuery()
    : kind === "entity"
      ? trpc.ledger.entityBoard.useQuery()
      : trpc.ledger.landlordBoard.useQuery();
  const rows = useMemo(() => query.data ?? [], [query.data]);

  const totals = useMemo(() => rows.reduce(
    (t, r) => ({
      stationCount: t.stationCount + r.stationCount, elecPay: t.elecPay + r.elecPay, elecCollect: t.elecCollect + r.elecCollect,
      elecProfit: t.elecProfit + r.elecProfit, rentCost: t.rentCost + r.rentCost, rentIncome: t.rentIncome + r.rentIncome,
      rentProfit: t.rentProfit + r.rentProfit, totalProfit: t.totalProfit + r.totalProfit,
    }),
    { stationCount: 0, elecPay: 0, elecCollect: 0, elecProfit: 0, rentCost: 0, rentIncome: 0, rentProfit: 0, totalProfit: 0 },
  ), [rows]);

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const doExport = () => {
    if (rows.length === 0) { toast.error("暂无数据可导出"); return; }
    const label = KIND_LABEL[kind];
    exportXlsx(`${label}看板_${new Date().toISOString().slice(0, 10)}`, [{
      name: `${label}看板`,
      rows: rows.map((r) => ({
        [label]: r.name, 站点数: r.stationCount,
        电费付款: r.elecPay, 电费收款: r.elecCollect, 电费利润: r.elecProfit,
        电费待付款: r.elecUnpaid, 电费待收款: r.elecUncollected,
        年租金成本: r.rentCost, 年租金收入: r.rentIncome, 租金利润: r.rentProfit,
        租金待收款: r.rentUncollected, 总利润: r.totalProfit,
      })),
    }]);
    toast.success("已导出 Excel");
  };

  const th = "px-3 py-2.5 text-left text-xs font-medium text-slate-500 whitespace-nowrap";
  const thR = "px-3 py-2.5 text-right text-xs font-medium text-slate-500 whitespace-nowrap";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={`${KIND_LABEL[kind]}数量`} value={`${rows.length}`} sub={`覆盖站点 ${totals.stationCount} 个`} icon={Building2} tone="blue" />
        <StatCard label="电费差价利润（元）" value={fmtMoney(totals.elecProfit)} icon={Zap} />
        <StatCard label="场租差价利润（元）" value={fmtMoney(totals.rentProfit)} icon={Home} />
        <StatCard label="总利润（元）" value={fmtMoney(totals.totalProfit)} icon={TrendingUp} tone="green" />
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={doExport}><Download className="mr-1.5 h-4 w-4" />导出表格</Button>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[1250px] text-sm">
          <thead><tr className="border-b bg-slate-50">
            <th className="w-8 px-1 py-2.5"></th>
            <th className={th}>{KIND_LABEL[kind]}</th>
            <th className={thR}>站点数</th>
            <th className={thR}>电费付款</th><th className={thR}>电费收款</th><th className={thR}>电费利润</th>
            <th className={thR}>电费待付</th><th className={thR}>电费待收</th>
            <th className={thR}>年租金成本</th><th className={thR}>年租金收入</th><th className={thR}>租金利润</th>
            <th className={thR}>租金待收</th><th className={thR}>总利润</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => {
              const isExpanded = expandedId === r.id;
              return (
                <>
                  <tr key={r.id} className={`cursor-pointer border-b hover:bg-emerald-50/40 ${isExpanded ? "bg-emerald-50/60" : ""}`}
                    onClick={() => toggleExpand(r.id)}>
                    <td className="px-1 py-2.5 text-center">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-300" />}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-800">{r.name}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.stationCount}</td>
                    <td className="px-3 py-2.5 text-right"><Money v={r.elecPay} /></td>
                    <td className="px-3 py-2.5 text-right"><Money v={r.elecCollect} /></td>
                    <td className="px-3 py-2.5 text-right"><Money v={r.elecProfit} strong /></td>
                    <td className="px-3 py-2.5 text-right text-rose-600"><Money v={r.elecUnpaid} /></td>
                    <td className="px-3 py-2.5 text-right text-amber-600"><Money v={r.elecUncollected} /></td>
                    <td className="px-3 py-2.5 text-right"><Money v={r.rentCost} /></td>
                    <td className="px-3 py-2.5 text-right"><Money v={r.rentIncome} /></td>
                    <td className="px-3 py-2.5 text-right"><Money v={r.rentProfit} strong /></td>
                    <td className="px-3 py-2.5 text-right text-amber-600"><Money v={r.rentUncollected} /></td>
                    <td className="px-3 py-2.5 text-right"><Money v={r.totalProfit} strong /></td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${r.id}-expanded`}>
                      <td colSpan={13} className="border-b bg-white px-6 py-4">
                        {kind === "entity" ? (
                          <EntityExpandedDetail entityId={r.id} />
                        ) : kind === "brand" ? (
                          <BrandExpandedDetail brandId={r.id} />
                        ) : (
                          <LandlordExpandedDetail landlordId={r.id} />
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={13} className="py-16 text-center text-slate-400">{query.isLoading ? "加载中…" : "暂无数据"}</td></tr>}
          </tbody>
          {rows.length > 0 && (
            <tfoot><tr className="border-t bg-emerald-50/50 text-xs font-semibold text-slate-700">
              <td className="px-3 py-2.5" colSpan={2}>合计</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{totals.stationCount}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.elecPay)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.elecCollect)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.elecProfit)}</td>
              <td colSpan={2}></td>
              <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.rentCost)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.rentIncome)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.rentProfit)}</td>
              <td></td>
              <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.totalProfit)}</td>
            </tr></tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
