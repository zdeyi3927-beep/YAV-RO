import * as XLSX from 'xlsx';
import {
  addDaysToIsoDate,
  Contract,
  getEffectiveApprovalStatus,
  Worker,
} from '../types/workforce';

export interface ExportMonthlySummary {
  exportedCount: number;
  teamCount: number;
  monthLabel: string;
}

export function exportExpiringContractsByTeamExcel(
  contracts: Contract[],
  workers: Worker[],
  targetMonth: string // YYYY-MM
): ExportMonthlySummary | null {
  const [yearStr, monthStr] = targetMonth.split('-');
  const yearNum = Number(yearStr);
  const monthNum = Number(monthStr);
  if (!yearNum || !monthNum) return null;

  const workerById = new Map<string, Worker>();
  for (const w of workers) {
    workerById.set(w.id, w);
  }

  // Group pending_approval contracts expiring in the selected YYYY-MM by team (班组)
  const teamDict = new Map<string, Array<{
    employeeCode: string;
    khmerName: string;
    englishName: string;
    team: string;
    hireDate: string;
    probationEndDate: string;
    currentEndDate: string;
    nextEndDate: string;
  }>>();

  for (const c of contracts) {
    const approval = getEffectiveApprovalStatus(c);
    if (approval !== 'pending_approval') continue;
    if (!c.endDate.startsWith(targetMonth)) continue;

    const w = workerById.get(c.workerId);
    const teamName = (w?.team || c.team || 'ផ្សេងៗ / 其他').trim();
    const hireDate = w?.hireDate || c.hireDate || c.startDate;
    const probationEndDate = addDaysToIsoDate(hireDate, 60);
    const nextEndDate = addDaysToIsoDate(c.endDate, 90);

    const list = teamDict.get(teamName) || [];
    list.push({
      employeeCode: c.employeeCode,
      khmerName: c.workerName,
      englishName: w?.englishName || c.englishName || '',
      team: teamName,
      hireDate,
      probationEndDate,
      currentEndDate: c.endDate,
      nextEndDate,
    });
    teamDict.set(teamName, list);
  }

  if (teamDict.size === 0) {
    return null;
  }

  const wb = XLSX.utils.book_new();
  let totalCount = 0;

  // Sheet 1: 汇总 / សរុប
  const summaryRows: Array<Array<string | number>> = [
    ['合同到期汇总表 · តារាងសរុបកុងត្រាផុតកំណត់'],
    [],
    ['导出月份 / ខែនាំចេញ：', `${yearNum}年${monthNum}月 (${targetMonth})`],
    ['导出时间 / ម៉ោងនាំចេញ：', new Date().toISOString().replace('T', ' ').slice(0, 19)],
    ['总合同数 / កុងត្រាសរុប：', 0],
    [],
    ['班组 / ក្រុមការងារ', '人数 / ចំនួន'],
  ];

  const teamSheets: Array<{ sheetName: string; rows: Array<Array<string | number>> }> = [];
  const usedSheetNames = new Set<string>(['汇总']);

  for (const [teamName, items] of teamDict.entries()) {
    totalCount += items.length;
    summaryRows.push([teamName, items.length]);

    // Clean Excel sheet name (max 31 chars, no []:*?/\ chars)
    const sanitizedBase = teamName.replace(/[[\]:*?/\\]/g, '_').slice(0, 28) || 'Team';
    let sheetName = sanitizedBase;
    let counter = 2;
    while (usedSheetNames.has(sheetName)) {
      sheetName = `${sanitizedBase.slice(0, 25)}_${counter}`;
      counter += 1;
    }
    usedSheetNames.add(sheetName);

    const sheetRows: Array<Array<string | number>> = [
      [
        '序号',
        '工号',
        '柬埔寨名',
        '英文名',
        '部门',
        '入职日期',
        '转正日期',
        '续签日期',
        '合同到期日',
        '合同续签期限',
        '本人确认续签',
        '主管确认续签',
        '备注',
      ],
    ];

    items.forEach((item, idx) => {
      sheetRows.push([
        idx + 1,
        item.employeeCode,
        item.khmerName,
        item.englishName,
        item.team,
        item.hireDate,
        item.probationEndDate,
        item.currentEndDate,
        item.nextEndDate,
        '3个月 (90天)',
        '',
        '',
        '',
      ]);
    });

    sheetRows.push(['本组合计：', `${items.length} 人`]);
    teamSheets.push({ sheetName, rows: sheetRows });
  }

  summaryRows[4][1] = `${totalCount} 份`;
  summaryRows.push(['总计 / សរុប', totalCount]);

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
  summaryWs['!cols'] = [{ wch: 24 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, summaryWs, '汇总');

  for (const ts of teamSheets) {
    const ws = XLSX.utils.aoa_to_sheet(ts.rows);
    ws['!cols'] = [
      { wch: 8 },
      { wch: 12 },
      { wch: 22 },
      { wch: 20 },
      { wch: 16 },
      { wch: 13 },
      { wch: 13 },
      { wch: 13 },
      { wch: 13 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, ts.sheetName);
  }

  XLSX.writeFile(wb, `合同到期汇总_${targetMonth}.xlsx`);

  return {
    exportedCount: totalCount,
    teamCount: teamDict.size,
    monthLabel: targetMonth,
  };
}
