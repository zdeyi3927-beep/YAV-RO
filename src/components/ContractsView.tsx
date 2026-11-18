import { useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  Download,
  FilePlus2,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  APPROVAL_LABELS,
  CONTRACT_EXPIRING_WINDOW_DAYS,
  CONTRACT_LABELS,
  Contract,
  defaultTargetEndDate,
  getContractHealth,
  getEffectiveApprovalStatus,
  todayIsoDate,
  Worker,
} from '../types/workforce';
import { exportExpiringContractsByTeamExcel } from '../utils/exportContractsExcel';
import { ContractDocumentModal } from './ContractDocumentModal';
import { SpreadsheetScrollWrapper } from './SpreadsheetScrollWrapper';

interface ContractsViewProps {
  contracts: Contract[];
  workers: Worker[];
  loading: boolean;
  onCreateNewContract: () => void;
  onRefreshSchedule: (targetEndDate: string) => Promise<{ added: number; removed: number }>;
  onApproveContract: (
    contract: Contract,
    targetEndDate: string
  ) => Promise<{ generatedNext: boolean }>;
  onRejectContract: (contract: Contract) => Promise<void>;
  onDeleteContract: (contract: Contract) => Promise<void>;
}

type ContractFilterTab =
  | 'pending_approval'
  | 'expiring_25'
  | 'by_month'
  | 'approved'
  | 'rejected'
  | 'all';

