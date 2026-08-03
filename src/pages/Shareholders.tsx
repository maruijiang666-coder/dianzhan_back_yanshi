import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listShareholders, listIntroducers, listPlatformUsers } from "@/api/directory";
import { getStationBoard } from "@/api/overview";
import { shareholderSummary, listDividends, listShareholderConfigs, listIntroducerConfigs, deleteShareholderConfig, deleteIntroducerConfig, calculateDividend, createDividend } from "@/api/dividends";
import { submitDividendApproval, getApprovalByDividend } from "@/api/approvals";
import { listExpenses, saveExpense, deleteExpense } from "@/api/rent";
import { MonthPicker } from "@/components/MonthPicker";
import { fmtMoney, fmtNum, fmtPct } from "@/lib/format";
import { inputCls } from "@/components/fields";
import { Users, MapPin, Plus, X, Trash2, UserPlus, Settings, DollarSign, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

// ─── 新增股东弹窗 ───
function AddShareholderDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [remark, setRemark] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("股东名称不能为空");
      const res = await fetch("/api/directory/shareholders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || undefined, remark: remark.trim() || undefined }),
      });
      if (!res.ok) throw new Error("创建失败");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shareholders"] });
      toast.success("股东添加成功");
      onClose();
      setName(""); setPhone(""); setRemark("");
    },
    onError: (e: any) => toast.error(e.message || "添加失败"),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-96 rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800">新增股东</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500">股东名称 <span className="text-rose-500">*</span></label>
            <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="请输入股东名称" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">联系电话</label>
            <input className={inputCls} value={phone} onChange={e => setPhone(e.target.value)} placeholder="请输入联系电话" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">备注</label>
            <input className={inputCls} value={remark} onChange={e => setRemark(e.target.value)} placeholder="备注信息" />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100">取消</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-50">
            {mutation.isPending ? "添加中…" : "确认添加"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 配置分红弹窗 ───
function ConfigDividendDialog({ open, onClose, type, stationId }: { open: boolean; onClose: () => void; type: "shareholder" | "introducer"; stationId?: number }) {
  const qc = useQueryClient();
  const [targetId, setTargetId] = useState<number | null>(null);
  const [mode, setMode] = useState("利润分红");
  const [ratio, setRatio] = useState("");
  const [fixedAmount, setFixedAmount] = useState("");
  const [countAsCost, setCountAsCost] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: shareholders } = useQuery({ queryKey: ["shareholders"], queryFn: () => listShareholders(), enabled: type === "shareholder" });
  const { data: introducers } = useQuery({ queryKey: ["introducers"], queryFn: () => listIntroducers(), enabled: type === "introducer" });

  const targets = type === "shareholder" ? shareholders : introducers;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!stationId) throw new Error("请先选择场地方");
      if (!targetId) throw new Error(type === "shareholder" ? "请选择股东" : "请选择介绍人");
      if (mode !== "固定金额" && !ratio) throw new Error("请输入比例");
      if (mode === "固定金额" && !fixedAmount) throw new Error("请输入固定金额");
      const endpoint = type === "shareholder" ? "/api/dividends/configs/shareholder" : "/api/dividends/configs/introducer";
      const body: any = type === "shareholder"
        ? { stationId, shareholderId: targetId, mode, ratio: mode !== "固定金额" ? Number(ratio) / 100 : null, fixedAmount: mode === "固定金额" ? Number(fixedAmount) : null, startDate: startDate || null, endDate: endDate || null }
        : { stationId, introducerId: targetId, mode, ratio: mode !== "固定金额" ? Number(ratio) / 100 : null, fixedAmount: mode === "固定金额" ? Number(fixedAmount) : null, countAsCost, startDate: startDate || null, endDate: endDate || null };
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error("配置失败");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shareholderConfigs"] });
      qc.invalidateQueries({ queryKey: ["introducerConfigs"] });
      qc.invalidateQueries({ queryKey: ["dividendPreview"] });
      qc.invalidateQueries({ queryKey: ["stationBoard"] });
      toast.success("配置成功");
      onClose();
    },
    onError: (e: any) => toast.error(e.message || "配置失败"),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-96 rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800">{type === "shareholder" ? "配置股东分红" : "配置商务分红"}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500">{type === "shareholder" ? "选择股东" : "选择介绍人"} <span className="text-rose-500">*</span></label>
            <select className={inputCls} value={targetId || ""} onChange={e => setTargetId(Number(e.target.value) || null)}>
              <option value="">{type === "shareholder" ? "请选择股东" : "请选择介绍人"}</option>
              {targets?.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">分红模式</label>
            <select className={inputCls} value={mode} onChange={e => setMode(e.target.value)}>
              <option value="收入分红">收入分红（按总收入比例）</option>
              <option value="利润分红">利润分红（按净利润比例）</option>
              <option value="固定金额">固定金额</option>
            </select>
          </div>
          {mode === "收入分红" && (
            <div>
              <label className="mb-1 block text-xs text-slate-500">收入分红比例 (%)</label>
              <input className={inputCls} type="number" value={ratio} onChange={e => setRatio(e.target.value)} placeholder="如：10 表示 10%" step="0.1" min="0" max="100" />
              <div className="mt-1 text-[10px] text-slate-400">分红基数 = 电费收款 + 租金收款</div>
            </div>
          )}
          {mode === "利润分红" && (
            <div>
              <label className="mb-1 block text-xs text-slate-500">利润分红比例 (%)</label>
              <input className={inputCls} type="number" value={ratio} onChange={e => setRatio(e.target.value)} placeholder="如：30 表示 30%" step="0.1" min="0" max="100" />
              <div className="mt-1 text-[10px] text-slate-400">分红基数 = 净利润（总收入 - 总成本）</div>
            </div>
          )}
          {mode === "固定金额" && (
            <div>
              <label className="mb-1 block text-xs text-slate-500">固定金额 (元/月)</label>
              <input className={inputCls} type="number" value={fixedAmount} onChange={e => setFixedAmount(e.target.value)} placeholder="如：5000" />
            </div>
          )}
          {type === "introducer" && (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <input type="checkbox" id="countAsCost" checked={countAsCost} onChange={e => setCountAsCost(e.target.checked)} className="rounded border-slate-300" />
              <label htmlFor="countAsCost" className="text-xs text-slate-600 cursor-pointer">商务分红计入成本（影响股东分红基数）</label>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">生效日期</label>
              <input className={inputCls} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">失效日期</label>
              <input className={inputCls} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              <div className="mt-1 text-[10px] text-slate-400">不填则长期有效</div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100">取消</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-50">
            {mutation.isPending ? "配置中…" : "确认配置"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 新增分红月结弹窗 ───
function AddDividendDialog({ open, onClose, stationId }: { open: boolean; onClose: () => void; stationId?: number }) {
  const qc = useQueryClient();
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [type, setType] = useState("股东分红");
  const [preview, setPreview] = useState<any>(null);

  const handlePreview = async () => {
    if (!stationId || !period) { toast.error("请先选择场地方和月份"); return; }
    try {
      const result = await calculateDividend({ stationId, period });
      setPreview(result);
    } catch (e: any) { toast.error(e.message || "计算失败"); }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!stationId || !period) throw new Error("请先选择场地方和月份");
      return createDividend({ stationId, period, type });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dividends"] });
      qc.invalidateQueries({ queryKey: ["stationDividends"] });
      qc.invalidateQueries({ queryKey: ["dividendPreview"] });
      qc.invalidateQueries({ queryKey: ["shareholderSummary"] });
      toast.success("分红月结创建成功");
      onClose();
      setPreview(null);
    },
    onError: (e: any) => toast.error(e.message || "创建失败"),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-[480px] rounded-xl bg-white p-5 shadow-xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800">新增分红月结</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500">选择月份 <span className="text-rose-500">*</span></label>
            <MonthPicker value={period} onChange={setPeriod} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">分红类型</label>
            <select className={inputCls} value={type} onChange={e => setType(e.target.value)}>
              <option value="股东分红">股东分红</option>
              <option value="商务分红">商务分红</option>
            </select>
          </div>
          <button onClick={handlePreview} className="w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 hover:bg-emerald-100">
            预览分红计算
          </button>
          {preview && (
            <div className="rounded-lg border bg-slate-50 p-3 space-y-2 text-xs">
              <div className="font-semibold text-slate-700">分红预览</div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-slate-400">总收入：</span><span className="font-medium">{fmtMoney(preview.income?.totalIncome)}</span></div>
                <div><span className="text-slate-400">总成本：</span><span className="font-medium">{fmtMoney(preview.cost?.totalCost)}</span></div>
                <div><span className="text-slate-400">利润：</span><span className={`font-medium ${preview.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtMoney(preview.profit)}</span></div>
              </div>
              {preview.shareholderDividends?.length > 0 && (
                <div>
                  <div className="font-semibold text-slate-600 mt-2">股东分红明细：</div>
                  {preview.shareholderDividends.map((d: any, i: number) => (
                    <div key={i} className="flex justify-between py-0.5"><span>{d.shareholderName}</span><span className="font-medium">{fmtMoney(d.amount)}</span></div>
                  ))}
                </div>
              )}
              {preview.bizDividends?.length > 0 && (
                <div>
                  <div className="font-semibold text-slate-600 mt-2">商务分红明细：</div>
                  {preview.bizDividends.map((d: any, i: number) => (
                    <div key={i} className="flex justify-between py-0.5"><span>{d.introducerName}</span><span className="font-medium">{fmtMoney(d.amount)}</span></div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100">取消</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-50">
            {mutation.isPending ? "创建中…" : "确认创建"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 提交审批弹窗 ───
function SubmitApprovalDialog({ open, onClose, dividend, onSuccess }: { open: boolean; onClose: () => void; dividend: any; onSuccess: () => void }) {
  const [applicant, setApplicant] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [boss, setBoss] = useState("");

  const { data: platformUsers } = useQuery({
    queryKey: ["platformUsers"],
    queryFn: listPlatformUsers,
    enabled: open,
  });

  const supervisors = (platformUsers ?? []).filter((u: any) => u.role === "finance_supervisor");
  const bosses = (platformUsers ?? []).filter((u: any) => u.role === "boss");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!applicant.trim()) throw new Error("请填写操作人");
      if (!supervisor && !boss) throw new Error("请至少选择一位审批人");
      return submitDividendApproval({
        dividendRecordId: dividend.id,
        stationName: dividend.station_name || `站点#${dividend.station_id}`,
        period: dividend.period,
        amount: dividend.shares?.reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0) || 0,
        applicant: applicant.trim(),
        approvers: { finance_supervisor: supervisor || undefined, boss: boss || undefined },
      });
    },
    onSuccess: () => { toast.success("已提交审批"); onSuccess(); onClose(); },
    onError: (e: any) => toast.error(e.message || "提交失败"),
  });

  if (!open || !dividend) return null;

  const totalAmount = dividend.shares?.reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0) || 0;

  // 构建审批流程预览
  const flowSteps = [applicant || "提交人"];
  if (supervisor) flowSteps.push(supervisor);
  if (boss) flowSteps.push(boss);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-[420px] rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800">提交分红审批</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
        </div>

        {/* 分红信息 */}
        <div className="rounded-lg border bg-slate-50 p-3 mb-4 space-y-1 text-xs">
          <div className="flex justify-between"><span className="text-slate-500">站点</span><span className="font-medium text-slate-700">{dividend.station_name || `站点#${dividend.station_id}`}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">月份</span><span className="font-medium text-slate-700">{dividend.period}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">类型</span><span className="font-medium text-slate-700">{dividend.type}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">利润</span><span className={`font-semibold tabular-nums ${dividend.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtMoney(dividend.profit)}</span></div>
          <div className="flex justify-between border-t pt-1"><span className="text-slate-500">分红总额</span><span className="font-semibold tabular-nums text-blue-600">{fmtMoney(totalAmount)}</span></div>
          {dividend.shares?.map((s: any, i: number) => (
            <div key={i} className="flex justify-between pl-3"><span className="text-slate-400">{s.shareholder_name || s.introducer_name || "-"}</span><span className="tabular-nums text-slate-600">{fmtMoney(s.amount)}</span></div>
          ))}
        </div>

        {/* 审批人选择 */}
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500">操作人（提交人）<span className="text-rose-500">*</span></label>
            <input className={inputCls} value={applicant} onChange={(e) => setApplicant(e.target.value)} placeholder="您的姓名" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">财务主管审核</label>
            <select className={inputCls} value={supervisor} onChange={(e) => setSupervisor(e.target.value)}>
              <option value="">不经过财务主管</option>
              {supervisors.map((u: any) => <option key={u.id} value={u.name}>{u.name}{u.phone ? ` (${u.phone})` : ""}</option>)}
            </select>
            {supervisors.length === 0 && <div className="mt-1 text-[10px] text-slate-400">如需添加，请在「Directory → 平台人员」中设置</div>}
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">老板审批</label>
            <select className={inputCls} value={boss} onChange={(e) => setBoss(e.target.value)}>
              <option value="">不经过老板</option>
              {bosses.map((u: any) => <option key={u.id} value={u.name}>{u.name}{u.phone ? ` (${u.phone})` : ""}</option>)}
            </select>
            {bosses.length === 0 && <div className="mt-1 text-[10px] text-slate-400">如需添加，请在「Directory → 平台人员」中设置</div>}
          </div>
          {!supervisor && !boss && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
              请至少选择一位审批人
            </div>
          )}
        </div>

        {/* 审批流程预览 */}
        {(supervisor || boss) && (
          <div className="mt-4 rounded-lg border bg-blue-50/50 p-3">
            <div className="text-[10px] font-semibold text-blue-600 mb-2">审批流程预览</div>
            <div className="flex items-center gap-1 text-[11px]">
              {flowSteps.map((step, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-slate-400">→</span>}
                  <span className={`rounded px-1.5 py-0.5 ${i === 0 ? "bg-blue-100 text-blue-700" : i === flowSteps.length - 1 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{step}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100">取消</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || (!supervisor && !boss)} className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50">
            {mutation.isPending ? "提交中…" : "确认提交审批"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 主页面 ───
export default function Shareholders() {
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<"shareholder" | "station">("shareholder");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // 弹窗状态
  const [addShareholderOpen, setAddShareholderOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState<{ open: boolean; type: "shareholder" | "introducer"; stationId?: number }>({ open: false, type: "shareholder" });
  const [addDividendOpen, setAddDividendOpen] = useState<{ open: boolean; stationId?: number }>({ open: false });
  const [expandedShareholderId, setExpandedShareholderId] = useState<number | null>(null);

  // ─── 数据查询 ───
  const { data: shareholders } = useQuery({ queryKey: ["shareholders"], queryFn: () => listShareholders() });

  const { data: shareholderSummaryData, isLoading: shLoading } = useQuery({
    queryKey: ["shareholderSummary", selectedMonth],
    queryFn: () => shareholderSummary({ period: selectedMonth || undefined }),
    enabled: viewMode === "shareholder",
  });

  // 获取所有股东分红配置（用于显示股东关联的站点）
  const { data: allShConfigs } = useQuery({
    queryKey: ["shareholderConfigs"],
    queryFn: () => listShareholderConfigs(),
    enabled: viewMode === "shareholder",
  });

  // 场地汇总数据（用于股东汇总中显示各站点经营数据）
  const { data: stationBoardForSH } = useQuery({
    queryKey: ["stationBoard", selectedMonth],
    queryFn: () => getStationBoard({ period: selectedMonth }),
    enabled: viewMode === "shareholder",
  });

  // 场地汇总：复用站点看板数据
  const { data: stationBoard, isLoading: stLoading } = useQuery({
    queryKey: ["stationBoard", selectedMonth],
    queryFn: () => getStationBoard({ period: selectedMonth }),
    enabled: viewMode === "station",
  });

  // ─── 股东汇总：合并所有股东（含没有分红记录的）───
  const allShareholders = useMemo(() => {
    const map = new Map<number, any>();
    if (shareholders) {
      for (const sh of shareholders) {
        map.set(sh.id, { id: sh.id, name: sh.name, phone: sh.phone, totalAmount: 0, settledAmount: 0, pendingAmount: 0, details: [], hasRecords: false });
      }
    }
    if (shareholderSummaryData) {
      for (const s of shareholderSummaryData) {
        const existing = map.get(s.shareholderId);
        if (existing) {
          existing.totalAmount = s.totalAmount;
          existing.settledAmount = s.settledAmount;
          existing.pendingAmount = s.pendingAmount;
          existing.details = s.details;
          existing.hasRecords = true;
        } else {
          map.set(s.shareholderId, { id: s.shareholderId, name: s.shareholderName, totalAmount: s.totalAmount, settledAmount: s.settledAmount, pendingAmount: s.pendingAmount, details: s.details, hasRecords: true });
        }
      }
    }
    return Array.from(map.values());
  }, [shareholders, shareholderSummaryData]);

  const selectedShareholder = useMemo(() => {
    if (viewMode !== "shareholder" || !selectedId) return null;
    return allShareholders.find(s => s.id === selectedId) || null;
  }, [viewMode, selectedId, allShareholders]);

  // 选中股东的分红配置
  const shareholderConfigs = useMemo(() => {
    if (!selectedId || !allShConfigs) return [];
    return allShConfigs.filter((c: any) => c.shareholder_id === selectedId);
  }, [selectedId, allShConfigs]);

  // ─── 场地汇总：复用站点看板数据（按场地方分组）───
  const stationRows = useMemo(() => stationBoard ?? [], [stationBoard]);

  const selectedLandlord = useMemo(() => {
    if (viewMode !== "station" || !selectedId) return null;
    return stationRows.find((r: any) => r.landlord.id === selectedId) || null;
  }, [viewMode, selectedId, stationRows]);

  // 选中场地方的分红配置（使用该场地方下第一个站点的ID）
  const selectedStationId = useMemo(() => {
    if (!selectedLandlord?.stations?.length) return null;
    return selectedLandlord.stations[0].id;
  }, [selectedLandlord]);

  const { data: shConfigs } = useQuery({
    queryKey: ["shareholderConfigs", selectedStationId],
    queryFn: () => listShareholderConfigs({ stationId: selectedStationId! }),
    enabled: viewMode === "station" && selectedStationId !== null,
  });

  const { data: intConfigs } = useQuery({
    queryKey: ["introducerConfigs", selectedStationId],
    queryFn: () => listIntroducerConfigs({ stationId: selectedStationId! }),
    enabled: viewMode === "station" && selectedStationId !== null,
  });

  // 选中场地方的分红记录
  const { data: stationDividends } = useQuery({
    queryKey: ["stationDividends", selectedStationId, selectedMonth],
    queryFn: () => listDividends({ stationId: selectedStationId!, period: selectedMonth || undefined }),
    enabled: viewMode === "station" && selectedStationId !== null,
  });

  // 分红预估计算（基于当前配置和财务数据）
  const { data: dividendPreview } = useQuery({
    queryKey: ["dividendPreview", selectedStationId, selectedMonth],
    queryFn: async () => {
      try {
        return await calculateDividend({ stationId: selectedStationId!, period: selectedMonth });
      } catch {
        return null;
      }
    },
    enabled: viewMode === "station" && selectedStationId !== null && !!selectedMonth,
  });

  // 运营费用
  const { data: expenses } = useQuery({
    queryKey: ["expenses", selectedStationId, selectedMonth],
    queryFn: () => listExpenses({ stationId: selectedStationId!, period: selectedMonth }),
    enabled: viewMode === "station" && selectedStationId !== null && !!selectedMonth,
  });

  const [expenseDraft, setExpenseDraft] = useState({ amount: "", remark: "" });
  const [editExpenseId, setEditExpenseId] = useState<number | null>(null);
  const [editExpenseDraft, setEditExpenseDraft] = useState({ amount: "", remark: "" });

  const saveExpenseMut = useMutation({
    mutationFn: (data: any) => saveExpense(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dividendPreview"] });
      qc.invalidateQueries({ queryKey: ["stationBoard"] });
      setExpenseDraft({ amount: "", remark: "" });
      toast.success("已保存");
    },
    onError: (e: any) => toast.error(e.message || "保存失败"),
  });

  const deleteExpenseMut = useMutation({
    mutationFn: (id: number) => deleteExpense(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dividendPreview"] });
      qc.invalidateQueries({ queryKey: ["stationBoard"] });
      toast.success("已删除");
    },
    onError: () => toast.error("删除失败"),
  });

  // 审批相关
  const [submitApprovalDiv, setSubmitApprovalDiv] = useState<any>(null);

  const deleteConfigMut = useMutation({
    mutationFn: async ({ type, id }: { type: "shareholder" | "introducer"; id: number }) => {
      if (type === "shareholder") return deleteShareholderConfig(id);
      return deleteIntroducerConfig(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shareholderConfigs"] });
      qc.invalidateQueries({ queryKey: ["introducerConfigs"] });
      qc.invalidateQueries({ queryKey: ["dividendPreview"] });
      qc.invalidateQueries({ queryKey: ["stationBoard"] });
      toast.success("配置已删除");
    },
    onError: () => toast.error("删除失败"),
  });

  const isLoading = viewMode === "shareholder" ? shLoading : stLoading;

  return (
    <div className="flex h-[calc(100vh-120px)] gap-0">
      {/* ─── 左侧面板 ─── */}
      <div className="w-64 shrink-0 flex flex-col border-r bg-white rounded-l-xl overflow-hidden">
        {/* 顶部操作栏 */}
        <div className="border-b p-3 space-y-2">
          <div className="flex items-center justify-between">
            <select
              className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1 focus:outline-none"
              value={viewMode}
              onChange={(e) => { setViewMode(e.target.value as any); setSelectedId(null); }}
            >
              <option value="shareholder">股东汇总</option>
              <option value="station">场地汇总</option>
            </select>
            {viewMode === "shareholder" && (
              <button onClick={() => setAddShareholderOpen(true)} className="flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[11px] text-white hover:bg-emerald-700">
                <UserPlus className="h-3 w-3" />
                新增
              </button>
            )}
          </div>
          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} className="w-full" />
        </div>

        {/* 列表 */}
        <div className="flex-1 overflow-y-auto">
          {viewMode === "shareholder" ? (
            allShareholders.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">暂无股东</div>
            ) : (
              allShareholders.map((sh) => (
                <button
                  key={sh.id}
                  onClick={() => setSelectedId(sh.id)}
                  className={`flex w-full items-center gap-2 border-b px-3 py-2.5 text-left text-xs transition-colors ${selectedId === sh.id ? "bg-emerald-50 border-l-2 border-l-emerald-500" : "hover:bg-slate-50"}`}
                >
                  <Users className="h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-800 truncate">{sh.name}</div>
                    {sh.hasRecords ? (
                      <div className="text-[11px] text-slate-400">{fmtMoney(sh.totalAmount)} · {sh.details?.length || 0} 条记录</div>
                    ) : (
                      <div className="text-[11px] text-slate-300">暂无分红</div>
                    )}
                  </div>
                </button>
              ))
            )
          ) : (
            stationRows.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">暂无站点</div>
            ) : (
              stationRows.map((r: any) => (
                <button
                  key={r.landlord.id}
                  onClick={() => setSelectedId(r.landlord.id)}
                  className={`flex w-full items-center gap-2 border-b px-3 py-2.5 text-left text-xs transition-colors ${selectedId === r.landlord.id ? "bg-emerald-50 border-l-2 border-l-emerald-500" : "hover:bg-slate-50"}`}
                >
                  <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-800 truncate">{r.landlord.name}</div>
                    <div className="text-[11px] text-slate-400">
                      {r.meterCount > 0 ? (
                        <>电表 {r.meterCount} · 总利润 <span className={r.totalProfit >= 0 ? "text-emerald-600" : "text-rose-600"}>{fmtMoney(r.totalProfit)}</span></>
                      ) : (
                        <span className="text-slate-300">暂无数据</span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )
          )}
        </div>
      </div>

      {/* ─── 右侧详情面板 ─── */}
      <div className="flex-1 overflow-y-auto rounded-r-xl bg-slate-50 p-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">加载中…</div>
        ) : viewMode === "shareholder" ? (
          // ─── 股东汇总详情 ───
          !selectedShareholder ? (
            <div className="flex h-full flex-col items-center justify-center text-slate-400">
              <Users className="h-10 w-10 mb-2 text-slate-300" />
              <div className="text-sm">请从左侧选择股东</div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 股东信息卡片 */}
              <div className="rounded-xl border bg-white p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{selectedShareholder.name}</div>
                    {selectedShareholder.phone && <div className="text-xs text-slate-400">{selectedShareholder.phone}</div>}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
                    <div className="text-[10px] text-blue-600">总分红</div>
                    <div className="text-sm font-semibold tabular-nums text-blue-700">{fmtMoney(selectedShareholder.totalAmount)}</div>
                  </div>
                  <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
                    <div className="text-[10px] text-emerald-600">已结算</div>
                    <div className="text-sm font-semibold tabular-nums text-emerald-700">{fmtMoney(selectedShareholder.settledAmount)}</div>
                  </div>
                  <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                    <div className="text-[10px] text-amber-600">待结算</div>
                    <div className="text-sm font-semibold tabular-nums text-amber-700">{fmtMoney(selectedShareholder.pendingAmount)}</div>
                  </div>
                </div>
              </div>

              {/* 各站点分红详情 */}
              {shareholderConfigs.length > 0 && (
                <div className="space-y-3">
                  {shareholderConfigs.map((c: any) => {
                    const isStationExpanded = expandedShareholderId === c.station_id;
                    // 从stationBoard中找到该站点的经营数据
                    const stationData = (stationBoardForSH ?? []).find((r: any) =>
                      r.stations?.some((s: any) => s.id === c.station_id)
                    );
                    const stationInfo = stationData?.stations?.find((s: any) => s.id === c.station_id);
                    // 该站点的历史分红记录
                    const stationRecords = (selectedShareholder.details ?? []).filter((d: any) => d.station_id === c.station_id);

                    return (
                      <div key={c.id} className="rounded-xl border bg-white overflow-hidden">
                        {/* 站点头部 */}
                        <div
                          className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50/60 ${isStationExpanded ? "bg-blue-50/30" : ""}`}
                          onClick={() => setExpandedShareholderId(isStationExpanded ? null : c.station_id)}
                        >
                          <div className="flex items-center gap-2">
                            {isStationExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-300" />}
                            <MapPin className="h-4 w-4 text-emerald-500" />
                            <span className="text-sm font-semibold text-slate-800">{c.station_name || `站点#${c.station_id}`}</span>
                            {stationData && (
                              <span className="text-xs text-slate-400">（{stationData.landlord.name}）</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-slate-500">
                              {c.mode === "固定金额" ? `固定 ${fmtMoney(c.fixed_amount)}` : `${c.mode} ${(c.ratio * 100).toFixed(1)}%`}
                            </span>
                            {stationRecords.length > 0 && (
                              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-600">{stationRecords.length} 条记录</span>
                            )}
                          </div>
                        </div>

                        {/* 展开内容 */}
                        {isStationExpanded && (
                          <div className="border-t px-4 py-3 space-y-3 bg-slate-50/30">
                            {/* 分红配置 */}
                            <div className="rounded-lg border bg-white p-3">
                              <div className="text-[11px] font-semibold text-slate-600 mb-2">分红配置</div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div><span className="text-slate-400">分红模式：</span><span className="font-medium text-slate-700">{c.mode}</span></div>
                                {c.mode !== "固定金额" && (
                                  <div><span className="text-slate-400">分红比例：</span><span className="font-medium text-slate-700">{(c.ratio * 100).toFixed(1)}%</span></div>
                                )}
                                {c.mode === "固定金额" && (
                                  <div><span className="text-slate-400">固定金额：</span><span className="font-medium text-slate-700">{fmtMoney(c.fixed_amount)}/月</span></div>
                                )}
                              </div>
                            </div>

                            {/* 站点经营数据 */}
                            {stationData && (
                              <div className="rounded-lg border bg-white overflow-hidden">
                                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-600 bg-slate-50 border-b">
                                  站点经营数据（{selectedMonth}）
                                </div>
                                <div className="p-3 space-y-3">
                                  {/* 收入构成 */}
                                  <div>
                                    <div className="text-[11px] font-semibold text-emerald-600 mb-1.5">收入构成</div>
                                    <div className="space-y-1 text-xs">
                                      <div className="flex justify-between">
                                        <span className="text-slate-500">电费收入</span>
                                        <span className="tabular-nums text-slate-700">{fmtMoney(stationData.elecCollect)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-500">租金收入（品牌方合同）</span>
                                        <span className="tabular-nums text-slate-700">{fmtMoney(stationData.rentIncome)}</span>
                                      </div>
                                      <div className="flex justify-between font-semibold border-t pt-1">
                                        <span className="text-slate-700">总收入</span>
                                        <span className="tabular-nums text-emerald-600">{fmtMoney(stationData.elecCollect + stationData.rentIncome)}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* 成本构成 */}
                                  <div>
                                    <div className="text-[11px] font-semibold text-rose-600 mb-1.5">成本构成</div>
                                    <div className="space-y-1 text-xs">
                                      <div className="flex justify-between">
                                        <span className="text-slate-500">电费成本</span>
                                        <span className="tabular-nums text-slate-700">{fmtMoney(stationData.elecPay)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-500">场地租金</span>
                                        <span className="tabular-nums text-slate-700">{fmtMoney(stationData.rentCost)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-500">运营费用</span>
                                        <span className="tabular-nums text-slate-700">{fmtMoney(stationData.opExpense)}</span>
                                      </div>
                                      <div className="flex justify-between font-semibold border-t pt-1">
                                        <span className="text-slate-700">总成本</span>
                                        <span className="tabular-nums text-rose-600">{fmtMoney(stationData.elecPay + stationData.rentCost + stationData.opExpense)}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* 利润和分红计算 */}
                                  <div className="rounded-lg bg-slate-50 p-2.5 space-y-1.5">
                                    <div className="flex justify-between text-xs">
                                      <span className="text-slate-500">净利润</span>
                                      <span className={`font-semibold tabular-nums ${stationData.totalProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtMoney(stationData.totalProfit)}</span>
                                    </div>
                                    <div className="border-t pt-1.5">
                                      <div className="flex justify-between text-xs">
                                        <span className="text-slate-500">分红模式</span>
                                        <span className="font-medium text-slate-700">{c.mode}</span>
                                      </div>
                                      {c.mode === "收入分红" && (
                                        <div className="flex justify-between text-xs">
                                          <span className="text-slate-500">计算公式</span>
                                          <span className="text-slate-600">总收入 {fmtMoney(stationData.elecCollect + stationData.rentIncome)} × {(c.ratio * 100).toFixed(1)}%</span>
                                        </div>
                                      )}
                                      {c.mode === "利润分红" && (
                                        <div className="flex justify-between text-xs">
                                          <span className="text-slate-500">计算公式</span>
                                          <span className="text-slate-600">净利润 {fmtMoney(stationData.totalProfit)} × {(c.ratio * 100).toFixed(1)}%</span>
                                        </div>
                                      )}
                                      {c.mode === "固定金额" && (
                                        <div className="flex justify-between text-xs">
                                          <span className="text-slate-500">计算公式</span>
                                          <span className="text-slate-600">固定金额 {fmtMoney(c.fixed_amount)}/月</span>
                                        </div>
                                      )}
                                    </div>
                                    <div className="border-t pt-1.5">
                                      <div className="flex justify-between text-sm font-semibold">
                                        <span className="text-slate-700">本月预估分红</span>
                                        <span className="tabular-nums text-emerald-600">
                                          {fmtMoney(
                                            c.mode === "收入分红" ? (stationData.elecCollect + stationData.rentIncome) * c.ratio :
                                            c.mode === "利润分红" ? stationData.totalProfit * c.ratio :
                                            Number(c.fixed_amount || 0)
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* 历史分红记录 */}
                            {stationRecords.length > 0 ? (
                              <div className="rounded-lg border bg-white overflow-hidden">
                                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-600 bg-slate-50 border-b">历史分红记录</div>
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b bg-slate-50/50 text-left text-slate-500">
                                      <th className="px-2.5 py-1.5 font-medium">月份</th>
                                      <th className="px-2.5 py-1.5 font-medium">类型</th>
                                      <th className="px-2.5 py-1.5 text-right font-medium">分红金额</th>
                                      <th className="px-2.5 py-1.5 font-medium">状态</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {stationRecords.map((d: any, i: number) => (
                                      <tr key={i} className="border-b last:border-0">
                                        <td className="px-2.5 py-1.5 text-slate-600">{d.period}</td>
                                        <td className="px-2.5 py-1.5">
                                          <span className={`rounded-full px-2 py-0.5 text-[10px] ${d.type === "股东分红" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>{d.type}</span>
                                        </td>
                                        <td className="px-2.5 py-1.5 text-right font-medium text-emerald-600 tabular-nums">{fmtMoney(d.amount)}</td>
                                        <td className="px-2.5 py-1.5">
                                          <span className={`rounded-full px-2 py-0.5 text-[10px] ${d.status === "已结算" ? "bg-emerald-100 text-emerald-700" : d.status === "已通过" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{d.status}</span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot>
                                    <tr className="border-t bg-slate-50 font-medium">
                                      <td className="px-2.5 py-1.5">合计</td>
                                      <td colSpan={2} className="px-2.5 py-1.5 text-right text-emerald-600 tabular-nums">
                                        {fmtMoney(stationRecords.reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0))}
                                      </td>
                                      <td></td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            ) : (
                              <div className="py-4 text-center text-xs text-slate-400">该站点暂无分红记录</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {shareholderConfigs.length === 0 && (
                <div className="rounded-xl border border-dashed bg-white py-12 text-center text-sm text-slate-400">
                  该股东暂无分红配置，请在「场地汇总」中配置
                </div>
              )}
            </div>
          )
        ) : (
          // ─── 场地汇总详情 ───
          !selectedLandlord ? (
            <div className="flex h-full flex-col items-center justify-center text-slate-400">
              <MapPin className="h-10 w-10 mb-2 text-slate-300" />
              <div className="text-sm">请从左侧选择场地方</div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 场地方信息卡片 */}
              <div className="rounded-xl border bg-white p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{selectedLandlord.landlord.name}</div>
                    <div className="text-xs text-slate-400">
                      {selectedLandlord.landlord.contact ? `联系人：${selectedLandlord.landlord.contact}` : ""}
                      {selectedLandlord.landlord.phone ? ` · ${selectedLandlord.landlord.phone}` : ""}
                      {selectedLandlord.stations?.length > 0 && ` · ${selectedLandlord.stations.length} 个站点`}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  <div className="rounded-lg border bg-slate-50 px-3 py-2">
                    <div className="text-[10px] text-slate-400">电表数</div>
                    <div className="text-sm font-semibold tabular-nums">{selectedLandlord.meterCount}</div>
                  </div>
                  <div className="rounded-lg border bg-slate-50 px-3 py-2">
                    <div className="text-[10px] text-slate-400">总度数</div>
                    <div className="text-sm font-semibold tabular-nums">{fmtNum(selectedLandlord.totalKwh)} <span className="text-[10px] font-normal text-slate-400">度</span></div>
                  </div>
                  <div className="rounded-lg border bg-rose-50 px-3 py-2">
                    <div className="text-[10px] text-rose-500">电费成本</div>
                    <div className="text-sm font-semibold tabular-nums text-rose-600">{fmtMoney(selectedLandlord.elecPay)}</div>
                  </div>
                  <div className="rounded-lg border bg-emerald-50 px-3 py-2">
                    <div className="text-[10px] text-emerald-500">电费收入</div>
                    <div className="text-sm font-semibold tabular-nums text-emerald-600">{fmtMoney(selectedLandlord.elecCollect)}</div>
                  </div>
                  <div className="rounded-lg border bg-slate-50 px-3 py-2">
                    <div className="text-[10px] text-slate-400">电费利润</div>
                    <div className={`text-sm font-semibold tabular-nums ${selectedLandlord.elecProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtMoney(selectedLandlord.elecProfit)}</div>
                  </div>
                  <div className="rounded-lg border bg-rose-50 px-3 py-2">
                    <div className="text-[10px] text-rose-500">租金成本</div>
                    <div className="text-sm font-semibold tabular-nums text-rose-600">{fmtMoney(selectedLandlord.rentCost)}</div>
                  </div>
                  <div className="rounded-lg border bg-emerald-50 px-3 py-2">
                    <div className="text-[10px] text-emerald-500">租金收入</div>
                    <div className="text-sm font-semibold tabular-nums text-emerald-600">{fmtMoney(selectedLandlord.rentIncome)}</div>
                  </div>
                  <div className="rounded-lg border bg-blue-50 px-3 py-2">
                    <div className="text-[10px] text-blue-500">总利润</div>
                    <div className={`text-sm font-semibold tabular-nums ${selectedLandlord.totalProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtMoney(selectedLandlord.totalProfit)}</div>
                  </div>
                </div>
              </div>

              {/* 站点列表 */}
              {selectedLandlord.stations?.length > 0 && (
                <div className="rounded-xl border bg-white overflow-hidden">
                  <div className="border-b bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
                    站点（{selectedLandlord.stations.length} 个）
                  </div>
                  <div className="divide-y">
                    {selectedLandlord.stations.map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between px-4 py-2">
                        <div className="flex items-center gap-2 text-xs">
                          <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="font-medium text-slate-700">{s.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          占股 {fmtPct(s.company_share)} · {s.status}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 分红配置 */}
              {selectedStationId && (
                <div className="rounded-xl border bg-white overflow-hidden">
                  <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                      <Settings className="h-3.5 w-3.5" />
                      分红配置
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setConfigOpen({ open: true, type: "shareholder", stationId: selectedStationId })} className="rounded-md bg-blue-50 border border-blue-200 px-2 py-1 text-[11px] text-blue-700 hover:bg-blue-100">
                        + 股东分红
                      </button>
                      <button onClick={() => setConfigOpen({ open: true, type: "introducer", stationId: selectedStationId })} className="rounded-md bg-purple-50 border border-purple-200 px-2 py-1 text-[11px] text-purple-700 hover:bg-purple-100">
                        + 商务分红
                      </button>
                    </div>
                  </div>

                  {shConfigs && shConfigs.length > 0 && (
                    <div className="border-b">
                      <div className="px-4 py-1.5 text-[11px] font-semibold text-slate-500 bg-blue-50/50">股东分红配置</div>
                      {shConfigs.map((c: any) => {
                        const isExpanded = expandedShareholderId === c.shareholder_id;
                        // 获取该股东在当前站点的分红记录
                        const shareholderRecords = (stationDividends ?? []).flatMap((r: any) => {
                          const shares = (r.shares ?? []).filter((s: any) => s.shareholder_id === c.shareholder_id);
                          if (shares.length === 0) return [];
                          return [{ ...r, shares }];
                        });
                        // 获取该股东的预估分红
                        const estimatedDividend = dividendPreview?.shareholderDividends?.find(
                          (d: any) => d.shareholderId === c.shareholder_id
                        );
                        const hasEstimate = !!estimatedDividend;
                        return (
                          <div key={c.id}>
                            <div className={`flex items-center justify-between border-b last:border-0 px-4 py-2 hover:bg-slate-50/50 ${isExpanded ? "bg-blue-50/30" : ""}`}>
                              <div className="flex items-center gap-2 text-xs">
                                <Users className="h-3.5 w-3.5 text-blue-500" />
                                <button
                                  onClick={() => setExpandedShareholderId(isExpanded ? null : c.shareholder_id)}
                                  className="font-medium text-slate-700 hover:text-blue-600 transition-colors cursor-pointer"
                                >
                                  {c.shareholder_name}
                                </button>
                                <span className="text-slate-400">·</span>
                                <span className="text-slate-500">{c.mode === "固定金额" ? `固定 ${fmtMoney(c.fixed_amount)}` : `${c.mode} ${(c.ratio * 100).toFixed(1)}%`}</span>
                                {hasEstimate && (
                                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700 font-medium">预估 {fmtMoney(estimatedDividend.amount)}</span>
                                )}
                                {shareholderRecords.length > 0 && (
                                  <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-600">{shareholderRecords.length} 条记录</span>
                                )}
                              </div>
                              <button onClick={() => deleteConfigMut.mutate({ type: "shareholder", id: c.id })} className="text-slate-400 hover:text-rose-500 transition-colors">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            {/* 展开的分红详情 */}
                            {isExpanded && (
                              <div className="bg-blue-50/20 border-b px-4 py-3 space-y-3">
                                {/* 分红配置信息 */}
                                <div className="rounded-lg border bg-white p-3">
                                  <div className="text-[11px] font-semibold text-slate-600 mb-2">分红配置</div>
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div><span className="text-slate-400">分红模式：</span><span className="font-medium text-slate-700">{c.mode}</span></div>
                                    {c.mode !== "固定金额" && (
                                      <div><span className="text-slate-400">分红比例：</span><span className="font-medium text-slate-700">{(c.ratio * 100).toFixed(1)}%</span></div>
                                    )}
                                    {c.mode === "固定金额" && (
                                      <div><span className="text-slate-400">固定金额：</span><span className="font-medium text-slate-700">{fmtMoney(c.fixed_amount)}/月</span></div>
                                    )}
                                  </div>
                                </div>

                                {/* 预估分红计算明细 */}
                                {hasEstimate && dividendPreview && (
                                  <div className="rounded-lg border bg-white overflow-hidden">
                                    <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-600 bg-slate-50 border-b">
                                      预估分红计算明细（{selectedMonth}）
                                    </div>
                                    <div className="p-3 space-y-3">
                                      {/* 收入明细 */}
                                      <div>
                                        <div className="text-[11px] font-semibold text-emerald-600 mb-1.5">收入构成</div>
                                        <table className="w-full text-xs">
                                          <tbody>
                                            <tr className="border-b">
                                              <td className="py-1 text-slate-500">电费收入</td>
                                              <td className="py-1 text-right tabular-nums text-slate-700">{fmtMoney(dividendPreview.income?.elecIncome?.total || 0)}</td>
                                            </tr>
                                            {dividendPreview.income?.elecIncome?.details?.length > 0 && dividendPreview.income.elecIncome.details.map((d: any, i: number) => (
                                              <tr key={i} className="text-[10px]">
                                                <td className="py-0.5 pl-4 text-slate-400">{d.meterNo}（{d.brandName}）{d.kwh}度 × {d.unitPrice}元/度</td>
                                                <td className="py-0.5 text-right tabular-nums text-slate-500">{fmtMoney(d.amount)}</td>
                                              </tr>
                                            ))}
                                            <tr className="border-b">
                                              <td className="py-1 text-slate-500">租金收入（品牌方合同）</td>
                                              <td className="py-1 text-right tabular-nums text-slate-700">{fmtMoney(dividendPreview.income?.rentIncome?.total || 0)}</td>
                                            </tr>
                                            {dividendPreview.income?.rentIncome?.details?.length > 0 && dividendPreview.income.rentIncome.details.map((d: any, i: number) => (
                                              <tr key={i} className="text-[10px]">
                                                <td className="py-0.5 pl-4 text-slate-400">{d.brandName} {d.cabinets}柜 × {fmtMoney(d.unitMonthlyRent)}/柜</td>
                                                <td className="py-0.5 text-right tabular-nums text-slate-500">{fmtMoney(d.amount)}</td>
                                              </tr>
                                            ))}
                                            <tr className="font-semibold">
                                              <td className="py-1 text-slate-700">总收入</td>
                                              <td className="py-1 text-right tabular-nums text-emerald-600">{fmtMoney(dividendPreview.income?.totalIncome || 0)}</td>
                                            </tr>
                                          </tbody>
                                        </table>
                                      </div>

                                      {/* 成本明细 */}
                                      <div>
                                        <div className="text-[11px] font-semibold text-rose-600 mb-1.5">成本构成</div>
                                        <table className="w-full text-xs">
                                          <tbody>
                                            <tr className="border-b">
                                              <td className="py-1 text-slate-500">电费成本</td>
                                              <td className="py-1 text-right tabular-nums text-slate-700">{fmtMoney(dividendPreview.cost?.elecCost || 0)}</td>
                                            </tr>
                                            {dividendPreview.cost?.details?.electricity?.length > 0 && dividendPreview.cost.details.electricity.map((d: any, i: number) => (
                                              <tr key={i} className="text-[10px]">
                                                <td className="py-0.5 pl-4 text-slate-400">{d.meterNo} {d.kwh}度 × {d.unitPrice}元/度</td>
                                                <td className="py-0.5 text-right tabular-nums text-slate-500">{fmtMoney(d.amount)}</td>
                                              </tr>
                                            ))}
                                            <tr className="border-b">
                                              <td className="py-1 text-slate-500">场地租金</td>
                                              <td className="py-1 text-right tabular-nums text-slate-700">{fmtMoney(dividendPreview.cost?.rentCost || 0)}</td>
                                            </tr>
                                            {dividendPreview.cost?.details?.rent?.length > 0 && dividendPreview.cost.details.rent.map((d: any, i: number) => (
                                              <tr key={i} className="text-[10px]">
                                                <td className="py-0.5 pl-4 text-slate-400">{d.landlordName}</td>
                                                <td className="py-0.5 text-right tabular-nums text-slate-500">{fmtMoney(d.monthlyRent)}</td>
                                              </tr>
                                            ))}
                                            <tr className="border-b">
                                              <td className="py-1 text-slate-500">运营费用</td>
                                              <td className="py-1 text-right tabular-nums text-slate-700">{fmtMoney(dividendPreview.cost?.opExpense || 0)}</td>
                                            </tr>
                                            {dividendPreview.cost?.bizDividendCost > 0 && (
                                              <tr className="border-b">
                                                <td className="py-1 text-slate-500">商务分红（计入成本）</td>
                                                <td className="py-1 text-right tabular-nums text-slate-700">{fmtMoney(dividendPreview.cost.bizDividendCost)}</td>
                                              </tr>
                                            )}
                                            <tr className="font-semibold">
                                              <td className="py-1 text-slate-700">总成本</td>
                                              <td className="py-1 text-right tabular-nums text-rose-600">{fmtMoney(dividendPreview.cost?.totalCost || 0)}</td>
                                            </tr>
                                          </tbody>
                                        </table>
                                      </div>

                                      {/* 利润和分红计算 */}
                                      <div className="rounded-lg bg-slate-50 p-2.5 space-y-1.5">
                                        <div className="flex justify-between text-xs">
                                          <span className="text-slate-500">净利润</span>
                                          <span className={`font-semibold tabular-nums ${(dividendPreview.profit || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtMoney(dividendPreview.profit || 0)}</span>
                                        </div>
                                        <div className="border-t pt-1.5">
                                          <div className="flex justify-between text-xs">
                                            <span className="text-slate-500">分红模式</span>
                                            <span className="font-medium text-slate-700">{estimatedDividend.mode}</span>
                                          </div>
                                          {estimatedDividend.mode === "收入分红" && (
                                            <div className="flex justify-between text-xs">
                                              <span className="text-slate-500">计算公式</span>
                                              <span className="text-slate-600">总收入 {fmtMoney(dividendPreview.income?.totalIncome)} × {(estimatedDividend.ratio * 100).toFixed(1)}%</span>
                                            </div>
                                          )}
                                          {estimatedDividend.mode === "利润分红" && (
                                            <div className="flex justify-between text-xs">
                                              <span className="text-slate-500">计算公式</span>
                                              <span className="text-slate-600">净利润 {fmtMoney(dividendPreview.profit)} × {(estimatedDividend.ratio * 100).toFixed(1)}%</span>
                                            </div>
                                          )}
                                          {estimatedDividend.mode === "固定金额" && (
                                            <div className="flex justify-between text-xs">
                                              <span className="text-slate-500">计算公式</span>
                                              <span className="text-slate-600">固定金额 {fmtMoney(estimatedDividend.fixedAmount)}/月</span>
                                            </div>
                                          )}
                                        </div>
                                        <div className="border-t pt-1.5">
                                          <div className="flex justify-between text-sm font-semibold">
                                            <span className="text-slate-700">预估分红金额</span>
                                            <span className="tabular-nums text-emerald-600">{fmtMoney(estimatedDividend.amount)}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* 历史分红记录 */}
                                {shareholderRecords.length > 0 ? (
                                  <div className="rounded-lg border bg-white overflow-hidden">
                                    <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-600 bg-slate-50 border-b">历史分红记录</div>
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b bg-slate-50/50 text-left text-slate-500">
                                          <th className="px-2.5 py-1.5 font-medium">月份</th>
                                          <th className="px-2.5 py-1.5 font-medium">类型</th>
                                          <th className="px-2.5 py-1.5 text-right font-medium">分红金额</th>
                                          <th className="px-2.5 py-1.5 font-medium">状态</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {shareholderRecords.map((r: any) => (
                                          <tr key={r.id} className="border-b last:border-0">
                                            <td className="px-2.5 py-1.5 text-slate-600">{r.period}</td>
                                            <td className="px-2.5 py-1.5">
                                              <span className={`rounded-full px-2 py-0.5 text-[10px] ${r.type === "股东分红" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>{r.type}</span>
                                            </td>
                                            <td className="px-2.5 py-1.5 text-right font-medium text-emerald-600 tabular-nums">
                                              {fmtMoney(r.shares.reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0))}
                                            </td>
                                            <td className="px-2.5 py-1.5">
                                              <span className={`rounded-full px-2 py-0.5 text-[10px] ${r.status === "已结算" ? "bg-emerald-100 text-emerald-700" : r.status === "已通过" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{r.status}</span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tfoot>
                                        <tr className="border-t bg-slate-50 font-medium">
                                          <td colSpan={2} className="px-2.5 py-1.5">合计</td>
                                          <td className="px-2.5 py-1.5 text-right text-emerald-600 tabular-nums">
                                            {fmtMoney(shareholderRecords.reduce((sum: number, r: any) => sum + r.shares.reduce((s: number, sh: any) => s + Number(sh.amount || 0), 0), 0))}
                                          </td>
                                          <td></td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                ) : !hasEstimate ? (
                                  <div className="py-4 text-center text-xs text-slate-400">暂无分红记录和预估数据</div>
                                ) : null}

                                {/* 提示信息 */}
                                {shareholderRecords.length === 0 && hasEstimate && (
                                  <div className="text-[10px] text-slate-400 text-center">
                                    提示：点击「新增月结」可创建实际分红记录
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {intConfigs && intConfigs.length > 0 && (
                    <div>
                      <div className="px-4 py-1.5 text-[11px] font-semibold text-slate-500 bg-purple-50/50">商务分红配置</div>
                      {intConfigs.map((c: any) => {
                        const isIntExpanded = expandedShareholderId === -c.introducer_id; // 用负数区分介绍人
                        // 获取该介绍人在当前站点的分红记录
                        const introducerRecords = (stationDividends ?? []).flatMap((r: any) => {
                          const shares = (r.shares ?? []).filter((s: any) => s.introducer_id === c.introducer_id);
                          if (shares.length === 0) return [];
                          return [{ ...r, shares }];
                        });
                        // 获取该介绍人的预估分红
                        const estimatedBizDividend = dividendPreview?.bizDividends?.find(
                          (d: any) => d.introducerId === c.introducer_id
                        );
                        const hasBizEstimate = !!estimatedBizDividend;
                        return (
                          <div key={c.id}>
                            <div className={`flex items-center justify-between border-b last:border-0 px-4 py-2 hover:bg-slate-50/50 ${isIntExpanded ? "bg-purple-50/30" : ""}`}>
                              <div className="flex items-center gap-2 text-xs">
                                <UserPlus className="h-3.5 w-3.5 text-purple-500" />
                                <button
                                  onClick={() => setExpandedShareholderId(isIntExpanded ? null : -c.introducer_id)}
                                  className="font-medium text-slate-700 hover:text-purple-600 transition-colors cursor-pointer"
                                >
                                  {c.introducer_name}
                                </button>
                                <span className="text-slate-400">·</span>
                                <span className="text-slate-500">{c.mode === "固定金额" ? `固定 ${fmtMoney(c.fixed_amount)}` : `${c.mode} ${(c.ratio * 100).toFixed(1)}%`}</span>
                                {c.count_as_cost && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">计入成本</span>}
                                {hasBizEstimate && (
                                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700 font-medium">预估 {fmtMoney(estimatedBizDividend.amount)}</span>
                                )}
                              </div>
                              <button onClick={() => deleteConfigMut.mutate({ type: "introducer", id: c.id })} className="text-slate-400 hover:text-rose-500 transition-colors">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            {/* 展开的分红详情 */}
                            {isIntExpanded && (
                              <div className="bg-purple-50/20 border-b px-4 py-3 space-y-3">
                                {/* 分红配置信息 */}
                                <div className="rounded-lg border bg-white p-3">
                                  <div className="text-[11px] font-semibold text-slate-600 mb-2">商务分红配置</div>
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div><span className="text-slate-400">分红模式：</span><span className="font-medium text-slate-700">{c.mode}</span></div>
                                    {c.mode !== "固定金额" && (
                                      <div><span className="text-slate-400">分红比例：</span><span className="font-medium text-slate-700">{(c.ratio * 100).toFixed(1)}%</span></div>
                                    )}
                                    {c.mode === "固定金额" && (
                                      <div><span className="text-slate-400">固定金额：</span><span className="font-medium text-slate-700">{fmtMoney(c.fixed_amount)}/月</span></div>
                                    )}
                                    <div><span className="text-slate-400">计入成本：</span><span className={`font-medium ${c.count_as_cost ? "text-amber-600" : "text-slate-500"}`}>{c.count_as_cost ? "是" : "否"}</span></div>
                                  </div>
                                </div>

                                {/* 预估分红计算明细 */}
                                {hasBizEstimate && dividendPreview && (
                                  <div className="rounded-lg border bg-white overflow-hidden">
                                    <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-600 bg-slate-50 border-b">
                                      预估商务分红计算明细（{selectedMonth}）
                                    </div>
                                    <div className="p-3 space-y-3">
                                      {/* 收入明细 */}
                                      <div>
                                        <div className="text-[11px] font-semibold text-emerald-600 mb-1.5">收入构成</div>
                                        <table className="w-full text-xs">
                                          <tbody>
                                            <tr className="border-b">
                                              <td className="py-1 text-slate-500">电费收入</td>
                                              <td className="py-1 text-right tabular-nums text-slate-700">{fmtMoney(dividendPreview.income?.elecIncome?.total || 0)}</td>
                                            </tr>
                                            <tr className="border-b">
                                              <td className="py-1 text-slate-500">租金收入（品牌方合同）</td>
                                              <td className="py-1 text-right tabular-nums text-slate-700">{fmtMoney(dividendPreview.income?.rentIncome?.total || 0)}</td>
                                            </tr>
                                            <tr className="font-semibold">
                                              <td className="py-1 text-slate-700">总收入</td>
                                              <td className="py-1 text-right tabular-nums text-emerald-600">{fmtMoney(dividendPreview.income?.totalIncome || 0)}</td>
                                            </tr>
                                          </tbody>
                                        </table>
                                      </div>

                                      {/* 成本明细 */}
                                      <div>
                                        <div className="text-[11px] font-semibold text-rose-600 mb-1.5">成本构成</div>
                                        <table className="w-full text-xs">
                                          <tbody>
                                            <tr className="border-b">
                                              <td className="py-1 text-slate-500">电费成本</td>
                                              <td className="py-1 text-right tabular-nums text-slate-700">{fmtMoney(dividendPreview.cost?.elecCost || 0)}</td>
                                            </tr>
                                            <tr className="border-b">
                                              <td className="py-1 text-slate-500">场地租金</td>
                                              <td className="py-1 text-right tabular-nums text-slate-700">{fmtMoney(dividendPreview.cost?.rentCost || 0)}</td>
                                            </tr>
                                            <tr className="border-b">
                                              <td className="py-1 text-slate-500">运营费用</td>
                                              <td className="py-1 text-right tabular-nums text-slate-700">{fmtMoney(dividendPreview.cost?.opExpense || 0)}</td>
                                            </tr>
                                            <tr className="font-semibold">
                                              <td className="py-1 text-slate-700">基础成本</td>
                                              <td className="py-1 text-right tabular-nums text-rose-600">{fmtMoney((dividendPreview.cost?.elecCost || 0) + (dividendPreview.cost?.rentCost || 0) + (dividendPreview.cost?.opExpense || 0))}</td>
                                            </tr>
                                          </tbody>
                                        </table>
                                      </div>

                                      {/* 分红计算 */}
                                      <div className="rounded-lg bg-slate-50 p-2.5 space-y-1.5">
                                        {estimatedBizDividend.mode === "利润分红" && c.count_as_cost && (
                                          <>
                                            <div className="flex justify-between text-xs">
                                              <span className="text-slate-500">分红基数（总收入 - 基础成本）</span>
                                              <span className="font-medium tabular-nums text-slate-700">{fmtMoney(estimatedBizDividend.baseAmount)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                              <span className="text-slate-500">计算公式</span>
                                              <span className="text-slate-600">{fmtMoney(estimatedBizDividend.baseAmount)} × {(estimatedBizDividend.ratio * 100).toFixed(1)}%</span>
                                            </div>
                                          </>
                                        )}
                                        {estimatedBizDividend.mode === "利润分红" && !c.count_as_cost && (
                                          <>
                                            <div className="flex justify-between text-xs">
                                              <span className="text-slate-500">净利润</span>
                                              <span className={`font-medium tabular-nums ${(dividendPreview.profit || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtMoney(dividendPreview.profit || 0)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                              <span className="text-slate-500">计算公式</span>
                                              <span className="text-slate-600">净利润 {fmtMoney(dividendPreview.profit)} × {(estimatedBizDividend.ratio * 100).toFixed(1)}%</span>
                                            </div>
                                          </>
                                        )}
                                        {estimatedBizDividend.mode === "收入分红" && (
                                          <div className="flex justify-between text-xs">
                                            <span className="text-slate-500">计算公式</span>
                                            <span className="text-slate-600">总收入 {fmtMoney(dividendPreview.income?.totalIncome)} × {(estimatedBizDividend.ratio * 100).toFixed(1)}%</span>
                                          </div>
                                        )}
                                        {estimatedBizDividend.mode === "固定金额" && (
                                          <div className="flex justify-between text-xs">
                                            <span className="text-slate-500">计算公式</span>
                                            <span className="text-slate-600">固定金额 {fmtMoney(estimatedBizDividend.fixedAmount)}/月</span>
                                          </div>
                                        )}
                                        <div className="border-t pt-1.5">
                                          <div className="flex justify-between text-sm font-semibold">
                                            <span className="text-slate-700">预估商务分红</span>
                                            <span className="tabular-nums text-emerald-600">{fmtMoney(estimatedBizDividend.amount)}</span>
                                          </div>
                                          {c.count_as_cost && (
                                            <div className="text-[10px] text-amber-600 mt-1">此金额将计入成本，影响股东分红基数</div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* 历史分红记录 */}
                                {introducerRecords.length > 0 ? (
                                  <div className="rounded-lg border bg-white overflow-hidden">
                                    <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-600 bg-slate-50 border-b">历史分红记录</div>
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b bg-slate-50/50 text-left text-slate-500">
                                          <th className="px-2.5 py-1.5 font-medium">月份</th>
                                          <th className="px-2.5 py-1.5 text-right font-medium">分红金额</th>
                                          <th className="px-2.5 py-1.5 font-medium">状态</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {introducerRecords.map((r: any) => (
                                          <tr key={r.id} className="border-b last:border-0">
                                            <td className="px-2.5 py-1.5 text-slate-600">{r.period}</td>
                                            <td className="px-2.5 py-1.5 text-right font-medium text-emerald-600 tabular-nums">
                                              {fmtMoney(r.shares.reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0))}
                                            </td>
                                            <td className="px-2.5 py-1.5">
                                              <span className={`rounded-full px-2 py-0.5 text-[10px] ${r.status === "已结算" ? "bg-emerald-100 text-emerald-700" : r.status === "已通过" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{r.status}</span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tfoot>
                                        <tr className="border-t bg-slate-50 font-medium">
                                          <td className="px-2.5 py-1.5">合计</td>
                                          <td className="px-2.5 py-1.5 text-right text-emerald-600 tabular-nums">
                                            {fmtMoney(introducerRecords.reduce((sum: number, r: any) => sum + r.shares.reduce((s: number, sh: any) => s + Number(sh.amount || 0), 0), 0))}
                                          </td>
                                          <td></td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                ) : !hasBizEstimate ? (
                                  <div className="py-4 text-center text-xs text-slate-400">暂无分红记录和预估数据</div>
                                ) : null}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {(!shConfigs || shConfigs.length === 0) && (!intConfigs || intConfigs.length === 0) && (
                    <div className="px-4 py-6 text-center text-xs text-slate-400">暂无分红配置，请点击上方按钮添加</div>
                  )}
                </div>
              )}

              {/* 运营费用 */}
              {selectedStationId && (
                <div className="rounded-xl border bg-white overflow-hidden">
                  <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                      <DollarSign className="h-3.5 w-3.5" />
                      运营费用（{selectedMonth}）
                    </div>
                  </div>
                  <div className="p-3">
                    {/* 新增行 */}
                    <div className="flex items-center gap-2 mb-2">
                      <input className={`${inputCls} w-24 text-[11px]`} type="number" placeholder="金额" value={expenseDraft.amount}
                        onChange={(e) => setExpenseDraft((p) => ({ ...p, amount: e.target.value }))} />
                      <input className={`${inputCls} flex-1 text-[11px]`} placeholder="备注（如：维护费、保险费）" value={expenseDraft.remark}
                        onChange={(e) => setExpenseDraft((p) => ({ ...p, remark: e.target.value }))} />
                      <button className="rounded bg-emerald-600 px-2 py-1 text-[11px] text-white hover:bg-emerald-700"
                        onClick={() => {
                          if (!expenseDraft.amount) { toast.error("请填写金额"); return; }
                          saveExpenseMut.mutate({ stationId: selectedStationId, period: selectedMonth, amount: Number(expenseDraft.amount), remark: expenseDraft.remark || null });
                        }}>添加</button>
                    </div>
                    {/* 列表 */}
                    {expenses && expenses.length > 0 ? (
                      <div className="space-y-1">
                        {expenses.map((e: any) => (
                          <div key={e.id} className="flex items-center justify-between rounded border px-2 py-1.5 text-[11px] hover:bg-slate-50">
                            {editExpenseId === e.id ? (
                              <>
                                <input className={`${inputCls} w-20 text-[11px]`} type="number" value={editExpenseDraft.amount}
                                  onChange={(ev) => setEditExpenseDraft((p) => ({ ...p, amount: ev.target.value }))} />
                                <input className={`${inputCls} flex-1 mx-2 text-[11px]`} value={editExpenseDraft.remark}
                                  onChange={(ev) => setEditExpenseDraft((p) => ({ ...p, remark: ev.target.value }))} />
                                <button className="text-emerald-600 mr-1" onClick={() => {
                                  saveExpenseMut.mutate({ id: e.id, stationId: selectedStationId, period: selectedMonth, amount: Number(editExpenseDraft.amount), remark: editExpenseDraft.remark || null });
                                  setEditExpenseId(null);
                                }}>保存</button>
                                <button className="text-slate-400" onClick={() => setEditExpenseId(null)}>取消</button>
                              </>
                            ) : (
                              <>
                                <span className="font-medium text-slate-700 tabular-nums">{fmtMoney(e.amount)}</span>
                                <span className="flex-1 mx-2 text-slate-500 truncate">{e.remark || "-"}</span>
                                <button className="text-slate-400 hover:text-emerald-600 mr-1" onClick={() => {
                                  setEditExpenseId(e.id);
                                  setEditExpenseDraft({ amount: String(e.amount), remark: e.remark || "" });
                                }}>编辑</button>
                                <button className="text-slate-400 hover:text-rose-500" onClick={() => {
                                  if (window.confirm("删除该费用？")) deleteExpenseMut.mutate(e.id);
                                }}>删除</button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-3 text-center text-[11px] text-slate-400">暂无运营费用</div>
                    )}
                  </div>
                </div>
              )}

              {/* 分红记录 */}
              {selectedStationId && (
                <div className="rounded-xl border bg-white overflow-hidden">
                  <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                      <DollarSign className="h-3.5 w-3.5" />
                      分红记录
                    </div>
                    <button onClick={() => setAddDividendOpen({ open: true, stationId: selectedStationId })} className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] text-white hover:bg-emerald-700">
                      新增月结
                    </button>
                  </div>

                  {stationDividends && stationDividends.length > 0 ? (
                    <div className="divide-y">
                      {stationDividends.map((r: any) => (
                        <div key={r.id} className="px-4 py-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-700">{r.period}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] ${r.type === "股东分红" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>{r.type}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] ${r.status === "已结算" ? "bg-emerald-100 text-emerald-700" : r.status === "已通过" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{r.status}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className={`text-sm font-semibold tabular-nums ${r.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>利润 {fmtMoney(r.profit)}</div>
                              {r.status === "未结算" && (
                                <button
                                  onClick={() => setSubmitApprovalDiv(r)}
                                  className="rounded-md bg-blue-600 px-2 py-1 text-[11px] text-white hover:bg-blue-700"
                                >
                                  提交审批
                                </button>
                              )}
                              {r.status === "审批中" && (
                                <span className="text-[10px] text-amber-600">审批中…</span>
                              )}
                            </div>
                          </div>
                          {r.shares && r.shares.length > 0 && (
                            <div className="ml-4 space-y-1">
                              {r.shares.map((s: any, i: number) => (
                                <div key={i} className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-500">{s.shareholder_name || s.introducer_name || "-"}</span>
                                  <span className="font-medium tabular-nums text-slate-700">{fmtMoney(s.amount)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center text-xs text-slate-400">暂无分红记录</div>
                  )}
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* ─── 弹窗 ─── */}
      <AddShareholderDialog open={addShareholderOpen} onClose={() => setAddShareholderOpen(false)} />
      <ConfigDividendDialog open={configOpen.open} onClose={() => setConfigOpen({ ...configOpen, open: false })} type={configOpen.type} stationId={configOpen.stationId} />
      <AddDividendDialog open={addDividendOpen.open} onClose={() => setAddDividendOpen({ ...addDividendOpen, open: false })} stationId={addDividendOpen.stationId} />
      <SubmitApprovalDialog
        open={!!submitApprovalDiv}
        onClose={() => setSubmitApprovalDiv(null)}
        dividend={submitApprovalDiv}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["stationDividends"] });
          qc.invalidateQueries({ queryKey: ["approvals"] });
        }}
      />
    </div>
  );
}
