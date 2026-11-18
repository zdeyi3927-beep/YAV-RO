import * as XLSX from 'xlsx';
import { Gender, todayIsoDate, WorkerInput } from '../types/workforce';

export type WorkerFieldKey =
  | 'employeeCode'
  | 'khmerName'
  | 'englishName'
  | 'gender'
  | 'dateOfBirth'
  | 'nationalId'
  | 'nssfNumber'
  | 'team'
  | 'phone'
  | 'hireDate'
  | 'village'
  | 'commune'
  | 'district'
  | 'province'
  | 'workPermitNumber';

export interface ParsedSheetData {
  sheetName: string;
  rawRows: unknown[][];
  columnLabels: string[];
  dataStartRow: number;
  initialMapping: Record<WorkerFieldKey, number | null>;
}

export interface ParsedWorkbook {
  fileName: string;
  sheets: ParsedSheetData[];
}

export const WORKER_FIELD_META: Array<{
  key: WorkerFieldKey;
  labelKm: string;
  labelZh: string;
}> = [
  { key: 'employeeCode', labelKm: 'អត្តលេខ', labelZh: '工号' },
  { key: 'khmerName', labelKm: 'ឈ្មោះខ្មែរ', labelZh: '柬埔寨名 / 姓名' },
  { key: 'englishName', labelKm: 'ឈ្មោះអង់គ្លេស', labelZh: '英文名' },
  { key: 'gender', labelKm: 'ភេទ', labelZh: '性别' },
  { key: 'dateOfBirth', labelKm: 'ថ្ងៃខែឆ្នាំកំណើត', labelZh: '出生日期' },
  { key: 'nationalId', labelKm: 'អត្តសញ្ញាណប័ណ្ណ', labelZh: '身份证号' },
  { key: 'nssfNumber', labelKm: 'លេខ ប.ស.ស', labelZh: '保险号 / NSSF' },
  { key: 'team', labelKm: 'ក្រុមការងារ', labelZh: '班组 / 职务' },
  { key: 'phone', labelKm: 'លេខទូរស័ព្ទ', labelZh: '电话号码' },
  { key: 'hireDate', labelKm: 'ថ្ងៃចូលធ្វើការ', labelZh: '入厂日期' },
  { key: 'village', labelKm: 'ភូមិ', labelZh: '村' },
  { key: 'commune', labelKm: 'ឃុំ/សង្កាត់', labelZh: '乡/区' },
  { key: 'district', labelKm: 'ក្រុង/ស្រុក', labelZh: '县/区' },
  { key: 'province', labelKm: 'ខេត្ត', labelZh: '省' },
  { key: 'workPermitNumber', labelKm: 'លេខប័ណ្ណការងារ', labelZh: '工作证卡号' },
];

const HEADER_MATCHERS: Record<WorkerFieldKey, string[]> = {
  employeeCode: ['工号', '员工号', '编号', 'អត្តលេខ', 'លេខកូដ', 'employeecode', 'empid', 'empno', 'code', 'id'],
  khmerName: ['柬埔寨名', '柬文名', 'ខ្មែរ', 'ឈ្មោះខ្មែរ', 'គោត្តនាម', '姓名', '员工姓名', 'khmername', 'fullname', 'name'],
  englishName: ['英文名', 'អង់គ្លេស', 'ឈ្មោះអង់គ្លេស', 'englishname', 'english', 'latinname'],
  gender: ['性别', 'ភេទ', 'gender', 'sex'],
  dateOfBirth: ['出生日期', '生日', 'ថ្ងៃខែឆ្នាំកំណើត', 'កំណើត', 'dob', 'birthdate', 'dateofbirth', 'birthday'],
  nationalId: ['身份证', '护照', 'លិខិតឆ្លងដែន', 'អត្តសញ្ញាណប័ណ្ណ', 'nationalid', 'idcard', 'passport'],
  nssfNumber: ['保险号', '社保', 'nssf', 'បសស', 'ប-ស-ស', 'អត្តបសស'],
  team: ['班组', '部门', '组别', '职务', '岗位', 'ក្រុម', 'ផ្នែក', 'មុខងារ', 'team', 'department', 'group', 'position'],
  phone: ['电话', '手机', 'ទូរស័ព្ទ', 'លេខទូរស័ព្ទ', 'phone', 'mobile', 'tel'],
  hireDate: ['入厂日期', '入职日期', '进厂日期', 'ថ្ងៃចូលធ្វើការ', 'ចូលធ្វើការ', 'hiredate', 'startdate', 'joindate', 'entrydate'],
  village: ['ភូមិ', '村', 'village'],
  commune: ['ឃុំ', 'សង្កាត់', '乡', '镇', 'commune'],
  district: ['ក្រុង', 'ស្រុក', '县', '区', 'district'],
  province: ['ខេត្ត', 'រាជធានី', '省', 'province'],
  workPermitNumber: ['工作证', '劳工证', '卡号', 'ប័ណ្ណការងារ', 'workpermit', 'permit', 'cardno'],
};

function normHeaderText(val: unknown): string {
  return String(val ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-_/\\:：()（）.·]+/g, '');
}

