import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { StatusBadge } from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/fields";
import { exportXlsx } from "@/lib/export";
import { fmtNum, fmtPct, fmtDateTime } from "@/lib/format";
import { Download, Search, Gauge, RefreshCw, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface AnomalyItem {
  stationName: string;
  meterNo: string;
  prevDaily: number;   // 前期日均用量
  lastDaily: number;    // 最近日均用量
  changePct: number;    // 变化百分比
  direction: "surge" | "drop";
}

export default function Meters() {
  const [keyword, setKeyword] = useState("");
  const readings = trpc.ledger.meterReadings.useQuery();
  const stations = trpc.ledger.stationBoard.useQuery();
  const utils = trpc.useUtils();
  const simulate = trpc.mut.simulateMeterPush.useMutation({
    onSuccess: (r) => { toast.success(`已模拟 ${r.count} 个电表上报`); utils.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const meterStations = useMemo(() => (stations.data ?? []).filter((st) => st.station.meterNo), [stations.data]);
  const rows = useMemo(() => (readings.data ?? []).filter((r) =>
    !keyword || r.reading.meterNo.includes(keyword) || r.stationName.includes(keyword),
  ), [readings.data, keyword]);

  // 每个电表最新一条
  const latestByMeter = useMemo(() => {
    const m = new Map<string, { reading: number; at: string }>();
    for (const r of rows) {
      if (!m.has(r.reading.meterNo)) m.set(r.reading.meterNo, { reading: Number(r.reading.reading), at: String(r.reading.readingAt) });
    }
    return m;
  }, [rows]);

  // ─── 用电量异常检测 ───
  const anomalies = useMemo(() => {
    const stationMap = new Map((stations.data ?? []).map((st) => [st.station.meterNo, st]));
    const byMeter = new Map<string, { reading: number; at: Date }[]>();
    for (const r of readings.data ?? []) {
      const readings_ = byMeter.get(r.reading.meterNo) ?? [];
      readings_.push({ reading: Number(r.reading.reading), at: new Date(r.reading.readingAt) });
      byMeter.set(r.reading.meterNo, readings_);
    }
    const result: AnomalyItem[] = [];
    for (const [meterNo, readings_] of byMeter) {
      if (readings_.length < 3) continue; // 至少3条才能算2个区间
      readings_.sort((a, b) => a.at.getTime() - b.at.getTime());
      const st = stationMap.get(meterNo);
      const ratio = Number(st?.station.transformerRatio ?? 1) || 1;

      const last = readings_.at(-1)!;
      const prev = readings_.at(-2)!;
      const prev2 = readings_.at(-3)!;

      const days1 = (last.at.getTime() - prev.at.getTime()) / 86400000;
      const days2 = (prev.at.getTime() - prev2.at.getTime()) / 86400000;
      if (days1 < 1 || days2 < 1) continue;

      // 实际用电 = 表码差 × 互感器倍数
      const usage1 = (last.reading - prev.reading) * ratio;
      const usage2 = (prev.reading - prev2.reading) * ratio;

      const daily1 = usage1 / days1; // 近期日均
      const daily2 = usage2 / days2; // 前期日均
      if (daily2 === 0) continue;

      const changePct = (daily1 - daily2) / daily2;

      // 阈值：±30% 以上视为异常
      if (changePct > 0.3) {
        result.push({ stationName: st?.station.name ?? meterNo, meterNo, prevDaily: daily2, lastDaily: daily1, changePct, direction: "surge" });
      } else if (changePct < -0.3) {
        result.push({ stationName: st?.station.name ?? meterNo, meterNo, prevDaily: daily2, lastDaily: daily1, changePct, direction: "drop" });
      }
    }
    return result;
  }, [readings.data, stations.data]);

  const surgeItems = anomalies.filter((a) => a.direction === "surge").sort((a, b) => b.changePct - a.changePct);
  const dropItems = anomalies.filter((a) => a.direction === "drop").sort((a, b) => a.changePct - b.changePct);

  const doExport = () => {
    if (rows.length === 0) { toast.error("暂无数据可导出"); return; }
    exportXlsx(`电表抄表记录_${new Date().toISOString().slice(0, 10)}`, [{
      name: "抄表记录",
      rows: rows.map((r) => ({
        站点: r.stationName, 电表编号: r.reading.meterNo, 表码: Number(r.reading.reading),
        抄表时间: fmtDateTime(r.reading.readingAt, ""), 来源: r.reading.source === "api" ? "电表API" : "手工",
      })),
    }]);
    toast.success("已导出 Excel");
  };

  return (
    <div className="space-y-4">
      {/* 异常检测 + 在线电表 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* 用电量异常检测 */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> 用电量异常检测
          </h3>

          {anomalies.length === 0 && (
            <div className="flex h-32 items-center justify-center text-xs text-slate-400">
              暂无足够数据进行分析（需至少 3 条抄表记录）
            </div>
          )}

          {/* 激增项 */}
          {surgeItems.length > 0 && (
            <div className="mb-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                <TrendingUp className="h-3.5 w-3.5" /> 用量激增
              </div>
              <div className="space-y-1.5">
                {surgeItems.map((item) => (
                  <div key={item.meterNo} className="flex items-center justify-between rounded-lg border border-rose-100 bg-rose-50/50 px-3 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-slate-700">{item.stationName}</span>
                      <span className="ml-2 text-slate-400">{item.meterNo}</span>
                    </div>
                    <div className="ml-3 flex items-baseline gap-3 text-right tabular-nums">
                      <span className="text-slate-500">
                        {fmtNum(Math.round(item.prevDaily))} → <b className="text-rose-600">{fmtNum(Math.round(item.lastDaily))}</b> 度/日
                      </span>
                      <span className="w-14 font-bold text-rose-600">+{fmtPct(Math.abs(item.changePct))}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 激减项 */}
          {dropItems.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-sky-600">
                <TrendingDown className="h-3.5 w-3.5" /> 用量激减
              </div>
              <div className="space-y-1.5">
                {dropItems.map((item) => (
                  <div key={item.meterNo} className="flex items-center justify-between rounded-lg border border-sky-100 bg-sky-50/50 px-3 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-slate-700">{item.stationName}</span>
                      <span className="ml-2 text-slate-400">{item.meterNo}</span>
                    </div>
                    <div className="ml-3 flex items-baseline gap-3 text-right tabular-nums">
                      <span className="text-slate-500">
                        {fmtNum(Math.round(item.prevDaily))} → <b className="text-sky-600">{fmtNum(Math.round(item.lastDaily))}</b> 度/日
                      </span>
                      <span className="w-14 font-bold text-sky-600">{fmtPct(item.changePct)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 在线电表 */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Gauge className="h-4 w-4 text-sky-500" /> 在线电表（{meterStations.length}）
            </h3>
            <Button size="sm" variant="outline" disabled={simulate.isPending} onClick={() => simulate.mutate()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />模拟一次全站上报
            </Button>
          </div>
          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {meterStations.map((st) => {
              const latest = latestByMeter.get(st.station.meterNo!);
              return (
                <div key={st.station.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                  <span className="font-medium text-slate-700">{st.station.name}</span>
                  <span className="text-slate-400">{st.station.meterNo}</span>
                  <span className="font-semibold text-sky-600 tabular-nums">{latest ? `${fmtNum(latest.reading)} 度` : "暂无数据"}</span>
                </div>
              );
            })}
            {meterStations.length === 0 && <div className="py-8 text-center text-xs text-slate-400">暂无配置电表编号的站点</div>}
          </div>
        </div>
      </div>

      {/* 抄表记录 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input className={`${inputCls} w-64 pl-8`} placeholder="搜索站点 / 电表编号…" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        </div>
        <Button variant="outline" className="ml-auto" onClick={doExport}><Download className="mr-1.5 h-4 w-4" />导出表格</Button>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full text-xs">
          <thead><tr className="border-b bg-slate-50">
            <th className="px-3 py-2.5 text-left font-medium text-slate-500">站点</th>
            <th className="px-3 py-2.5 text-left font-medium text-slate-500">电表编号</th>
            <th className="px-3 py-2.5 text-right font-medium text-slate-500">表码（度）</th>
            <th className="px-3 py-2.5 text-left font-medium text-slate-500">抄表时间</th>
            <th className="px-3 py-2.5 text-left font-medium text-slate-500">来源</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.reading.id} className="border-b last:border-0 hover:bg-slate-50/60">
                <td className="px-3 py-2.5 font-medium">{r.stationName}</td>
                <td className="px-3 py-2.5 text-slate-600 tabular-nums">{r.reading.meterNo}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{fmtNum(r.reading.reading)}</td>
                <td className="px-3 py-2.5 text-slate-600">{fmtDateTime(r.reading.readingAt)}</td>
                <td className="px-3 py-2.5"><StatusBadge status={r.reading.source} /></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="py-16 text-center text-slate-400">{readings.isLoading ? "加载中…" : "暂无抄表记录"}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
