import { useMemo, useState } from 'react';
import {
  Download,
  Edit3,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  Search,
  Trash2,
  Upload,
  UserPlus,
} from 'lucide-react';
import {
  CONTRACT_LABELS,
  Contract,
  getContractHealth,
  pickCurrentWorkerContract,
  Worker,
} from '../types/workforce';
import { SpreadsheetScrollWrapper } from './SpreadsheetScrollWrapper';

interface WorkersViewProps {
  workers: Worker[];
  contracts: Contract[];
  loading: boolean;
  seeding: boolean;
  onOpenRegister: () => void;
  onOpenExcelImport: () => void;
  onEditWorker: (worker: Worker) => void;
  onToggleStatus: (worker: Worker) => Promise<void>;
  onDeleteWorker: (worker: Worker) => Promise<void>;
  onAssignContract: (worker: Worker) => void;
  onOpenContractLetter: (worker: Worker) => Promise<void>;
  onSeedSample: () => Promise<void>;
}

export function WorkersView({
  workers,
  contracts,
  loading,
  seeding,
  onOpenRegister,
  onOpenExcelImport,
  onEditWorker,
  onToggleStatus,
  onDeleteWorker,
  onAssignContract,
  onOpenContractLetter,
  onSeedSample,
}: WorkersViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const uniqueTeams = useMemo(() => {
    const set = new Set<string>();
    for (const w of workers) {
      if (w.team) set.add(w.team);
    }
    return Array.from(set).sort();
  }, [workers]);

  const activeContractByWorker = useMemo(() => {
    const grouped = new Map<string, Contract[]>();
    for (const c of contracts) {
      const arr = grouped.get(c.workerId) || [];
      arr.push(c);
      grouped.set(c.workerId, arr);
    }
    const map = new Map<string, Contract>();
    for (const [workerId, list] of grouped.entries()) {
      const current = pickCurrentWorkerContract(list);
      if (current) map.set(workerId, current);
    }
    return map;
  }, [contracts]);

  const filteredWorkers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return workers.filter((w) => {
      if (teamFilter !== 'all' && w.team !== teamFilter) return false;
      if (genderFilter !== 'all' && w.gender !== genderFilter) return false;
      if (!q) return true;
      return (
        w.employeeCode.toLowerCase().includes(q) ||
        w.khmerName.toLowerCase().includes(q) ||
        w.englishName.toLowerCase().includes(q) ||
        w.nationalId.toLowerCase().includes(q) ||
        w.nssfNumber.toLowerCase().includes(q) ||
        w.phone.toLowerCase().includes(q) ||
        w.team.toLowerCase().includes(q) ||
        w.workPermitNumber.toLowerCase().includes(q)
      );
    });
  }, [workers, searchQuery, teamFilter, genderFilter]);

  const handleExportCsv = () => {
    const headers = [
      'ល.រ / 序号',
      'អត្តលេខ / 工号',
      'ឈ្មោះខ្មែរ / 柬埔寨名',
      'ឈ្មោះអង់គ្លេស / 英文名',
      'ភេទ / 性别',
      'ថ្ងៃខែឆ្នាំកំណើត / 出生日期',
      'លេខលិខិតឆ្លងដែន-អត្តសញ្ញាណប័ណ្ណ / 身份证号',
      'លេខអត្ត-ប-ស-ស / 保险号',
      'ក្រុម / 班组',
      'លេខទូរស័ព្ទ / 电话号码',
      'ថ្ងៃចូលធ្វើការ / 入厂日期',
      'ភូមិ',
      'ឃុំ/សង្កាត់',
      'ក្រុង/ស្រុក',
      'ខេត្ត',
      'លេខប័ណ្ណការងារ / 工作证卡号',
      'កុងត្រាបច្ចុប្បន្ន',
    ];

    const escapeCsv = (val: string | number) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filteredWorkers.map((w, idx) => {
      const c = activeContractByWorker.get(w.id);
      const contractText = c ? `${CONTRACT_LABELS[c.contractType].km} (${c.startDate} -> ${c.endDate})` : 'មិនទាន់មាន';
      return [
        idx + 1,
        w.employeeCode,
        w.khmerName,
        w.englishName,
        w.gender,
        w.dateOfBirth,
        w.nationalId,
        w.nssfNumber,
        w.team,
        w.phone,
        w.hireDate,
        w.village,
        w.commune,
        w.district,
        w.province,
        w.workPermitNumber,
        contractText,
      ]
        .map(escapeCsv)
        .join(',');
    });

    const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `workers-roster-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ស្វែងរក អត្តលេខ, ឈ្មោះ, ប.ស.ស, ទូរស័ព្ទ..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="all">ក្រុមទាំងអស់ ({workers.length})</option>
            {uniqueTeams.map((t) => (
              <option key={t} value={t}>
                ក្រុម៖ {t}
              </option>
            ))}
          </select>

          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="all">ភេទទាំងអស់</option>
            <option value="ប្រុស">ប្រុស</option>
            <option value="ស្រី">ស្រី</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {workers.length === 0 && (
            <button
              type="button"
              onClick={() => void onSeedSample()}
              disabled={seeding}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 cursor-pointer whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{seeding ? 'កំពុងបញ្ចូល...' : 'បញ្ចូលទិន្នន័យគំរូ (4 នាក់)'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenExcelImport}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 cursor-pointer whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>នាំចូល Excel (导入 Excel)</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredWorkers.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ទាញយក Excel / CSV</span>
          </button>
          <button
            type="button"
            onClick={onOpenRegister}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>ចុះឈ្មោះកម្មករថ្មី</span>
          </button>
        </div>
      </div>

      {/* Spreadsheet Grid */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredWorkers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-900">
              {workers.length === 0
                ? 'មិនទាន់មានទិន្នន័យកម្មករចុះឈ្មោះនៅឡើយទេ'
                : 'រកមិនឃើញកម្មករត្រូវនឹងលក្ខខណ្ឌស្វែងរកទេ'}
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {workers.length === 0
                ? 'ចុចប៊ូតុង "ចុះឈ្មោះកម្មករថ្មី" ដើម្បីបញ្ចូលព័ត៌មានកម្មករ ឬសាកល្បងបញ្ចូលទិន្នន័យគំរូ ៤ នាក់។'
                : 'សូមសាកល្បងកែប្រែពាក្យស្វែងរក ឬជម្រើសក្រុមការងារឡើងវិញ។'}
            </p>
            {workers.length === 0 && (
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onOpenExcelImport}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 cursor-pointer whitespace-nowrap"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>នាំចូលពី Excel (导入 Excel)</span>
                </button>
                <button
                  type="button"
                  onClick={() => void onSeedSample()}
                  disabled={seeding}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 cursor-pointer whitespace-nowrap"
                >
                  បញ្ចូលទិន្នន័យគំរូ
                </button>
                <button
                  type="button"
                  onClick={onOpenRegister}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                >
                  + ចុះឈ្មោះកម្មករថ្មី
                </button>
              </div>
            )}
          </div>
        ) : (
          <SpreadsheetScrollWrapper depKey={filteredWorkers.length}>
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-3 text-center border-r border-slate-200">ល.រ / 序号</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">អត្តលេខ / 工号</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">ឈ្មោះខ្មែរ / 柬埔寨名</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">ឈ្មោះអង់គ្លេស / 英文名</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">ភេទ / 性别</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">ថ្ងៃខែឆ្នាំកំណើត / 出生日期</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">អត្តសញ្ញាណប័ណ្ណ / 身份证号</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">លេខអត្ត-ប-ស-ស / 保险号</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">ក្រុម / 班组</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">លេខទូរស័ព្ទ / 电话号码</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">ថ្ងៃចូលធ្វើការ / 入厂日期</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">ភូមិ</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">ឃុំ/សង្កាត់</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">ក្រុង/ស្រុក</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">ខេត្ត</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">លេខប័ណ្ណការងារ / 工作证卡号</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">កុងត្រាបច្ចុប្បន្ន</th>
                  <th className="py-2.5 px-3 text-right">សកម្មភាព</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredWorkers.map((w, index) => {
                  const activeContract = activeContractByWorker.get(w.id);
                  const health = activeContract ? getContractHealth(activeContract) : null;
                  return (
                    <tr
                      key={w.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        w.employmentStatus === 'inactive' ? 'opacity-60 bg-slate-50/50' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center font-mono tabular-nums text-slate-500 border-r border-slate-100">
                        {index + 1}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums font-semibold text-slate-900 border-r border-slate-100">
                        {w.employeeCode}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 border-r border-slate-100">
                        {w.khmerName}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700 border-r border-slate-100">
                        {w.englishName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 border-r border-slate-100">
                        {w.gender}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600 border-r border-slate-100">
                        {w.dateOfBirth}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700 border-r border-slate-100">
                        {w.nationalId || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700 border-r border-slate-100">
                        {w.nssfNumber || <span className="text-amber-700">ខ្វះ ប.ស.ស</span>}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800 border-r border-slate-100">
                        {w.team}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700 border-r border-slate-100">
                        {w.phone || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600 border-r border-slate-100">
                        {w.hireDate}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 border-r border-slate-100">
                        {w.village || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 border-r border-slate-100">
                        {w.commune || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 border-r border-slate-100">
                        {w.district || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 border-r border-slate-100">
                        {w.province || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700 border-r border-slate-100">
                        {w.workPermitNumber || <span className="text-amber-700">ខ្វះកាតការងារ</span>}
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-100">
                        {activeContract && health ? (
                          <span
                            className={`font-medium ${
                              health.state === 'expired'
                                ? 'text-rose-700'
                                : health.state === 'expiring_soon'
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                            }`}
                          >
                            {activeContract.durationDays}ថ្ងៃ ·{' '}
                            {health.daysRemaining >= 0
                              ? `នៅសល់ ${health.daysRemaining}ថ្ងៃ`
                              : `ហួស ${Math.abs(health.daysRemaining)}ថ្ងៃ`}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onAssignContract(w)}
                            className="text-slate-700 underline underline-offset-2 hover:text-slate-950 cursor-pointer"
                          >
                            + បង្កើតកុងត្រា
                          </button>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void onOpenContractLetter(w)}
                            title="បើកលិខិតកុងត្រា A4 / 导出PDF (合同书)"
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-800 bg-slate-100 border border-slate-200 rounded hover:bg-slate-200 cursor-pointer whitespace-nowrap"
                          >
                            <FileText className="w-3 h-3" />
                            <span>合同书</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onAssignContract(w)}
                            title="បង្កើតកុងត្រា"
                            className="p-1.5 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100 cursor-pointer"
                          >
                            <FilePlus2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditWorker(w)}
                            title="កែប្រែ"
                            className="p-1.5 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void onToggleStatus(w)}
                            className="text-[11px] font-medium text-slate-600 hover:text-slate-900 px-1.5 py-0.5 border border-slate-200 rounded cursor-pointer"
                          >
                            {w.employmentStatus === 'active' ? 'កំពុងធ្វើការ' : 'ឈប់ធ្វើការ'}
                          </button>
                          {confirmDeleteId === w.id ? (
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmDeleteId(null);
                                void onDeleteWorker(w);
                              }}
                              className="text-[11px] font-semibold text-rose-700 hover:text-rose-900 px-1.5 py-0.5 border border-rose-300 bg-rose-50 rounded cursor-pointer"
                            >
                              បញ្ជាក់លុប
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(w.id)}
                              title="លុប"
                              className="p-1.5 text-slate-400 hover:text-rose-700 rounded hover:bg-rose-50 cursor-pointer"
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
