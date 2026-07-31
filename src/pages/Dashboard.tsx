import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getOverview } from "@/api/overview";
import { listContracts } from "@/api/contracts";
import { StatCard } from "@/components/Stat";
import { EnergyOrb } from "@/components/EnergyOrb";
import { fmtMoney, fmtNum } from "@/lib/format";
import { Building2, Zap, Home, TrendingUp, AlertTriangle, FileWarning, Wallet, Clock, Users, Tag, Landmark, MapPin } from "lucide-react";
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
  const { data, isLoading } = useQuery({ queryKey: ["overview"], queryFn: getOverview });
  const contracts = useQuery({ queryKey: ["contracts"], queryFn: () => listContracts() });
  const [range, setRange] = useState<RangeKey>("month");

  if (isLoading || !data) return <div className="py-20 text-center text-slate-400">数据加载中…</div>;

  const expiring = (contracts.data ?? []).filter((c: any) => c.status === "临期" || c.status === "已到期");

  const monthly = data.monthly ?? [];
  const latestMonth = monthly[monthly.length - 1];
  const monthKwh = latestMonth ? latestMonth.elecCollect / 1.2 : 0;

  const current = range === "month"
    ? { label: latestMonth?.period ?? "", kwh: monthKwh }
    : range === "quarter"
    ? { label: "本季度", kwh: monthKwh * 3 }
    : { label: "本年度", kwh: monthly.reduce((s: number, m: any) => s + m.elecCollect / 1.2, 0) };

  const rangeLabel = range === "month" ? "月度总电量" : range === "quarter" ? "季度总电量" : "年度总电量";

  const totalProfit = data.elecProfit + data.rentIncomeTotal - data.rentCostTotal - data.opExpenseTotal;

  return (
    <div className="space-y-6">
      {/* 电量消耗 */}
      <div className="relative overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_top_left,#312e81_0%,#1e1b4b_45%,#0b0620_100%)] shadow-xl">
        <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-10 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="relative grid items-center lg:grid-cols-2">
          <div className="px-6 pt-4">
            <EnergyOrb kwh={current?.kwh ?? 0} label={current?.label ?? ""} />
          </div>
          <div className="px-8 pb-8 pt-6 text-white lg:pl-2">
            <div className="text-xs font-medium tracking-widest text-violet-300/80">总电量消耗 · {rangeLabel}</div>
            <div className="mt-1.5 flex items-end gap-3">
              <span className="text-4xl font-black tabular-nums">{current ? fmtNum(current.kwh) : "-"}</span>
              <span className="pb-1 text-sm text-violet-200/80">度</span>
            </div>
            <div className="mt-1 text-xs text-violet-300/60">{current?.label} · 数据来自电费台账收款侧</div>
            <div className="mt-5 inline-flex rounded-full bg-white/10 p-1 backdrop-blur">
              {RANGE_TABS.map((t) => (
                <button key={t.key} onClick={() => setRange(t.key)}
                  className={`rounded-full px-6 py-1.5 text-sm font-medium transition-all ${range === t.key ? "bg-white text-indigo-900 shadow" : "text-violet-200 hover:text-white"}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="mt-6 h-28">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} barCategoryGap="30%">
                  <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#c4b5fd" }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "rgba(255,255,255,0.06)" }} contentStyle={{ background: "#1e1b4b", border: "1px solid #4c1d95", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#c4b5fd" }} formatter={(v: any) => [`${fmtNum(v)} 元`, "电费收款"]} />
                  <Bar dataKey="elecCollect" radius={[4, 4, 0, 0]}>
                    {monthly.map((m: any, i: number) => (<Cell key={m.period} fill={i === monthly.length - 1 ? "#a78bfa" : "#4c3d8f"} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* 核心指标 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="站点总数" value={`${data.stationCount}`} sub={`运营中 ${data.activeStations} · 电表 ${data.meterCount}`} icon={Building2} tone="blue" />
        <StatCard label="净利润（元）" value={fmtMoney(totalProfit)} sub="电费+租金-运营费用" icon={TrendingUp} tone="green" />
        <StatCard label="电费差价利润（元）" value={fmtMoney(data.elecProfit)} sub={`收款 ${fmtMoney(data.elecCollect)} / 付款 ${fmtMoney(data.elecPay)}`} icon={Zap} />
        <StatCard label="场租差价利润（元）" value={fmtMoney(data.rentIncomeTotal - data.rentCostTotal)} sub={`收入 ${fmtMoney(data.rentIncomeTotal)} / 成本 ${fmtMoney(data.rentCostTotal)}`} icon={Home} />
      </div>

      {/* 费用与预警 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="运营费用（元）" value={fmtMoney(data.opExpenseTotal)} icon={Wallet} />
        <StatCard label="待收款项（元）" value={fmtMoney(data.elecUncollected + data.rentUncollected)} sub={`电费 ${fmtMoney(data.elecUncollected)} · 租金 ${fmtMoney(data.rentUncollected)}`} icon={Clock} tone="amber" />
        <StatCard label="待付款项（元）" value={fmtMoney(data.elecUnpaid)} icon={Wallet} tone="red" />
        <StatCard label="合同预警" value={`${data.expiringContracts + data.expiredContracts}`} sub={`临期 ${data.expiringContracts} · 已到期 ${data.expiredContracts}`} icon={FileWarning} tone="red" />
      </div>

      {/* 维度看板入口 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Link to="/brands" className="rounded-xl border bg-white p-4 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/30">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2"><Tag className="h-5 w-5 text-blue-600" /></div>
            <div>
              <div className="text-sm font-semibold text-slate-700">品牌方看板</div>
              <div className="text-xs text-slate-400">{data.brandCount} 个品牌方</div>
            </div>
          </div>
        </Link>
        <Link to="/entities" className="rounded-xl border bg-white p-4 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/30">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2"><Landmark className="h-5 w-5 text-purple-600" /></div>
            <div>
              <div className="text-sm font-semibold text-slate-700">公司主体看板</div>
              <div className="text-xs text-slate-400">{data.entityCount} 个主体</div>
            </div>
          </div>
        </Link>
        <Link to="/landlords" className="rounded-xl border bg-white p-4 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/30">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2"><MapPin className="h-5 w-5 text-amber-600" /></div>
            <div>
              <div className="text-sm font-semibold text-slate-700">场地方看板</div>
              <div className="text-xs text-slate-400">{data.landlordCount} 个场地方</div>
            </div>
          </div>
        </Link>
        <Link to="/shareholders" className="rounded-xl border bg-white p-4 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/30">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 p-2"><Users className="h-5 w-5 text-emerald-600" /></div>
            <div>
              <div className="text-sm font-semibold text-slate-700">股东分红</div>
              <div className="text-xs text-slate-400">{data.shareholderCount} 个股东 · {data.introducerCount} 个介绍人</div>
            </div>
          </div>
        </Link>
      </div>

      {/* 图表与预警 */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 shadow-sm lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">电费收付月度趋势</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v: number) => `${(v / 10000).toFixed(0)}万`} />
                <Tooltip formatter={(v: any) => fmtMoney(v)} />
                <Legend />
                <Bar dataKey="elecCollect" name="电费收款" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="elecPay" name="电费付款" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="elecProfit" name="电费利润" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
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
            {expiring.map((c: any) => (
              <div key={c.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700">{c.station_name}</span>
                  <span className={`text-[11px] font-semibold ${c.status === "已到期" ? "text-rose-600" : "text-amber-600"}`}>
                    {c.status === "已到期" ? `已逾期 ${-c.days_left} 天` : `剩 ${c.days_left} 天`}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  {c.brand_name ?? "未关联品牌"} · 合作方 {c.partner ?? "-"} · 至 {c.end_date ?? "-"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
