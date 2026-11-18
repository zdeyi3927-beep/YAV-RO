import { AlertCircle, ArrowRight, CheckCircle2, Clock, FileWarning, X } from 'lucide-react';
import { NotificationAlert } from '../types/workforce';

interface NotificationDrawerProps {
  open: boolean;
  alerts: NotificationAlert[];
  onClose: () => void;
  onCompleteTask: (taskId: string) => Promise<void>;
  onNavigate: (tab: 'tasks' | 'contracts' | 'workers') => void;
}

export function NotificationDrawer({
  open,
  alerts,
  onClose,
  onCompleteTask,
  onNavigate,
}: NotificationDrawerProps) {
  if (!open) return null;

  const unfinishedCount = alerts.filter((a) => a.kind === 'unfinished_task').length;
  const contractAlertCount = alerts.filter(
    (a) => a.kind === 'contract_expiring' || a.kind === 'contract_expired'
  ).length;
  const docAlertCount = alerts.filter((a) => a.kind === 'missing_document').length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex justify-end">
      <div className="w-full max-w-md bg-white h-full border-l border-slate-200 flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              មជ្ឈមណ្ឌលជូនដំណឹង ({alerts.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              ការងារមិនទាន់រួច {unfinishedCount} · កុងត្រា {contractAlertCount} · ឯកសារខ្វះ {docAlertCount}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="បិទ"
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {alerts.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-900">មិនមានការជូនដំណឹងបន្ទាន់ទេ</p>
              <p className="text-xs text-slate-500">
                រាល់ការងារ និងកុងត្រាកម្មករទាំងអស់កំពុងស្ថិតក្នុងស្ថានភាពល្អ។
              </p>
            </div>
          ) : (
            alerts.map((alert) => {
              const Icon =
                alert.severity === 'critical'
                  ? AlertCircle
                  : alert.severity === 'warning'
                  ? Clock
                  : FileWarning;
              const iconColor =
                alert.severity === 'critical'
                  ? 'text-rose-600'
                  : alert.severity === 'warning'
                  ? 'text-amber-600'
                  : 'text-slate-600';

              return (
                <div key={alert.id} className="p-5 hover:bg-slate-50 transition-colors space-y-2.5">
                  <div className="flex items-start gap-3">
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconColor}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span className="font-medium">
                          {alert.kind === 'unfinished_task'
                            ? 'ការងារមិនទាន់រួចរាល់'
                            : alert.kind === 'contract_expired'
                            ? 'កុងត្រាផុតកំណត់'
                            : alert.kind === 'contract_expiring'
                            ? 'កុងត្រាជិតផុតកំណត់'
                            : 'ខ្វះឯកសារចុះឈ្មោះ'}
                        </span>
                        <span className="font-mono tabular-nums">{alert.dateLabel}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900 mt-1">{alert.title}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{alert.detail}</p>
                    </div>
                  </div>

                  <div className="pl-7 flex items-center gap-3">
                    {alert.taskId && (
                      <button
                        type="button"
                        onClick={() => void onCompleteTask(alert.taskId!)}
                        className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer whitespace-nowrap"
                      >
                        ✓ សម្គាល់ថារួចរាល់
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate(alert.targetTab);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 cursor-pointer whitespace-nowrap"
                    >
                      <span>បើកពិនិត្យ</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
