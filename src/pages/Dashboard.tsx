import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { StatCard } from "@/components/Stat";
import { EnergyOrb } from "@/components/EnergyOrb";
import { fmtMoney, fmtNum } from "@/lib/format";
import { Building2, Zap, Home, TrendingUp, AlertTriangle, FileWarning, Wallet, Clock } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Cell,
} from "recharts";
import { Link } from "react-router";

type RangeKey = "month" | "quarter" | "year";
const RANGE_TABS: { key: RangeKey; label: string }[] = [
  { key: "month", label: "月" },
  { key: "quarter", label: "季" },
  { key: "year", label: "年" },
];

export default function Dashboard() {
  const { data, isLoading } = trpc.ledger.overview.useQuery();
  const contracts = trpc.ledger.contracts.useQuery();
  const kwh = trpc.ledger.kwhSummary.useQuery();
  const [range, setRange] = useState<RangeKey>("month");

  if (isLoading || !data) return <div className="py-20 text-center text-slate-400">数据加载中…</div>;

  const expiring = (contracts.data ?? []).filter((c) => c.status === "临期" || c.status === "已到期");
  const kwhInfo = kwh.data;
  const current = kwhInfo ? kwhInfo[range] : null;
  const rangeLabel = range === "month" ? "月度总电量" : range === "quarter" ? "季度总电量" : "年度总电量";

  return (
    <div className="space-y-6">
      {/* ═══ 悬浮玻璃球 · 电量消耗 ═══ */}
      <div className="relative overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_top_left,#312e81_0%,#1e1b4b_45%,#0b0620_100%)] shadow-xl">
        <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-10 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="relative grid items-center lg:grid-cols-2">
          {/* 左：悬浮球 */}
          <div className="px-6 pt-4">
            <EnergyOrb kwh={current?.kwh ?? 0} label={current?.label ?? ""} />
          </div>
          {/* 右：切换 + 趋势 */}
          <div className="px-8 pb-8 pt-6 text-white lg:pl-2">
            <div className="text-xs font-medium tracking-widest text-violet-300/80">总电量消耗 · {rangeLabel}</div>
            <div className="mt-1.5 flex items-end gap-3">
              <span className="text-4xl font-black tabular-nums">{current ? fmtNum(current.kwh) : "-"}</span>
              <span className="pb-1 text-sm text-violet-200/80">度</span>
            </div>
            <div className="mt-1 text-xs text-violet-300/60">
              {current?.label} · 数据来自电费台账收款侧区间度数
            </div>

            {/* 月/季/年 切换 */}
            <div className="mt-5 inline-flex rounded-full bg-white/10 p-1 backdrop-blur">
              {RANGE_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setRange(t.key)}
                  className={`rounded-full px-6 py-1.5 text-sm font-medium transition-all ${
                    range === t.key
                      ? "bg-white text-indigo-900 shadow"
                      : "text-violet-200 hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* 月度电量迷你趋势 */}
            <div className="mt-6 h-28">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kwhInfo?.monthly ?? []} barCategoryGap="30%">
                  <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#c4b5fd" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.06)" }}
                    contentStyle={{ background: "#1e1b4b", border: "1px solid #4c1d95", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#c4b5fd" }}
                    formatter={(v) => [`${fmtNum(v)} 度`, "电量"]}
                  />
                  <Bar dataKey="kwh" radius={[4, 4, 0, 0]}>
                    {(kwhInfo?.monthly ?? []).map((m) => (
                      <Cell key={m.period} fill={m.period === kwhInfo?.month.label ? "#a78bfa" : "#4c3d8f"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="站点总数" value={`${data.stationCount}`} sub={`运营中 ${data.activeStations}`} icon={Building2} tone="blue" />
        <StatCard label="累计总利润（元）" value={fmtMoney(data.totalProfit)} sub="电费差价 + 场租差价" icon={TrendingUp} tone="green" />
        <StatCard label="电费差价利润（元）" value={fmtMoney(data.elecProfit)} sub={`收款 ${fmtMoney(data.elecCollect)} / 付款 ${fmtMoney(data.elecPay)}`} icon={Zap} />
        <StatCard label="场租差价利润（元）" value={fmtMoney(data.rentProfit)} sub={`年收入 ${fmtMoney(data.rentIncomeTotal)} / 年成本 ${fmtMoney(data.rentCostTotal)}`} icon={Home} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="电费待付款（元）" value={fmtMoney(data.elecUnpaid)} icon={Wallet} tone="red" />
        <StatCard label="电费待收款（元）" value={fmtMoney(data.elecUncollected)} icon={Clock} tone="amber" />
        <StatCard label="租金待收款（元）" value={fmtMoney(data.rentUncollected)} icon={Home} tone="amber" />
        <StatCard label="合同预警" value={`${data.expiringContracts + data.expiredContracts}`} sub={`临期 ${data.expiringContracts} · 已到期 ${data.expiredContracts} / 共 ${data.contractCount}`} icon={FileWarning} tone="red" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 shadow-sm lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">电费收付月度趋势</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v: number) => `${(v / 10000).toFixed(0)}万`} />
                <Tooltip formatter={(v) => fmtMoney(v)} />
                <Legend />
                <Bar dataKey="collect" name="电费收款" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pay" name="电费付款" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="电费利润" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> 合同到期预警
            </h3>
            <Link to="/contracts" className="text-xs text-emerald-600 hover:underline">全部合同 →</Link>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {expiring.length === 0 && <div className="py-10 text-center text-xs text-slate-400">暂无临期或到期合同</div>}
            {expiring.map((c) => (
              <div key={c.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700">{c.stationName}</span>
                  <span className={`text-[11px] font-semibold ${c.status === "已到期" ? "text-rose-600" : "text-amber-600"}`}>
                    {c.status === "已到期" ? `已逾期 ${-c.daysLeft!} 天` : `剩 ${c.daysLeft} 天`}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  {c.brandName ?? "未关联品牌"} · 合作方 {c.partner ?? "-"} · 至 {c.endDate ?? "-"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
