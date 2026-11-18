import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  addDaysToIsoDate,
  BLUEPRINT_LIMITS,
  CONTRACT_DURATIONS,
  Contract,
  ContractType,
  defaultTargetEndDate,
  TaskInput,
  TaskItem,
  TaskStatus,
  todayIsoDate,
  Worker,
  WorkerInput,
} from '../types/workforce';

function clampString(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

function sanitizeWorkerInput(input: WorkerInput): WorkerInput {
  const employeeCode = clampString(input.employeeCode, BLUEPRINT_LIMITS.employeeCodeMax).replace(
    /[^a-zA-Z0-9_-]/g,
    ''
  );
  if (!employeeCode || !BLUEPRINT_LIMITS.idPattern.test(employeeCode)) {
    throw new Error('អត្តលេខកម្មករត្រូវតែជាអក្សរឡាតាំង លេខ ឬសញ្ញា - _ ប៉ុណ្ណោះ');
  }
  const khmerName = clampString(input.khmerName, BLUEPRINT_LIMITS.nameMax);
  const englishName = clampString(input.englishName, BLUEPRINT_LIMITS.nameMax).toUpperCase();
  const team = clampString(input.team, BLUEPRINT_LIMITS.teamMax);
  if (!khmerName || !englishName || !team) {
    throw new Error('សូមបំពេញឈ្មោះខ្មែរ ឈ្មោះអង់គ្លេស និងក្រុមការងារ');
  }
  const hireDate = BLUEPRINT_LIMITS.isoDatePattern.test(input.hireDate)
    ? input.hireDate
    : todayIsoDate();
  const dateOfBirth = clampString(input.dateOfBirth || '01-01-1995', BLUEPRINT_LIMITS.dobMax);

  return {
    employeeCode,
    khmerName,
    englishName,
    gender: input.gender === 'ស្រី' ? 'ស្រី' : 'ប្រុស',
    dateOfBirth: dateOfBirth.length >= 4 ? dateOfBirth : '01-01-1995',
    nationalId: clampString(input.nationalId, BLUEPRINT_LIMITS.idNumberMax),
    nssfNumber: clampString(input.nssfNumber, BLUEPRINT_LIMITS.idNumberMax),
    team,
    phone: clampString(input.phone, BLUEPRINT_LIMITS.phoneMax),
    hireDate,
    village: clampString(input.village, BLUEPRINT_LIMITS.addressPartMax),
    commune: clampString(input.commune, BLUEPRINT_LIMITS.addressPartMax),
    district: clampString(input.district, BLUEPRINT_LIMITS.addressPartMax),
    province: clampString(input.province, BLUEPRINT_LIMITS.addressPartMax),
    workPermitNumber: clampString(input.workPermitNumber, BLUEPRINT_LIMITS.idNumberMax),
    employmentStatus: input.employmentStatus === 'inactive' ? 'inactive' : 'active',
  };
}

function sanitizeTaskInput(input: TaskInput): TaskInput {
  const title = clampString(input.title, BLUEPRINT_LIMITS.taskTitleMax);
  const team = clampString(input.team || 'ទូទៅ', BLUEPRINT_LIMITS.teamMax);
  if (!title) {
    throw new Error('សូមបញ្ចូលចំណងជើងការងារ');
  }
  const dueDate = BLUEPRINT_LIMITS.isoDatePattern.test(input.dueDate)
    ? input.dueDate
    : todayIsoDate();
  return {
    workerId: clampString(input.workerId, BLUEPRINT_LIMITS.ownerIdMax),
    workerName: clampString(input.workerName, BLUEPRINT_LIMITS.nameMax),
    team,
    title,
    description: clampString(input.description, BLUEPRINT_LIMITS.taskDescMax),
    priority: input.priority === 'high' || input.priority === 'low' ? input.priority : 'medium',
    dueDate,
    status:
      input.status === 'in_progress' || input.status === 'completed' || input.status === 'archived'
        ? input.status
        : 'pending',
  };
}

export function subscribeWorkers(
  ownerId: string,
  onData: (workers: Worker[]) => void,
  onError: (error: Error) => void
) {
  const path = 'workers';
  const q = query(collection(db, path), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: Worker[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Worker, 'id'>),
      }));
      items.sort((a, b) => a.employeeCode.localeCompare(b.employeeCode, undefined, { numeric: true }));
      onData(items);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeContracts(
  ownerId: string,
  onData: (contracts: Contract[]) => void,
  onError: (error: Error) => void
) {
  const path = 'contracts';
  const q = query(collection(db, path), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: Contract[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Contract, 'id'>),
      }));
      items.sort((a, b) => {
        const codeCmp = a.employeeCode.localeCompare(b.employeeCode, undefined, { numeric: true });
        if (codeCmp !== 0) return codeCmp;
        return a.startDate.localeCompare(b.startDate);
      });
      onData(items);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeTasks(
  ownerId: string,
  onData: (tasks: TaskItem[]) => void,
  onError: (error: Error) => void
) {
  const path = 'tasks';
  const q = query(collection(db, path), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: TaskItem[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<TaskItem, 'id'>),
      }));
      items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      onData(items);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function registerWorkerWithOptionalContract(
  ownerId: string,
  rawInput: WorkerInput,
  initialContract?: { contractType: ContractType; startDate: string; notes: string }
): Promise<string> {
  const cleanWorker = sanitizeWorkerInput(rawInput);
  const workerRef = doc(collection(db, 'workers'));

  if (!initialContract) {
    const path = `workers/${workerRef.id}`;
    try {
      await setDoc(workerRef, {
        ownerId,
        ...cleanWorker,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return workerRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  const durationDays = CONTRACT_DURATIONS[initialContract.contractType];
  const startDate = BLUEPRINT_LIMITS.isoDatePattern.test(initialContract.startDate)
    ? initialContract.startDate
    : cleanWorker.hireDate;
  const endDate = addDaysToIsoDate(startDate, durationDays);
  const contractRef = doc(collection(db, 'contracts'));

  const batch = writeBatch(db);
  batch.set(workerRef, {
    ownerId,
    ...cleanWorker,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(contractRef, {
    ownerId,
    workerId: workerRef.id,
    workerName: cleanWorker.khmerName,
    englishName: cleanWorker.englishName,
    gender: cleanWorker.gender,
    hireDate: cleanWorker.hireDate,
    employeeCode: cleanWorker.employeeCode,
    team: cleanWorker.team,
    contractType: initialContract.contractType,
    durationDays,
    startDate,
    endDate,
    status: 'active',
    approvalStatus: 'pending_approval',
    notes: clampString(initialContract.notes, BLUEPRINT_LIMITS.notesMax),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return workerRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `workers/${workerRef.id}`);
  }
}

export async function updateWorkerProfile(workerId: string, rawInput: WorkerInput): Promise<void> {
  const clean = sanitizeWorkerInput(rawInput);
  const path = `workers/${workerId}`;
  try {
    await updateDoc(doc(db, 'workers', workerId), {
      employeeCode: clean.employeeCode,
      khmerName: clean.khmerName,
      englishName: clean.englishName,
      gender: clean.gender,
      dateOfBirth: clean.dateOfBirth,
      nationalId: clean.nationalId,
      nssfNumber: clean.nssfNumber,
      team: clean.team,
      phone: clean.phone,
      hireDate: clean.hireDate,
      village: clean.village,
      commune: clean.commune,
      district: clean.district,
      province: clean.province,
      workPermitNumber: clean.workPermitNumber,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleWorkerEmploymentStatus(
  workerId: string,
  employmentStatus: 'active' | 'inactive'
): Promise<void> {
  const path = `workers/${workerId}`;
  try {
    await updateDoc(doc(db, 'workers', workerId), {
      employmentStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteWorkerRecord(
  workerId: string,
  relatedContracts: Contract[],
  relatedTasks: TaskItem[]
): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'workers', workerId));
  for (const c of relatedContracts) {
    batch.delete(doc(db, 'contracts', c.id));
  }
  for (const t of relatedTasks) {
    batch.delete(doc(db, 'tasks', t.id));
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `workers/${workerId}`);
  }
}

export async function batchImportWorkersWithContracts(
  ownerId: string,
  rawWorkers: WorkerInput[],
  existingWorkers: Worker[],
  options: { skipExistingCodes: boolean; generateContracts: boolean }
): Promise<{ imported: number; skipped: number; contractsCreated: number }> {
  const existingCodes = new Set(existingWorkers.map((w) => w.employeeCode.toLowerCase()));
  const seenInBatch = new Set<string>();
  const targetEnd = defaultTargetEndDate();

  let batch = writeBatch(db);
  let opCount = 0;
  let imported = 0;
  let skipped = 0;
  let contractsCreated = 0;

  const commitBatch = async () => {
    if (opCount === 0) return;
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'workers');
    }
    batch = writeBatch(db);
    opCount = 0;
  };

  for (const raw of rawWorkers) {
    const clean = sanitizeWorkerInput(raw);
    const codeKey = clean.employeeCode.toLowerCase();

    if ((options.skipExistingCodes && existingCodes.has(codeKey)) || seenInBatch.has(codeKey)) {
      skipped += 1;
      continue;
    }
    seenInBatch.add(codeKey);

    // Build sequential contracts for this worker
    const segments: Array<{
      contractType: ContractType;
      durationDays: 60 | 90;
      startDate: string;
      endDate: string;
      segIdx: number;
    }> = [];

    if (options.generateContracts) {
      let currentStart = clean.hireDate;
      let currentEnd = addDaysToIsoDate(currentStart, 60);
      if (currentStart < targetEnd && currentEnd > targetEnd) {
        currentEnd = targetEnd;
      }

      if (currentStart >= targetEnd) {
        // Ensure every worker has at least an initial 60-day probation contract
        segments.push({
          contractType: 'probation_60',
          durationDays: 60,
          startDate: currentStart,
          endDate: addDaysToIsoDate(currentStart, 60),
          segIdx: 1,
        });
      } else {
        let segIdx = 0;
        while (currentStart < targetEnd && segIdx < 40) {
          segIdx += 1;
          segments.push({
            contractType: segIdx === 1 ? 'probation_60' : 'fulltime_90',
            durationDays: segIdx === 1 ? 60 : 90,
            startDate: currentStart,
            endDate: currentEnd,
            segIdx,
          });
          currentStart = addDaysToIsoDate(currentEnd, 1);
          if (currentStart >= targetEnd) break;
          currentEnd = addDaysToIsoDate(currentStart, 90);
          if (currentEnd > targetEnd) currentEnd = targetEnd;
        }
      }
    }

    const neededOps = 1 + segments.length;
    if (opCount + neededOps > 400) {
      await commitBatch();
    }

    const workerRef = doc(collection(db, 'workers'));
    batch.set(workerRef, {
      ownerId,
      ...clean,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    opCount += 1;
    imported += 1;

    for (const seg of segments) {
      const cRef = doc(collection(db, 'contracts'));
      batch.set(cRef, {
        ownerId,
        workerId: workerRef.id,
        workerName: clean.khmerName,
        englishName: clean.englishName,
        gender: clean.gender,
        hireDate: clean.hireDate,
        employeeCode: clean.employeeCode,
        team: clean.team,
        contractType: seg.contractType,
        durationDays: seg.durationDays,
        startDate: seg.startDate,
        endDate: seg.endDate,
        status: 'active',
        approvalStatus: 'pending_approval',
        notes:
          seg.segIdx === 1
            ? '试用期(60天) · កុងត្រាសាកល្បង ៦០ ថ្ងៃ'
            : '续签合同(90天) · កុងត្រាបន្ត ៩០ ថ្ងៃ',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      opCount += 1;
      contractsCreated += 1;
    }
  }

  await commitBatch();
  return { imported, skipped, contractsCreated };
}

export async function createWorkerContract(
  ownerId: string,
  worker: Worker,
  contractType: ContractType,
  startDate: string,
  notes: string,
  existingActiveContracts: Contract[] = []
): Promise<string> {
  const durationDays = CONTRACT_DURATIONS[contractType];
  const validStart = BLUEPRINT_LIMITS.isoDatePattern.test(startDate) ? startDate : todayIsoDate();
  const endDate = addDaysToIsoDate(validStart, durationDays);
  const newRef = doc(collection(db, 'contracts'));

  const batch = writeBatch(db);
  for (const oldContract of existingActiveContracts) {
    if (oldContract.status === 'active' && oldContract.approvalStatus !== 'rejected') {
      batch.update(doc(db, 'contracts', oldContract.id), {
        status: 'superseded',
        notes: clampString(
          oldContract.notes
            ? `${oldContract.notes} · ប្តូរទៅកុងត្រាថ្មី`
            : 'បានប្តូរទៅកុងត្រាថ្មី',
          BLUEPRINT_LIMITS.notesMax
        ),
        updatedAt: serverTimestamp(),
      });
    }
  }

  batch.set(newRef, {
    ownerId,
    workerId: worker.id,
    workerName: clampString(worker.khmerName, BLUEPRINT_LIMITS.nameMax),
    englishName: clampString(worker.englishName, BLUEPRINT_LIMITS.nameMax),
    gender: worker.gender,
    hireDate: worker.hireDate,
    employeeCode: clampString(worker.employeeCode, BLUEPRINT_LIMITS.employeeCodeMax),
    team: clampString(worker.team, BLUEPRINT_LIMITS.teamMax),
    contractType,
    durationDays,
    startDate: validStart,
    endDate,
    status: 'active',
    approvalStatus: 'pending_approval',
    notes: clampString(notes, BLUEPRINT_LIMITS.notesMax),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return newRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `contracts/${newRef.id}`);
  }
}

export async function promoteOrRenewContract(
  ownerId: string,
  oldContract: Contract,
  newType: ContractType,
  startDate: string,
  notes: string
): Promise<string> {
  const durationDays = CONTRACT_DURATIONS[newType];
  const validStart = BLUEPRINT_LIMITS.isoDatePattern.test(startDate) ? startDate : todayIsoDate();
  const endDate = addDaysToIsoDate(validStart, durationDays);
  const newRef = doc(collection(db, 'contracts'));

  const batch = writeBatch(db);
  if (oldContract.status === 'active') {
    batch.update(doc(db, 'contracts', oldContract.id), {
      status: 'superseded',
      approvalStatus: 'approved',
      notes: clampString(
        newType === 'fulltime_90'
          ? 'បានដំឡើងទៅកុងត្រាពេញសិទ្ធិ ៩០ ថ្ងៃ (已通过)'
          : 'បានបន្តកុងត្រាថ្មី (已通过)',
        BLUEPRINT_LIMITS.notesMax
      ),
      updatedAt: serverTimestamp(),
    });
  }

  batch.set(newRef, {
    ownerId,
    workerId: oldContract.workerId,
    workerName: clampString(oldContract.workerName, BLUEPRINT_LIMITS.nameMax),
    englishName: clampString(oldContract.englishName || '', BLUEPRINT_LIMITS.nameMax),
    gender: oldContract.gender === 'ស្រី' ? 'ស្រី' : 'ប្រុស',
    hireDate: oldContract.hireDate || oldContract.startDate,
    employeeCode: clampString(oldContract.employeeCode, BLUEPRINT_LIMITS.employeeCodeMax),
    team: clampString(oldContract.team, BLUEPRINT_LIMITS.teamMax),
    contractType: newType,
    durationDays,
    startDate: validStart,
    endDate,
    status: 'active',
    approvalStatus: 'pending_approval',
    notes: clampString(notes, BLUEPRINT_LIMITS.notesMax),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return newRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `contracts/${newRef.id}`);
  }
}

/**
 * Replicates VBA ApproveContract():
 * Marks selected pending contract as 'approved' (通过) and generates the next 90-day renewal contract
 * starting endDate + 1 day up to targetEndDate if not already present.
 */
export async function approveContractAndGenerateNext(
  ownerId: string,
  contract: Contract,
  worker: Worker | undefined,
  allContracts: Contract[],
  targetEndDate = defaultTargetEndDate()
): Promise<{ generatedNext: boolean }> {
  const newStart = addDaysToIsoDate(contract.endDate, 1);
  const existingNext = allContracts.some(
    (c) => c.workerId === contract.workerId && c.startDate === newStart
  );
  const shouldGenerateNext = contract.endDate < targetEndDate && !existingNext;

  const batch = writeBatch(db);
  batch.update(doc(db, 'contracts', contract.id), {
    approvalStatus: 'approved',
    status: shouldGenerateNext || existingNext ? 'superseded' : 'active',
    englishName: worker?.englishName ?? contract.englishName ?? '',
    gender: worker?.gender ?? contract.gender ?? 'ប្រុស',
    hireDate: worker?.hireDate ?? contract.hireDate ?? contract.startDate,
    notes: clampString('បានអនុម័ត (已通过)', BLUEPRINT_LIMITS.notesMax),
    updatedAt: serverTimestamp(),
  });

  if (shouldGenerateNext) {
    const rawNewEnd = addDaysToIsoDate(newStart, 90);
    const finalEnd = rawNewEnd > targetEndDate ? targetEndDate : rawNewEnd;
    const nextRef = doc(collection(db, 'contracts'));
    batch.set(nextRef, {
      ownerId,
      workerId: contract.workerId,
      workerName: clampString(worker?.khmerName || contract.workerName, BLUEPRINT_LIMITS.nameMax),
      englishName: clampString(worker?.englishName || contract.englishName || '', BLUEPRINT_LIMITS.nameMax),
      gender: worker?.gender ?? contract.gender ?? 'ប្រុស',
      hireDate: worker?.hireDate ?? contract.hireDate ?? contract.startDate,
      employeeCode: clampString(worker?.employeeCode || contract.employeeCode, BLUEPRINT_LIMITS.employeeCodeMax),
      team: clampString(worker?.team || contract.team, BLUEPRINT_LIMITS.teamMax),
      contractType: 'fulltime_90',
      durationDays: 90,
      startDate: newStart,
      endDate: finalEnd,
      status: 'active',
      approvalStatus: 'pending_approval',
      notes: '续签合同(90天) · បន្តកុងត្រា ៩០ ថ្ងៃ',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    return { generatedNext: shouldGenerateNext };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `contracts/${contract.id}`);
  }
}

/**
 * Replicates VBA RejectContract():
 * Marks selected pending contract as 'rejected' (不通过 / 不续签) and terminates it.
 */
export async function rejectContract(
  contract: Contract,
  worker: Worker | undefined
): Promise<void> {
  const path = `contracts/${contract.id}`;
  try {
    await updateDoc(doc(db, 'contracts', contract.id), {
      approvalStatus: 'rejected',
      status: 'terminated',
      englishName: worker?.englishName ?? contract.englishName ?? '',
      gender: worker?.gender ?? contract.gender ?? 'ប្រុស',
      hireDate: worker?.hireDate ?? contract.hireDate ?? contract.startDate,
      notes: clampString('មិនអនុម័ត · ឈប់បន្តកុងត្រា (不通过 / 不续签)', BLUEPRINT_LIMITS.notesMax),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteContractRecord(contractId: string): Promise<void> {
  const path = `contracts/${contractId}`;
  try {
    await deleteDoc(doc(db, 'contracts', contractId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Replicates VBA RefreshContracts() + GenerateAndWriteContracts():
 * Reconciles each active worker's contracts into an exact sequential chain from hireDate -> targetEndDate:
 *   Segment 1 = Probation 60 days (hireDate -> hireDate + 60d)
 *   Segment 2+ = Renewal 90 days (prevEnd + 1d -> start + 90d, capped at targetEndDate)
 * Automatically removes overlapping/stale/duplicate rows that don't fit the canonical chain,
 * while preserving approved/rejected status on matching segments.
 */
export async function refreshWorkerContractSchedule(
  ownerId: string,
  workers: Worker[],
  existingContracts: Contract[],
  targetEndDate = defaultTargetEndDate()
): Promise<{ added: number; removed: number }> {
  if (!BLUEPRINT_LIMITS.isoDatePattern.test(targetEndDate)) {
    throw new Error('កាលបរិច្ឆេទគោលដៅមិនត្រឹមត្រូវ (YYYY-MM-DD)');
  }

  const byWorker = new Map<string, Contract[]>();
  for (const c of existingContracts) {
    const arr = byWorker.get(c.workerId) || [];
    arr.push(c);
    byWorker.set(c.workerId, arr);
  }

  type BatchOp =
    | { kind: 'set'; ref: ReturnType<typeof doc>; data: Record<string, unknown> }
    | { kind: 'delete'; ref: ReturnType<typeof doc> };

  const ops: BatchOp[] = [];
  let added = 0;
  let removed = 0;

  for (const w of workers) {
    const workerContracts = byWorker.get(w.id) || [];
    if (w.employmentStatus !== 'active' || !BLUEPRINT_LIMITS.isoDatePattern.test(w.hireDate)) {
      continue;
    }

    // Build canonical sequential segments from hireDate up to targetEndDate
    const canonicalSegments: Array<{
      key: string;
      contractType: ContractType;
      durationDays: 60 | 90;
      startDate: string;
      endDate: string;
      segmentIndex: number;
    }> = [];

    let currentStart = w.hireDate;
    let currentEnd = addDaysToIsoDate(currentStart, 60);
    if (currentEnd > targetEndDate) currentEnd = targetEndDate;

    let segmentIndex = 0;
    while (currentStart < targetEndDate && segmentIndex < 40) {
      segmentIndex += 1;
      const contractType: ContractType = segmentIndex === 1 ? 'probation_60' : 'fulltime_90';
      const durationDays: 60 | 90 = segmentIndex === 1 ? 60 : 90;
      const key = `${currentStart}|${currentEnd}|${contractType}`;

      canonicalSegments.push({
        key,
        contractType,
        durationDays,
        startDate: currentStart,
        endDate: currentEnd,
        segmentIndex,
      });

      currentStart = addDaysToIsoDate(currentEnd, 1);
      if (currentStart >= targetEndDate) break;
      currentEnd = addDaysToIsoDate(currentStart, 90);
      if (currentEnd > targetEndDate) currentEnd = targetEndDate;
    }

    // Group existing contracts by canonical key
    const existingByKey = new Map<string, Contract[]>();
    for (const c of workerContracts) {
      const k = `${c.startDate}|${c.endDate}|${c.contractType}`;
      const list = existingByKey.get(k) || [];
      list.push(c);
      existingByKey.set(k, list);
    }

    const keptIds = new Set<string>();
    let stoppedByRejection = false;

    for (const seg of canonicalSegments) {
      if (stoppedByRejection) break;

      const matches = existingByKey.get(seg.key) || [];
      if (matches.length > 0) {
        // Keep the highest-priority contract (rejected > approved > pending_approval)
        const rank = (c: Contract) =>
          c.approvalStatus === 'rejected'
            ? 3
            : c.approvalStatus === 'approved'
            ? 2
            : 1;
        matches.sort((a, b) => rank(b) - rank(a));
        const keeper = matches[0];
        keptIds.add(keeper.id);

        if (keeper.approvalStatus === 'rejected' || keeper.status === 'terminated') {
          stoppedByRejection = true;
        }
      } else {
        const newRef = doc(collection(db, 'contracts'));
        ops.push({
          kind: 'set',
          ref: newRef,
          data: {
            ownerId,
            workerId: w.id,
            workerName: clampString(w.khmerName, BLUEPRINT_LIMITS.nameMax),
            englishName: clampString(w.englishName, BLUEPRINT_LIMITS.nameMax),
            gender: w.gender,
            hireDate: w.hireDate,
            employeeCode: clampString(w.employeeCode, BLUEPRINT_LIMITS.employeeCodeMax),
            team: clampString(w.team, BLUEPRINT_LIMITS.teamMax),
            contractType: seg.contractType,
            durationDays: seg.durationDays,
            startDate: seg.startDate,
            endDate: seg.endDate,
            status: 'active',
            approvalStatus: 'pending_approval',
            notes:
              seg.segmentIndex === 1
                ? '试用期(60天) · កុងត្រាសាកល្បង ៦០ ថ្ងៃ'
                : '续签合同(90天) · កុងត្រាបន្ត ៩០ ថ្ងៃ',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        });
        added += 1;
      }
    }

    // Delete any stale, overlapping, or duplicate contracts for this worker that were not kept
    for (const c of workerContracts) {
      if (!keptIds.has(c.id)) {
        ops.push({ kind: 'delete', ref: doc(db, 'contracts', c.id) });
        removed += 1;
      }
    }
  }

  // Commit in chunks of 400 operations
  for (let i = 0; i < ops.length; i += 400) {
    const chunk = ops.slice(i, i + 400);
    const batch = writeBatch(db);
    for (const op of chunk) {
      if (op.kind === 'set') {
        batch.set(op.ref, op.data);
      } else {
        batch.delete(op.ref);
      }
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'contracts');
    }
  }

  return { added, removed };
}

export async function terminateContract(contractId: string, notes: string): Promise<void> {
  const path = `contracts/${contractId}`;
  try {
    await updateDoc(doc(db, 'contracts', contractId), {
      status: 'terminated',
      approvalStatus: 'rejected',
      notes: clampString(notes || 'បានបញ្ចប់កុងត្រា (不续签)', BLUEPRINT_LIMITS.notesMax),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createTask(ownerId: string, rawInput: TaskInput): Promise<string> {
  const clean = sanitizeTaskInput(rawInput);
  const ref = doc(collection(db, 'tasks'));
  const path = `tasks/${ref.id}`;
  try {
    await setDoc(ref, {
      ownerId,
      ...clean,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
  const path = `tasks/${taskId}`;
  try {
    await updateDoc(doc(db, 'tasks', taskId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateTaskDetails(taskId: string, rawInput: TaskInput): Promise<void> {
  const clean = sanitizeTaskInput(rawInput);
  const path = `tasks/${taskId}`;
  try {
    await updateDoc(doc(db, 'tasks', taskId), {
      workerId: clean.workerId,
      workerName: clean.workerName,
      team: clean.team,
      title: clean.title,
      description: clean.description,
      priority: clean.priority,
      dueDate: clean.dueDate,
      status: clean.status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTaskRecord(taskId: string): Promise<void> {
  const path = `tasks/${taskId}`;
  try {
    await deleteDoc(doc(db, 'tasks', taskId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function seedSampleRosterFromSheet(ownerId: string): Promise<void> {
  const today = todayIsoDate();
  const targetEnd = defaultTargetEndDate();
  const sampleWorkers: WorkerInput[] = [
    {
      employeeCode: '001',
      khmerName: 'ភិន សណ្ដាប់',
      englishName: 'PIN SANDAB',
      gender: 'ប្រុស',
      dateOfBirth: '15-02-1992',
      nationalId: '90645840',
      nssfNumber: '1921119-2244873- ជ',
      team: 'ជាង',
      phone: '888220486',
      hireDate: '2025-03-24',
      village: 'ព្រៃកៀត',
      commune: 'សំឡី',
      district: 'កំពង់រោទិ៍',
      province: 'ស្វាយរៀង',
      workPermitNumber: 'ML-00362044',
      employmentStatus: 'active',
    },
    {
      employeeCode: '011',
      khmerName: 'នឿន ចាន់ធី',
      englishName: 'NOEURN CHANTHY',
      gender: 'ស្រី',
      dateOfBirth: '03-05-1987',
      nationalId: '90686936',
      nssfNumber: '28705170734817ល',
      team: 'បាញ់ព្រីល',
      phone: '885370595',
      hireDate: '2026-06-24',
      village: 'ព្រៃអង្គុញ',
      commune: 'ព្រៃអង្គុញ',
      district: 'បាវិត',
      province: 'ស្វាយរៀង',
      workPermitNumber: 'EBP0001090686936',
      employmentStatus: 'active',
    },
    {
      employeeCode: '018',
      khmerName: 'គង់ រីដា',
      englishName: 'KONG RYDA',
      gender: 'ប្រុស',
      dateOfBirth: '24-04-1999',
      nationalId: '90645588',
      nssfNumber: '19905170740220ណ',
      team: 'វិញស្លឹក',
      phone: '68828072',
      hireDate: '2026-09-20',
      village: 'អង្គសាលា',
      commune: 'ព្រៃអង្គុញ',
      district: 'បាវិត',
      province: 'ស្វាយរៀង',
      workPermitNumber: 'ML-00593636',
      employmentStatus: 'active',
    },
    {
      employeeCode: '019',
      khmerName: 'សឿន សាភា',
      englishName: 'SOEURN SAPHEA',
      gender: 'ស្រី',
      dateOfBirth: '05-05-2001',
      nationalId: '90882646',
      nssfNumber: '20105192055371ល',
      team: 'រុំមែក',
      phone: '979557342',
      hireDate: '2026-10-15',
      village: 'ព្រៃឈើទាល',
      commune: 'ជ្រៃធំ',
      district: 'រមាសហែក',
      province: 'ស្វាយរៀង',
      workPermitNumber: 'ML-00325712',
      employmentStatus: 'active',
    },
  ];

  const batch = writeBatch(db);
  const createdWorkers: Array<{ id: string; name: string; team: string }> = [];

  for (const worker of sampleWorkers) {
    const wRef = doc(collection(db, 'workers'));
    batch.set(wRef, {
      ownerId,
      ...worker,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    createdWorkers.push({ id: wRef.id, name: worker.khmerName, team: worker.team });

    // Generate clean sequential contract chain aligned to hireDate -> targetEnd
    let currentStart = worker.hireDate;
    let currentEnd = addDaysToIsoDate(currentStart, 60);
    if (currentEnd > targetEnd) currentEnd = targetEnd;
    let segIdx = 0;

    while (currentStart < targetEnd && segIdx < 20) {
      segIdx += 1;
      const contractType: ContractType = segIdx === 1 ? 'probation_60' : 'fulltime_90';
      const durationDays: 60 | 90 = segIdx === 1 ? 60 : 90;
      const cRef = doc(collection(db, 'contracts'));

      batch.set(cRef, {
        ownerId,
        workerId: wRef.id,
        workerName: worker.khmerName,
        englishName: worker.englishName,
        gender: worker.gender,
        hireDate: worker.hireDate,
        employeeCode: worker.employeeCode,
        team: worker.team,
        contractType,
        durationDays,
        startDate: currentStart,
        endDate: currentEnd,
        status: 'active',
        approvalStatus: 'pending_approval',
        notes:
          segIdx === 1
            ? '试用期(60天) · កុងត្រាសាកល្បង ៦០ ថ្ងៃ'
            : '续签合同(90天) · កុងត្រាបន្ត ៩០ ថ្ងៃ',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      currentStart = addDaysToIsoDate(currentEnd, 1);
      if (currentStart >= targetEnd) break;
      currentEnd = addDaysToIsoDate(currentStart, 90);
      if (currentEnd > targetEnd) currentEnd = targetEnd;
    }
  }

  const sampleTasks: Array<Omit<TaskInput, 'status'> & { status: TaskStatus }> = [
    {
      workerId: createdWorkers[2].id,
      workerName: createdWorkers[2].name,
      team: createdWorkers[2].team,
      title: 'វាយតម្លៃសមត្ថភាពមុនបញ្ចប់កុងត្រាសាកល្បង ៦០ ថ្ងៃ',
      description: 'ពិនិត្យលទ្ធផលការងារ និងអវត្តមានសម្រាប់ការដំឡើងទៅកុងត្រាពេញសិទ្ធិ ៩០ ថ្ងៃ។',
      priority: 'high',
      dueDate: addDaysToIsoDate(today, -1),
      status: 'pending',
    },
    {
      workerId: createdWorkers[0].id,
      workerName: createdWorkers[0].name,
      team: createdWorkers[0].team,
      title: 'ពិនិត្យបន្តកុងត្រាពេញសិទ្ធិ ៩០ ថ្ងៃថ្មី',
      description: 'រៀបចំឯកសារបន្តកុងត្រា ៩០ ថ្ងៃ និងបញ្ជាក់ហត្ថលេខាសាមីខ្លួន។',
      priority: 'high',
      dueDate: addDaysToIsoDate(today, 3),
      status: 'in_progress',
    },
    {
      workerId: createdWorkers[1].id,
      workerName: createdWorkers[1].name,
      team: createdWorkers[1].team,
      title: 'ផ្ទៀងផ្ទាត់ប័ណ្ណ ប.ស.ស និងកាតការងារប្រចាំខែ',
      description: 'ពិនិត្យសុពលភាពលេខប័ណ្ណការងារ និងបច្ចុប្បន្នភាពអាសយដ្ឋានបច្ចុប្បន្ន។',
      priority: 'medium',
      dueDate: addDaysToIsoDate(today, 5),
      status: 'pending',
    },
  ];

  for (const t of sampleTasks) {
    const tRef = doc(collection(db, 'tasks'));
    batch.set(tRef, {
      ownerId,
      ...t,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'workers');
  }
}
