import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listEntities, listLandlords } from "@/api/directory";
import { listContracts } from "@/api/contracts";
import { listMeters, updateMeter } from "@/api/meters";
import { StatusBadge } from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { inputCls } from "@/components/fields";
import { exportXlsx } from "@/lib/export";
import { fmtMoney, fmtNum, fmtDate } from "@/lib/format";
import { Download, Search, ChevronDown, ChevronRight, FileText, Building2, DollarSign, Zap, Link, Trash2, Plus, Check } from "lucide-react";
import { toast } from "sonner";

export default function Entities() {
  const [keyword, setKeyword] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkEntityId, setLinkEntityId] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const entities = useQuery({ queryKey: ["entities"], queryFn: listEntities });
  const contracts = useQuery({ queryKey: ["contracts"], queryFn: () => listContracts() });
  const meters = useQuery({ queryKey: ["meters"], queryFn: () => listMeters() });

  const entityData = useMemo(() => {
    const entityList = entities.data ?? [];
    const contractList = contracts.data ?? [];
    const meterList = meters.data ?? [];

    return entityList
      .filter((e: any) => !keyword || e.name?.includes(keyword) || e.short_name?.includes(keyword))
      .map((entity: any) => {
        // 该主体的电表（通过entity_id关联）
        const entityMeters = meterList.filter((m: any) => m.entity_id === entity.id);

        // 该主体关联的场地ID集合（来自电表的landlord_id）
        const entityLandlordIds = new Set(entityMeters.map((m: any) => m.landlord_id).filter(Boolean));

        // 该主体的合同：通过pay_entity匹配，但如果主体已关联场地，则只显示该场地下的合同
        const entityContracts = contractList.filter((c: any) => {
          if (c.pay_entity !== entity.name && c.pay_entity !== entity.short_name) return false;
          // 如果主体已通过电表关联了场地，合同必须属于这些场地之一
          if (entityLandlordIds.size > 0) {
            return c.landlord_id && entityLandlordIds.has(c.landlord_id);
          }
          return true;
        });

        // 汇总数据
        const totalMonthlyRent = entityContracts.reduce((sum: number, c: any) => sum + (Number(c.monthly_rent) || 0), 0);
        const totalAnnualRent = entityContracts.reduce((sum: number, c: any) => sum + (Number(c.rent_amount) || 0), 0);
        const costContracts = entityContracts.filter((c: any) => c.contract_type === "场地合同");
        const incomeContracts = entityContracts.filter((c: any) => c.contract_type === "品牌方合同");

        // 按场地分组的电表
        const metersByLandlord = new Map<number, any>();
        for (const m of entityMeters) {
          const lid = m.landlord_id || 0;
          if (!metersByLandlord.has(lid)) {
            metersByLandlord.set(lid, {
              landlordId: lid,
              landlordName: m.landlord_name || "未设置场地方",
              meters: [],
            });
          }
          metersByLandlord.get(lid).meters.push(m);
        }

        return {
          ...entity,
          meters: entityMeters,
          contracts: entityContracts,
          costContracts,
          incomeContracts,
          metersByLandlord: [...metersByLandlord.values()],
          meterCount: entityMeters.length,
          contractCount: entityContracts.length,
          totalMonthlyRent,
          totalAnnualRent,
        };
      });
  }, [entities.data, contracts.data, meters.data, keyword]);

  const toggleExpand = (id: number) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const openLinkDialog = (entityId: number) => {
    setLinkEntityId(entityId);
    setLinkDialogOpen(true);
  };

  const doExport = () => {
    if (entityData.length === 0) { toast.error("暂无数据可导出"); return; }
    exportXlsx(`公司主体管理_${new Date().toISOString().slice(0, 10)}`, [{
      name: "公司主体管理",
      rows: entityData.map((e: any) => ({
        公司全称: e.name,
        简称: e.short_name ?? "",
        电表数: e.meterCount,
        合同数: e.contractCount,
        月租金: e.totalMonthlyRent,
        年租金: e.totalAnnualRent,
        备注: e.remark ?? "",
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
          <input className={`${inputCls} w-56 pl-8`} placeholder="搜索公司名称…" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={doExport}><Download className="mr-1.5 h-4 w-4" />导出表格</Button>
        </div>
      </div>

      {/* 主体列表 */}
      <div className="space-y-4">
        {entityData.map((entity: any) => {
          const isExpanded = expandedId === entity.id;

          return (
            <div key={entity.id} className="rounded-xl border bg-white shadow-sm">
              {/* 主体头部 */}
              <div
                className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-slate-50/60"
                onClick={() => toggleExpand(entity.id)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-300" />}
                  <div>
                    <div className="font-semibold text-slate-800">{entity.name}</div>
                    {entity.short_name && <div className="text-xs text-slate-400">简称：{entity.short_name}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-6 text-xs">
                  <div className="flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    <span className="tabular-nums">{entity.meterCount}</span> 电表
                  </div>
                  <div className="flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="tabular-nums">{entity.contractCount}</span> 合同
                  </div>
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5 text-rose-500" />
                    月租金 <span className="tabular-nums font-medium">{fmtMoney(entity.totalMonthlyRent)}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openLinkDialog(entity.id); }}>
                    <Link className="mr-1 h-3 w-3" />关联电表
                  </Button>
                </div>
              </div>

              {/* 展开内容 */}
              {isExpanded && (
                <div className="border-t px-5 py-4 space-y-4">
                  {/* 汇总数据 */}
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <div className="rounded-lg border bg-slate-50 px-3 py-2">
                      <div className="text-[10px] text-slate-400">电表数量</div>
                      <div className="text-lg font-semibold tabular-nums">{entity.meterCount}</div>
                    </div>
                    <div className="rounded-lg border bg-slate-50 px-3 py-2">
                      <div className="text-[10px] text-slate-400">合同总数</div>
                      <div className="text-lg font-semibold tabular-nums">{entity.contractCount}</div>
                    </div>
                    <div className="rounded-lg border bg-slate-50 px-3 py-2">
                      <div className="text-[10px] text-slate-400">成本合同</div>
                      <div className="text-lg font-semibold tabular-nums text-rose-600">{entity.costContracts.length}</div>
                    </div>
                    <div className="rounded-lg border bg-slate-50 px-3 py-2">
                      <div className="text-[10px] text-slate-400">收入合同</div>
                      <div className="text-lg font-semibold tabular-nums text-emerald-600">{entity.incomeContracts.length}</div>
                    </div>
                  </div>

                  {/* 电表列表（按场地分组） */}
                  {entity.metersByLandlord.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-xs font-semibold text-slate-600">归属电表（{entity.meterCount} 块）</h4>
                      <div className="space-y-3">
                        {entity.metersByLandlord.map((group: any) => (
                          <div key={group.landlordId} className="rounded-lg border overflow-hidden">
                            <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 border-b">
                              <Building2 className="h-3.5 w-3.5 text-slate-500" />
                              <span className="text-xs font-semibold text-slate-600">{group.landlordName}</span>
                              <span className="text-[10px] text-slate-400">（{group.meters.length} 块电表）</span>
                            </div>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b bg-white">
                                  <th className={th}>电表编号</th>
                                  <th className={th}>电表名称</th>
                                  <th className={th}>站点</th>
                                  <th className={th}>品牌方</th>
                                  <th className={th}>状态</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.meters.map((m: any) => (
                                  <tr key={m.id} className="border-b last:border-0">
                                    <td className="px-3 py-2 font-mono font-medium">{m.meter_no}</td>
                                    <td className="px-3 py-2">{m.meter_name ?? "-"}</td>
                                    <td className="px-3 py-2">{m.station_name ?? "-"}</td>
                                    <td className="px-3 py-2">{m.brand_name ?? "-"}</td>
                                    <td className="px-3 py-2"><StatusBadge status={m.status} /></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 合同列表 */}
                  {entity.contracts.length > 0 ? (
                    <div>
                      <h4 className="mb-2 text-xs font-semibold text-slate-600">合同（{entity.contracts.length} 份）</h4>
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b bg-slate-50">
                              <th className={th}>合同类型</th>
                              <th className={th}>关联场地</th>
                              <th className={th}>品牌方</th>
                              <th className={th}>电费单价</th>
                              <th className={th}>场地月租金</th>
                              <th className={th}>付款方式</th>
                              <th className={th}>合同期限</th>
                              <th className={th}>状态</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entity.contracts.map((c: any) => (
                              <tr key={c.id} className="border-b last:border-0">
                                <td className="px-3 py-2">
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${c.contract_type === "场地合同" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                                    {c.contract_type}
                                  </span>
                                </td>
                                <td className="px-3 py-2 font-medium">{c.landlord_name ?? "-"}</td>
                                <td className="px-3 py-2">{c.brand_name ?? "-"}</td>
                                <td className="px-3 py-2 tabular-nums">{c.electricity_price ? `${fmtNum(c.electricity_price)} 元/度` : "-"}</td>
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
                  ) : (
                    <div className="py-6 text-center text-sm text-slate-400">
                      暂无关联合同
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {entityData.length === 0 && (
          <div className="rounded-xl border border-dashed py-16 text-center text-slate-400">
            {entities.isLoading ? "加载中…" : "暂无公司主体数据，请先在「基础档案」中添加"}
          </div>
        )}
      </div>

      {/* 关联电表弹窗 */}
      <EntityMeterLinkDialog
        open={linkDialogOpen}
        onClose={() => { setLinkDialogOpen(false); setLinkEntityId(null); }}
        entityId={linkEntityId}
      />
    </div>
  );
}


// ─── 关联电表弹窗 ───────────────────────────────────────────

function EntityMeterLinkDialog({ open, onClose, entityId }: { open: boolean; onClose: () => void; entityId: number | null }) {
  const queryClient = useQueryClient();
  const [selectedLandlordId, setSelectedLandlordId] = useState("");
  const [selectedMeterIds, setSelectedMeterIds] = useState<Set<number>>(new Set());

  const landlords = useQuery({ queryKey: ["landlords"], queryFn: listLandlords, enabled: open });
  const allMeters = useQuery({ queryKey: ["meters"], queryFn: () => listMeters(), enabled: open });

  // 该场地下的电表（未关联到其他主体的）
  const availableMeters = useMemo(() => {
    if (!selectedLandlordId) return [];
    return (allMeters.data ?? []).filter((m: any) =>
      m.landlord_id === Number(selectedLandlordId) && (m.entity_id === null || m.entity_id === entityId)
    );
  }, [allMeters.data, selectedLandlordId, entityId]);

  // 已关联到该主体的电表
  const linkedMeters = useMemo(() => {
    if (!selectedLandlordId) return [];
    return (allMeters.data ?? []).filter((m: any) =>
      m.landlord_id === Number(selectedLandlordId) && m.entity_id === entityId
    );
  }, [allMeters.data, selectedLandlordId, entityId]);

  const toggleMeter = (meterId: number) => {
    setSelectedMeterIds(prev => {
      const next = new Set(prev);
      if (next.has(meterId)) next.delete(meterId);
      else next.add(meterId);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedMeterIds(new Set(availableMeters.map((m: any) => m.id)));
  };

  const deselectAll = () => {
    setSelectedMeterIds(new Set());
  };

  const save = useMutation({
    mutationFn: async () => {
      const promises = Array.from(selectedMeterIds).map(meterId =>
        updateMeter(meterId, { entityId })
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      toast.success("已关联");
      setSelectedMeterIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["meters"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unlink = useMutation({
    mutationFn: async (meterId: number) => {
      await updateMeter(meterId, { entityId: null });
    },
    onSuccess: () => {
      toast.success("已解除关联");
      queryClient.invalidateQueries({ queryKey: ["meters"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>关联电表</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* 选择场地 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">选择场地</label>
            <select
              className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm"
              value={selectedLandlordId}
              onChange={(e) => { setSelectedLandlordId(e.target.value); setSelectedMeterIds(new Set()); }}
            >
              <option value="">请选择场地</option>
              {(landlords.data ?? []).map((l: any) => (
                <option key={l.id} value={String(l.id)}>{l.name}</option>
              ))}
            </select>
          </div>

          {selectedLandlordId && (
            <>
              {/* 已关联的电表 */}
              {linkedMeters.length > 0 && (
                <div>
                  <div className="mb-1 text-xs font-semibold text-slate-600">已关联（{linkedMeters.length} 块）</div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {linkedMeters.map((m: any) => (
                      <div key={m.id} className="flex items-center justify-between rounded border bg-emerald-50 px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-xs font-mono">{m.meter_no}</span>
                          <span className="text-xs text-slate-500">{m.brand_name}</span>
                        </div>
                        <button
                          className="rounded p-0.5 text-slate-400 hover:text-rose-500"
                          onClick={() => window.confirm("解除关联？") && unlink.mutate(m.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 可关联的电表 */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">可关联（{availableMeters.length} 块）</span>
                  <div className="flex gap-1">
                    <button className="text-[10px] text-emerald-600 hover:underline" onClick={selectAll}>全选</button>
                    <span className="text-[10px] text-slate-300">|</span>
                    <button className="text-[10px] text-slate-500 hover:underline" onClick={deselectAll}>取消</button>
                  </div>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto rounded border p-2">
                  {availableMeters.map((m: any) => {
                    const isSelected = selectedMeterIds.has(m.id);
                    return (
                      <label
                        key={m.id}
                        className={`flex items-center gap-2 rounded px-2 py-1.5 cursor-pointer transition-colors ${isSelected ? "bg-emerald-50" : "hover:bg-slate-50"}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleMeter(m.id)}
                          className="rounded border-slate-300"
                        />
                        <span className="text-xs font-mono">{m.meter_no}</span>
                        <span className="text-xs text-slate-500">{m.meter_name ?? ""}</span>
                        <span className="ml-auto text-[10px] text-slate-400">{m.brand_name}</span>
                      </label>
                    );
                  })}
                  {availableMeters.length === 0 && (
                    <div className="py-4 text-center text-xs text-slate-400">该场地下暂无可关联的电表</div>
                  )}
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>关闭</Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={selectedMeterIds.size === 0 || save.isPending}
                  onClick={() => save.mutate()}
                >
                  关联选中的 {selectedMeterIds.size} 块电表
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
