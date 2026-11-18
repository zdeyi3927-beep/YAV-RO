import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  Bell,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { AuthGate } from './components/AuthGate';
import { ContractDocumentModal } from './components/ContractDocumentModal';
import { ContractModal } from './components/ContractModal';
import { DashboardView } from './components/DashboardView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ExcelImportModal } from './components/ExcelImportModal';
import { NotificationDrawer } from './components/NotificationDrawer';
import { TaskModal } from './components/TaskModal';
import { TasksView } from './components/TasksView';
import { WorkerFormModal } from './components/WorkerFormModal';
import { WorkersView } from './components/WorkersView';
import { ContractsView } from './components/ContractsView';
import { auth } from './firebase';
import {
  approveContractAndGenerateNext,
  batchImportWorkersWithContracts,
  createTask,
  createWorkerContract,
  deleteContractRecord,
  deleteTaskRecord,
  deleteWorkerRecord,
  promoteOrRenewContract,
  refreshWorkerContractSchedule,
  registerWorkerWithOptionalContract,
  rejectContract,
  seedSampleRosterFromSheet,
  subscribeContracts,
  subscribeTasks,
  subscribeWorkers,
  toggleWorkerEmploymentStatus,
  updateTaskDetails,
  updateTaskStatus,
  updateWorkerProfile,
} from './services/workforceService';
import {
  addDaysToIsoDate,
  buildAlerts,
  Contract,
  ContractType,
  defaultTargetEndDate,
  pickCurrentWorkerContract,
  TaskInput,
  TaskItem,
  TaskStatus,
  Worker,
  WorkerInput,
} from './types/workforce';

type ActiveTab = 'dashboard' | 'workers' | 'contracts' | 'tasks';

const TAB_TITLES: Record<ActiveTab, { km: string; subtitle: string }> = {
  dashboard: {
    km: 'ទិដ្ឋភាពទូទៅ',
    subtitle: 'សង្ខេបទិន្នន័យកម្មករ កុងត្រា ៦០/៩០ ថ្ងៃ និងការជូនដំណឹងបន្ទាន់',
  },
  workers: {
    km: 'បញ្ជី និងការចុះឈ្មោះកម្មករ',
    subtitle: 'ព័ត៌មានកម្មករពេញលេញតាមទម្រង់បញ្ជីរោងចក្រ',
  },
  contracts: {
    km: 'គ្រប់គ្រងកុងត្រាកម្មករ',
    subtitle: 'កុងត្រាសាកល្បង (៦០ ថ្ងៃ) និងកុងត្រាពេញសិទ្ធិ (៩០ ថ្ងៃ)',
  },
  tasks: {
    km: 'ការងារមិនទាន់រួចរាល់ និងការជូនដំណឹង',
    subtitle: 'តាមដានកិច្ចការដែលមិនទាន់បញ្ចប់ និងការងារហួសកំណត់',
  },
};

function WorkforceApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  // Modals state
  const [workerModalOpen, setWorkerModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [excelImportOpen, setExcelImportOpen] = useState(false);
  const [workerDocPreview, setWorkerDocPreview] = useState<{
    contract: Contract;
    worker: Worker;
  } | null>(null);

  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [targetWorkerForContract, setTargetWorkerForContract] = useState<string | undefined>(undefined);
  const [renewingContract, setRenewingContract] = useState<Contract | null>(null);
  const [defaultContractType, setDefaultContractType] = useState<ContractType>('probation_60');

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user) {
      setWorkers([]);
      setContracts([]);
      setTasks([]);
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    setDataError(null);
    let loadedWorkers = false;
    let loadedContracts = false;
    let loadedTasks = false;

    const markReady = () => {
      if (loadedWorkers && loadedContracts && loadedTasks) {
        setLoadingData(false);
      }
    };

    const handleErr = (err: Error) => {
      setDataError(err.message);
      setLoadingData(false);
    };

    const unsubW = subscribeWorkers(
      user.uid,
      (list) => {
        setWorkers(list);
        loadedWorkers = true;
        markReady();
      },
      handleErr
    );

    const unsubC = subscribeContracts(
      user.uid,
      (list) => {
        setContracts(list);
        loadedContracts = true;
        markReady();
      },
      handleErr
    );

    const unsubT = subscribeTasks(
      user.uid,
      (list) => {
        setTasks(list);
        loadedTasks = true;
        markReady();
      },
      handleErr
    );

    return () => {
      unsubW();
      unsubC();
      unsubT();
    };
  }, [authReady, user]);

  const alerts = useMemo(() => buildAlerts(workers, contracts, tasks), [workers, contracts, tasks]);
  const unfinishedTasksCount = useMemo(
    () => tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length,
    [tasks]
  );

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-sm font-medium text-slate-600">កំពុងផ្ទុកប្រព័ន្ធ...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthGate />;
  }

  const handleWorkerSubmit = async (
    workerData: WorkerInput,
    initialContract?: { contractType: ContractType; startDate: string; notes: string }
  ) => {
    if (editingWorker) {
      await updateWorkerProfile(editingWorker.id, workerData);
      if (editingWorker.hireDate !== workerData.hireDate) {
        const updatedWorker: Worker = {
          ...editingWorker,
          ...workerData,
        };
        const workerContracts = contracts.filter((c) => c.workerId === editingWorker.id);
        await refreshWorkerContractSchedule(
          user.uid,
          [updatedWorker],
          workerContracts,
          defaultTargetEndDate()
        );
      }
    } else {
      await registerWorkerWithOptionalContract(user.uid, workerData, initialContract);
    }
  };

  const handleToggleWorkerStatus = async (worker: Worker) => {
    const nextStatus = worker.employmentStatus === 'active' ? 'inactive' : 'active';
    await toggleWorkerEmploymentStatus(worker.id, nextStatus);
  };

  const handleDeleteWorker = async (worker: Worker) => {
    const relatedContracts = contracts.filter((c) => c.workerId === worker.id);
    const relatedTasks = tasks.filter((t) => t.workerId === worker.id);
    await deleteWorkerRecord(worker.id, relatedContracts, relatedTasks);
  };

  const handleCreateContract = async (
    worker: Worker,
    contractType: ContractType,
    startDate: string,
    notes: string
  ) => {
    const activeContracts = contracts.filter(
      (c) => c.workerId === worker.id && c.status === 'active'
    );
    await createWorkerContract(user.uid, worker, contractType, startDate, notes, activeContracts);
  };

  const handlePromoteOrRenew = async (
    oldContract: Contract,
    newType: ContractType,
    startDate: string,
    notes: string
  ) => {
    await promoteOrRenewContract(user.uid, oldContract, newType, startDate, notes);
  };

  const handleRefreshSchedule = async (targetEndDate: string) => {
    return refreshWorkerContractSchedule(user.uid, workers, contracts, targetEndDate);
  };

  const handleApproveContract = async (contract: Contract, targetEndDate: string) => {
    const w = workers.find((item) => item.id === contract.workerId);
    return approveContractAndGenerateNext(user.uid, contract, w, contracts, targetEndDate);
  };

  const handleRejectContract = async (contract: Contract) => {
    const w = workers.find((item) => item.id === contract.workerId);
    await rejectContract(contract, w);
  };

  const handleDeleteContract = async (contract: Contract) => {
    await deleteContractRecord(contract.id);
  };

  const handleExcelImport = async (
    importedWorkers: WorkerInput[],
    options: { skipExistingCodes: boolean; generateContracts: boolean }
  ) => {
    return batchImportWorkersWithContracts(user.uid, importedWorkers, workers, options);
  };

  const handleOpenWorkerContractLetter = async (worker: Worker) => {
    const workerContracts = contracts.filter((c) => c.workerId === worker.id);
    const current = pickCurrentWorkerContract(workerContracts) || workerContracts[0];
    if (current) {
      setWorkerDocPreview({ contract: current, worker });
      return;
    }

    // Ensure every worker always has a contract & A4 contract letter
    const startDate = worker.hireDate;
    const endDate = addDaysToIsoDate(startDate, 60);
    const createdId = await createWorkerContract(
      user.uid,
      worker,
      'probation_60',
      startDate,
      '试用期(60天) · កុងត្រាសាកល្បង ៦០ ថ្ងៃ',
      []
    );
    setWorkerDocPreview({
      contract: {
        id: createdId,
        ownerId: user.uid,
        workerId: worker.id,
        workerName: worker.khmerName,
        englishName: worker.englishName,
        gender: worker.gender,
        hireDate: worker.hireDate,
        employeeCode: worker.employeeCode,
        team: worker.team,
        contractType: 'probation_60',
        durationDays: 60,
        startDate,
        endDate,
        status: 'active',
        approvalStatus: 'pending_approval',
        notes: '试用期(60天) · កុងត្រាសាកល្បង ៦០ ថ្ងៃ',
      },
      worker,
    });
  };

  const handleTaskSubmit = async (data: TaskInput) => {
    if (editingTask) {
      await updateTaskDetails(editingTask.id, data);
    } else {
      await createTask(user.uid, data);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    await updateTaskStatus(taskId, 'completed');
  };

  const handleChangeTaskStatus = async (taskId: string, status: TaskStatus) => {
    await updateTaskStatus(taskId, status);
  };

  const handleSeedSample = async () => {
    setSeeding(true);
    try {
      await seedSampleRosterFromSheet(user.uid);
    } finally {
      setSeeding(false);
    }
  };

  const navItems: Array<{ id: ActiveTab; label: string; icon: typeof LayoutDashboard; count?: number }> = [
    { id: 'dashboard', label: 'ទិដ្ឋភាពទូទៅ', icon: LayoutDashboard },
    { id: 'workers', label: 'ចុះឈ្មោះកម្មករ', icon: Users, count: workers.length },
    {
      id: 'contracts',
      label: 'កុងត្រា ៦០/៩០ ថ្ងៃ',
      icon: FileText,
      count: contracts.filter((c) => c.status === 'active').length,
    },
    {
      id: 'tasks',
      label: 'ការងារមិនទាន់រួច',
      icon: ClipboardList,
      count: unfinishedTasksCount,
    },
  ];

  const openRegisterModal = () => {
    setEditingWorker(null);
    setWorkerModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-white border-r border-slate-200 shrink-0 no-print">
        <div className="h-16 px-6 border-b border-slate-200 flex items-center">
          <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
            ប្រព័ន្ធគ្រប់គ្រងកម្មករ
          </span>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-2.5 whitespace-nowrap">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {typeof item.count === 'number' && (
                  <span
                    className={`text-xs font-mono tabular-nums ${
                      active ? 'text-slate-300' : 'text-slate-400'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-900 truncate">
              {user.displayName || 'អ្នកគ្រប់គ្រង'}
            </p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={() => void signOut(auth)}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>ចាកចេញ</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden bg-slate-900/50 flex">
          <div className="w-64 bg-white h-full flex flex-col border-r border-slate-200">
            <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">ប្រព័ន្ធគ្រប់គ្រងកម្មករ</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg cursor-pointer ${
                      active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </span>
                    {typeof item.count === 'number' && (
                      <span className="text-xs font-mono tabular-nums">{item.count}</span>
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => void signOut(auth)}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>ចាកចេញ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="បើកម៉ឺនុយ"
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                {TAB_TITLES[activeTab].km}
              </h1>
              <p className="hidden sm:block text-xs text-slate-500 truncate">
                {TAB_TITLES[activeTab].subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setNotificationDrawerOpen(true)}
              className="relative inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Bell className={`w-4 h-4 ${alerts.length > 0 ? 'text-rose-600' : 'text-slate-500'}`} />
              <span className="hidden sm:inline">ការជូនដំណឹង</span>
              <span
                className={`font-mono tabular-nums font-bold ${
                  alerts.length > 0 ? 'text-rose-700' : 'text-slate-500'
                }`}
              >
                {alerts.length}
              </span>
            </button>

            <button
              type="button"
              onClick={openRegisterModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4" />
              <span>ចុះឈ្មោះកម្មករ</span>
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {dataError && (
            <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-mono break-words">
              {dataError}
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DashboardView
              workers={workers}
              contracts={contracts}
              tasks={tasks}
              alerts={alerts}
              loading={loadingData}
              seeding={seeding}
              onSeedSample={handleSeedSample}
              onNavigate={(tab) => setActiveTab(tab)}
              onOpenRegisterWorker={openRegisterModal}
              onCompleteTask={handleCompleteTask}
              onPromoteContract={(contract) => {
                setRenewingContract(contract);
                setTargetWorkerForContract(undefined);
                setDefaultContractType('fulltime_90');
                setContractModalOpen(true);
              }}
            />
          )}

          {activeTab === 'workers' && (
            <WorkersView
              workers={workers}
              contracts={contracts}
              loading={loadingData}
              seeding={seeding}
              onOpenRegister={openRegisterModal}
              onOpenExcelImport={() => setExcelImportOpen(true)}
              onEditWorker={(w) => {
                setEditingWorker(w);
                setWorkerModalOpen(true);
              }}
              onToggleStatus={handleToggleWorkerStatus}
              onDeleteWorker={handleDeleteWorker}
              onAssignContract={(w) => {
                setRenewingContract(null);
                setTargetWorkerForContract(w.id);
                setDefaultContractType('probation_60');
                setContractModalOpen(true);
              }}
              onOpenContractLetter={handleOpenWorkerContractLetter}
              onSeedSample={handleSeedSample}
            />
          )}

          {activeTab === 'contracts' && (
            <ContractsView
              contracts={contracts}
              workers={workers}
              loading={loadingData}
              onCreateNewContract={() => {
                setRenewingContract(null);
                setTargetWorkerForContract(undefined);
                setDefaultContractType('probation_60');
                setContractModalOpen(true);
              }}
              onRefreshSchedule={handleRefreshSchedule}
              onApproveContract={handleApproveContract}
              onRejectContract={handleRejectContract}
              onDeleteContract={handleDeleteContract}
            />
          )}

          {activeTab === 'tasks' && (
            <TasksView
              tasks={tasks}
              loading={loadingData}
              onCreateTask={() => {
                setEditingTask(null);
                setTaskModalOpen(true);
              }}
              onEditTask={(t) => {
                setEditingTask(t);
                setTaskModalOpen(true);
              }}
              onChangeStatus={handleChangeTaskStatus}
              onDeleteTask={deleteTaskRecord}
            />
          )}
        </main>
      </div>

      {/* Modals & Notification Drawer */}
      <WorkerFormModal
        open={workerModalOpen}
        editingWorker={editingWorker}
        onClose={() => setWorkerModalOpen(false)}
        onSubmit={handleWorkerSubmit}
      />

      <ContractModal
        open={contractModalOpen}
        workers={workers}
        targetWorkerId={targetWorkerForContract}
        renewingContract={renewingContract}
        defaultType={defaultContractType}
        onClose={() => setContractModalOpen(false)}
        onCreateContract={handleCreateContract}
        onPromoteOrRenew={handlePromoteOrRenew}
      />

      <TaskModal
        open={taskModalOpen}
        workers={workers}
        editingTask={editingTask}
        onClose={() => setTaskModalOpen(false)}
        onSubmit={handleTaskSubmit}
      />

      <NotificationDrawer
        open={notificationDrawerOpen}
        alerts={alerts}
        onClose={() => setNotificationDrawerOpen(false)}
        onCompleteTask={handleCompleteTask}
        onNavigate={(tab) => setActiveTab(tab)}
      />

      <ExcelImportModal
        open={excelImportOpen}
        onClose={() => setExcelImportOpen(false)}
        onImport={handleExcelImport}
      />

      <ContractDocumentModal
        contract={workerDocPreview?.contract || null}
        worker={workerDocPreview?.worker}
        onClose={() => setWorkerDocPreview(null)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <WorkforceApp />
    </ErrorBoundary>
  );
}
