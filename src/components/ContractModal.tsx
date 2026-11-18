import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  addDaysToIsoDate,
  BLUEPRINT_LIMITS,
  CONTRACT_DURATIONS,
  Contract,
  ContractType,
  todayIsoDate,
  Worker,
} from '../types/workforce';

interface ContractModalProps {
  open: boolean;
  workers: Worker[];
  targetWorkerId?: string;
  renewingContract?: Contract | null;
  defaultType?: ContractType;
  onClose: () => void;
  onCreateContract: (
    worker: Worker,
    contractType: ContractType,
    startDate: string,
    notes: string
  ) => Promise<void>;
  onPromoteOrRenew: (
    oldContract: Contract,
    newType: ContractType,
    startDate: string,
    notes: string
  ) => Promise<void>;
}

export function ContractModal({
  open,
  workers,
  targetWorkerId,
  renewingContract,
  defaultType = 'probation_60',
  onClose,
  onCreateContract,
  onPromoteOrRenew,
}: ContractModalProps) {
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [contractType, setContractType] = useState<ContractType>(defaultType);
  const [startDate, setStartDate] = useState(todayIsoDate());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    if (renewingContract) {
      setSelectedWorkerId(renewingContract.workerId);
      setContractType(defaultType);
      setStartDate(todayIsoDate());
      setNotes(
        defaultType === 'fulltime_90'
          ? 'ដំឡើង / បន្តទៅកុងត្រាពេញសិទ្ធិ ៩០ ថ្ងៃ'
          : 'បន្តកុងត្រាសាកល្បង ៦០ ថ្ងៃ'
      );
    } else {
      setSelectedWorkerId(targetWorkerId || workers[0]?.id || '');
      setContractType(defaultType);
      setStartDate(todayIsoDate());
      setNotes('');
    }
  }, [open, renewingContract, targetWorkerId, defaultType, workers]);

  if (!open) return null;

  const endDate = addDaysToIsoDate(startDate, CONTRACT_DURATIONS[contractType]);
  const selectedWorker = workers.find((w) => w.id === selectedWorkerId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      if (renewingContract) {
        await onPromoteOrRenew(renewingContract, contractType, startDate, notes);
      } else {
        if (!selectedWorker) {
          throw new Error('សូមជ្រើសរើសកម្មករ');
        }
        await onCreateContract(selectedWorker, contractType, startDate, notes);
      }
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'មិនអាចបង្កើតកុងត្រាបានទេ');
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
              {renewingContract ? 'បន្ត ឬដំឡើងកុងត្រាកម្មករ' : 'បង្កើតកុងត្រាកម្មករថ្មី'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              សាកល្បងមានរយៈពេល ៦០ ថ្ងៃ · ពេញសិទ្ធិមានរយៈពេល ៩០ ថ្ងៃ
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
              ជ្រើសរើសកម្មករ *
            </label>
            {renewingContract ? (
              <div className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium">
                {renewingContract.employeeCode} · {renewingContract.workerName} ({renewingContract.team})
              </div>
            ) : (
              <select
                required
                value={selectedWorkerId}
                onChange={(e) => setSelectedWorkerId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {workers.length === 0 && <option value="">មិនទាន់មានកម្មករ</option>}
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.employeeCode} · {w.khmerName} ({w.englishName}) — {w.team}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              ប្រភេទ និងរយៈពេលកុងត្រា *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setContractType('probation_60')}
                className={`p-3 text-left rounded-lg border transition-colors cursor-pointer ${
                  contractType === 'probation_60'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                }`}
              >
                <div className="text-sm font-semibold">កុងត្រាសាកល្បង</div>
                <div
                  className={`text-xs font-mono mt-0.5 ${
                    contractType === 'probation_60' ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  រយៈពេល ៦០ ថ្ងៃ (60 Days)
                </div>
              </button>
              <button
                type="button"
                onClick={() => setContractType('fulltime_90')}
                className={`p-3 text-left rounded-lg border transition-colors cursor-pointer ${
                  contractType === 'fulltime_90'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                }`}
              >
                <div className="text-sm font-semibold">កុងត្រាពេញសិទ្ធិ</div>
                <div
                  className={`text-xs font-mono mt-0.5 ${
                    contractType === 'fulltime_90' ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  រយៈពេល ៩០ ថ្ងៃ (90 Days)
                </div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                ថ្ងៃចាប់ផ្តើម *
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                ថ្ងៃផុតកំណត់ ({CONTRACT_DURATIONS[contractType]} ថ្ងៃ)
              </label>
              <div className="px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900">
                {endDate}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              កំណត់សម្គាល់
            </label>
            <textarea
              rows={2}
              maxLength={BLUEPRINT_LIMITS.notesMax}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="កំណត់សម្គាល់អំពីកុងត្រា ឬលក្ខខណ្ឌការងារ..."
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
              disabled={submitting || (!renewingContract && workers.length === 0)}
              className="px-5 py-2 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              {submitting ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកកុងត្រា'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
