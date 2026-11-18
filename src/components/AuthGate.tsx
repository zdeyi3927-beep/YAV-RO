import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { BellRing, FileCheck2, ShieldCheck, Users } from 'lucide-react';
import { auth, googleProvider } from '../firebase';

export function AuthGate() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'មិនអាចចូលប្រើប្រាស់បានទេ';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6">
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-xl overflow-hidden grid md:grid-cols-12">
        <div className="md:col-span-7 p-8 md:p-10 space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500">Workforce Operations · HR System</p>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 leading-snug text-balance">
              ប្រព័ន្ធគ្រប់គ្រងកម្មករ កុងត្រា និងការជូនដំណឹងការងារ
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              រចនាឡើងសម្រាប់ការចុះឈ្មោះកម្មករតាមទម្រង់បញ្ជីរោងចក្រ តាមដានកុងត្រាសាកល្បង ៦០ ថ្ងៃ
              និងកុងត្រាពេញសិទ្ធិ ៩០ ថ្ងៃ ព្រមទាំងជូនដំណឹងរាល់ការងារដែលមិនទាន់ធ្វើរួចរាល់។
            </p>
          </div>

          <div className="divide-y divide-slate-100 border-t border-b border-slate-100">
            <div className="py-3.5 flex items-start gap-3">
              <Users className="w-4 h-4 text-slate-700 mt-1 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-slate-900">ចុះឈ្មោះកម្មករពេញលេញ (ទម្រង់ Excel)</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  អត្តលេខ · ឈ្មោះខ្មែរ/អង់គ្លេស · ប.ស.ស · ក្រុម · អាសយដ្ឋាន · ប័ណ្ណការងារ
                </p>
              </div>
            </div>
            <div className="py-3.5 flex items-start gap-3">
              <FileCheck2 className="w-4 h-4 text-slate-700 mt-1 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-slate-900">គ្រប់គ្រងកុងត្រា ៦០ ថ្ងៃ និង ៩០ ថ្ងៃ</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  គណនាថ្ងៃផុតកំណត់ស្វ័យប្រវត្តិ · ដំឡើងពីសាកល្បង ៦០ ថ្ងៃ ទៅពេញសិទ្ធិ ៩០ ថ្ងៃ
                </p>
              </div>
            </div>
            <div className="py-3.5 flex items-start gap-3">
              <BellRing className="w-4 h-4 text-slate-700 mt-1 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-slate-900">ការជូនដំណឹងការងារមិនទាន់រួចរាល់</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  ដាស់តឿនការងារនៅសល់ កិច្ចការហួសកំណត់ និងកុងត្រាជិតផុតសុពលភាព
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-5 bg-slate-900 text-white p-8 md:p-10 flex flex-col justify-between gap-8">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 text-xs text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>ទិន្នន័យរក្សាទុកដោយសុវត្ថិភាព</span>
            </div>
            <h2 className="text-xl font-semibold text-white">ចូលប្រើប្រាស់ប្រព័ន្ធ</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              ចូលដោយប្រើគណនី Google របស់អ្នក ដើម្បីគ្រប់គ្រងបញ្ជីកម្មករ កុងត្រា និងការជូនដំណឹងការងារ។
            </p>
          </div>

          <div className="space-y-3">
            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-xs text-rose-200">
                {errorMsg}
              </div>
            )}
            <button
              type="button"
              onClick={handleSignIn}
              disabled={loading}
              className="w-full py-3 px-4 bg-white text-slate-900 font-semibold text-sm rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <span>{loading ? 'កំពុងភ្ជាប់...' : 'ចូលប្រើប្រាស់ជាមួយ Google'}</span>
            </button>
            <p className="text-xs text-slate-400 text-center">
              ទិន្នន័យកម្មករត្រូវបានរក្សាទុកឯកជនតាមគណនីនីមួយៗ
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
