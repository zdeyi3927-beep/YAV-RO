import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, FileSpreadsheet, Upload, X } from 'lucide-react';
import { WorkerInput } from '../types/workforce';
import {
  buildWorkerInputsFromSheet,
  parseAnyExcelWorkbook,
  ParsedWorkbook,
  WORKER_FIELD_META,
  WorkerFieldKey,
} from '../utils/importWorkersExcel';

interface ExcelImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (
    workers: WorkerInput[],
    options: { skipExistingCodes: boolean; generateContracts: boolean }
  ) => Promise<{ imported: number; skipped: number; contractsCreated: number }>;
}

export function ExcelImportModal({ open, onClose, onImport }: ExcelImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [mapping, setMapping] = useState<Record<WorkerFieldKey, number | null> | null>(null);
  const [dataStartRow, setDataStartRow] = useState(1);
  const [skipExistingCodes, setSkipExistingCodes] = useState(true);
  const [generateContracts, setGenerateContracts] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setWorkbook(null);
      setSheetIdx(0);
      setMapping(null);
      setErrorMsg(null);
      setSuccessMsg(null);
      setParsing(false);
      setImporting(false);
    }
  }, [open]);

  const activeSheet = workbook?.sheets[sheetIdx] || null;

  useEffect(() => {
    if (activeSheet) {
      setMapping(activeSheet.initialMapping);
      setDataStartRow(activeSheet.dataStartRow);
    }
  }, [activeSheet]);

  const parsedWorkers = useMemo(() => {
    if (!activeSheet || !mapping) return [];
    return buildWorkerInputsFromSheet(activeSheet, mapping, dataStartRow);
  }, [activeSheet, mapping, dataStartRow]);

  if (!open) return null;

  const handleFile = async (file: File) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setParsing(true);
    try {
      const wb = await parseAnyExcelWorkbook(file);
      // Pick the sheet with the most rows by default
      let bestIdx = 0;
      let maxLen = 0;
      wb.sheets.forEach((s, idx) => {
        if (s.rawRows.length > maxLen) {
          maxLen = s.rawRows.length;
          bestIdx = idx;
        }
      });
      setWorkbook(wb);
      setSheetIdx(bestIdx);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'មិនអាចអានឯកសារ Excel បានទេ (无法读取该Excel文件，请检查格式)'
      );
    } finally {
      setParsing(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const handleConfirmImport = async () => {
    if (parsedWorkers.length === 0) return;
    setErrorMsg(null);
    setImporting(true);
    try {
      const res = await onImport(parsedWorkers, {
        skipExistingCodes,
        generateContracts,
      });
      setSuccessMsg(
        `នាំចូលជោគជ័យ! បានបន្ថែមកម្មករ ${res.imported} នាក់ · បង្កើតកុងត្រា ${res.contractsCreated} ជួរ · រំលងស្ទួន ${res.skipped} (导入成功: 新增 ${res.imported} 名员工, 生成 ${res.contractsCreated} 条合同, 跳过 ${res.skipped})`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'មិនអាចនាំចូលទិន្នន័យបានទេ');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                នាំចូលបញ្ជីកម្មករពី Excel (Excel 批量导入员工 — 支持任意表格格式)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                គាំទ្រ .xlsx, .xls, .xlsm, .xlsb, .ods, .csv · សម្គាល់ជួរឈរខ្មែរ/ចិន/អង់គ្លេសដោយស្វ័យប្រវត្តិ
              </p>
            </div>
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

        {/* Body */}
        <div className="overflow-y-auto p-6 space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1 text-xs font-semibold bg-emerald-700 text-white rounded hover:bg-emerald-800 cursor-pointer whitespace-nowrap"
              >
                បិទ និងមើលបញ្ជី
              </button>
            </div>
          )}

          {/* File Picker / Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              dragActive
                ? 'border-slate-900 bg-slate-100'
                : 'border-slate-300 bg-slate-50 hover:bg-slate-100/70'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.xlsm,.xlsb,.ods,.csv,.tsv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFileInput}
              className="hidden"
            />
            <Upload className="w-7 h-7 text-slate-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-900">
              {parsing
                ? 'កំពុងវិភាគឯកសារ Excel...'
                : workbook
                ? `បានជ្រើសរើស៖ ${workbook.fileName} (ចុចដើម្បីប្តូរឯកសារ)`
                : 'ចុចជ្រើសរើស ឬអូសឯកសារ Excel មកដាក់ទីនេះ (点击选择或拖入任意 Excel 文件)'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              អាចប្រើជាមួយគ្រប់ប្រភេទតារាង Excel (.xlsx / .xls / .xlsm / .xlsb / .csv / .ods)
            </p>
          </div>

          {/* Mapping & Options once workbook is loaded */}
          {workbook && activeSheet && mapping && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                    <span className="font-semibold">Sheet:</span>
                    <select
                      value={sheetIdx}
                      onChange={(e) => setSheetIdx(Number(e.target.value))}
                      className="px-2.5 py-1 text-xs border border-slate-300 rounded bg-white"
                    >
                      {workbook.sheets.map((s, idx) => (
                        <option key={s.sheetName} value={idx}>
                          {s.sheetName} ({s.rawRows.length} ជួរ)
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                    <span className="font-semibold">ទិន្នន័យចាប់ពីជួរទី (数据起始行):</span>
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, activeSheet.rawRows.length)}
                      value={dataStartRow + 1}
                      onChange={(e) =>
                        setDataStartRow(Math.max(0, Number(e.target.value) - 1))
                      }
                      className="w-16 px-2 py-1 text-xs font-mono border border-slate-300 rounded bg-white"
                    />
                  </label>
                </div>

                <div className="text-xs font-semibold text-slate-900 font-mono tabular-nums">
                  រកឃើញកម្មករ៖ {parsedWorkers.length} នាក់
                </div>
              </div>

              {/* Column Mapping Grid */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-800">
                  ផ្គូផ្គងជួរឈរ (自动匹配字段 — 如需微调可手动选择列)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                  {WORKER_FIELD_META.map((field) => (
                    <label key={field.key} className="block text-[11px]">
                      <span className="block font-medium text-slate-700 mb-1 truncate">
                        {field.labelKm} ({field.labelZh})
                      </span>
                      <select
                        value={mapping[field.key] === null ? '' : String(mapping[field.key])}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMapping((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  [field.key]: val === '' ? null : Number(val),
                                }
                              : prev
                          );
                        }}
                        className="w-full px-2 py-1 text-[11px] border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                      >
                        <option value="">— មិនប្រើ / 自动 —</option>
                        {activeSheet.columnLabels.map((lbl, colIdx) => (
                          <option key={colIdx} value={String(colIdx)}>
                            {lbl}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>

              {/* Import Options */}
              <div className="flex flex-wrap items-center gap-6 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-xs">
                <label className="inline-flex items-center gap-2 font-medium text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={generateContracts}
                    onChange={(e) => setGenerateContracts(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span>
                    បង្កើតកុងត្រា ៦០/៩០ ថ្ងៃ និងលិខិតកុងត្រា A4 ដោយស្វ័យប្រវត្តិ (自动生成合同与A4合同书)
                  </span>
                </label>

                <label className="inline-flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipExistingCodes}
                    onChange={(e) => setSkipExistingCodes(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span>រំលងអត្តលេខដែលមានរួចហើយ (跳过已存在工号)</span>
                </label>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                  មើលទិន្នន័យជាមុន (បង្ហាញ ៨ ជួរដំបូង ក្នុងចំណោម {parsedWorkers.length} នាក់)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-white text-[11px] font-semibold text-slate-600">
                        <th className="py-1.5 px-2.5 border-r border-slate-100">អត្តលេខ / 工号</th>
                        <th className="py-1.5 px-2.5 border-r border-slate-100">ឈ្មោះខ្មែរ / 姓名</th>
                        <th className="py-1.5 px-2.5 border-r border-slate-100">ឈ្មោះអង់គ្លេស</th>
                        <th className="py-1.5 px-2.5 border-r border-slate-100">ភេទ</th>
                        <th className="py-1.5 px-2.5 border-r border-slate-100">ក្រុម / 班组</th>
                        <th className="py-1.5 px-2.5 border-r border-slate-100">ថ្ងៃចូល / 入厂日期</th>
                        <th className="py-1.5 px-2.5 border-r border-slate-100">ទូរស័ព្ទ</th>
                        <th className="py-1.5 px-2.5">អាសយដ្ឋាន</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedWorkers.slice(0, 8).map((w, idx) => (
                        <tr key={`${w.employeeCode}_${idx}`} className="hover:bg-slate-50">
                          <td className="py-1.5 px-2.5 font-mono font-semibold border-r border-slate-100">
                            {w.employeeCode}
                          </td>
                          <td className="py-1.5 px-2.5 font-semibold border-r border-slate-100">
                            {w.khmerName}
                          </td>
                          <td className="py-1.5 px-2.5 font-mono border-r border-slate-100">
                            {w.englishName}
                          </td>
                          <td className="py-1.5 px-2.5 border-r border-slate-100">{w.gender}</td>
                          <td className="py-1.5 px-2.5 border-r border-slate-100">{w.team}</td>
                          <td className="py-1.5 px-2.5 font-mono border-r border-slate-100">
                            {w.hireDate}
                          </td>
                          <td className="py-1.5 px-2.5 font-mono border-r border-slate-100">
                            {w.phone || '—'}
                          </td>
                          <td className="py-1.5 px-2.5 text-slate-600">
                            {[w.village, w.commune, w.district, w.province].filter(Boolean).join(', ') || '—'}
                          </td>
                        </tr>
                      ))}
                      {parsedWorkers.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-6 text-center text-slate-500">
                            មិនមានជួរទិន្នន័យកម្មករទេ សូមពិនិត្យជួរចាប់ផ្តើម ឬជ្រើសជួរឈរម្តងទៀត
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            បិទ
          </button>
          <button
            type="button"
            disabled={importing || parsedWorkers.length === 0}
            onClick={() => void handleConfirmImport()}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>
              {importing
                ? 'កំពុងនាំចូល...'
                : `បញ្ជាក់នាំចូល ${parsedWorkers.length} នាក់ (确认导入)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
