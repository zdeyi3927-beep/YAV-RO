import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileText, Printer, X } from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { Contract, ContractType, Worker } from '../types/workforce';

interface ContractDocumentModalProps {
  contract: Contract | null;
  worker: Worker | undefined;
  onClose: () => void;
}

function parseIsoParts(isoDate: string | undefined): { year: string; month: string; day: string } {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return { year: '.......', month: '.......', day: '.......' };
  }
  const [year, monthNum, dayNum] = isoDate.split('-');
  return {
    year,
    month: String(Number(monthNum)),
    day: String(Number(dayNum)),
  };
}

function computeAgeFromDob(dob: string | undefined, referenceIsoDate?: string): string {
  if (!dob) return '';
  let birthYear: number | null = null;
  let birthMonth = 1;
  let birthDay = 1;

  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(dob)) {
    const [y, m, d] = dob.split(/[-/]/).map(Number);
    birthYear = y;
    birthMonth = m;
    birthDay = d;
  } else if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(dob)) {
    const [d, m, y] = dob.split(/[-/]/).map(Number);
    birthYear = y;
    birthMonth = m;
    birthDay = d;
  }

  if (!birthYear || birthYear < 1940 || birthYear > 2020) return '';

  const ref =
    referenceIsoDate && /^\d{4}-\d{2}-\d{2}$/.test(referenceIsoDate)
      ? new Date(`${referenceIsoDate}T00:00:00Z`)
      : new Date();
  let age = ref.getUTCFullYear() - birthYear;
  const mDiff = ref.getUTCMonth() + 1 - birthMonth;
  if (mDiff < 0 || (mDiff === 0 && ref.getUTCDate() < birthDay)) {
    age -= 1;
  }
  return age > 0 && age < 100 ? String(age) : '';
}