export function ContractsView({
  contracts,
  workers,
  loading,
  onCreateNewContract,
  onRefreshSchedule,
  onApproveContract,
  onRejectContract,
  onDeleteContract,
}: ContractsViewProps) {
  const [filterTab, setFilterTab] = useState<ContractFilterTab>('pending_approval');
  const [searchQuery, setSearchQuery] = useState('');
  const [targetEndDate, setTargetEndDate] = useState(defaultTargetEndDate());
  const [queryMonth, setQueryMonth] = useState(() => todayIsoDate().slice(0, 7)); // YYYY-MM
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'info' | 'error'; text: string } | null>(
    null
  );
  const [printingContract, setPrintingContract] = useState<Contract | null>(null);

  const workerById = useMemo(() => {
    const map = new Map<string, Worker>();
    for (const w of workers) {
      map.set(w.id, w);
    }
    return map;
  }, [workers]);

  const counts = useMemo(() => {
    let pending = 0;
    let expiring25 = 0;
    let byMonth = 0;
    let approved = 0;
    let rejected = 0;

    for (const c of contracts) {
      const approval = getEffectiveApprovalStatus(c);
      if (approval === 'pending_approval') pending += 1;
      else if (approval === 'approved') approved += 1;
      else if (approval === 'rejected') rejected += 1;

      if (approval !== 'rejected') {
        const h = getContractHealth(c);
        if (
          c.status === 'active' &&
          h.daysRemaining >= 0 &&
          h.daysRemaining <= CONTRACT_EXPIRING_WINDOW_DAYS
        ) {
          expiring25 += 1;
        }
        if (c.endDate.startsWith(queryMonth)) {
          byMonth += 1;
        }
      }
    }

    return {
      all: contracts.length,
      pending,
      expiring25,
      byMonth,
      approved,
      rejected,
    };
  }, [contracts, queryMonth]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return contracts.filter((c) => {
      const approval = getEffectiveApprovalStatus(c);
      if (filterTab === 'pending_approval' && approval !== 'pending_approval') return false;
      if (filterTab === 'approved' && approval !== 'approved') return false;
      if (filterTab === 'rejected' && approval !== 'rejected') return false;
      if (filterTab === 'expiring_25') {
        if (approval === 'rejected' || c.status !== 'active') return false;
        const h = getContractHealth(c);
        if (h.daysRemaining < 0 || h.daysRemaining > CONTRACT_EXPIRING_WINDOW_DAYS) return false;
      }
      if (filterTab === 'by_month') {
        if (approval === 'rejected') return false;
        if (!c.endDate.startsWith(queryMonth)) return false;
      }

      if (!q) return true;
      const w = workerById.get(c.workerId);
      const enName = (c.englishName || w?.englishName || '').toLowerCase();
      return (
        c.workerName.toLowerCase().includes(q) ||
        enName.includes(q) ||
        c.employeeCode.toLowerCase().includes(q) ||
        c.team.toLowerCase().includes(q)
      );
    });
  }, [contracts, filterTab, searchQuery, queryMonth, workerById]);

  const selectedContract = useMemo(
    () => contracts.find((c) => c.id === selectedContractId) || null,
    [contracts, selectedContractId]
  );

  const handleRefreshSchedule = async () => {
    setBusyAction('refresh');
    setFeedback(null);
    try {
      const { added, removed } = await onRefreshSchedule(targetEndDate);
      setFeedback({
        kind: 'success',
        text:
          added > 0 || removed > 0
            ? `ធ្វើបច្ចុប្បន្នភាពកុងត្រាជោគជ័យ! បន្ថែម ${added} ជួរ · សម្អាតជួរស្ទួន/ចាស់ ${removed} ជួរ (刷新完成: 新增 ${added}, 清理重复 ${removed})`
            : 'កុងត្រាទាំងអស់ត្រូវតាមថ្ងៃចូលធ្វើការ និងគ្មានជួរស្ទួនទេ (所有合同已最新且无重复)',
      });
    } catch (err) {
      setFeedback({
        kind: 'error',
        text: err instanceof Error ? err.message : 'មិនអាចធ្វើបច្ចុប្បន្នភាពកុងត្រាបានទេ',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleApprove = async (c: Contract) => {
    const approval = getEffectiveApprovalStatus(c);
    if (approval !== 'pending_approval') {
      setFeedback({
        kind: 'info',
        text: 'មានតែកុងត្រា "រង់ចាំអនុម័ត (待审批)" ប៉ុណ្ណោះដែលអាចអនុម័តបាន',
      });
      return;
    }
    setBusyAction(`approve_${c.id}`);
    setFeedback(null);
    try {
      const res = await onApproveContract(c, targetEndDate);
      setFeedback({
        kind: 'success',
        text: res.generatedNext
          ? `អនុម័តកុងត្រា ${c.employeeCode} · ${c.workerName} ជោគជ័យ! បានបង្កើតកុងត្រាបន្ត ៩០ ថ្ងៃថ្មីដោយស្វ័យប្រវត្តិ (审批通过，已生成下一份90天合同)`
          : `អនុម័តកុងត្រា ${c.employeeCode} · ${c.workerName} ជោគជ័យ! (已通过)`,
      });
    } catch (err) {
      setFeedback({
        kind: 'error',
        text: err instanceof Error ? err.message : 'មិនអាចអនុម័តកុងត្រាបានទេ',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleReject = async (c: Contract) => {
    const approval = getEffectiveApprovalStatus(c);
    if (approval !== 'pending_approval') {
      setFeedback({
        kind: 'info',
        text: 'មានតែកុងត្រា "រង់ចាំអនុម័ត (待审批)" ប៉ុណ្ណោះដែលអាចបដិសេធបាន',
      });
      return;
    }
    setBusyAction(`reject_${c.id}`);
    setFeedback(null);
    try {
      await onRejectContract(c);
      setFeedback({
        kind: 'info',
        text: `បានសម្គាល់មិនអនុម័តសម្រាប់ ${c.employeeCode} · ${c.workerName} (不通过 · 不再续签)`,
      });
    } catch (err) {
      setFeedback({
        kind: 'error',
        text: err instanceof Error ? err.message : 'មិនអាចបដិសេធកុងត្រាបានទេ',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleExportMonthlyExcel = () => {
    const result = exportExpiringContractsByTeamExcel(contracts, workers, queryMonth);
    if (!result) {
      setFeedback({
        kind: 'info',
        text: `មិនមានកុងត្រារង់ចាំអនុម័តផុតកំណត់ក្នុងខែ ${queryMonth} ទេ (该月份没有待审批到期合同)`,
      });
      return;
    }
    setFeedback({
      kind: 'success',
      text: `នាំចេញ Excel ជោគជ័យ! សរុប ${result.exportedCount} កុងត្រា ចែកជា ${result.teamCount} ក្រុម (导出成功: 共${result.exportedCount}份，按${result.teamCount}个班组分Sheet)`,
    });
  };

  const handleDelete = async (c: Contract) => {
    setBusyAction(`delete_${c.id}`);
    setConfirmDeleteId(null);
    setFeedback(null);
    try {
      await onDeleteContract(c);
      if (selectedContractId === c.id) {
        setSelectedContractId(null);
      }
      setFeedback({
        kind: 'info',
        text: `បានលុបជួរកុងត្រា ${c.employeeCode} (${c.startDate} → ${c.endDate}) រួចរាល់`,
      });
    } catch (err) {
      setFeedback({
        kind: 'error',
        text: err instanceof Error ? err.message : 'មិនអាចលុបកុងត្រាបានទេ',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handlePrint = (c: Contract) => {
    setPrintingContract(c);
  };

  return (
    <div className="space-y-4">
      {/* Header Summary & VBA Operation Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              ការអនុម័តបន្តកុងត្រា · 合同续签审批{' '}
              <span className="font-mono tabular-nums text-rose-700">
                (ផុតកំណត់ក្នុង ២៥ ថ្ងៃ / 25天内到期: {counts.expiring25} 份)
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              សាកល្បង ៦០ ថ្ងៃ (试用期60天) → បន្តកុងត្រាពេញសិទ្ធិ ៩០ ថ្ងៃ (续签合同90天)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-slate-600">
              <span className="whitespace-nowrap">ដល់ថ្ងៃគោលដៅ (TARGET):</span>
              <input
                type="date"
                value={targetEndDate}
                onChange={(e) => setTargetEndDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </label>

            <label className="inline-flex items-center gap-2 text-xs text-slate-600">
              <span className="whitespace-nowrap">ខែស្វែងរក/នាំចេញ:</span>
              <input
                type="month"
                value={queryMonth}
                onChange={(e) => setQueryMonth(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </label>
          </div>
        </div>

        {/* 6 VBA Operation Panel Buttons + Add Contract */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleRefreshSchedule()}
            disabled={busyAction !== null || workers.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busyAction === 'refresh' ? 'animate-spin' : ''}`} />
            <span>ធ្វើបច្ចុប្បន្នភាពកុងត្រា (刷新合同)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!selectedContract) {
                setFeedback({
                  kind: 'info',
                  text: 'សូមចុចជ្រើសរើសជួរកុងត្រាមួយក្នុងតារាងជាមុន (请先选中一条合同记录)',
                });
                return;
              }
              void handleApprove(selectedContract);
            }}
            disabled={busyAction !== null}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            <Check className="w-3.5 h-3.5" />
            <span>អនុម័ត (审批通过)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!selectedContract) {
                setFeedback({
                  kind: 'info',
                  text: 'សូមចុចជ្រើសរើសជួរកុងត្រាមួយក្នុងតារាងជាមុន (请先选中一条合同记录)',
                });
                return;
              }
              void handleReject(selectedContract);
            }}
            disabled={busyAction !== null}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            <X className="w-3.5 h-3.5" />
            <span>មិនអនុម័ត (审批不通过)</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('by_month')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer whitespace-nowrap"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>ស្វែងរកតាមខែ (按月查询)</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('expiring_25')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 cursor-pointer whitespace-nowrap"
          >
            <span>ផុតកំណត់ ≤ ២៥ ថ្ងៃ (25天内到期: {counts.expiring25})</span>
          </button>

          <button
            type="button"
            onClick={handleExportMonthlyExcel}
            disabled={contracts.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>នាំចេញ Excel តាមក្រុម (导出本月合同)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const target = selectedContract || filtered[0] || null;
              if (!target) {
                setFeedback({
                  kind: 'info',
                  text: 'សូមចុចជ្រើសរើសជួរកុងត្រាមួយក្នុងតារាងជាមុន (请先选中一条合同记录)',
                });
                return;
              }
              setPrintingContract(target);
            }}
            disabled={contracts.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>លិខិតកុងត្រា (合同书)</span>
          </button>

          <button
            type="button"
            onClick={onCreateNewContract}
            disabled={workers.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 cursor-pointer whitespace-nowrap ml-auto"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            <span>+ បង្កើតកុងត្រាថ្មី</span>
          </button>
        </div>

        {feedback && (
          <div
            className={`px-4 py-2.5 rounded-lg border text-xs font-medium flex items-center justify-between gap-3 ${
              feedback.kind === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : feedback.kind === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <span>{feedback.text}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Filter Tabs + Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3 no-print">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setFilterTab('pending_approval')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              filterTab === 'pending_approval'
                ? 'bg-white text-amber-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            រង់ចាំអនុម័ត / 待审批 ({counts.pending})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('expiring_25')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              filterTab === 'expiring_25'
                ? 'bg-white text-rose-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ២៥ ថ្ងៃផុតកំណត់ / 25天内 ({counts.expiring25})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('by_month')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              filterTab === 'by_month'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ប្រចាំខែ {queryMonth} ({counts.byMonth})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('approved')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              filterTab === 'approved'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            បានអនុម័ត / 通过 ({counts.approved})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('rejected')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              filterTab === 'rejected'
                ? 'bg-white text-rose-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            មិនអនុម័ត / 不通过 ({counts.rejected})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              filterTab === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ទាំងអស់ ({counts.all})
          </button>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ស្វែងរក អត្តលេខ, ឈ្មោះខ្មែរ/អង់គ្លេស, ក្រុម..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
      </div>

      {/* Official A4 Contract Letter Preview & Print Modal */}
      <ContractDocumentModal
        contract={printingContract}
        worker={printingContract ? workerById.get(printingContract.workerId) : undefined}
        onClose={() => setPrintingContract(null)}
      />

      {/* Sheet2-Aligned Contracts Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden no-print">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-11 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-900">មិនមានកុងត្រាក្នុងផ្នែកនេះទេ</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              អ្នកអាចចុច "ធ្វើបច្ចុប្បន្នភាពកុងត្រា (刷新合同)" ដើម្បីបង្កើតតារាងកុងត្រាសាកល្បង ៦០ ថ្ងៃ
              និងបន្តកុងត្រា ៩០ ថ្ងៃដោយស្វ័យប្រវត្តិសម្រាប់កម្មករទាំងអស់។
            </p>
          </div>
        ) : (
          <SpreadsheetScrollWrapper depKey={filtered.length}>
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-2 px-2.5 border-r border-slate-200">អត្តលេខ / 工号</th>
                  <th className="py-2 px-2.5 border-r border-slate-200">ឈ្មោះខ្មែរ / 柬埔寨名</th>
                  <th className="py-2 px-2.5 border-r border-slate-200">ឈ្មោះអង់គ្លេស / 英文名</th>
                  <th className="py-2 px-2 border-r border-slate-200 text-center">ភេទ / 性别</th>
                  <th className="py-2 px-2.5 border-r border-slate-200">ថ្ងៃចូល / 入厂日期</th>
                  <th className="py-2 px-2 border-r border-slate-200 text-center">ឆ្នាំ</th>
                  <th className="py-2 px-2.5 border-r border-slate-200">ប្រភេទ / 合同类型</th>
                  <th className="py-2 px-2.5 border-r border-slate-200">ចាប់ផ្តើម / 开始日期</th>
                  <th className="py-2 px-2.5 border-r border-slate-200">បញ្ចប់ / 结束日期</th>
                  <th className="py-2 px-2.5 border-r border-slate-200">ស្ថានភាព / 审批</th>
                  <th className="py-2 px-2.5 text-right">សកម្មភាព / 操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filtered.map((c) => {
                  const w = workerById.get(c.workerId);
                  const englishName = c.englishName || w?.englishName || '—';
                  const gender = c.gender || w?.gender || '—';
                  const hireDate = c.hireDate || w?.hireDate || c.startDate;
                  const entryYear = hireDate.slice(0, 4);
                  const approval = getEffectiveApprovalStatus(c);
                  const health = getContractHealth(c);
                  const isSelected = selectedContractId === c.id;

                  // Replicate VBA color bands for <= 25 days expiring rows
                  let rowBg = isSelected ? 'bg-slate-100' : 'hover:bg-slate-50';
                  if (!isSelected && approval !== 'rejected' && c.status === 'active') {
                    if (health.band === 'critical_7') rowBg = 'bg-rose-100/80 hover:bg-rose-100';
                    else if (health.band === 'warn_15') rowBg = 'bg-rose-50/90 hover:bg-rose-100/70';
                    else if (health.band === 'notice_25') rowBg = 'bg-amber-50/70 hover:bg-amber-50';
                  }

                  const textTone =
                    approval === 'rejected'
                      ? 'text-rose-700 line-through opacity-75'
                      : approval === 'approved'
                      ? 'text-emerald-800'
                      : 'text-amber-800';

                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedContractId(c.id)}
                      className={`transition-colors cursor-pointer ${rowBg} ${
                        isSelected ? 'outline-1 outline-slate-900' : ''
                      }`}
                    >
                      <td className={`py-2 px-2.5 font-mono tabular-nums font-semibold border-r border-slate-100 ${textTone}`}>
                        {c.employeeCode}
                      </td>
                      <td className={`py-2 px-2.5 font-semibold border-r border-slate-100 ${textTone}`}>
                        {c.workerName}
                      </td>
                      <td className={`py-2 px-2.5 font-mono border-r border-slate-100 ${textTone}`}>
                        {englishName}
                      </td>
                      <td className={`py-2 px-2 text-center border-r border-slate-100 ${textTone}`}>
                        {gender}
                      </td>
                      <td className={`py-2 px-2.5 font-mono tabular-nums border-r border-slate-100 ${textTone}`}>
                        {hireDate}
                      </td>
                      <td className={`py-2 px-2 text-center font-mono tabular-nums border-r border-slate-100 ${textTone}`}>
                        {entryYear}
                      </td>
                      <td className={`py-2 px-2.5 font-medium border-r border-slate-100 ${textTone}`}>
                        {CONTRACT_LABELS[c.contractType].zh}
                      </td>
                      <td className={`py-2 px-2.5 font-mono tabular-nums border-r border-slate-100 ${textTone}`}>
                        {c.startDate}
                      </td>
                      <td className={`py-2 px-2.5 font-mono tabular-nums border-r border-slate-100 ${textTone}`}>
                        {c.endDate}
                      </td>
                      <td className="py-2 px-2.5 font-semibold border-r border-slate-100">
                        {approval === 'approved' ? (
                          <span className="text-emerald-700">
                            {APPROVAL_LABELS.approved.km} ({APPROVAL_LABELS.approved.zh})
                          </span>
                        ) : approval === 'rejected' ? (
                          <span className="text-rose-700">
                            {APPROVAL_LABELS.rejected.km} ({APPROVAL_LABELS.rejected.zh})
                          </span>
                        ) : (
                          <span className="text-amber-700">
                            {APPROVAL_LABELS.pending_approval.km} ({APPROVAL_LABELS.pending_approval.zh})
                          </span>
                        )}
                      </td>
                      <td
                        className="py-2 px-2.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          {approval === 'pending_approval' && c.status === 'active' && (
                            <>
                              {health.daysRemaining >= 0 &&
                                health.daysRemaining <= CONTRACT_EXPIRING_WINDOW_DAYS && (
                                  <span className="font-mono tabular-nums font-bold text-rose-700 mr-1">
                                    សល់ {health.daysRemaining}ថ្ងៃ
                                  </span>
                                )}
                              {health.daysRemaining < 0 && (
                                <span className="font-mono tabular-nums font-bold text-rose-700 mr-1">
                                  ហួស {Math.abs(health.daysRemaining)}ថ្ងៃ
                                </span>
                              )}
                              <button
                                type="button"
                                disabled={busyAction !== null}
                                onClick={() => void handleApprove(c)}
                                className="px-2 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 cursor-pointer whitespace-nowrap shrink-0"
                              >
                                អនុម័ត
                              </button>
                              <button
                                type="button"
                                disabled={busyAction !== null}
                                onClick={() => void handleReject(c)}
                                className="px-2 py-1 text-[11px] font-semibold text-rose-800 bg-rose-50 border border-rose-200 rounded hover:bg-rose-100 cursor-pointer whitespace-nowrap shrink-0"
                              >
                                មិនអនុម័ត
                              </button>
                            </>
                          )}
                          {approval === 'approved' && (
                            <span className="text-emerald-700 font-medium text-[11px] whitespace-nowrap">
                              បានអនុម័ត
                            </span>
                          )}
                          {approval === 'rejected' && (
                            <span className="text-rose-700 font-medium text-[11px] whitespace-nowrap">
                              មិនបន្ត
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handlePrint(c)}
                            title="បោះពុម្ព"
                            className="p-1 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100 cursor-pointer shrink-0"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          {confirmDeleteId === c.id ? (
                            <button
                              type="button"
                              disabled={busyAction !== null}
                              onClick={() => void handleDelete(c)}
                              className="px-1.5 py-0.5 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-300 rounded hover:bg-rose-100 cursor-pointer whitespace-nowrap shrink-0"
                            >
                              បញ្ជាក់លុប
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busyAction !== null}
                              onClick={() => setConfirmDeleteId(c.id)}
                              title="លុបជួរនេះ"
                              className="p-1 text-slate-400 hover:text-rose-700 rounded hover:bg-rose-50 cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </SpreadsheetScrollWrapper>
        )}
      </div>
    </div>
  );
}
