import { AlertCircle, ArrowRight, CheckCircle2, Clock, FileCheck2, Users } from 'lucide-react';
import {
  CONTRACT_LABELS,
  Contract,
  getContractHealth,
  getEffectiveApprovalStatus,
  NotificationAlert,
  pickCurrentWorkerContract,
  TaskItem,
  todayIsoDate,
  Worker,
} from '../types/workforce';

interface DashboardViewProps {
  workers: Worker[];
  contracts: Contract[];
  tasks: TaskItem[];
  alerts: NotificationAlert[];
  loading: boolean;
  seeding: boolean;
  onSeedSample: () => Promise<void>;
  onNavigate: (tab: 'workers' | 'contracts' | 'tasks') => void;
  onOpenRegisterWorker: () => void;
  onCompleteTask: (taskId: string) => Promise<void>;
  onPromoteContract: (contract: Contract) => void;
}

export function DashboardView({
  workers,
  contracts,
  tasks,
  alerts,
  loading,
  seeding,
  onSeedSample,
  onNavigate,
  onOpenRegisterWorker,
  onCompleteTask,
  onPromoteContract,
}: DashboardViewProps) {
  const today = todayIsoDate();
  const activeWorkers = workers.filter((w) => w.employmentStatus === 'active');

  const currentContractsByWorker: Contract[] = [];
  const contractsGrouped = new Map<string, Contract[]>();
  for (const c of contracts) {
    const arr = contractsGrouped.get(c.workerId) || [];
    arr.push(c);
    contractsGrouped.set(c.workerId, arr);
  }
  for (const [, list] of contractsGrouped.entries()) {
    const current = pickCurrentWorkerContract(list, today);
    if (current) currentContractsByWorker.push(current);
  }

  const activeProbation = currentContractsByWorker.filter((c) => c.contractType === 'probation_60');
  const activeFulltime = currentContractsByWorker.filter((c) => c.contractType === 'fulltime_90');
  const unfinishedTasks = tasks.filter(
    (t) => t.status === 'pending' || t.status === 'in_progress'
  );

  // Team summary
  const teamMap = new Map<string, { total: number; male: number; female: number }>();
  for (const w of activeWorkers) {
    const existing = teamMap.get(w.team) || { total: 0, male: 0, female: 0 };
    existing.total += 1;
    if (w.gender === 'ប្រុស') existing.male += 1;
    else existing.female += 1;
    teamMap.set(w.team, existing);
  }
  const teamRows = Array.from(teamMap.entries()).sort((a, b) => b[1].total - a[1].total);

  // Contracts needing attention (current or expiring within 25 days, sorted by daysRemaining ascending)
  const attentionContracts = contracts
    .filter((c) => c.status === 'active' && getEffectiveApprovalStatus(c) !== 'rejected')
    .map((c) => ({ contract: c, health: getContractHealth(c, today) }))
    .filter(({ contract, health }) => {
      if (health.daysRemaining >= 0 && health.daysRemaining <= 25) return true;
      return currentContractsByWorker.some((cur) => cur.id === contract.id);
    })
    .sort((a, b) => a.health.daysRemaining - b.health.daysRemaining)
    .slice(0, 6);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-72 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Empty Onboarding Banner when workspace has no workers yet */}
      {workers.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900">
              ចាប់ផ្តើមប្រើប្រាស់ប្រព័ន្ធគ្រប់គ្រងកម្មករ
            </h2>
            <p className="text-sm text-slate-600">
              អ្នកអាចចុះឈ្មោះកម្មករថ្មីដោយផ្ទាល់ ឬនាំចូលទិន្នន័យគំរូ ៤ នាក់ (001, 011, 018, 019)
              ពីបញ្ជីរោងចក្ររបស់អ្នកដើម្បីសាកល្បងប្រព័ន្ធភ្លាមៗ។
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => void onSeedSample()}
              disabled={seeding}
              className="px-4 py-2 text-sm font-medium text-slate-800 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              {seeding ? 'កំពុងបញ្ចូលទិន្នន័យ...' : 'បញ្ចូលទិន្នន័យគំរូ (4 នាក់)'}
            </button>
            <button
              type="button"
              onClick={onOpenRegisterWorker}
              className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              + ចុះឈ្មោះកម្មករដំបូង
            </button>
          </div>
        </div>
      )}

      {/* 4-column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>កម្មករកំពុងធ្វើការសរុប</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 font-mono tabular-nums">
              {activeWorkers.length}
            </span>
            <span className="text-xs text-slate-500">នាក់</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('workers')}
            className="mt-3 text-xs font-medium text-slate-700 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer self-start whitespace-nowrap"
          >
            <span>បើកបញ្ជីកម្មករ</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>កុងត្រាសាកល្បង (៦០ ថ្ងៃ)</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 font-mono tabular-nums">
              {activeProbation.length}
            </span>
            <span className="text-xs text-slate-500">កុងត្រា</span>
          </div>
          <p className="mt-3 text-xs text-slate-500">រយៈពេលសាកល្បង 60 ថ្ងៃ</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>កុងត្រាពេញសិទ្ធិ (៩០ ថ្ងៃ)</span>
            <FileCheck2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 font-mono tabular-nums">
              {activeFulltime.length}
            </span>
            <span className="text-xs text-slate-500">កុងត្រា</span>
          </div>
          <p className="mt-3 text-xs text-slate-500">រយៈពេលពេញសិទ្ធិ 90 ថ្ងៃ</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>ការងារមិនទាន់រួចរាល់</span>
            <AlertCircle
              className={`w-4 h-4 ${unfinishedTasks.length > 0 ? 'text-rose-600' : 'text-slate-400'}`}
            />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={`text-3xl font-bold font-mono tabular-nums ${
                unfinishedTasks.length > 0 ? 'text-rose-700' : 'text-slate-900'
              }`}
            >
              {unfinishedTasks.length}
            </span>
            <span className="text-xs text-slate-500">
              ការងារ · ជូនដំណឹងសរុប {alerts.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('tasks')}
            className="mt-3 text-xs font-medium text-slate-700 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer self-start whitespace-nowrap"
          >
            <span>ពិនិត្យការងារ</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Split: Actionable Pending Alerts + Team Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                ការជូនដំណឹងអំពីការងារមិនទាន់រួចរាល់ និងកុងត្រា
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                តម្រៀបតាមកម្រិតបន្ទាន់សម្រាប់ការដោះស្រាយភ្លាមៗ
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('tasks')}
              className="text-xs font-medium text-slate-700 hover:text-slate-900 cursor-pointer whitespace-nowrap"
            >
              មើលទាំងអស់
            </button>
          </div>

          {alerts.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-900">គ្មានការងារកកស្ទះទេ</p>
              <p className="text-xs text-slate-500">
                រាល់ការងារ និងកុងត្រាត្រូវបានដោះស្រាយរួចរាល់។
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {alerts.slice(0, 6).map((alert) => (
                <div
                  key={alert.id}
                  className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className={`font-semibold ${
                          alert.severity === 'critical'
                            ? 'text-rose-700'
                            : alert.severity === 'warning'
                            ? 'text-amber-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {alert.severity === 'critical'
                          ? 'បន្ទាន់'
                          : alert.severity === 'warning'
                          ? 'ដាស់តឿន'
                          : 'ព័ត៌មាន'}
                      </span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="font-mono tabular-nums text-slate-500">{alert.dateLabel}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 truncate">{alert.title}</p>
                    <p className="text-xs text-slate-600">{alert.detail}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {alert.taskId && (
                      <button
                        type="button"
                        onClick={() => void onCompleteTask(alert.taskId!)}
                        className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 cursor-pointer whitespace-nowrap"
                      >
                        បញ្ចប់ការងារ
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onNavigate(alert.targetTab)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 cursor-pointer whitespace-nowrap"
                    >
                      ពិនិត្យ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-sm font-bold text-slate-900">ចំនួនកម្មករតាមក្រុមការងារ (班组)</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              បែងចែកតាមក្រុមផលិតកម្ម និងភេទ
            </p>
          </div>

          {teamRows.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">មិនទាន់មានទិន្នន័យក្រុមការងារ</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-5">ក្រុមការងារ</th>
                    <th className="py-2.5 px-3 text-right">ប្រុស</th>
                    <th className="py-2.5 px-3 text-right">ស្រី</th>
                    <th className="py-2.5 px-5 text-right">សរុប</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {teamRows.map(([teamName, counts]) => (
                    <tr key={teamName} className="hover:bg-slate-50">
                      <td className="py-2.5 px-5 font-medium text-slate-900">{teamName}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                        {counts.male}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                        {counts.female}
                      </td>
                      <td className="py-2.5 px-5 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {counts.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Contract Expirations */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              កុងត្រាកម្មករជិតដល់ថ្ងៃផុតកំណត់ (សាកល្បង ៦០ ថ្ងៃ & ពេញសិទ្ធិ ៩០ ថ្ងៃ)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ពិនិត្យកុងត្រាសាកល្បង ៦០ ថ្ងៃ ដើម្បីដំឡើងទៅពេញសិទ្ធិ ៩០ ថ្ងៃ ឬបន្តកុងត្រាថ្មី
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('contracts')}
            className="text-xs font-medium text-slate-700 hover:text-slate-900 cursor-pointer whitespace-nowrap"
          >
            គ្រប់គ្រងកុងត្រាទាំងអស់
          </button>
        </div>

        {attentionContracts.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            មិនទាន់មានកុងត្រាកំពុងដំណើរការនៅឡើយទេ
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-5">អត្តលេខ</th>
                  <th className="py-2.5 px-4">ឈ្មោះកម្មករ</th>
                  <th className="py-2.5 px-4">ក្រុម</th>
                  <th className="py-2.5 px-4">ប្រភេទកុងត្រា</th>
                  <th className="py-2.5 px-4">ថ្ងៃផុតកំណត់</th>
                  <th className="py-2.5 px-4 text-right">រយៈពេលនៅសល់</th>
                  <th className="py-2.5 px-5 text-right">សកម្មភាព</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {attentionContracts.map(({ contract, health }) => (
                  <tr key={contract.id} className="hover:bg-slate-50">
                    <td className="py-3 px-5 font-mono tabular-nums text-slate-700">
                      {contract.employeeCode}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{contract.workerName}</td>
                    <td className="py-3 px-4 text-slate-600">{contract.team}</td>
                    <td className="py-3 px-4 text-slate-700">
                      {CONTRACT_LABELS[contract.contractType].km}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600">
                      {contract.endDate}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                      {health.state === 'expired' ? (
                        <span className="text-rose-700">
                          ហួស {Math.abs(health.daysRemaining)} ថ្ងៃ
                        </span>
                      ) : health.state === 'expiring_soon' ? (
                        <span className="text-amber-700">នៅសល់ {health.daysRemaining} ថ្ងៃ</span>
                      ) : (
                        <span className="text-emerald-700">នៅសល់ {health.daysRemaining} ថ្ងៃ</span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <button
                        type="button"
                        onClick={() => onPromoteContract(contract)}
                        className="text-xs font-semibold text-slate-800 hover:text-slate-950 underline underline-offset-2 cursor-pointer whitespace-nowrap"
                      >
                        {contract.contractType === 'probation_60'
                          ? 'ដំឡើងទៅ ៩០ ថ្ងៃ'
                          : 'បន្តកុងត្រា ៩០ ថ្ងៃ'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
