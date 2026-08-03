import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStationBoard } from "@/api/overview";
import { getStationMeterView } from "@/api/stations";
import { listBrands } from "@/api/directory";
import { Money, StatusBadge } from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/fields";
import { StationForm } from "@/components/StationForm";
import { MonthPicker } from "@/components/MonthPicker";
import { exportXlsx } from "@/lib/export";
import { fmtMoney, fmtNum, fmtPct, fmtDate } from "@/lib/format";
import { Download, Plus, Search, ChevronDown, ChevronRight, MapPin, Gauge, ArrowLeft, Zap, Battery, Receipt, TrendingUp, Home } from "lucide-react";
import { toast } from "sonner";

// ─── 信息行 ───
function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-center gap-1">
      <span className="shrink-0 text-slate-400">{label}：</span>
      <span className="font-medium text-slate-700">{value ?? "-"}</span>
    </div>
  );
}

// ─── 区块卡片 ───
function SectionCard({ icon: Icon, title, color, children }: { icon: any; title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white">
      <div className={`flex items-center gap-1.5 border-b px-3 py-1.5 ${color}`}>
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-semibold">{title}</span>
      </div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}

// ─── 站点电表详情 ───
function StationMeterDetail({ stationId, period, onBack }: { stationId: number; period: string; onBack: () => void }) {
  const { data: mv, isLoading } = useQuery({
    queryKey: ["stationMeterView", stationId, period],
    queryFn: () => getStationMeterView(stationId, period),
  });

  if (isLoading) return <div className="py-10 text-center text-slate-400">加载中…</div>;
  if (!mv) return <div className="py-10 text-center text-slate-400">加载失败</div>;

  const s = mv.summary || {};

  return (
    <div className="space-y-3">
      {/* 返回按钮 + 站点名 */}
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-600 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          返回站点列表
        </button>
        <span className="text-sm font-semibold text-slate-800">{mv.stationName}</span>
        <span className="text-xs text-slate-400">· {period}</span>
      </div>

      {/* 站点汇总数据 */}
      {s.totalKwh != null && (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-white px-3 py-2">
            <div className="text-[10px] text-slate-400">总度数</div>
            <div className="text-sm font-semibold tabular-nums">{fmtNum(s.totalKwh)} <span className="text-[10px] font-normal text-slate-400">度</span></div>
          </div>
          <div className="rounded-lg border bg-white px-3 py-2">
            <div className="text-[10px] text-slate-400">总电费成本</div>
            <div className="text-sm font-semibold tabular-nums text-rose-600">{fmtMoney(s.totalPayAmount)}</div>
          </div>
          <div className="rounded-lg border bg-white px-3 py-2">
            <div className="text-[10px] text-slate-400">总电费收入</div>
            <div className="text-sm font-semibold tabular-nums text-emerald-600">{fmtMoney(s.totalCollectNet)}</div>
          </div>
          <div className="rounded-lg border bg-white px-3 py-2">
            <div className="text-[10px] text-slate-400">总电费利润</div>
            <div className={`text-sm font-semibold tabular-nums ${s.totalElecProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtMoney(s.totalElecProfit)}</div>
          </div>
        </div>
      )}

      {mv.brandGroups && mv.brandGroups.length === 0 && (
        <div className="rounded-lg border border-dashed py-8 text-center text-sm text-slate-400">
          暂无电表数据，请先在「电表管理」中添加电表
        </div>
      )}

      {mv.brandGroups && mv.brandGroups.map((group: any) => (
        <div key={group.brandName} className="space-y-2.5">
          {/* 品牌分隔 */}
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="shrink-0 text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1 rounded-full border">
              {group.brandName}
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {group.meters.map((meter: any) => (
            <div key={meter.meterId} className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
              {/* 电表标题 */}
              <div className="flex items-center gap-2 bg-white border-b px-4 py-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-semibold text-slate-800">
                  {meter.meterNo || meter.meterName || `电表#${meter.meterId}`}
                </span>
                {meter.meterName && meter.meterNo && (
                  <span className="text-xs text-slate-400">({meter.meterName})</span>
                )}
              </div>

              <div className="p-3 space-y-2">
                {/* 1. 站点配置 */}
                <SectionCard icon={Battery} title="站点配置" color="text-violet-600 bg-violet-50 border-violet-100">
                  <div className="grid grid-cols-3 gap-x-6 gap-y-1 text-xs">
                    <InfoRow label="电表品牌" value={meter.brandName} />
                    <InfoRow label="柜子数量" value={`${meter.cabinetCount} 个`} />
                    <InfoRow label="柜子编号" value={meter.cabinetNos} />
                  </div>
                </SectionCard>

                {/* 2. 电费付款情况 */}
                <SectionCard icon={Zap} title="电费付款情况" color="text-amber-600 bg-amber-50 border-amber-100">
                  <div className="grid grid-cols-4 gap-x-6 gap-y-1.5 text-xs">
                    <InfoRow label="电表编号" value={meter.meterNo} />
                    <InfoRow label="上月抄表度数" value={meter.prevEndReading != null ? fmtNum(meter.prevEndReading) : "-"} />
                    <InfoRow label="本月抄表度数" value={meter.endReading != null ? fmtNum(meter.endReading) : "-"} />
                    <InfoRow label="付款度数" value={meter.payKwh != null ? fmtNum(meter.payKwh) : "-"} />
                    <InfoRow label="付款单价" value={meter.payUnitPrice != null ? `${fmtNum(meter.payUnitPrice)} 元/度` : "-"} />
                    <InfoRow label="付款金额" value={meter.payAmount != null ? <Money v={meter.payAmount} /> : "-"} />
                    <div className="flex items-center gap-1">
                      <span className="shrink-0 text-slate-400">电费付款情况：</span>
                      {meter.payStatus ? <StatusBadge status={meter.payStatus} /> : <span className="text-slate-300">-</span>}
                    </div>
                  </div>
                </SectionCard>

                {/* 3. 电费收款情况 */}
                <SectionCard icon={Receipt} title="电费收款情况" color="text-emerald-600 bg-emerald-50 border-emerald-100">
                  <div className="grid grid-cols-4 gap-x-6 gap-y-1.5 text-xs">
                    <InfoRow
                      label="电费收款区间"
                      value={
                        meter.collectStartDate && meter.collectEndDate
                          ? `${fmtDate(meter.collectStartDate)} ~ ${fmtDate(meter.collectEndDate)}`
                          : "-"
                      }
                    />
                    <InfoRow label="收款度数" value={meter.payKwh != null ? fmtNum(meter.payKwh) : "-"} />
                    <InfoRow label="电费收款单价" value={meter.collectUnitPrice != null ? `${fmtNum(meter.collectUnitPrice)} 元/度` : "-"} />
                    {meter.taxEnabled && meter.postTaxPrice != null && (
                      <InfoRow label="税后单价" value={<span className="text-emerald-600 font-medium">{fmtNum(meter.postTaxPrice)} 元/度</span>} />
                    )}
                    <InfoRow label="电费收入（含税）" value={meter.collectAmount != null ? <Money v={meter.collectAmount} /> : "-"} />
                    <div className="flex items-center gap-1">
                      <span className="shrink-0 text-slate-400">电费收款情况：</span>
                      {meter.collectStatus ? <StatusBadge status={meter.collectStatus} /> : <span className="text-slate-300">-</span>}
                    </div>
                  </div>
                </SectionCard>

                {/* 4. 电费利润明细 */}
                <SectionCard icon={TrendingUp} title="电费利润明细" color="text-blue-600 bg-blue-50 border-blue-100">
                  <div className="grid grid-cols-3 gap-x-6 gap-y-1 text-xs">
                    <InfoRow label="税率" value={meter.taxEnabled && meter.taxRate != null ? `${(meter.taxRate * 100).toFixed(1)}%` : "-"} />
                    <InfoRow label="收入单价（不含税）" value={meter.postTaxPrice != null ? `${fmtNum(meter.postTaxPrice)} 元/度` : "-"} />
                    <InfoRow label="电费收入（不含税）" value={meter.collectNet != null ? <Money v={meter.collectNet} /> : "-"} />
                  </div>
                </SectionCard>

                {/* 5. 场地租金付款情况（来自合同） */}
                {mv.contractRent && mv.contractRent.cost && mv.contractRent.cost.length > 0 && (
                  <SectionCard icon={Home} title="场地租金付款情况" color="text-orange-600 bg-orange-50 border-orange-100">
                    <div className="space-y-2">
                      {mv.contractRent.cost.map((c: any) => (
                        <div key={c.id} className="grid grid-cols-4 gap-x-6 gap-y-1 text-xs">
                          <InfoRow label="场地方" value={c.partner || "-"} />
                          <InfoRow label="年租金" value={c.annualRent != null ? <Money v={c.annualRent} /> : "-"} />
                          <InfoRow label="月租金" value={c.monthlyRent != null ? <Money v={c.monthlyRent} /> : "-"} />
                          <InfoRow label="付款方式" value={c.payMethod || "-"} />
                          <InfoRow label="合同期限" value={c.startDate && c.endDate ? `${c.startDate} ~ ${c.endDate}` : "-"} />
                          <div className="flex items-center gap-1">
                            <span className="shrink-0 text-slate-400">付款状态：</span>
                            {c.payStatus ? <StatusBadge status={c.payStatus} /> : <span className="text-slate-300">-</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}

                {/* 5.6 品牌方租金收款情况（来自合同） */}
                {mv.contractRent && mv.contractRent.income && mv.contractRent.income.length > 0 && (
                  <SectionCard icon={Home} title="品牌方租金收款情况" color="text-emerald-600 bg-emerald-50 border-emerald-100">
                    <div className="space-y-2">
                      {mv.contractRent.income.map((c: any) => (
                        <div key={c.id} className="grid grid-cols-4 gap-x-6 gap-y-1 text-xs">
                          <InfoRow label="品牌方" value={c.brandName || "-"} />
                          <InfoRow label="年租金" value={c.annualRent != null ? <Money v={c.annualRent} /> : "-"} />
                          <InfoRow label="月租金" value={c.monthlyRent != null ? <Money v={c.monthlyRent} /> : "-"} />
                          <InfoRow label="付款方式" value={c.payMethod || "-"} />
                          <InfoRow label="合同期限" value={c.startDate && c.endDate ? `${c.startDate} ~ ${c.endDate}` : "-"} />
                          <div className="flex items-center gap-1">
                            <span className="shrink-0 text-slate-400">收款状态：</span>
                            {c.payStatus ? <StatusBadge status={c.payStatus} /> : <span className="text-slate-300">-</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}

                {/* 6. 用电量趋势 */}
                {(meter.dailyEnergy?.length > 0 || meter.monthlyEnergy?.length > 0) && (
                  <SectionCard icon={Zap} title="用电量数据" color="text-teal-600 bg-teal-50 border-teal-100">
                    <div className="space-y-3">
                      {/* 日用电量 */}
                      {meter.dailyEnergy && meter.dailyEnergy.length > 0 && (
                        <div>
                          <div className="mb-1 text-[11px] font-semibold text-slate-500">本月日用电量</div>
                          <div className="grid grid-cols-7 gap-0.5">
                            {meter.dailyEnergy.map((d: any) => (
                              <div key={d.day_date} className="rounded bg-white border px-1 py-0.5 text-center">
                                <div className="text-[10px] text-slate-400">{d.day_date.slice(6, 8)}日</div>
                                <div className="text-[11px] font-medium text-slate-700">{fmtNum(d.kwh)}</div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-1 text-right text-[11px] text-slate-500">
                            月累计：<b>{fmtNum(meter.dailyEnergy.reduce((s: number, d: any) => s + Number(d.kwh || 0), 0))}</b> 度
                          </div>
                        </div>
                      )}
                      {/* 月用电量 */}
                      {meter.monthlyEnergy && meter.monthlyEnergy.length > 0 && (
                        <div>
                          <div className="mb-1 text-[11px] font-semibold text-slate-500">近6个月用电量</div>
                          <div className="flex gap-1">
                            {meter.monthlyEnergy.slice(0, 6).reverse().map((m: any) => (
                              <div key={m.month_period} className="flex-1 rounded bg-white border px-1 py-1 text-center">
                                <div className="text-[10px] text-slate-400">{m.month_period.slice(4)}月</div>
                                <div className="text-[11px] font-medium text-slate-700">{fmtNum(m.kwh)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </SectionCard>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── 展开行详情组件 ───
function ExpandedDetail({ landlordId, meters, stations, period, summary }: { landlordId: number; meters: any[]; stations: any[]; period: string; summary?: any }) {
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);

  // 如果选了站点，显示站点详情
  if (selectedStationId !== null) {
    return <StationMeterDetail stationId={selectedStationId} period={period} onBack={() => setSelectedStationId(null)} />;
  }

  const toggleMetric = (key: string) => {
    setExpandedMetric(prev => prev === key ? null : key);
  };

  const breakdown = summary?.stationBreakdown || [];
  const contractBreakdown = summary?.contractBreakdown || [];

  return (
    <div className="space-y-4 text-sm">
      {/* 场地总览 */}
      {summary && (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
            <button onClick={() => toggleMetric("kwh")} className={`rounded-lg border bg-white px-3 py-2 text-left transition-colors hover:border-emerald-400 ${expandedMetric === "kwh" ? "border-emerald-500 ring-1 ring-emerald-500" : ""}`}>
              <div className="text-[10px] text-slate-400">总度数</div>
              <div className="text-sm font-semibold tabular-nums">{fmtNum(summary.totalKwh || 0)} <span className="text-[10px] font-normal text-slate-400">度</span></div>
            </button>
            <button onClick={() => toggleMetric("elecPay")} className={`rounded-lg border bg-white px-3 py-2 text-left transition-colors hover:border-emerald-400 ${expandedMetric === "elecPay" ? "border-emerald-500 ring-1 ring-emerald-500" : ""}`}>
              <div className="text-[10px] text-slate-400">电费成本</div>
              <div className="text-sm font-semibold tabular-nums text-rose-600">{fmtMoney(summary.elecPay)}</div>
            </button>
            <button onClick={() => toggleMetric("elecCollect")} className={`rounded-lg border bg-white px-3 py-2 text-left transition-colors hover:border-emerald-400 ${expandedMetric === "elecCollect" ? "border-emerald-500 ring-1 ring-emerald-500" : ""}`}>
              <div className="text-[10px] text-slate-400">电费收入</div>
              <div className="text-sm font-semibold tabular-nums text-emerald-600">{fmtMoney(summary.elecCollect)}</div>
            </button>
            <button onClick={() => toggleMetric("elecProfit")} className={`rounded-lg border bg-white px-3 py-2 text-left transition-colors hover:border-emerald-400 ${expandedMetric === "elecProfit" ? "border-emerald-500 ring-1 ring-emerald-500" : ""}`}>
              <div className="text-[10px] text-slate-400">电费利润</div>
              <div className={`text-sm font-semibold tabular-nums ${summary.elecProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtMoney(summary.elecProfit)}</div>
            </button>
            <button onClick={() => toggleMetric("rentCost")} className={`rounded-lg border bg-white px-3 py-2 text-left transition-colors hover:border-emerald-400 ${expandedMetric === "rentCost" ? "border-emerald-500 ring-1 ring-emerald-500" : ""}`}>
              <div className="text-[10px] text-slate-400">场地成本</div>
              <div className="text-sm font-semibold tabular-nums text-rose-600">{fmtMoney(summary.rentCost)}</div>
            </button>
            <button onClick={() => toggleMetric("rentProfit")} className={`rounded-lg border bg-white px-3 py-2 text-left transition-colors hover:border-emerald-400 ${expandedMetric === "rentProfit" ? "border-emerald-500 ring-1 ring-emerald-500" : ""}`}>
              <div className="text-[10px] text-slate-400">场地利润</div>
              <div className={`text-sm font-semibold tabular-nums ${summary.rentProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtMoney(summary.rentProfit)}</div>
            </button>
          </div>

          {/* 场地成本/利润拆分详情 */}
          {expandedMetric === "rentCost" && contractBreakdown.filter((c: any) => c.type === "场地合同").length > 0 && (
            <div className="rounded-lg border bg-white p-3">
              <div className="mb-2 text-xs font-semibold text-slate-600">场地成本构成</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="px-2.5 py-1.5 text-left font-medium text-slate-500">场地方</th>
                    <th className="px-2.5 py-1.5 text-right font-medium text-slate-500">场地月租金</th>
                    <th className="px-2.5 py-1.5 text-right font-medium text-slate-500">电费单价</th>
                  </tr>
                </thead>
                <tbody>
                  {contractBreakdown.filter((c: any) => c.type === "场地合同").map((c: any) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="px-2.5 py-1.5 font-medium">{c.partner || "-"}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums text-rose-600">{c.monthlyRent ? fmtMoney(c.monthlyRent) : "-"}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{c.elecPrice ? `${fmtNum(c.elecPrice)} 元/度` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {expandedMetric === "rentProfit" && contractBreakdown.length > 0 && (
            <div className="rounded-lg border bg-white p-3">
              <div className="mb-2 text-xs font-semibold text-slate-600">场地利润构成</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="px-2.5 py-1.5 text-left font-medium text-slate-500">合同类型</th>
                    <th className="px-2.5 py-1.5 text-left font-medium text-slate-500">合作方/品牌方</th>
                    <th className="px-2.5 py-1.5 text-right font-medium text-slate-500">场地月租金</th>
                  </tr>
                </thead>
                <tbody>
                  {contractBreakdown.map((c: any) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="px-2.5 py-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] ${c.type === "场地合同" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {c.type}
                        </span>
                      </td>
                      <td className="px-2.5 py-1.5 font-medium">{c.partner || "-"}</td>
                      <td className={`px-2.5 py-1.5 text-right tabular-nums ${c.type === "场地合同" ? "text-rose-600" : "text-emerald-600"}`}>{c.monthlyRent ? fmtMoney(c.monthlyRent) : "-"}</td>
                    </tr>
                  ))}
                  <tr className="border-t bg-slate-50 font-medium">
                    <td colSpan={2} className="px-2.5 py-1.5">场地利润</td>
                    <td className={`px-2.5 py-1.5 text-right tabular-nums ${(summary?.rentProfit || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtMoney(summary?.rentProfit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {expandedMetric && expandedMetric !== "rentCost" && expandedMetric !== "rentProfit" && breakdown.length > 0 && (

            <div className="rounded-lg border bg-white p-3">
              <div className="mb-2 text-xs font-semibold text-slate-600">
                {expandedMetric === "kwh" && "各站点用电量"}
                {expandedMetric === "elecPay" && "各站点电费成本"}
                {expandedMetric === "elecCollect" && "各站点电费收入"}
                {expandedMetric === "elecProfit" && "各站点电费利润"}
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="px-2.5 py-1.5 text-left font-medium text-slate-500">站点</th>
                    <th className="px-2.5 py-1.5 text-right font-medium text-slate-500">电表数</th>
                    <th className="px-2.5 py-1.5 text-right font-medium text-slate-500">用电量（度）</th>
                    {(expandedMetric === "elecPay" || expandedMetric === "elecProfit") && (
                      <th className="px-2.5 py-1.5 text-right font-medium text-slate-500">电费成本</th>
                    )}
                    {(expandedMetric === "elecCollect" || expandedMetric === "elecProfit") && (
                      <th className="px-2.5 py-1.5 text-right font-medium text-slate-500">电费收入</th>
                    )}
                    {expandedMetric === "elecProfit" && (
                      <th className="px-2.5 py-1.5 text-right font-medium text-slate-500">电费利润</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((sb: any) => (
                    <tr key={sb.station_id} className="border-b last:border-0">
                      <td className="px-2.5 py-1.5 font-medium">{sb.station_name || "未分配站点"}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{sb.meter_count}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{fmtNum(sb.kwh)}</td>
                      {(expandedMetric === "elecPay" || expandedMetric === "elecProfit") && (
                        <td className="px-2.5 py-1.5 text-right tabular-nums text-rose-600">{fmtMoney(sb.elecPay)}</td>
                      )}
                      {(expandedMetric === "elecCollect" || expandedMetric === "elecProfit") && (
                        <td className="px-2.5 py-1.5 text-right tabular-nums text-emerald-600">{fmtMoney(sb.elecCollect)}</td>
                      )}
                      {expandedMetric === "elecProfit" && (
                        <td className={`px-2.5 py-1.5 text-right tabular-nums font-medium ${sb.elecProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtMoney(sb.elecProfit)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* 站点列表 */}
      {stations.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-xs font-semibold text-slate-700">站点（{stations.length} 个）</h4>
          <div className="flex flex-wrap gap-2">
            {stations.map((s: any) => (
              <button
                key={s.id}
                onClick={() => setSelectedStationId(s.id)}
                className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-left text-xs hover:border-emerald-400 hover:bg-emerald-50 transition-colors"
              >
                <div>
                  <div className="font-medium text-slate-800">{s.name}</div>
                  <div className="text-[11px] text-slate-400">占股 {fmtPct(s.company_share)} · {s.status}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

// ─── 主页面 ───
export default function Stations() {
  const [keyword, setKeyword] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const brands = useQuery({ queryKey: ["brands"], queryFn: listBrands });
  const board = useQuery({
    queryKey: ["stationBoard", keyword, selectedMonth],
    queryFn: () => getStationBoard({ keyword: keyword || undefined, period: selectedMonth }),
  });

  const rows = useMemo(() => board.data ?? [], [board.data]);
  const totals = useMemo(() => rows.reduce(
    (t: any, r: any) => ({
      elecPay: t.elecPay + r.elecPay, elecCollect: t.elecCollect + r.elecCollect, elecProfit: t.elecProfit + r.elecProfit,
      rentCost: t.rentCost + r.rentCost, rentIncome: t.rentIncome + r.rentIncome, rentProfit: t.rentProfit + r.rentProfit,
      opExpense: t.opExpense + r.opExpense,
      totalProfit: t.totalProfit + r.totalProfit,
    }),
    { elecPay: 0, elecCollect: 0, elecProfit: 0, rentCost: 0, rentIncome: 0, rentProfit: 0, opExpense: 0, totalProfit: 0 },
  ), [rows]);

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const doExport = () => {
    if (rows.length === 0) { toast.error("暂无数据可导出"); return; }
    exportXlsx(`站点数据看板_${selectedMonth}`, [{
      name: "站点看板",
      rows: rows.map((r: any) => ({
        场地方: r.landlord.name, 联系人: r.landlord.contact ?? "", 电话: r.landlord.phone ?? "",
        电表数: r.meterCount, 站点数: r.stationCount,
        电费付款: r.elecPay, 电费收款: r.elecCollect, 电费利润: r.elecProfit,
        租金成本: r.rentCost, 租金收入: r.rentIncome, 租金利润: r.rentProfit,
        运营费用: r.opExpense, 总利润: r.totalProfit,
      })),
    }]);
    toast.success("已导出 Excel");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input className={`${inputCls} w-56 pl-8`} placeholder="搜索场地方名称…" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        </div>
        <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={doExport}><Download className="mr-1.5 h-4 w-4" />导出表格</Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
              <th className="w-8 px-1 py-2.5"></th>
              <th className="px-3 py-2.5 font-medium">场地方</th>
              <th className="px-3 py-2.5 text-center font-medium">电表数</th>
              <th className="px-3 py-2.5 text-right font-medium">电费付款</th>
              <th className="px-3 py-2.5 text-right font-medium">电费收款</th>
              <th className="px-3 py-2.5 text-right font-medium">电费利润</th>
              <th className="px-3 py-2.5 text-right font-medium">租金成本</th>
              <th className="px-3 py-2.5 text-right font-medium">租金收入</th>
              <th className="px-3 py-2.5 text-right font-medium">运营费用</th>
              <th className="px-3 py-2.5 text-right font-medium">总利润</th>
              <th className="px-3 py-2.5 text-center font-medium">合同</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => {
              const isExpanded = expandedId === r.landlord.id;
              return (
                <Fragment key={r.landlord.id}>
                  <tr className={`border-b hover:bg-slate-50/60 cursor-pointer ${isExpanded ? "bg-slate-50/80" : ""}`} onClick={() => toggleExpand(r.landlord.id)}>
                    <td className="px-1 py-2.5 text-center">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-300" />}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-emerald-600" />
                        <div>
                          <div className="font-medium text-slate-800">{r.landlord.name}</div>
                          <div className="text-[11px] text-slate-400">
                            {r.landlord.contact ? `联系人：${r.landlord.contact}` : ""}
                            {r.landlord.phone ? ` · ${r.landlord.phone}` : ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Gauge className="h-3.5 w-3.5 text-slate-400" />
                        <span className="tabular-nums">{r.meterCount}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right"><Money v={r.elecPay} /></td>
                    <td className="px-3 py-2.5 text-right"><Money v={r.elecCollect} /></td>
                    <td className="px-3 py-2.5 text-right"><Money v={r.elecProfit} strong /></td>
                    <td className="px-3 py-2.5 text-right"><Money v={r.rentCost} /></td>
                    <td className="px-3 py-2.5 text-right"><Money v={r.rentIncome} /></td>
                    <td className="px-3 py-2.5 text-right"><Money v={r.opExpense} /></td>
                    <td className="px-3 py-2.5 text-right"><Money v={r.totalProfit} strong /></td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="text-xs">
                        <span className="text-slate-500">{r.contractCount} 份</span>
                        {r.expiredContracts > 0 && <span className="ml-1 text-rose-600">({r.expiredContracts}到期)</span>}
                        {r.expiringContracts > 0 && <span className="ml-1 text-amber-600">({r.expiringContracts}临期)</span>}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${r.landlord.id}-expanded`}>
                      <td colSpan={11} className="border-b bg-white px-6 py-4">
                        <ExpandedDetail landlordId={r.landlord.id} meters={r.meters} stations={r.stations} period={selectedMonth} summary={{ totalKwh: r.totalKwh, elecPay: r.elecPay, elecCollect: r.elecCollect, elecProfit: r.elecProfit, rentCost: r.rentCost, rentIncome: r.rentIncome, rentProfit: r.rentProfit, stationBreakdown: r.stationBreakdown, contractBreakdown: r.contractBreakdown }} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={11} className="py-16 text-center text-slate-400">{board.isLoading ? "加载中…" : "暂无站点数据"}</td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t bg-emerald-50/50 text-xs font-semibold text-slate-700">
                <td className="px-3 py-2.5" colSpan={2}>合计（{rows.length} 个场地方）</td>
                <td className="px-3 py-2.5 text-center tabular-nums">{rows.reduce((t: number, r: any) => t + r.meterCount, 0)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.elecPay)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.elecCollect)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.elecProfit)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.rentCost)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.rentIncome)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.opExpense)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.totalProfit)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <StationForm open={formOpen} onClose={() => setFormOpen(false)} record={editing} />
    </div>
  );
}
