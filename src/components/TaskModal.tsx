import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  BLUEPRINT_LIMITS,
  PRESET_TEAMS,
  TaskInput,
  TaskItem,
  TaskPriority,
  TaskStatus,
  todayIsoDate,
  Worker,
} from '../types/workforce';

interface TaskModalProps {
  open: boolean;
  workers: Worker[];
  editingTask: TaskItem | null;
  onClose: () => void;
  onSubmit: (data: TaskInput) => Promise<void>;
}

export function TaskModal({ open, workers, editingTask, onClose, onSubmit }: TaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [team, setTeam] = useState('ជាង');
  const [priority, setPriority] = useState<TaskPriority>('high');
  const [dueDate, setDueDate] = useState(todayIsoDate());
  const [status, setStatus] = useState<TaskStatus>('pending');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description);
      setWorkerId(editingTask.workerId);
      setTeam(editingTask.team);
      setPriority(editingTask.priority);
      setDueDate(editingTask.dueDate);
      setStatus(editingTask.status);
    } else {
      setTitle('');
      setDescription('');
      setWorkerId('');
      setTeam('ជាង');
      setPriority('high');
      setDueDate(todayIsoDate());
      setStatus('pending');
    }
  }, [open, editingTask]);

  if (!open) return null;

  const handleWorkerChange = (nextId: string) => {
    setWorkerId(nextId);
    const matched = workers.find((w) => w.id === nextId);
    if (matched) {
      setTeam(matched.team);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const matched = workers.find((w) => w.id === workerId);
      await onSubmit({
        workerId,
        workerName: matched ? matched.khmerName : '',
        team: team.trim() || 'ទូទៅ',
        title,
        description,
        priority,
        dueDate,
        status,
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'មិនអាចរក្សាទុកការងារបានទេ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {editingTask ? 'កែប្រែការងារ' : 'បន្ថែមការងារថ្មី'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ការងារដែលមិនទាន់រួចរាល់នឹងបង្ហាញក្នុងប្រព័ន្ធជូនដំណឹងដោយស្វ័យប្រវត្តិ
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              ចំណងជើងការងារ *
            </label>
            <input
              type="text"
              required
              maxLength={BLUEPRINT_LIMITS.taskTitleMax}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ឧ. វាយតម្លៃកុងត្រាសាកល្បង ៦០ ថ្ងៃ ឬ ប្រមូលឯកសារ ប.ស.ស"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                ប្រគល់ជូនកម្មករ (ជម្រើស)
              </label>
              <select
                value={workerId}
                onChange={(e) => handleWorkerChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="">ទូទៅ / តាមក្រុមទាំងមូល</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.employeeCode} · {w.khmerName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                ក្រុមការងារ *
              </label>
              <input
                type="text"
                list="task-team-list"
                required
                maxLength={BLUEPRINT_LIMITS.teamMax}
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <datalist id="task-team-list">
                {PRESET_TEAMS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">កម្រិតអាទិភាព</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="high">ខ្ពស់ (បន្ទាន់)</option>
                <option value="medium">មធ្យម</option>
                <option value="low">ទាប</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">ថ្ងៃកំណត់ *</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">ស្ថានភាព</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="pending">មិនទាន់រួចរាល់</option>
                <option value="in_progress">កំពុងអនុវត្ត</option>
                <option value="completed">រួចរាល់</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              ព័ត៌មានលម្អិត
            </label>
            <textarea
              rows={3}
              maxLength={BLUEPRINT_LIMITS.taskDescMax}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="សរសេរការណែនាំ ឬកិច្ចការដែលត្រូវបំពេញ..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer whitespace-nowrap"
            >
              បោះបង់
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              {submitting ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកការងារ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