function emptyMapping(): Record<WorkerFieldKey, number | null> {
  return {
    employeeCode: null,
    khmerName: null,
    englishName: null,
    gender: null,
    dateOfBirth: null,
    nationalId: null,
    nssfNumber: null,
    team: null,
    phone: null,
    hireDate: null,
    village: null,
    commune: null,
    district: null,
    province: null,
    workPermitNumber: null,
  };
}

function scoreHeaderRow(row: unknown[]): number {
  let score = 0;
  for (const cell of row) {
    const text = normHeaderText(cell);
    if (!text) continue;
    for (const patterns of Object.values(HEADER_MATCHERS)) {
      if (patterns.some((p) => text.includes(normHeaderText(p)))) {
        score += 1;
        break;
      }
    }
  }
  return score;
}

function detectSheetStructure(rawRows: unknown[][]): Omit<ParsedSheetData, 'sheetName' | 'rawRows'> {
  const maxCols = rawRows.reduce((m, r) => Math.max(m, r.length), 0);
  if (maxCols === 0) {
    return { columnLabels: [], dataStartRow: 0, initialMapping: emptyMapping() };
  }

  // Scan top 12 rows to locate primary header row
  let bestRowIdx = -1;
  let bestScore = 0;
  const limit = Math.min(12, rawRows.length);
  for (let i = 0; i < limit; i += 1) {
    const sc = scoreHeaderRow(rawRows[i] || []);
    if (sc > bestScore) {
      bestScore = sc;
      bestRowIdx = i;
    }
  }

  const mapping = emptyMapping();
  let dataStartRow = 0;
  const columnLabels: string[] = [];

  if (bestRowIdx >= 0 && bestScore >= 2) {
    // Check if the next row is a secondary/sub-header row (like 英文名 / ភូមិ / ឃុំ / ស្រុក / ខេត្ត)
    const nextRow = rawRows[bestRowIdx + 1] || [];
    const nextScore = scoreHeaderRow(nextRow);
    const hasSubHeader = nextScore >= 2 && bestRowIdx + 2 <= rawRows.length;
    dataStartRow = hasSubHeader ? bestRowIdx + 2 : bestRowIdx + 1;

    const usedCols = new Set<number>();
    const combinedNorms: string[] = [];

    for (let col = 0; col < maxCols; col += 1) {
      const topVal = String(rawRows[bestRowIdx]?.[col] ?? '').trim();
      const subVal = hasSubHeader ? String(nextRow[col] ?? '').trim() : '';
      const display = [topVal, subVal].filter(Boolean).join(' / ') || `Col ${col + 1}`;
      columnLabels.push(display);
      combinedNorms.push(normHeaderText(`${subVal} ${topVal}`));
    }

    // Match specific sub-header columns first (sub-header takes precedence over merged parent like 现居地址)
    const fieldPriority: WorkerFieldKey[] = [
      'employeeCode',
      'englishName',
      'khmerName',
      'gender',
      'dateOfBirth',
      'nationalId',
      'nssfNumber',
      'workPermitNumber',
      'team',
      'phone',
      'hireDate',
      'village',
      'commune',
      'district',
      'province',
    ];

    for (const field of fieldPriority) {
      const patterns = HEADER_MATCHERS[field].map(normHeaderText);
      // Prefer sub-row exact/partial match first, then combined
      let matchedCol: number | null = null;

      if (hasSubHeader) {
        for (let col = 0; col < maxCols; col += 1) {
          if (usedCols.has(col)) continue;
          const subNorm = normHeaderText(nextRow[col]);
          if (subNorm && patterns.some((p) => subNorm.includes(p))) {
            matchedCol = col;
            break;
          }
        }
      }

      if (matchedCol === null) {
        for (let col = 0; col < maxCols; col += 1) {
          if (usedCols.has(col)) continue;
          const topNorm = normHeaderText(rawRows[bestRowIdx]?.[col]);
          const targetNorm = topNorm || combinedNorms[col];
          if (!targetNorm) continue;
          // Prevent "现居地址" from falsely matching unrelated fields; skip generic serial "序号"
          if (targetNorm === '序号' || targetNorm === 'លរ') continue;
          if (patterns.some((p) => targetNorm.includes(p))) {
            matchedCol = col;
            break;
          }
        }
      }

      if (matchedCol !== null) {
        mapping[field] = matchedCol;
        usedCols.add(matchedCol);
      }
    }
  } else {
    // Headerless Excel sheet: allow manual mapping or sensible positional fallback
    for (let col = 0; col < maxCols; col += 1) {
      const sample = String(rawRows[0]?.[col] ?? '').trim();
      columnLabels.push(sample ? `Col ${col + 1} (${sample.slice(0, 14)})` : `Col ${col + 1}`);
    }
    dataStartRow = 0;
  }

  return { columnLabels, dataStartRow, initialMapping: mapping };
}

