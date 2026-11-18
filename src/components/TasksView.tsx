import { useMemo, useState } from 'react';
import { Archive, CheckCircle2, Clock, Edit3, Plus, Search, Trash2 } from 'lucide-react';
import { diffDaysBetweenIso, TaskItem, TaskStatus, todayIsoDate } from '../types/workforce';

interface TasksViewProps {
  tasks: TaskItem[];
  loading: boolean;
  onCreateTask: () => void;
  onEditTask: (task: TaskItem) => void;
  onChangeStatus: (taskId: string, status: TaskStatus) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
}

type TaskTab = 'unfinished' | 'overdue' | 'completed' | 'archived';

export function TasksView({
  tasks,
  loading,
  onCreateTask,
  onEditTask,
  onChangeStatus,
  onDeleteTask,
}: TasksViewProps) {
  const [activeTab, setActiveTab] = useState<TaskTab>('unfinished');
  const [searchQuery, setSearchQuery] = useState('');
  const today = todayIsoDate();

  const counts = useMemo(() => {
    let unfinished = 0;
    let overdue = 0;
    let completed = 0;
    let archived = 0;
    for (const t of tasks) {
      if (t.status === 'pending' || t.status === 'in_progress') {
        unfinished += 1;
        if (diffDaysBetweenIso(today, t.dueDate) < 0) {
          overdue += 1;
        }
      } else if (t.status === 'completed') {
        completed += 1;
      } else if (t.status === 'archived') {
        archived += 1;
      }
    }
    return { unfinished, overdue, completed, archived };
  }, [tasks, today]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tasks.filter((t) => {
      if (activeTab === 'unfinished' && t.status !== 'pending' && t.status !== 'in_progress') {
        return false;
      }
      if (activeTab === 'overdue') {
        if ((t.status !== 'pending' && t.status !== 'in_progress') || diffDaysBetweenIso(today, t.dueDate) >= 0) {
          return false;
        }
      }
      if (activeTab === 'completed' && t.status !== 'completed') return false;
      if (activeTab === 'archived' && t.status !== 'archived') return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.workerName.toLowerCase().includes(q) ||
        t.team.toLowerCase().includes(q)
      );
    });
  }, [tasks, activeTab, searchQuery, today]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('unfinished')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'unfinished'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ការងារមិនទាន់រួចរាល់ ({counts.unfinished})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('overdue')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'overdue'
                ? 'bg-white text-rose-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ហួសកំណត់ ({counts.overdue})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('completed')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'completed'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            រួចរាល់ ({counts.completed})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('archived')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'archived'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            បណ្ណសារ ({counts.archived})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ស្វែងរកការងារ ឬកម្មករ..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <button
            type="button"
            onClick={onCreateTask}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>បន្ថែមការងារថ្មី</span>
          </button>
        </div>
      </div>

      {/* Tasks List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-900">
              {activeTab === 'unfinished'
                ? 'គ្មានការងារដែលមិនទាន់រួចរាល់ទេ'
                : 'មិនមានទិន្នន័យការងារក្នុងផ្នែកនេះទេ'}
            </p>
            <p className="text-xs text-slate-500">
              ចុច "បន្ថែមការងារថ្មី" ដើម្បីកំណត់កិច្ចការ និងការជូនដំណឹងសម្រាប់កម្មករ ឬក្រុមការងារ។
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((task) => {
              const daysDiff = diffDaysBetweenIso(today, task.dueDate);
              const isUnfinished = task.status === 'pending' || task.status === 'in_progress';
              const isOverdue = isUnfinished && daysDiff < 0;

              return (
                <div
                  key={task.id}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span
                        className={`font-semibold ${
                          task.priority === 'high'
                            ? 'text-rose-700'
                            : task.priority === 'medium'
                            ? 'text-amber-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {task.priority === 'high'
                          ? 'អាទិភាពខ្ពស់'
                          : task.priority === 'medium'
                          ? 'មធ្យម'
                          : 'ទាប'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>ក្រុម {task.team}</span>
                      {task.workerName && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-800 font-medium">{task.workerName}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span
                        className={`font-mono tabular-nums ${
                          isOverdue ? 'text-rose-700 font-semibold' : ''
                        }`}
                      >
                        កំណត់ {task.dueDate}
                        {isOverdue ? ` (ហួស ${Math.abs(daysDiff)} ថ្ងៃ)` : ''}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900">{task.title}</h3>
                    {task.description && (
                      <p className="text-xs text-slate-600 leading-relaxed">{task.description}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {task.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => void onChangeStatus(task.id, 'in_progress')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 cursor-pointer whitespace-nowrap"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>កំពុងអនុវត្ត</span>
                      </button>
                    )}

                    {isUnfinished && (
                      <button
                        type="button"
                        onClick={() => void onChangeStatus(task.id, 'completed')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 cursor-pointer whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>បញ្ចប់រួចរាល់</span>
                      </button>
                    )}

                    {task.status === 'completed' && (
                      <>
                        <button
                          type="button"
                          onClick={() => void onChangeStatus(task.id, 'pending')}
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 cursor-pointer whitespace-nowrap"
                        >
                          បើកឡើងវិញ
                        </button>
                        <button
                          type="button"
                          onClick={() => void onChangeStatus(task.id, 'archived')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-md hover:bg-slate-200 cursor-pointer whitespace-nowrap"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          <span>ទុកបណ្ណសារ</span>
                        </button>
                      </>
                    )}

                    {task.status !== 'archived' && (
                      <button
                        type="button"
                        onClick={() => onEditTask(task)}
                        title="កែប្រែ"
                        className="p-1.5 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100 cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => void onDeleteTask(task.id)}
                      title="លុប"
                      className="p-1.5 text-slate-400 hover:text-rose-700 rounded hover:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