export function ContractDocumentModal({
  contract,
  worker,
  onClose,
}: ContractDocumentModalProps) {
  const docRef = useRef<HTMLDivElement>(null);
  const [templateType, setTemplateType] = useState<ContractType>('probation_60');
  const [baseSalary, setBaseSalary] = useState('208');
  const [education, setEducation] = useState('');
  const [positionOverride, setPositionOverride] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    if (contract) {
      setTemplateType(contract.contractType);
      setBaseSalary(contract.contractType === 'probation_60' ? '208' : '210');
      setEducation('');
      setPositionOverride(contract.team || worker?.team || '');
      setPdfError(null);
    }
  }, [contract, worker]);

  const handleSwitchTemplate = (nextType: ContractType) => {
    setTemplateType(nextType);
    if (baseSalary === '208' || baseSalary === '210') {
      setBaseSalary(nextType === 'probation_60' ? '208' : '210');
    }
  };

  const computed = useMemo(() => {
    if (!contract) return null;
    const isProbation = templateType === 'probation_60';
    const fullName = worker
      ? `${worker.khmerName}${worker.englishName ? ` (${worker.englishName})` : ''}`
      : `${contract.workerName}${contract.englishName ? ` (${contract.englishName})` : ''}`;
    const gender = worker?.gender || contract.gender || '';
    const dob = worker?.dateOfBirth || '';
    const hireDate = worker?.hireDate || contract.hireDate || contract.startDate;
    const age = computeAgeFromDob(dob, contract.startDate);
    const startParts = parseIsoParts(contract.startDate);
    const endParts = parseIsoParts(contract.endDate);

    return {
      isProbation,
      fullName,
      gender,
      dob,
      age,
      hireDate,
      employeeCode: worker?.employeeCode || contract.employeeCode,
      village: worker?.village || '',
      commune: worker?.commune || '',
      district: worker?.district || '',
      province: worker?.province || '',
      startParts,
      endParts,
    };
  }, [contract, worker, templateType]);

  if (!contract || !computed) return null;

  const handleExportPdf = async () => {
    const el = docRef.current;
    if (!el) return;
    setExportingPdf(true);
    setPdfError(null);

    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      const scale = 2;
      const docRect = el.getBoundingClientRect();
      const pageWidthMm = 210;
      const pageHeightMm = 297;
      const domWidth = docRect.width || el.offsetWidth;
      const domPageHeight = domWidth * (pageHeightMm / pageWidthMm);

      // Collect safe page break Y boundaries between clauses so no text line is ever sliced
      const clauseEls = Array.from(el.querySelectorAll('.contract-clause'));
      const candidateBreaksDom = clauseEls
        .map((node) => {
          const r = node.getBoundingClientRect();
          return r.bottom - docRect.top + 4;
        })
        .filter((y) => y > 0)
        .sort((a, b) => a - b);

      const canvas = await html2canvas(el, {
        scale,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const totalDomHeight = canvas.height / scale;
      const pxToMm = pageWidthMm / canvas.width;

      if (totalDomHeight <= domPageHeight + 4) {
        // Fits cleanly on a single A4 page
        const imgData = canvas.toDataURL('image/png');
        const renderHeightMm = Math.min(pageHeightMm, canvas.height * pxToMm);
        pdf.addImage(imgData, 'PNG', 0, 0, pageWidthMm, renderHeightMm);
      } else {
        // Slice cleanly at clause boundaries across A4 pages
        let cursorDomY = 0;
        let pageIndex = 0;
        const marginTopMm = 8;

        while (cursorDomY < totalDomHeight - 2 && pageIndex < 10) {
          const topMarginForPageMm = pageIndex === 0 ? 0 : marginTopMm;
          const usableDomHeight = domPageHeight - (topMarginForPageMm / pageWidthMm) * domWidth - 12;
          const maxEndDomY = cursorDomY + usableDomHeight;

          let sliceEndDomY = totalDomHeight;
          if (maxEndDomY < totalDomHeight - 4) {
            const safeBreak = [...candidateBreaksDom]
              .reverse()
              .find((y) => y > cursorDomY + 80 && y <= maxEndDomY);
            sliceEndDomY = safeBreak ?? maxEndDomY;
          }

          const srcY = Math.round(cursorDomY * scale);
          const srcH = Math.max(1, Math.round((sliceEndDomY - cursorDomY) * scale));

          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = srcH;
          const ctx = pageCanvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
            ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
            const sliceData = pageCanvas.toDataURL('image/png');
            if (pageIndex > 0) pdf.addPage();
            const sliceHeightMm = srcH * pxToMm;
            pdf.addImage(sliceData, 'PNG', 0, topMarginForPageMm, pageWidthMm, sliceHeightMm);
          }

          cursorDomY = sliceEndDomY;
          pageIndex += 1;
        }
      }

      const suffix = computed.isProbation ? 'probation-60d' : 'formal-90d';
      pdf.save(`contract-${computed.employeeCode}-${suffix}.pdf`);
    } catch (err) {
      setPdfError(
        err instanceof Error
          ? err.message
          : 'មិនអាចនាំចេញ PDF បានទេ (PDF 导出失败)'
      );
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 overflow-y-auto p-3 sm:p-6 print:static print:inset-auto print:bg-transparent print:p-0 print:overflow-visible">
      <div className="max-w-[225mm] mx-auto space-y-3 print:max-w-none print:space-y-0">
        {/* Top Control Toolbar (hidden when printing) */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 sm:px-5 space-y-2 shadow-sm no-print">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-slate-700" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  លិខិតកិច្ចសន្យា / {computed.isProbation ? '试用合同书' : '正式合同书'} ({computed.employeeCode})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Pine arts and Crafts Company Limited · ទម្រង់ A4 ស្តង់ដារក្រុមហ៊ុន
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-slate-300 bg-slate-50 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => handleSwitchTemplate('probation_60')}
                  className={`px-2.5 py-1 rounded-md font-medium cursor-pointer whitespace-nowrap ${
                    computed.isProbation
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  សាកល្បង 试用合同
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchTemplate('fulltime_90')}
                  className={`px-2.5 py-1 rounded-md font-medium cursor-pointer whitespace-nowrap ${
                    !computed.isProbation
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ពេញសិទ្ធិ 正式合同
                </button>
              </div>

              <label className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                <span>មុខងារ/职务:</span>
                <input
                  type="text"
                  value={positionOverride}
                  onChange={(e) => setPositionOverride(e.target.value)}
                  className="w-24 px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                <span>កម្រិតវប្បធម៌/学历:</span>
                <input
                  type="text"
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                  placeholder="—"
                  className="w-20 px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                <span>ប្រាក់ខែគោល/底薪:</span>
                <input
                  type="text"
                  value={baseSalary}
                  onChange={(e) => setBaseSalary(e.target.value)}
                  className="w-14 px-2 py-1 text-xs font-mono border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </label>
              <button
                type="button"
                disabled={exportingPdf}
                onClick={() => void handleExportPdf()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{exportingPdf ? 'កំពុងបង្កើត PDF...' : 'ទាញយក PDF (导出 PDF)'}</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>បោះពុម្ព (打印)</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="បិទ"
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {pdfError && (
            <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              {pdfError}
            </div>
          )}
        </div>

        {/* Exact A4 Bilingual Contract Document */}
        <div ref={docRef} className="a4-document bg-white text-black mx-auto shadow-lg print:shadow-none">
          {/* 头部公司与国家信息 */}
          <div className="flex justify-between items-start mb-3.5 text-[13px] font-bold leading-snug">
            <div className="text-left">
              <div>ផាញ អាត អេន ក្រាហ្វ ឯ.ក</div>
              <div>Pine arts and Crafts Company Limited</div>
            </div>
            <div className="text-center">
              <div>ព្រះរាជាណាចក្រកម្ពុជា</div>
              <div>ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
              <div>柬埔寨王国</div>
              <div>民族宗教君主</div>
            </div>
          </div>

          {/* 标题 */}
          <div className="text-center text-[20px] font-bold my-3.5 leading-snug">
            <div>{computed.isProbation ? 'កិច្ចសន្យាសាកល្បង' : 'កិច្ចសន្យាពេញសិទ្ធិ'}</div>
            <div>{computed.isProbation ? '试用合同书' : '正式合同书'}</div>
          </div>

          {/* 员工信息表格 */}
          <table className="w-full border-collapse mb-3.5 text-[12px]">
            <tbody>
              <tr>
                <td className="border border-black px-2 py-1.5 w-[16%] align-middle leading-snug">
                  គោត្តនាមនឹងនាម
                  <br />
                  姓名
                </td>
                <td className="border border-black px-2 py-1.5 w-[20%] align-middle text-center font-semibold">
                  {computed.fullName}
                </td>
                <td className="border border-black px-2 py-1.5 w-[13%] align-middle leading-snug">
                  ភេទ
                  <br />
                  性别
                </td>
                <td className="border border-black px-2 py-1.5 w-[16%] align-middle text-center">
                  {computed.gender || '—'}
                </td>
                <td className="border border-black px-2 py-1.5 w-[15%] align-middle leading-snug">
                  អាយុរ
                  <br />
                  年龄
                </td>
                <td className="border border-black px-2 py-1.5 w-[20%] align-middle text-center font-mono">
                  {computed.age}
                </td>
              </tr>
              <tr>
                <td className="border border-black px-2 py-1.5 align-middle leading-snug">
                  ថ្ងៃខែឆ្នាំកំណើត
                  <br />
                  出生日期
                </td>
                <td className="border border-black px-2 py-1.5 align-middle text-center font-mono">
                  {computed.dob || '—'}
                </td>
                <td className="border border-black px-2 py-1.5 align-middle leading-snug">
                  កំរិតវប្បធម៌
                  <br />
                  学历
                </td>
                <td className="border border-black px-2 py-1.5 align-middle text-center">
                  {education}
                </td>
                <td className="border border-black px-2 py-1.5 align-middle leading-snug">
                  អត្តលេខ
                  <br />
                  工号
                </td>
                <td className="border border-black px-2 py-1.5 align-middle text-center font-mono font-bold">
                  {computed.employeeCode}
                </td>
              </tr>
              <tr>
                <td className="border border-black px-2 py-1.5 align-middle leading-snug">
                  ថ្ងៃចូលធ្វើការ
                  <br />
                  进厂日期
                </td>
                <td className="border border-black px-2 py-1.5 align-middle text-center font-mono">
                  {computed.hireDate}
                </td>
                <td className="border border-black px-2 py-1.5 align-middle leading-snug">
                  មុខងារ
                  <br />
                  职务
                </td>
                <td className="border border-black px-2 py-1.5 align-middle text-center">
                  {positionOverride || '—'}
                </td>
                <td className="border border-black px-2 py-1.5 align-middle leading-snug">
                  ប្រាក់បៀវត្សគោល
                  <br />
                  底薪
                </td>
                <td className="border border-black px-2 py-1.5 align-middle text-center font-mono">
                  {baseSalary}
                </td>
              </tr>
              <tr>
                <td className="border border-black px-2 py-1.5 align-middle leading-snug">
                  ទីលំនៅបច្ចុប្បន្ន
                  <br />
                  现居地址
                </td>
                <td className="border border-black px-2 py-1.5 align-middle" colSpan={5}>
                  {computed.village ? `ភូមិ (村): ${computed.village}   ` : ''}
                  ឃុំ (乡/区): {computed.commune || '...........................'} &nbsp; ស្រុក (县):{' '}
                  {computed.district || '...........................'} &nbsp; ខេត្ត (省):{' '}
                  {computed.province || '...........................'}
                </td>
              </tr>
            </tbody>
          </table>

          {/* 合同正文条款 */}
          <div className="text-[11.5px] leading-[1.5] text-justify space-y-2">
            {/* 前言 */}
            <div className="contract-clause">
              {computed.isProbation ? (
                <>
                  <p className="m-0 mb-0.5">
                    ក្រុមហ៊ុនសូមបញ្ជាក់ជូនកម្មកររូបនេះពិតជាបានចូលកម្មករសាកល្បង ចាប់ផ្តើមពីថ្ងៃចូលរោងចក្រនេះតទៅសាកល្បងចំនួន២ខែ ហើយធ្វើកិច្ចសន្យាការងារសាកល្បង ជាមួយក្រុមហ៊ុនដែលមានខ្លឹមសារដូចខាងក្រោម :
                  </p>
                  <p className="m-0">
                    本公司在此证实此员工已进入试用期,从进厂日开始试用为2个月,与公司签下工作试用合同书,其内容如下
                  </p>
                </>
              ) : (
                <>
                  <p className="m-0 mb-0.5">
                    ក្រុមហ៊ុនសូមបញ្ជាក់ជូនកម្មកររូបនេះ ពិតជាបានឆ្លងកាត់ការងារសាកល្បងជោគជ័យមែន ចាប់ពីពេលនេះតទៅក្រុមហ៊ុនចាត់ទុកជាកម្មករពេញសិទ្ធិរបស់ក្រុមហ៊ុន ហើយធ្វើកិច្ចសន្យាការងារពេញសិទ្ធិជាមួយក្រុមហ៊ុន កិច្ចសន្យាមួយដងមានរយះ៣ខែដែលមានខ្លឹមសារដូចខាងក្រោមៈ
                  </p>
                  <p className="m-0">
                    本公司在此证实此员工已顺利的通过试用期,从现在开始转为本公司的正式员工,与公司签下工作正式合同书,一次合约期限3个月,及在合同期间的底薪以及其他内容如下
                  </p>
                </>
              )}
            </div>

            {/* 第 1 条 (+ 转正合同的薪资明细表) */}
            <div className="contract-clause">
              <p className="m-0 mb-0.5">
                ១. រយះពេលធ្វើកិច្ចសន្យា {computed.isProbation ? '២ ខែ' : '៣ ខែ'} រយះពេលមានប្រសិទ្ធិភាពចាប់ពីឆ្នាំ{' '}
                <span className="font-mono font-semibold">{computed.startParts.year}</span> ខែ{' '}
                <span className="font-mono font-semibold">{computed.startParts.month}</span> ទី{' '}
                <span className="font-mono font-semibold">{computed.startParts.day}</span> ដល់ឆ្នាំ{' '}
                <span className="font-mono font-semibold">{computed.endParts.year}</span> ខែ{' '}
                <span className="font-mono font-semibold">{computed.endParts.month}</span> ទី{' '}
                <span className="font-mono font-semibold">{computed.endParts.day}</span>
              </p>
              <p className="m-0">
                一、正式合约期为{computed.isProbation ? '2个月' : '3个月'},从{' '}
                <span className="font-mono font-semibold">{computed.startParts.year}</span> 年{' '}
                <span className="font-mono font-semibold">{computed.startParts.month}</span> 月{' '}
                <span className="font-mono font-semibold">{computed.startParts.day}</span> 日起至{' '}
                <span className="font-mono font-semibold">{computed.endParts.year}</span> 年{' '}
                <span className="font-mono font-semibold">{computed.endParts.month}</span> 月{' '}
                <span className="font-mono font-semibold">{computed.endParts.day}</span> 日止
              </p>

              {!computed.isProbation && (
                <>
                  <div className="salary-table-container my-2 ml-4">
                    <p className="m-0 mb-1 font-medium">លក្ខ័ខណ្ឌច្បាប់ 法定項目:</p>
                    <table className="w-[96%] border-collapse mb-2 text-[11px]">
                      <thead>
                        <tr>
                          <th className="border border-black px-2 py-1 bg-[#f9f9f9] text-center font-normal">
                            ធាតុ項目
                          </th>
                          <th className="border border-black px-2 py-1 bg-[#f9f9f9] text-center font-normal">
                            ការទូទាត់ 金額
                          </th>
                          <th className="border border-black px-2 py-1 bg-[#f9f9f9] text-center font-normal">
                            ចំណាំ 備註
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-black px-2 py-1">
                            កុងត្រាកម្មករប្រាក់បៀវត្សគោល
                            <br />
                            底薪
                          </td>
                          <td className="border border-black px-2 py-1">
                            តាមការប្រកាសរបស់រដ្ឋាភិបាល
                            <br />
                            依据政府法定公告
                          </td>
                          <td className="border border-black px-2 py-1" />
                        </tr>
                        <tr>
                          <td className="border border-black px-2 py-1">
                            ប្រាក់មកទៀងទាត់
                            <br />
                            出勤津贴
                          </td>
                          <td className="border border-black px-2 py-1">
                            ១០ ដុល្លារ
                            <br />
                            10 美元
                          </td>
                          <td className="border border-black px-2 py-1">
                            អវត្តមាននឹងត្រូវកាត់តាមអត្រា
                            <br />
                            未出勤将依考勤记录按比例减扣
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-black px-2 py-1">
                            ប្រាក់ឧបត្ថម្ភអាហារ
                            <br />
                            用餐津贴
                          </td>
                          <td className="border border-black px-2 py-1">
                            ០.៥ ដុល្លារ
                            <br />
                            0.5 美元
                          </td>
                          <td className="border border-black px-2 py-1">
                            ដោយផ្អែកលើថ្ងៃធ្វើការជាក់ស្តែង
                            <br />
                            依实际上工日数核发
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-black px-2 py-1">
                            ប្រាក់សោហ៊ុយធ្វើដំណើរ/ការស្នាក់នៅ
                            <br />
                            交通或住宿津贴
                          </td>
                          <td className="border border-black px-2 py-1">
                            ធ្វើតាមការប្រកាសរបស់រដ្ឋាភិបាល
                            <br />
                            依据政府法定公告
                          </td>
                          <td className="border border-black px-2 py-1" />
                        </tr>
                      </tbody>
                    </table>

                    <p className="m-0 mb-1 font-medium">លក្ខខណ្ឌបន្ថែម 其他项目:</p>
                    <table className="w-[96%] border-collapse mb-2 text-[11px]">
                      <thead>
                        <tr>
                          <th className="border border-black px-2 py-1 bg-[#f9f9f9] text-center font-normal">
                            ធាតុ項目
                          </th>
                          <th className="border border-black px-2 py-1 bg-[#f9f9f9] text-center font-normal">
                            ការទូទាត់ 金額
                          </th>
                          <th className="border border-black px-2 py-1 bg-[#f9f9f9] text-center font-normal">
                            ចំណាំ 備註
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-black px-2 py-1">
                            ប្រាក់ឧបត្ថម្ភមុខតំណែង
                            <br />
                            职务津贴
                          </td>
                          <td className="border border-black px-2 py-1" />
                          <td className="border border-black px-2 py-1" />
                        </tr>
                        <tr>
                          <td className="border border-black px-2 py-1">
                            ប្រាក់ឧបត្ថម្ភជំនាញ
                            <br />
                            技术津贴
                          </td>
                          <td className="border border-black px-2 py-1" />
                          <td className="border border-black px-2 py-1" />
                        </tr>
                        <tr>
                          <td className="border border-black px-2 py-1">
                            ប្រាក់ឧបត្ថម្ភអាហារ
                            <br />
                            用餐津贴
                          </td>
                          <td className="border border-black px-2 py-1" />
                          <td className="border border-black px-2 py-1" />
                        </tr>
                        <tr>
                          <td className="border border-black px-2 py-1">
                            ប្រាក់ឧបត្ថម្ភផ្សេងទៀត
                            <br />
                            其他津贴
                          </td>
                          <td className="border border-black px-2 py-1" />
                          <td className="border border-black px-2 py-1" />
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <p className="m-0 mb-0.5">
                    រីឯប្រាក់បៀវត្ស នឹងត្រូវបើកចំនួនពីរលើក លើកទី១បើកនៅថ្ងៃទី២៥ និងលើកទី២បើកនៅថ្ងៃទី១០( បើចំថ្ងៃអាទិត្យ ថ្ងៃបុណ្យជាតិអាចបើកមុន១ថ្ងៃ)
                  </p>
                  <p className="m-0">
                    员工薪资将分两次发放,在每月25号及10日发放。(如遇状况,可提前或延后一天)。
                  </p>
                </>
              )}
            </div>

            {/* 第 2 条 */}
            <div className="contract-clause">
              <p className="m-0 mb-0.5">
                ២. ក្នុងអំឡុងពេលធ្វើការអោយក្រុមហ៊ុន ភាពទទួលខុសត្រូវការងារ ការងារដែលត្រូវផ្លាស់ប្តូរផ្នែក រឺផ្លាស់ប្តូរមុខតំណែងគឺអាស្រ័យទៅលើក្រុមហ៊ុន រឺប្រធានដឹកនាំជាអ្នករៀបចំ ប្រសិនគ្មានហេតុផលសមរម្យត្រូវព្រមទទួល និងសហការណ៍។
              </p>
              <p className="m-0">
                二、为公司工作期间,职务责任和所有作业改动或调任部门依据公司或领导安排,无合理情况下须接受及配合。
              </p>
            </div>

            {/* 第 3 条 */}
            <div className="contract-clause">
              <p className="m-0 mb-0.5">
                ៣. ក្នុងមួយថ្ងៃធ្វើការ៨ម៉ោង មួយសប្តាហ៍ធ្វើការ៤៨ម៉ោង បើថែមម៉ោងកម្មករនឹងទទួលបានប្រាក់បន្ថែមម៉ោងគិតតាមច្បាប់ក្រសួងការងារ ។
              </p>
              <p className="m-0">
                三. 每天上班时间为8小时,一星期为48小时,如赶货加班时员工可获得按劳工法规定的加班费。
              </p>
            </div>

            {/* 第 4 条 (试用无5%补偿，正式含总工资5%补偿) */}
            <div className="contract-clause">
              {computed.isProbation ? (
                <>
                  <p className="m-0 mb-0.5">
                    ៤. កិច្ចសន្យាជិតផុតកំណត់ ក្រុមហ៊ុននឹងជំរាបជូនដំណឹងមុន៧ថ្ងៃអោយកម្មករដឹងពីពេលកំណត់កិច្ចសន្យា ប្រសិនបើក្រុមហ៊ុនមិនបន្តកិច្ចសន្យាថ្មីជាមួយកម្មករនិយោជិតទេនោះក្រុមហ៊ុននឹងបើកប្រាក់បៀវត្សជូននូវប្រាក់ដែលត្រូវបើកក្រៅពីនេះកម្មករនិយោជិត មិនអាចទាមទារសំណងអ្វីផ្សេងចំពោះក្រុមហ៊ុនឡើយ ។
                  </p>
                  <p className="m-0">
                    四. 试用合约快要到期之前,公司将提前7天通知员工有关到期合约事宜,如公司不继续约与员工签正式合同,除应得的工资外,终止试用合约时公司将不做任何補偿。
                  </p>
                </>
              ) : (
                <>
                  <p className="m-0 mb-0.5">
                    ៤. កិច្ចសន្យាជិតផុតកំណត់ ក្រុមហ៊ុននឹងជំរាបជូនដំណឹងមុន៧ថ្ងៃអោយកម្មករដឹងពីពេលកំណត់កិច្ចសន្យា ប្រសិនបើក្រុមហ៊ុនមិនបន្តកិច្ចសន្យាថ្មីជាមួយកម្មករនិយោជិតទេ នោះក្រុមហ៊ុននឹងបើកប្រាក់បៀវត្សជូននូវប្រាក់បៀវត្សដែលត្រូវបើក(គិតទាំងប្រាក់បៀវត្សសរុបមានសំណង៥%) ក្រៅពីនេះកម្មករនិយោជិត មិនអាចទាមទារសំណងអ្វីផ្សេងចំពោះក្រុមហ៊ុនឡើយ ។
                  </p>
                  <p className="m-0">
                    四. 工作合约快要到期之前,公司将提前7天通知员工有关到期合约事宜,如公司不继续约,除应得的工资外(含总工资5%之补偿),终止合约时公司将不做任何補偿。
                  </p>
                </>
              )}
            </div>

            {/* 第 5 条 */}
            <div className="contract-clause">
              <p className="m-0 mb-0.5">
                ៥. កម្មករនិយោជិតដែលចូលថ្មីរឺឆ្លងកាត់កម្មករនិយោជិតឆ្លងកាត់សាកល្បង ប្រាក់ខែត្រូវកំណត់តាមច្បាប់ស្តីពីក្រសួងការងារនៃព្រះរាជាណាចក្រកម្ពុជា
              </p>
              <p className="m-0">
                五. 所有新进或已过试用期之员工,薪资全部都以柬埔寨劳工法规定计算处理。
              </p>
            </div>

            {/* 第 6 条 */}
            <div className="contract-clause">
              <p className="m-0 mb-0.5">
                ៦. កម្មករត្រូវចេញចូលធ្វើការអោយទៀងពេល មានបញ្ហាមិនបានមកធ្វើការ មកយឺត រឺ ត្រូវចេញមុនម៉ោងត្រូវប្រាប់អ្នកគ្រប់គ្រងអោយដាក់ច្បាប់ ហើយត្រូវមានក្រដាស់ច្បាប់ត្រឹមត្រូវ មិនដូចច្នោះទេមានន័យថាឈប់អត់ច្បាប់ បើឈប់អត់ច្បាប់បីថ្ងៃជាប់គ្នា ចាត់ទុកថាបោះបង់ចោលការងារ។
              </p>
              <p className="m-0">
                六. 员工需按时出勤,有事不能上班或不能按时上下班时需向相关负责人请假,并且要有请假条,否则视为旷工。连续矿工三天视为自动离职。
              </p>
            </div>

            {/* 第 7 条 */}
            <div className="contract-clause">
              <p className="m-0 mb-0.5">
                ៧. កម្មករត្រូវគោរពច្បាប់ស្តីពីក្រសួងការងារនិងច្បាប់ផ្ទៃក្នុងរបស់ក្រុមហ៊ុន បើប្រព្រឹត្តិល្មើសពីច្បាប់ស្តីពីក្រសួងការងារ មិនគោរពតាមខ្លឹមសារក្នុងកិច្ចសន្យា រឺប្រព្រឹត្តិល្មើសច្បាប់រោងចក្រចំនួន៣ដងនិងត្រូវចេញលិខិតព្រមាន ក្រុមហ៊ុនមានសិទ្ធិបញ្ឈប់ពីការងារហើយព្រមទាំងលុបចោលនូវកិច្ចសន្យា បើប្រព្រឹត្តិល្មើសច្បាប់រោងចក្រធ្ងន់ធ្ងរ(ត្រូវក្រុមហ៊ុនបញ្ឈប់ការងារ) ក្រៅពីប្រាក់បៀវត្សការងារគ្មានសំណងអ្វីទាំងអស់ ។
              </p>
              <p className="m-0">
                七. 员工须遵守劳工法及内部规章,违反劳工法、不遵守合约里有关规定或违反三次厂规者並开警告信,公司有权利开除及解除雇用合约,如严重违反厂规(被公司开除),除已工作薪资外不做任何补偿。
              </p>
            </div>

            {/* 第 8 条 */}
            <div className="contract-clause">
              <p className="m-0 mb-0.5">
                ៨. ក្រុមហ៊ុនស្នើអោយកម្មករថែមម៉ោង គឺធ្វើទៅតាមការយល់ព្រមពីភាគីទាំងសងខាង កម្មករថែមម៉ោងវេនព្រឹកថែមម៉ោង: ធម្មតាគិតប្រាក់ខែគោល/២៦/8*ចំនួនថែមម៉ោង*១,៥ ចំពោះធ្វើការថ្ងៃបុណ្យជាតិ រឺ ថ្ងៃអាទិត្យគិតប្រាក់ខែគោល/២៦/៨*ចំនួនថែមម៉ោង*២ ។ កម្មករថែមវេនយប់ : ប្រាក់ខែគោល/២៦/៨*ចំនួនថែមម៉ោង*២ ចំពោះធ្វើការថ្ងៃបុណ្យជាតិ រឺ ថ្ងៃអាទិត្យគិតប្រាក់ខែគោល/២៦/៨*ចំនួនថែមម៉ោង*២ ។
              </p>
              <p className="m-0">
                八. 公司可以要求员工加班,依照双方一致同意,白班员工加班:普通加班费以底薪/26/8×加班时数×1.5倍,假日或星期天加班以底薪/26/8×加班时数×2倍。夜班员工加班:除普通加班费以底薪/26/8×加班时数×2倍以外,其余国定假日与星期天加班费以底薪/26/8×加班时数×2倍计算。
              </p>
            </div>

            {/* 第 9 条 */}
            <div className="contract-clause">
              <p className="m-0 mb-0.5">
                ៩. ប្រសិនកម្មកររងរបួសការងារ រឺ នៅពេលធ្វើដំណើរមកធ្វើការប្រទះគ្រោះថ្នាក់ចរាចរណ៏ ក្រុមហ៊ុនធានារ៉ាប់រងនិងទទួលខុសត្រូវទាំងស្រុងចំពោះប្រាក់ខែនិងថ្លៃព្យាបាល ។
              </p>
              <p className="m-0">
                九. 员工如在工作时及上班途中发生意外,保险公司将负责一切医疗费及薪资。
              </p>
            </div>

            {/* 第 10 条 */}
            <div className="contract-clause">
              <p className="m-0 mb-0.5">
                ១០. កម្មករមានយោបល់អ្វីមួយត្រូវសរសេរជាលាយលក្ខណ៍អក្សររួចទំនាក់ទំនងទៅផ្នែកគ្រប់គ្រង ហើយផ្នែកគ្រប់គ្រងនឹងដោះស្រាយជូនក្នុងអំឡុងពេល១០ថ្ងៃ។ បើកម្មករចូលរួមធ្វើកូដកម្មមិនស្របច្បាប់ ក្រុមហ៊ុនមានសិទ្ធិបញ្ឈប់ពីការងារ ក្រៅពីប្រាក់បៀវត្សការងារ ក្រុមហ៊ុនមិនមានសំណងអ្វីផ្សេងទៀតទេ។
              </p>
              <p className="m-0">
                十. 员工有任何建议应向管理部书面陈情沟通,管理部于10天内作出合理回应,若员工参与不合法罢工,公司有权开除,除已工作薪资外不做任何补偿。
              </p>
            </div>

            {/* 第 11 条 */}
            <div className="contract-clause">
              <p className="m-0 mb-0.5">
                ១១. កម្មករមិនអាចបករឿងសំងាត់ទាក់ទងនឹងការងារក្រុមហ៊ុនឡើយ មិនចូលរួមកិច្ចការនយោបាយផ្សេងៗ ។
              </p>
              <p className="m-0">
                十一. 员工不可泄露任何关于该公司业务机密的信息,不进行任何政治的活动。
              </p>
            </div>

            {/* 第 12 条 */}
            <div className="contract-clause">
              <p className="m-0 mb-0.5">
                ១២. បើកម្មករយល់ព្រមនិងទទួលយកនូវច្បាប់នៃប្រការនីមួយៗ,នឹងត្រូវផ្តល់ឯកសារពិតប្រាកដល់រោងចក្រសូមយក(អត្តសញ្ញាណប័ណ្ណ,សៀវភៅគ្រួសារ,សំបុត្រកំណើត ច្បាប់ដើមពិតប្រាកដ),សូមចុះហត្ថលេខានិងផ្តិតមេដៃស្តាំទុក ជាភស្តុតាង ។
              </p>
              <p className="m-0">
                十二. 如员工理解、同意并接受以上所有条款规定,并且请确认提供给工厂(身份证、户口薄、出生证明真实有效的证件)请签字并印上手印为证。
              </p>
            </div>

            {/* 第 13 条 */}
            <div className="contract-clause">
              <p className="m-0 mb-0.5">
                ១៣. កិច្ចសន្យាដើមមិនមានខ្លឹមសារទាំងស្រុង សូមយោងទៅតាមបទបញ្ជាផ្ទៃក្នុង សៀវភៅណែនាំកម្មករ រឺច្បាប់ស្តីពីការងារបស់ប្រទេស ៕
              </p>
              <p className="m-0">
                十三. 本合约未尽之事宜,请参照本公司厂纪厂规、员工指引守则、及国家劳动法。
              </p>
            </div>
          </div>

          {/* 底部签名区 */}
          <div className="flex justify-between mt-8 text-center text-[13px] contract-clause">
            <div className="w-[31%] leading-relaxed">
              <div>ហត្ថលេខា ឬ ស្នាមមេដៃកម្មករ (ភាគីខ)</div>
              <div>乙方员工签字</div>
              <div className="h-14" />
            </div>

            <div className="w-[32%] leading-relaxed">
              <div>
                ធ្វើនៅថ្ងៃទី{' '}
                <span className="font-mono font-semibold">{computed.startParts.day}</span> ខែ{' '}
                <span className="font-mono font-semibold">{computed.startParts.month}</span> ឆ្នាំ{' '}
                <span className="font-mono font-semibold">{computed.startParts.year}</span>
              </div>
              <div>
                于 <span className="font-mono font-semibold">{computed.startParts.year}</span> 年{' '}
                <span className="font-mono font-semibold">{computed.startParts.month}</span> 月{' '}
                <span className="font-mono font-semibold">{computed.startParts.day}</span> 日
              </div>
              <div className="h-14" />
            </div>

            <div className="w-[31%] leading-relaxed">
              <div>ហត្ថលេខាក្រុមហ៊ុន (ភាគី ក)</div>
              <div>甲方工厂签字</div>
              <div className="h-14" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
