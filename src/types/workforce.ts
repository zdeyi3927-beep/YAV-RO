import type { Timestamp } from 'firebase/firestore';

export type Gender = 'ប្រុស' | 'ស្រី';
export type EmploymentStatus = 'active' | 'inactive';
export type ContractType = 'probation_60' | 'fulltime_90';
export type ContractStatus = 'active' | 'superseded' | 'terminated';
export type ApprovalStatus = 'pending_approval' | 'approved' | 'rejected';
export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'archived';

export const CONTRACT_EXPIRING_WINDOW_DAYS = 25;

export const CONTRACT_DURATIONS: Record<ContractType, 60 | 90> = {
  probation_60: 60,
  fulltime_90: 90,
};

export const CONTRACT_LABELS: Record<
  ContractType,
  { km: string; zh: string; en: string; days: number }
> = {
  probation_60: {
    km: 'កុងត្រាសាកល្បង (៦០ ថ្ងៃ)',
    zh: '试用期(60天)',
    en: 'Probation 60d',
    days: 60,
  },
  fulltime_90: {
    km: 'កុងត្រាបន្ត / ពេញសិទ្ធិ (៩០ ថ្ងៃ)',
    zh: '续签合同(90天)',
    en: 'Full-Time 90d',
    days: 90,
  },
};

export const APPROVAL_LABELS: Record<ApprovalStatus, { km: string; zh: string }> = {
  pending_approval: { km: 'រង់ចាំអនុម័ត', zh: '待审批' },
  approved: { km: 'អនុម័ត', zh: '通过' },
  rejected: { km: 'មិនអនុម័ត', zh: '不通过' },
};

export const PRESET_TEAMS = ['ជាង', 'បាញ់ព្រីល', 'វិញស្លឹក', 'រុំមែក', 'ត្រួតពិនិត្យគុណភាព', 'រដ្ឋបាល'];

export const BLUEPRINT_LIMITS = {
  ownerIdMax: 128,
  employeeCodeMax: 32,
  nameMax: 120,
  dobMax: 20,
  idNumberMax: 64,
  teamMax: 80,
  phoneMax: 32,
  addressPartMax: 100,
  notesMax: 500,
  taskTitleMax: 200,
  taskDescMax: 1000,
  idPattern: /^[a-zA-Z0-9_-]+$/,
  isoDatePattern: /^\d{4}-\d{2}-\d{2}$/,
} as const;

