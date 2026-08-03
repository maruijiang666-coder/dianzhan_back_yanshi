import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listBrands } from "@/api/directory";
import { listContracts } from "@/api/contracts";
import { listMeters } from "@/api/meters";
import { listCabinets } from "@/api/cabinets";
import { StatusBadge } from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/fields";
import { exportXlsx } from "@/lib/export";
import { fmtMoney, fmtNum, fmtDate } from "@/lib/format";
import { Download, Search, ChevronDown, ChevronRight, Zap, FileText, Box, DollarSign } from "lucide-react";
import { toast } from "sonner";

export default function Brands() {
  const [keyword, setKeyword] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const brands = useQuery({ queryKey: ["brands"], queryFn: listBrands });
  const contracts = useQuery({ queryKey: ["contracts"], queryFn: () => listContracts() });
  const meters = useQuery({ queryKey: ["meters"], queryFn: () => listMeters() });
  const cabinets = useQuery({ queryKey: ["allCabinets"], queryFn: () => listCabinets() });

  const brandData = useMemo(() => {
    const brandList = brands.data ?? [];
    const contractList = contracts.data ?? [];
    const meterList = meters.data ?? [];
    const cabinetList = cabinets.data ?? [];

    return brandList
      .filter((b: any) => !keyword || b.name?.includes(keyword))
      .map((brand: any) => {
        // 该品牌的合同
        const brandContracts = contractList.filter((c: any) => c.brand_id === brand.id && c.contract_type === "品牌方合同");

        // 该品牌的电表
        const brandMeters = meterList.filter((m: any) => m.brand_id === brand.id);
        const meterIds = new Set(brandMeters.map((m: any) => m.id));

        // 该品牌电表下的柜子
        const brandCabinets = cabinetList.filter((c: any) => meterIds.has(c.meter_id));

        // 汇总数据
        const totalMonthlyRent = brandContracts.reduce((sum: number, c: any) => sum + (Number(c.monthly_rent) || 0), 0);
        const totalAnnualRent = brandContracts.reduce((sum: number, c: any) => sum + (Number(c.rent_amount) || 0), 0);
        const electricityPrice = brandContracts[0]?.electricity_price ? Number(brandContracts[0].electricity_price) : null;
        const postTaxPrice = brandContracts[0]?.post_tax_electricity_price ? Number(brandContracts[0].post_tax_electricity_price) : null;
        const taxEnabled = brandContracts[0]?.tax_enabled || false;
        const taxRate = brandContracts[0]?.tax_rate ? Number(brandContracts[0].tax_rate) : null;

        return {
          ...brand,
          contracts: brandContracts,
          meters: brandMeters,
          cabinets: brandCabinets,
          meterCount: brandMeters.length,
          cabinetCount: brandCabinets.length,
          contractCount: brandContracts.length,
          totalMonthlyRent,
          totalAnnualRent,
          electricityPrice,
          postTaxPrice,
          taxEnabled,
          taxRate,
        };
      });
  }, [brands.data, contracts.data, meters.data, cabinets.data, keyword]);

  const toggleExpand = (id: number) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const doExport = () => {
    if (brandData.length === 0) { toast.error("暂无数据可导出"); return; }
    exportXlsx(`品牌方管理_${new Date().toISOString().slice(0, 10)}`, [{
      name: "品牌方管理",
      rows: brandData.map((b: any) => ({
        品牌名称: b.name,
        联系人: b.contact ?? "",
        电表数: b.meterCount,
        柜子数: b.cabinetCount,
        合同数: b.contractCount,
        电费单价: b.electricityPrice ?? "",
        场地月租金: b.totalMonthlyRent,
        场地年租金: b.totalAnnualRent,
        备注: b.remark ?? "",
      })),
    }]);
    toast.success("已导出 Excel");
  };

  const th = "px-3 py-2 text-left text-xs font-medium text-slate-500";

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input className={`${inputCls} w-56 pl-8`} placeholder="搜索品牌名称…" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={doExport}><Download className="mr-1.5 h-4 w-4" />导出表格</Button>
        </div>
      </div>

      {/* 品牌列表 */}
      <div className="space-y-4">
        {brandData.map((brand: any) => {
          const isExpanded = expandedId === brand.id;

          return (
            <div key={brand.id} className="rounded-xl border bg-white shadow-sm">
              {/* 品牌头部 */}
              <div
                className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-slate-50/60"
                onClick={() => toggleExpand(brand.id)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-300" />}
                  <div>
                    <div className="font-semibold text-slate-800">{brand.name}</div>
                    {brand.contact && <div className="text-xs text-slate-400">联系人：{brand.contact}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-6 text-xs">
                  <div className="flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    <span className="tabular-nums">{brand.meterCount}</span> 电表
                  </div>
                  <div className="flex items-center gap-1">
                    <Box className="h-3.5 w-3.5 text-violet-500" />
                    <span className="tabular-nums">{brand.cabinetCount}</span> 柜子
                  </div>
                  <div className="flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="tabular-nums">{brand.contractCount}</span> 合同
                  </div>
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5 text-rose-500" />
                    月租 <span className="tabular-nums font-medium">{fmtMoney(brand.totalMonthlyRent)}</span>
                  </div>
                </div>
              </div>

              {/* 展开内容 */}
              {isExpanded && (
                <div className="border-t px-5 py-4 space-y-4">
                  {/* 汇总数据 */}
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                    <div className="rounded-lg border bg-slate-50 px-3 py-2">
                      <div className="text-[10px] text-slate-400">电表数量</div>
                      <div className="text-lg font-semibold tabular-nums">{brand.meterCount}</div>
                    </div>
                    <div className="rounded-lg border bg-slate-50 px-3 py-2">
                      <div className="text-[10px] text-slate-400">柜子数量</div>
                      <div className="text-lg font-semibold tabular-nums">{brand.cabinetCount}</div>
                    </div>
                    <div className="rounded-lg border bg-slate-50 px-3 py-2">
                      <div className="text-[10px] text-slate-400">电费单价（税前）</div>
                      <div className="text-lg font-semibold tabular-nums">{brand.electricityPrice ? `${fmtNum(brand.electricityPrice)} 元/度` : "-"}</div>
                    </div>
                    {brand.taxEnabled && brand.postTaxPrice && (
                      <div className="rounded-lg border bg-emerald-50 px-3 py-2">
                        <div className="text-[10px] text-emerald-600">电费单价（税后）</div>
                        <div className="text-lg font-semibold tabular-nums text-emerald-700">{fmtNum(brand.postTaxPrice)} 元/度</div>
                      </div>
                    )}
                    <div className="rounded-lg border bg-slate-50 px-3 py-2">
                      <div className="text-[10px] text-slate-400">场地月租金</div>
                      <div className="text-lg font-semibold tabular-nums">{fmtMoney(brand.totalMonthlyRent)}</div>
                    </div>
                  </div>

                  {/* 合同列表 */}
                  {brand.contracts.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-xs font-semibold text-slate-600">合同（{brand.contracts.length} 份）</h4>
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b bg-slate-50">
                              <th className={th}>关联场地</th>
                              <th className={th}>电费单价</th>
                              <th className={th}>计费柜数</th>
                              <th className={th}>场地月租金</th>
                              <th className={th}>付款方式</th>
                              <th className={th}>合同期限</th>
                              <th className={th}>状态</th>
                            </tr>
                          </thead>
                          <tbody>
                            {brand.contracts.map((c: any) => (
                              <tr key={c.id} className="border-b last:border-0">
                                <td className="px-3 py-2 font-medium">{c.landlord_name ?? "-"}</td>
                                <td className="px-3 py-2 tabular-nums">{c.electricity_price ? `${fmtNum(c.electricity_price)} 元/度` : "-"}</td>
                                <td className="px-3 py-2 tabular-nums">{c.cabinets_count ?? "-"}</td>
                                <td className="px-3 py-2 tabular-nums">{c.monthly_rent ? fmtMoney(c.monthly_rent) : "-"}</td>
                                <td className="px-3 py-2">{c.pay_method ?? "-"}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{fmtDate(c.start_date)} ~ {fmtDate(c.end_date)}</td>
                                <td className="px-3 py-2"><StatusBadge status={c.status} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 电表列表 */}
                  {brand.meters.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-xs font-semibold text-slate-600">电表（{brand.meters.length} 块）</h4>
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b bg-slate-50">
                              <th className={th}>电表编号</th>
                              <th className={th}>电表名称</th>
                              <th className={th}>场地方</th>
                              <th className={th}>站点</th>
                              <th className={th}>柜子数</th>
                              <th className={th}>状态</th>
                            </tr>
                          </thead>
                          <tbody>
                            {brand.meters.map((m: any) => {
                              const meterCabinets = brand.cabinets.filter((c: any) => c.meter_id === m.id);
                              return (
                                <tr key={m.id} className="border-b last:border-0">
                                  <td className="px-3 py-2 font-mono font-medium">{m.meter_no}</td>
                                  <td className="px-3 py-2">{m.meter_name ?? "-"}</td>
                                  <td className="px-3 py-2">{m.landlord_name ?? "-"}</td>
                                  <td className="px-3 py-2">{m.station_name ?? "-"}</td>
                                  <td className="px-3 py-2 tabular-nums">{meterCabinets.length}</td>
                                  <td className="px-3 py-2"><StatusBadge status={m.status} /></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {brand.meters.length === 0 && brand.contracts.length === 0 && (
                    <div className="py-6 text-center text-sm text-slate-400">
                      暂无关联数据
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {brandData.length === 0 && (
          <div className="rounded-xl border border-dashed py-16 text-center text-slate-400">
            {brands.isLoading ? "加载中…" : "暂无品牌数据"}
          </div>
        )}
      </div>
    </div>
  );
}
