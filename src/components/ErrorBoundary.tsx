import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'មានបញ្ហាបច្ចេកទេសកើតឡើង',
    };
  }

  render() {
    if (this.state.hasError) {
      let displayDetail = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as { error?: string; operationType?: string; path?: string };
        if (parsed.error) {
          displayDetail = `${parsed.error} (${parsed.operationType || ''} ${parsed.path || ''})`;
        }
      } catch {
        // Keep plain message
      }

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h1 className="text-lg font-semibold">ប្រព័ន្ធបានជួបបញ្ហាបណ្ដោះអាសន្ន</h1>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              សូមព្យាយាមផ្ទុកទំព័រឡើងវិញ ឬពិនិត្យការតភ្ជាប់គណនីរបស់អ្នក។
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-700 break-words">
              {displayDetail}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              ផ្ទុកទំព័រឡើងវិញ
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
