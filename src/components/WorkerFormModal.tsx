import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  addDaysToIsoDate,
  BLUEPRINT_LIMITS,
  CONTRACT_DURATIONS,
  ContractType,
  Gender,
  PRESET_TEAMS,
  todayIsoDate,
  Worker,
  WorkerInput,
} from '../types/workforce';

interface WorkerFormModalProps {
  open: boolean;
  editingWorker: Worker | null;
  onClose: () => void;
  onSubmit: (
    workerData: WorkerInput,
    initialContract?: { contractType: ContractType; startDate: string; notes: string }
  ) => Promise<void>;
}

const emptyWorkerForm = (): WorkerInput => ({
  employeeCode: '',
  khmerName: '',
  englishName: '',
  gender: 'ប្រុស',
  dateOfBirth: '',
  nationalId: '',
  nssfNumber: '',
  team: 'ជាង',
  phone: '',
  hireDate: todayIsoDate(),
  village: '',
  commune: '',
  district: '',
  province: 'ស្វាយរៀង',
  workPermitNumber: '',
  employmentStatus: 'active',
});

export function WorkerFormModal({
  open,
  editingWorker,
  onClose,
  onSubmit,
}: WorkerFormModalProps) {
  const [form, setForm] = useState<WorkerInput>(emptyWorkerForm());
  const [createInitialContract, setCreateInitialContract] = useState(true);
  const [contractType, setContractType] = useState<ContractType>('probation_60');
  const [contractStartDate, setContractStartDate] = useState(todayIsoDate());
  const [contractNotes, setContractNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    if (editingWorker) {
      setForm({
        employeeCode: editingWorker.employeeCode,
        khmerName: editingWorker.khmerName,
        englishName: editingWorker.englishName,
        gender: editingWorker.gender,
        dateOfBirth: editingWorker.dateOfBirth,
        nationalId: editingWorker.nationalId,
        nssfNumber: editingWorker.nssfNumber,
        team: editingWorker.team,
        phone: editingWorker.phone,
        hireDate: editingWorker.hireDate,
        village: editingWorker.village,
        commune: editingWorker.commune,
        district: editingWorker.district,
        province: editingWorker.province,
        workPermitNumber: editingWorker.workPermitNumber,
        employmentStatus: editingWorker.employmentStatus,
      });
      setCreateInitialContract(false);
    } else {
      const today = todayIsoDate();
      setForm(emptyWorkerForm());
      setCreateInitialContract(true);
      setContractType('probation_60');
      setContractStartDate(today);
      setContractNotes('');
    }
  }, [open, editingWorker]);

  if (!open) return null;

  const previewEndDate = addDaysToIsoDate(contractStartDate, CONTRACT_DURATIONS[contractType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await onSubmit(
        form,
        !editingWorker
          ? {
              contractType,
              startDate: contractStartDate,
              notes: contractNotes,
            }
          : undefined
      );
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {editingWorker ? 'កែប្រែព័ត៌មានកម្មករ' : 'ចុះឈ្មោះកម្មករថ្មី'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              បំពេញព័ត៌មានកម្មករតាមទម្រង់បញ្ជីរោងចក្រ (ឈ្មោះខ្មែរ · ឈ្មោះអង់គ្លេស · ប.ស.ស · អាសយដ្ឋាន · កាតការងារ)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="បិទ"
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
              {errorMsg}
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              ១. ព័ត៌មានផ្ទាល់ខ្លួន និងអត្តសញ្ញាណ
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  អត្តលេខ (工号) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={BLUEPRINT_LIMITS.employeeCodeMax}
                  value={form.employeeCode}
                  onChange={(e) => setForm({ ...form, employeeCode: e.target.value })}
                  placeholder="ឧ. 001, 020"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  ឈ្មោះខ្មែរ (柬埔寨名) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={BLUEPRINT_LIMITS.nameMax}
                  value={form.khmerName}
                  onChange={(e) => setForm({ ...form, khmerName: e.target.value })}
                  placeholder="ឧ. ភិន សណ្ដាប់"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  ឈ្មោះអង់គ្លេស (英文名) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={BLUEPRINT_LIMITS.nameMax}
                  value={form.englishName}
                  onChange={(e) => setForm({ ...form, englishName: e.target.value.toUpperCase() })}
                  placeholder="ឧ. PIN SANDAB"
                  className="w-full px-3 py-2 text-sm uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  ភេទ (性别) *
                </label>
                <select
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value as Gender })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="ប្រុស">ប្រុស</option>
                  <option value="ស្រី">ស្រី</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  ថ្ងៃ ខែ ឆ្នាំ កំណើត (出生日期) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={BLUEPRINT_LIMITS.dobMax}
                  value={form.dateOfBirth}
                  onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                  placeholder="ឧ. 15-02-1992"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  លេខទូរស័ព្ទ (电话号码)
                </label>
                <input
                  type="text"
                  maxLength={BLUEPRINT_LIMITS.phoneMax}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="ឧ. 0888220486"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              ២. ឯកសារផ្លូវការ និងក្រុមការងារ
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  លេខលិខិតឆ្លងដែន-អត្តសញ្ញាណប័ណ្ណ (身份证号)
                </label>
                <input
                  type="text"
                  maxLength={BLUEPRINT_LIMITS.idNumberMax}
                  value={form.nationalId}
                  onChange={(e) => setForm({ ...form, nationalId: e.target.value })}
                  placeholder="ឧ. 90645840"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  លេខអត្ត-ប-ស-ស (保险号)
                </label>
                <input
                  type="text"
                  maxLength={BLUEPRINT_LIMITS.idNumberMax}
                  value={form.nssfNumber}
                  onChange={(e) => setForm({ ...form, nssfNumber: e.target.value })}
                  placeholder="ឧ. 1921119-2244873- ជ"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  លេខប័ណ្ណការងារ (工作证卡号)
                </label>
                <input
                  type="text"
                  maxLength={BLUEPRINT_LIMITS.idNumberMax}
                  value={form.workPermitNumber}
                  onChange={(e) => setForm({ ...form, workPermitNumber: e.target.value })}
                  placeholder="ឧ. ML-00362044"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  ក្រុមការងារ (班组) *
                </label>
                <input
                  type="text"
                  list="team-presets"
                  required
                  maxLength={BLUEPRINT_LIMITS.teamMax}
                  value={form.team}
                  onChange={(e) => setForm({ ...form, team: e.target.value })}
                  placeholder="ឧ. ជាង, បាញ់ព្រីល, វិញស្លឹក, រុំមែក"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <datalist id="team-presets">
                  {PRESET_TEAMS.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  ថ្ងៃចូលធ្វើការ (入厂日期) *
                </label>
                <input
                  type="date"
                  required
                  value={form.hireDate}
                  onChange={(e) => {
                    const next = e.target.value;
                    setForm({ ...form, hireDate: next });
                    if (!editingWorker) {
                      setContractStartDate(next);
                    }
                  }}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              ៣. អាសយដ្ឋានបច្ចុប្បន្ន (现住地址)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ភូមិ</label>
                <input
                  type="text"
                  maxLength={BLUEPRINT_LIMITS.addressPartMax}
                  value={form.village}
                  onChange={(e) => setForm({ ...form, village: e.target.value })}
                  placeholder="ឧ. ព្រៃកៀត"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ឃុំ/សង្កាត់</label>
                <input
                  type="text"
                  maxLength={BLUEPRINT_LIMITS.addressPartMax}
                  value={form.commune}
                  onChange={(e) => setForm({ ...form, commune: e.target.value })}
                  placeholder="ឧ. សំឡី"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ក្រុង/ស្រុក</label>
                <input
                  type="text"
                  maxLength={BLUEPRINT_LIMITS.addressPartMax}
                  value={form.district}
                  onChange={(e) => setForm({ ...form, district: e.target.value })}
                  placeholder="ឧ. កំពង់រោទិ៍"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ខេត្ត</label>
                <input
                  type="text"
                  maxLength={BLUEPRINT_LIMITS.addressPartMax}
                  value={form.province}
                  onChange={(e) => setForm({ ...form, province: e.target.value })}
                  placeholder="ឧ. ស្វាយរៀង"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
          </div>

          {!editingWorker && (
            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    ៤. កុងត្រា និងលិខិតកុងត្រា A4 (自动生成合同与合同书) *
                  </h3>
                  <p className="text-xs text-slate-500">
                    កម្មករថ្មីគ្រប់រូបត្រូវមានកុងត្រា (សាកល្បង ៦០ ថ្ងៃ ឬពេញសិទ្ធិ ៩០ ថ្ងៃ) និងលិខិតកុងត្រា A4 PDF
                  </p>
                </div>
                <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap">
                  បង្កើតដោយស្វ័យប្រវត្តិ (必须生成)
                </span>
              </div>

              {createInitialContract && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      ប្រភេទកុងត្រា *
                    </label>
                    <select
                      value={contractType}
                      onChange={(e) => setContractType(e.target.value as ContractType)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                    >
                      <option value="probation_60">កុងត្រាសាកល្បង (៦០ ថ្ងៃ)</option>
                      <option value="fulltime_90">កុងត្រាពេញសិទ្ធិ (៩០ ថ្ងៃ)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      ថ្ងៃចាប់ផ្តើមកុងត្រា *
                    </label>
                    <input
                      type="date"
                      value={contractStartDate}
                      onChange={(e) => setContractStartDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      ថ្ងៃផុតកំណត់ស្វ័យប្រវត្តិ
                    </label>
                    <div className="px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-700">
                      {previewEndDate} ({CONTRACT_DURATIONS[contractType]} ថ្ងៃ)
                    </div>
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      កំណត់សម្គាល់កុងត្រា
                    </label>
                    <input
                      type="text"
                      maxLength={BLUEPRINT_LIMITS.notesMax}
                      value={contractNotes}
                      onChange={(e) => setContractNotes(e.target.value)}
                      placeholder="បញ្ចូលកំណត់សម្គាល់បន្ថែម (ប្រសិនបើមាន)"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              បោះបង់
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              {submitting
                ? 'កំពុងរក្សាទុក...'
                : editingWorker
                ? 'រក្សាទុកការកែប្រែ'
                : 'បញ្ជាក់ការចុះឈ្មោះ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