export async function parseAnyExcelWorkbook(file: File): Promise<ParsedWorkbook> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

  const sheets: ParsedSheetData[] = wb.SheetNames.map((sheetName) => {
    const ws = wb.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: '',
      raw: true,
    });
    const nonEmptyRows = rawRows.filter((row) =>
      row.some((cell) => String(cell ?? '').trim() !== '')
    );
    const structure = detectSheetStructure(nonEmptyRows);
    return {
      sheetName,
      rawRows: nonEmptyRows,
      ...structure,
    };
  }).filter((s) => s.rawRows.length > 0);

  if (sheets.length === 0) {
    throw new Error('ឯកសារ Excel ទទេ ឬគ្មានទិន្នន័យ (Excel 文件为空或无有效数据)');
  }

  return {
    fileName: file.name,
    sheets,
  };
}

function formatCellAsIsoDate(cell: unknown): string | null {
  if (cell === null || cell === undefined || cell === '') return null;

  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    const y = cell.getFullYear();
    const m = String(cell.getMonth() + 1).padStart(2, '0');
    const d = String(cell.getDate()).padStart(2, '0');
    if (y >= 1940 && y <= 2100) return `${y}-${m}-${d}`;
  }

  if (typeof cell === 'number' && cell > 1000 && cell < 100000) {
    const parsed = XLSX.SSF.parse_date_code(cell);
    if (parsed && parsed.y >= 1940 && parsed.y <= 2100) {
      const m = String(parsed.m).padStart(2, '0');
      const d = String(parsed.d).padStart(2, '0');
      return `${parsed.y}-${m}-${d}`;
    }
  }

  const str = String(cell).trim();
  if (!str) return null;

  // YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const ymd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return null;
}

function formatCellAsDob(cell: unknown): string {
  const iso = formatCellAsIsoDate(cell);
  if (iso) {
    const [y, m, d] = iso.split('-');
    return `${d}-${m}-${y}`;
  }
  const str = String(cell ?? '').trim();
  return str.length >= 4 ? str.slice(0, 20) : '01-01-1995';
}

function normalizeGender(val: unknown): Gender {
  const s = String(val ?? '')
    .trim()
    .toLowerCase();
  if (
    s.includes('ស្រី') ||
    s.includes('女') ||
    s === 'f' ||
    s === 'female' ||
    s === '2'
  ) {
    return 'ស្រី';
  }
  return 'ប្រុស';
}

export function buildWorkerInputsFromSheet(
  sheet: ParsedSheetData,
  mapping: Record<WorkerFieldKey, number | null>,
  dataStartRow: number
): WorkerInput[] {
  const result: WorkerInput[] = [];
  const today = todayIsoDate();

  const getCell = (row: unknown[], key: WorkerFieldKey): unknown => {
    const col = mapping[key];
    if (col === null || col === undefined || col < 0) return '';
    return row[col] ?? '';
  };

  for (let r = dataStartRow; r < sheet.rawRows.length; r += 1) {
    const row = sheet.rawRows[r] || [];
    const nonEmptyCount = row.filter((c) => String(c ?? '').trim() !== '').length;
    if (nonEmptyCount === 0) continue;

    // Skip repeated header rows inside sheet
    if (scoreHeaderRow(row) >= 3) continue;

    let rawCode = String(getCell(row, 'employeeCode')).trim();
    // Clean invalid chars per Firestore employeeCode rule ^[a-zA-Z0-9_-]+$
    rawCode = rawCode.replace(/[^a-zA-Z0-9_-]/g, '');

    let khmerName = String(getCell(row, 'khmerName')).trim();
    let englishName = String(getCell(row, 'englishName')).trim().toUpperCase();

    // If neither code nor any name exists on this row, skip summary/footer row
    if (!rawCode && !khmerName && !englishName) {
      continue;
    }

    const employeeCode = (rawCode || `IMP${String(r + 1).padStart(3, '0')}`).slice(0, 32);
    if (!khmerName) khmerName = englishName || employeeCode;
    if (!englishName) englishName = khmerName.toUpperCase() || `WORKER-${employeeCode}`;

    const hireDate = formatCellAsIsoDate(getCell(row, 'hireDate')) || today;
    const dateOfBirth = formatCellAsDob(getCell(row, 'dateOfBirth'));
    const team = String(getCell(row, 'team')).trim().slice(0, 80) || 'ទូទៅ';

    result.push({
      employeeCode,
      khmerName: khmerName.slice(0, 120),
      englishName: englishName.slice(0, 120),
      gender: normalizeGender(getCell(row, 'gender')),
      dateOfBirth,
      nationalId: String(getCell(row, 'nationalId')).trim().slice(0, 64),
      nssfNumber: String(getCell(row, 'nssfNumber')).trim().slice(0, 64),
      team,
      phone: String(getCell(row, 'phone')).trim().slice(0, 32),
      hireDate,
      village: String(getCell(row, 'village')).trim().slice(0, 100),
      commune: String(getCell(row, 'commune')).trim().slice(0, 100),
      district: String(getCell(row, 'district')).trim().slice(0, 100),
      province: String(getCell(row, 'province')).trim().slice(0, 100),
      workPermitNumber: String(getCell(row, 'workPermitNumber')).trim().slice(0, 64),
      employmentStatus: 'active',
    });
  }

  return result;
}