export interface Worker {
  id: string;
  ownerId: string;
  employeeCode: string;
  khmerName: string;
  englishName: string;
  gender: Gender;
  dateOfBirth: string;
  nationalId: string;
  nssfNumber: string;
  team: string;
  phone: string;
  hireDate: string;
  village: string;
  commune: string;
  district: string;
  province: string;
  workPermitNumber: string;
  employmentStatus: EmploymentStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type WorkerInput = Omit<Worker, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>;

export interface Contract {
  id: string;
  ownerId: string;
  workerId: string;
  workerName: string;
  englishName?: string;
  gender?: Gender;
  hireDate?: string;
  employeeCode: string;
  team: string;
  contractType: ContractType;
  durationDays: 60 | 90;
  startDate: string;
  endDate: string;
  status: ContractStatus;
  approvalStatus?: ApprovalStatus;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface TaskItem {
  id: string;
  ownerId: string;
  workerId: string;
  workerName: string;
  team: string;
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string;
  status: TaskStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type TaskInput = Omit<TaskItem, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>;

export type ContractHealthState = 'nominal' | 'expiring_soon' | 'expired' | 'inactive';
export type ExpiringUrgencyBand = 'critical_7' | 'warn_15' | 'notice_25' | 'expired' | 'nominal' | 'inactive';

export interface ContractHealth {
  state: ContractHealthState;
  band: ExpiringUrgencyBand;
  daysRemaining: number;
  daysElapsed: number;
  progressPercent: number;
}

export interface NotificationAlert {
  id: string;
  kind: 'unfinished_task' | 'contract_expiring' | 'contract_expired' | 'missing_document';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  dateLabel: string;
  targetTab: 'tasks' | 'contracts' | 'workers';
  taskId?: string;
  contractId?: string;
  workerId?: string;
}

export function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function defaultTargetEndDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-12-31`;
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  if (!BLUEPRINT_LIMITS.isoDatePattern.test(isoDate)) {
    return todayIsoDate();
  }
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function diffDaysBetweenIso(fromIso: string, toIso: string): number {
  const [y1, m1, d1] = fromIso.split('-').map(Number);
  const [y2, m2, d2] = toIso.split('-').map(Number);
  if (!y1 || !y2) return 0;
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

export function getEffectiveApprovalStatus(contract: Contract): ApprovalStatus {
  if (contract.approvalStatus) return contract.approvalStatus;
  if (contract.status === 'terminated') return 'rejected';
  if (contract.status === 'superseded') return 'approved';
  return 'pending_approval';
}

export function getContractHealth(contract: Contract, referenceDate = todayIsoDate()): ContractHealth {
  const approval = getEffectiveApprovalStatus(contract);
  if (approval === 'rejected' || contract.status === 'terminated' || contract.status === 'superseded') {
    return {
      state: 'inactive',
      band: 'inactive',
      daysRemaining: 0,
      daysElapsed: contract.durationDays,
      progressPercent: 100,
    };
  }
  const daysRemaining = diffDaysBetweenIso(referenceDate, contract.endDate);
  const daysElapsed = Math.max(0, diffDaysBetweenIso(contract.startDate, referenceDate));
  const progressPercent = Math.min(100, Math.max(0, Math.round((daysElapsed / contract.durationDays) * 100)));

  if (daysRemaining < 0) {
    return { state: 'expired', band: 'expired', daysRemaining, daysElapsed, progressPercent: 100 };
  }
  if (daysRemaining <= 7) {
    return { state: 'expiring_soon', band: 'critical_7', daysRemaining, daysElapsed, progressPercent };
  }
  if (daysRemaining <= 15) {
    return { state: 'expiring_soon', band: 'warn_15', daysRemaining, daysElapsed, progressPercent };
  }
  if (daysRemaining <= CONTRACT_EXPIRING_WINDOW_DAYS) {
    return { state: 'expiring_soon', band: 'notice_25', daysRemaining, daysElapsed, progressPercent };
  }
  return { state: 'nominal', band: 'nominal', daysRemaining, daysElapsed, progressPercent };
}

export function pickCurrentWorkerContract(
  workerContracts: Contract[],
  referenceDate = todayIsoDate()
): Contract | undefined {
  const candidates = workerContracts.filter(
    (c) => c.status === 'active' && getEffectiveApprovalStatus(c) !== 'rejected'
  );
  if (candidates.length === 0) return undefined;

  const sorted = [...candidates].sort((a, b) => a.startDate.localeCompare(b.startDate));
  // 1. Prefer segment whose period covers today
  const coveringToday = sorted.find(
    (c) => c.startDate <= referenceDate && c.endDate >= referenceDate
  );
  if (coveringToday) return coveringToday;

  // 2. Otherwise earliest upcoming segment ending >= today
  const upcoming = sorted.find((c) => c.endDate >= referenceDate);
  if (upcoming) return upcoming;

  // 3. Otherwise the most recently ended segment
  return sorted[sorted.length - 1];
}

export function buildAlerts(
  workers: Worker[],
  contracts: Contract[],
  tasks: TaskItem[],
  referenceDate = todayIsoDate()
): NotificationAlert[] {
  const alerts: NotificationAlert[] = [];

  // 1. Unfinished tasks (pending or in_progress)
  for (const task of tasks) {
    if (task.status === 'pending' || task.status === 'in_progress') {
      const daysUntilDue = diffDaysBetweenIso(referenceDate, task.dueDate);
      const isOverdue = daysUntilDue < 0;
      const isDueSoon = daysUntilDue >= 0 && daysUntilDue <= 2;
      alerts.push({
        id: `task_${task.id}`,
        kind: 'unfinished_task',
        severity: isOverdue || task.priority === 'high' ? 'critical' : isDueSoon ? 'warning' : 'info',
        title: task.title,
        detail: `${task.workerName ? `${task.workerName} · ` : ''}${task.team} · ${
          isOverdue
            ? `ហួសកំណត់ ${Math.abs(daysUntilDue)} ថ្ងៃ`
            : daysUntilDue === 0
            ? 'ដល់កំណត់ថ្ងៃនេះ'
            : `នៅសល់ ${daysUntilDue} ថ្ងៃ`
        }`,
        dateLabel: task.dueDate,
        targetTab: 'tasks',
        taskId: task.id,
      });
    }
  }

  // 2. Contracts expiring within 25 days, plus recently expired current contracts (avoid spamming historical schedule rows)
  const contractsByWorker = new Map<string, Contract[]>();
  for (const contract of contracts) {
    const approval = getEffectiveApprovalStatus(contract);
    if (contract.status !== 'active' || approval === 'rejected') continue;
    const list = contractsByWorker.get(contract.workerId) || [];
    list.push(contract);
    contractsByWorker.set(contract.workerId, list);

    const health = getContractHealth(contract, referenceDate);
    if (health.state === 'expiring_soon') {
      alerts.push({
        id: `contract_${contract.id}`,
        kind: 'contract_expiring',
        severity: health.daysRemaining <= 7 ? 'critical' : 'warning',
        title: `កុងត្រាជិតផុតកំណត់៖ ${contract.workerName} (${contract.employeeCode})`,
        detail: `${CONTRACT_LABELS[contract.contractType].km} · នៅសល់ ${health.daysRemaining} ថ្ងៃ (${health.daysRemaining}天后到期)`,
        dateLabel: contract.endDate,
        targetTab: 'contracts',
        contractId: contract.id,
        workerId: contract.workerId,
      });
    }
  }

  for (const [, workerContracts] of contractsByWorker.entries()) {
    const current = pickCurrentWorkerContract(workerContracts, referenceDate);
    if (!current) continue;
    const health = getContractHealth(current, referenceDate);
    if (health.state === 'expired') {
      alerts.push({
        id: `contract_${current.id}`,
        kind: 'contract_expired',
        severity: 'critical',
        title: `កុងត្រាផុតកំណត់៖ ${current.workerName} (${current.employeeCode})`,
        detail: `${CONTRACT_LABELS[current.contractType].km} · ហួសកំណត់ ${Math.abs(health.daysRemaining)} ថ្ងៃ`,
        dateLabel: current.endDate,
        targetTab: 'contracts',
        contractId: current.id,
        workerId: current.workerId,
      });
    }
  }

  // 3. Incomplete worker registration paperwork (missing NSSF or Work Permit)
  for (const worker of workers) {
    if (worker.employmentStatus !== 'active') continue;
    const missing: string[] = [];
    if (!worker.nssfNumber.trim()) missing.push('លេខអត្ត-ប-ស-ស');
    if (!worker.workPermitNumber.trim()) missing.push('លេខប័ណ្ណការងារ');
    if (!worker.nationalId.trim()) missing.push('អត្តសញ្ញាណប័ណ្ណ');
    if (missing.length > 0) {
      alerts.push({
        id: `doc_${worker.id}`,
        kind: 'missing_document',
        severity: 'info',
        title: `ឯកសារមិនទាន់ពេញលេញ៖ ${worker.khmerName} (${worker.employeeCode})`,
        detail: `ខ្វះ៖ ${missing.join(', ')}`,
        dateLabel: worker.hireDate,
        targetTab: 'workers',
        workerId: worker.id,
      });
    }
  }

  const severityOrder: Record<NotificationAlert['severity'], number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}
