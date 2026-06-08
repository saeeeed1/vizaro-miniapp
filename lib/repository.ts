import { eachDayOfInterval } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import {
  getRecentWorkingDateKeys,
  getSalaryRates,
  isHoliday,
  isWeeklyOffDay,
  isWorkDay,
  rebuildRecord,
  summarizeRecords
} from "@/lib/attendance";
import { APP_TIMEZONE } from "@/lib/config";
import { resolveSession } from "@/lib/auth";
import { getStore } from "@/lib/store";
import type {
  AttendancePageResponse,
  AttendanceRecord,
  AuditLog,
  DailyRecord,
  DashboardResponse,
  DataStore,
  Employee,
  EmployeeDetailResponse,
  EmployeeDashboardData,
  EmployeeInsight,
  EmployeeListItem,
  EmployeeUpsertPayload,
  HoursChartPoint,
  ReportsResponse,
  SalaryChartPoint,
  SalaryPageResponse,
  SessionPayload,
  SessionUser,
  SettingsResponse,
  SettingsUpdatePayload,
  SummaryCardItem
} from "@/lib/types";
import {
  asCsv,
  formatCurrencyUsd,
  formatDateLabel,
  formatHoursCompact,
  formatTimeLabel,
  getDateKey,
  getMonthLabel,
  getPeriodRange,
  nowInZone,
  roundCurrency,
  statusLabel,
  uid,
  zonedDateAt
} from "@/lib/utils";

export class RepositoryError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

interface ReportFilters {
  period?: "today" | "yesterday" | "week" | "month" | "custom";
  from?: string;
  to?: string;
  employeeId?: string;
}

interface TodayCard {
  status: AttendanceRecord["status"];
  checkInTime: string | null;
  checkOutTime: string | null;
  workedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  dailyEarned: number;
  dailyPenalty: number;
  netDailyAmount: number;
}

function assertAdmin(session: SessionPayload): void {
  if (session.user.role !== "ADMIN") {
    throw new RepositoryError("Bu amal faqat admin uchun.", 403);
  }
}

function getEmployeeForUser(store: DataStore, user: SessionUser): Employee | null {
  return store.employees.find((employee) => employee.userId === user.id && employee.isActive) ?? null;
}

function getEmployeeOrThrow(store: DataStore, employeeId: string): Employee {
  const employee = store.employees.find((item) => item.id === employeeId);
  if (!employee) {
    throw new RepositoryError("Xodim topilmadi.", 404);
  }
  return employee;
}

function getTodayKey(store: DataStore): string {
  return getDateKey(nowInZone(store.salaryConfig.timezone), store.salaryConfig.timezone);
}

function hasWorkdayEnded(store: DataStore, dateKey: string): boolean {
  return new Date() >= zonedDateAt(dateKey, store.salaryConfig.workEndTime, store.salaryConfig.timezone);
}

function getRecordIndex(store: DataStore, employeeId: string, dateKey: string): number {
  return store.attendanceRecords.findIndex((record) => record.employeeId === employeeId && record.date === dateKey);
}

function syncRecord(store: DataStore, record: AttendanceRecord): AttendanceRecord & { overtimeMinutes: number } {
  const employee = getEmployeeOrThrow(store, record.employeeId);
  const hydrated = rebuildRecord(
    record,
    {
      ...store.salaryConfig,
      defaultMonthlySalaryUsd: employee.monthlySalaryUsd,
      workStartTime: employee.workStartTime,
      workEndTime: employee.workEndTime
    },
    store.holidays
  );

  const updatedRecord: AttendanceRecord = {
    ...record,
    status: hydrated.status,
    lateMinutes: hydrated.lateMinutes,
    earlyLeaveMinutes: hydrated.earlyLeaveMinutes,
    workedMinutes: hydrated.workedMinutes,
    expectedMinutes: hydrated.expectedMinutes,
    dailyEarned: hydrated.dailyEarned,
    dailyPenalty: hydrated.dailyPenalty,
    netDailyAmount: hydrated.netDailyAmount
  };

  const index = getRecordIndex(store, record.employeeId, record.date);
  if (index >= 0) {
    store.attendanceRecords[index] = updatedRecord;
  } else {
    store.attendanceRecords.push(updatedRecord);
  }

  store.penalties = store.penalties.filter((penalty) => penalty.attendanceRecordId !== updatedRecord.id);
  store.penalties.push(...hydrated.penalties);

  return {
    ...updatedRecord,
    overtimeMinutes: hydrated.overtimeMinutes
  };
}

function createEmptyRecord(employeeId: string, dateKey: string): AttendanceRecord {
  const timestamp = new Date().toISOString();
  return {
    id: uid("att"),
    employeeId,
    date: dateKey,
    checkInTime: null,
    checkOutTime: null,
    status: "PENDING",
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    workedMinutes: 0,
    expectedMinutes: 480,
    dailyEarned: 0,
    dailyPenalty: 0,
    netDailyAmount: 0,
    notes: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function logAction(store: DataStore, input: Omit<AuditLog, "id" | "createdAt">): void {
  store.auditLogs.unshift({
    ...input,
    id: uid("audit"),
    createdAt: new Date().toISOString()
  });
}

function materializeAbsences(store: DataStore, from: string, to: string): void {
  const rangeDays = eachDayOfInterval({
    start: zonedDateAt(from, "00:00", store.salaryConfig.timezone),
    end: zonedDateAt(to, "00:00", store.salaryConfig.timezone)
  });

  for (const employee of store.employees.filter((item) => item.isActive)) {
    for (const day of rangeDays) {
      const dateKey = getDateKey(day, store.salaryConfig.timezone);
      const index = getRecordIndex(store, employee.id, dateKey);
      const isPastDay = dateKey < getTodayKey(store) || (dateKey === getTodayKey(store) && hasWorkdayEnded(store, dateKey));

      if (!isWorkDay(dateKey, { ...store.salaryConfig, workStartTime: employee.workStartTime, workEndTime: employee.workEndTime }, store.holidays)) {
        continue;
      }

      if (isPastDay && index < 0) {
        syncRecord(
          store,
          {
            ...createEmptyRecord(employee.id, dateKey),
            createdAt: zonedDateAt(dateKey, employee.workEndTime, store.salaryConfig.timezone).toISOString(),
            updatedAt: zonedDateAt(dateKey, employee.workEndTime, store.salaryConfig.timezone).toISOString(),
            notes: "Auto-generated absent record."
          }
        );
      }
    }
  }
}

function materializeCurrentMonth(store: DataStore): void {
  const monthPrefix = formatInTimeZone(new Date(), store.salaryConfig.timezone, "yyyy-MM");
  const start = `${monthPrefix}-01`;
  const end = getDateKey(nowInZone(store.salaryConfig.timezone), store.salaryConfig.timezone);
  materializeAbsences(store, start, end);
}

function getScopedEmployees(store: DataStore, session: SessionPayload): Employee[] {
  if (session.user.role === "ADMIN") {
    return [...store.employees.filter((employee) => employee.isActive)];
  }

  const ownEmployee = getEmployeeForUser(store, session.user);
  return ownEmployee ? [ownEmployee] : [];
}

function getTodayCard(store: DataStore, employee: Employee | null): TodayCard {
  if (!employee) {
    return {
      status: "PENDING",
      checkInTime: null,
      checkOutTime: null,
      workedMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      dailyEarned: 0,
      dailyPenalty: 0,
      netDailyAmount: 0
    };
  }

  const todayKey = getTodayKey(store);
  const dateStatus = isWeeklyOffDay(todayKey, { ...store.salaryConfig, workStartTime: employee.workStartTime, workEndTime: employee.workEndTime })
    ? "SUNDAY"
    : isHoliday(todayKey, store.holidays, store.salaryConfig.timezone)
      ? "OFF_DAY"
      : "PENDING";
  const existing = store.attendanceRecords.find((record) => record.employeeId === employee.id && record.date === todayKey);

  if (!existing) {
    return {
      status: dateStatus,
      checkInTime: null,
      checkOutTime: null,
      workedMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      dailyEarned: 0,
      dailyPenalty: 0,
      netDailyAmount: 0
    };
  }

  const rebuilt = syncRecord(store, existing);
  return {
    status: rebuilt.status,
    checkInTime: rebuilt.checkInTime,
    checkOutTime: rebuilt.checkOutTime,
    workedMinutes: rebuilt.workedMinutes,
    lateMinutes: rebuilt.lateMinutes,
    earlyLeaveMinutes: rebuilt.earlyLeaveMinutes,
    overtimeMinutes: rebuilt.overtimeMinutes,
    dailyEarned: rebuilt.dailyEarned,
    dailyPenalty: rebuilt.dailyPenalty,
    netDailyAmount: rebuilt.netDailyAmount
  };
}

function getEmployeeMonthRecords(store: DataStore, employeeId: string): AttendanceRecord[] {
  materializeCurrentMonth(store);
  const monthLabel = formatInTimeZone(new Date(), store.salaryConfig.timezone, "yyyy-MM");
  return store.attendanceRecords
    .filter((record) => record.employeeId === employeeId && record.date.startsWith(monthLabel))
    .sort((left, right) => right.date.localeCompare(left.date));
}

function getEmployeeMonthStats(store: DataStore, employee: Employee): {
  arrivedDays: number;
  lateDays: number;
  absentDays: number;
  workedMinutes: number;
  overtimeMinutes: number;
  totalPenalty: number;
  totalEarned: number;
  netSalary: number;
} {
  const records = getEmployeeMonthRecords(store, employee.id);
  const summary = summarizeRecords(
    records,
    {
      ...store.salaryConfig,
      defaultMonthlySalaryUsd: employee.monthlySalaryUsd,
      workStartTime: employee.workStartTime,
      workEndTime: employee.workEndTime
    },
    store.holidays
  );

  return {
    arrivedDays: summary.arrivedDays,
    lateDays: summary.lateDays,
    absentDays: summary.absentDays,
    workedMinutes: summary.totalWorkedMinutes,
    overtimeMinutes: summary.totalOvertimeMinutes,
    totalPenalty: summary.totalPenalty,
    totalEarned: summary.totalEarned,
    netSalary: summary.netSalary
  };
}

function employeeInsight(store: DataStore, employee: Employee, value: string, secondary?: string): EmployeeInsight {
  return {
    employeeId: employee.id,
    fullName: employee.user.fullName,
    position: employee.position,
    value,
    secondary
  };
}

function getLatestActivity(store: DataStore, scopedEmployees: Employee[]): DashboardResponse["latestActivity"] {
  const employeeMap = new Map(scopedEmployees.map((employee) => [employee.id, employee]));
  return store.attendanceRecords
    .filter((record) => employeeMap.has(record.employeeId))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 8)
    .map((record) => {
      const employee = employeeMap.get(record.employeeId)!;
      return {
        id: record.id,
        title: `${employee.user.fullName} - ${statusLabel(record.status)}`,
        subtitle: `${formatDateLabel(record.date, store.salaryConfig.timezone)} / ${formatTimeLabel(record.checkInTime, store.salaryConfig.timezone) ?? "--"} - ${formatTimeLabel(record.checkOutTime, store.salaryConfig.timezone) ?? "--"}`,
        amount: formatCurrencyUsd(record.netDailyAmount),
        tone: record.status === "ABSENT" ? "danger" : record.status === "LATE" || record.status === "EARLY_LEAVE" ? "warning" : "success"
      };
    });
}

function buildAdminDashboard(store: DataStore, session: SessionPayload): DashboardResponse {
  materializeCurrentMonth(store);
  const employees = getScopedEmployees(store, session);
  const todayKey = getTodayKey(store);
  const todayRecords = employees
    .map((employee) => store.attendanceRecords.find((record) => record.employeeId === employee.id && record.date === todayKey))
    .filter(Boolean) as AttendanceRecord[];
  const monthStats = employees.map((employee) => ({ employee, stats: getEmployeeMonthStats(store, employee) }));

  const arrivedToday = todayRecords.filter((record) => Boolean(record.checkInTime)).length;
  const lateTodayEmployees = employees.filter((employee) => {
    const record = todayRecords.find((item) => item.employeeId === employee.id);
    return Boolean(record && record.lateMinutes > 0);
  });
  const absentTodayEmployees = employees.filter((employee) => {
    const record = todayRecords.find((item) => item.employeeId === employee.id);
    return !record?.checkInTime && isWorkDay(todayKey, { ...store.salaryConfig, workStartTime: employee.workStartTime, workEndTime: employee.workEndTime }, store.holidays);
  });
  const onTimeTodayEmployees = employees.filter((employee) => {
    const record = todayRecords.find((item) => item.employeeId === employee.id);
    return Boolean(record?.checkInTime) && record!.lateMinutes === 0;
  });

  const totalWorkedMinutes = monthStats.reduce((sum, item) => sum + item.stats.workedMinutes, 0);
  const totalPenalty = roundCurrency(monthStats.reduce((sum, item) => sum + item.stats.totalPenalty, 0));
  const totalEarned = roundCurrency(monthStats.reduce((sum, item) => sum + item.stats.totalEarned, 0));
  const totalNet = roundCurrency(monthStats.reduce((sum, item) => sum + item.stats.netSalary, 0));

  const recentWorkdays = getRecentWorkingDateKeys(store.salaryConfig, 7);
  const weeklyAttendance = recentWorkdays.map((dateKey) => ({
    label: formatInTimeZone(zonedDateAt(dateKey, "00:00", store.salaryConfig.timezone), store.salaryConfig.timezone, "EEE"),
    value: employees.filter((employee) => {
      const record = store.attendanceRecords.find((item) => item.employeeId === employee.id && item.date === dateKey);
      return Boolean(record?.checkInTime);
    }).length,
    value2: employees.filter((employee) => {
      const record = store.attendanceRecords.find((item) => item.employeeId === employee.id && item.date === dateKey);
      return !record?.checkInTime;
    }).length
  }));

  const monthlyLateChart = monthStats
    .map(({ employee, stats }) => ({
      label: employee.user.fullName.split(" ")[0] ?? employee.user.fullName,
      value: stats.lateDays
    }))
    .sort((left, right) => right.value - left.value);

  const absencePie = [
    {
      label: "Kelgan",
      value: monthStats.reduce((sum, item) => sum + item.stats.arrivedDays, 0)
    },
    {
      label: "Kelmagan",
      value: monthStats.reduce((sum, item) => sum + item.stats.absentDays, 0)
    }
  ];

  const employeeHoursTrend = monthStats
    .map(({ employee, stats }) => ({
      label: employee.user.fullName.split(" ")[0] ?? employee.user.fullName,
      value: roundCurrency(stats.workedMinutes / 60)
    }))
    .sort((left, right) => right.value - left.value);

  const salaryBreakdown = [
    { label: "Earned", value: totalEarned },
    { label: "Penalty", value: totalPenalty },
    { label: "Net", value: totalNet }
  ];

  const dailyAttendanceTrend = recentWorkdays.map((dateKey) => ({
    label: formatInTimeZone(zonedDateAt(dateKey, "00:00", store.salaryConfig.timezone), store.salaryConfig.timezone, "dd MMM"),
    value: employees.filter((employee) => {
      const record = store.attendanceRecords.find((item) => item.employeeId === employee.id && item.date === dateKey);
      return Boolean(record?.checkInTime);
    }).length,
    value2: employees.filter((employee) => {
      const record = store.attendanceRecords.find((item) => item.employeeId === employee.id && item.date === dateKey);
      return record?.status === "ABSENT";
    }).length
  }));

  const mostLateThisMonth = [...monthStats]
    .sort((left, right) => right.stats.lateDays - left.stats.lateDays)
    .slice(0, 5)
    .map(({ employee, stats }) => employeeInsight(store, employee, `${stats.lateDays} marta`, `${formatCurrencyUsd(stats.totalPenalty)} minus`));

  const mostPenalizedThisMonth = [...monthStats]
    .sort((left, right) => right.stats.totalPenalty - left.stats.totalPenalty)
    .slice(0, 5)
    .map(({ employee, stats }) => employeeInsight(store, employee, formatCurrencyUsd(stats.totalPenalty), `${formatHoursCompact(stats.workedMinutes)}`));

  return {
    summary: [
      { label: "Jami xodimlar", value: String(employees.length), hint: "Faol employee lar" },
      { label: "Bugun kelganlar", value: String(arrivedToday), hint: `${employees.length} tadan` },
      { label: "Bugun kech qolganlar", value: String(lateTodayEmployees.length), hint: "10:00 dan keyin" },
      { label: "Bugun kelmaganlar", value: String(absentTodayEmployees.length), hint: "Hali check-in qilmaganlar" },
      { label: "Umumiy ishlangan", value: formatHoursCompact(totalWorkedMinutes), hint: getMonthLabel(new Date(), store.salaryConfig.timezone) },
      { label: "Jami minus", value: formatCurrencyUsd(totalPenalty), hint: "Oy davomida" },
      { label: "Net salary", value: formatCurrencyUsd(totalNet), hint: "Current month" }
    ],
    weeklyAttendance,
    monthlyLateChart,
    absencePie,
    employeeHoursTrend,
    salaryBreakdown,
    dailyAttendanceTrend,
    latestActivity: getLatestActivity(store, employees),
    quickLists: {
      lateToday: lateTodayEmployees.map((employee) => {
        const record = todayRecords.find((item) => item.employeeId === employee.id)!;
        return employeeInsight(store, employee, `${record.lateMinutes} minut`, formatTimeLabel(record.checkInTime, store.salaryConfig.timezone) ?? "--");
      }),
      absentToday: absentTodayEmployees.map((employee) => employeeInsight(store, employee, "Kelmagan", employee.position)),
      onTimeToday: onTimeTodayEmployees.map((employee) => {
        const record = todayRecords.find((item) => item.employeeId === employee.id)!;
        return employeeInsight(store, employee, formatTimeLabel(record.checkInTime, store.salaryConfig.timezone) ?? "--", "Vaqtida kelgan");
      }),
      mostLateThisMonth,
      mostPenalizedThisMonth
    }
  };
}

function buildEmployeeDashboard(store: DataStore, session: SessionPayload): DashboardResponse {
  const employee = getEmployeeForUser(store, session.user);
  if (!employee) {
    throw new RepositoryError("Employee profili topilmadi.", 404);
  }

  const stats = getEmployeeMonthStats(store, employee);
  const recentDates = getRecentWorkingDateKeys(store.salaryConfig, 7);
  const records = getEmployeeMonthRecords(store, employee.id);
  const recordMap = new Map(records.map((record) => [record.date, record]));

  return {
    summary: [
      { label: "Bugungi status", value: statusLabel(getTodayCard(store, employee).status), hint: employee.position },
      { label: "Shu oy ishlagan", value: formatHoursCompact(stats.workedMinutes), hint: `${stats.arrivedDays} kun kelgan` },
      { label: "Kech qolgan kunlar", value: String(stats.lateDays), hint: "Current month" },
      { label: "Kelmagan kunlar", value: String(stats.absentDays), hint: "Yakshanba hisoblanmaydi" },
      { label: "Jarima", value: formatCurrencyUsd(stats.totalPenalty), hint: "Late + early leave + absent" },
      { label: "Daromad", value: formatCurrencyUsd(stats.totalEarned), hint: "Worked time" },
      { label: "Sof oylik", value: formatCurrencyUsd(stats.netSalary), hint: getMonthLabel(new Date(), store.salaryConfig.timezone) }
    ],
    weeklyAttendance: recentDates.map((dateKey) => ({
      label: formatInTimeZone(zonedDateAt(dateKey, "00:00", store.salaryConfig.timezone), store.salaryConfig.timezone, "EEE"),
      value: roundCurrency((recordMap.get(dateKey)?.workedMinutes ?? 0) / 60)
    })),
    monthlyLateChart: [
      { label: "Late", value: stats.lateDays },
      { label: "Absent", value: stats.absentDays },
      { label: "Overtime", value: roundCurrency(stats.overtimeMinutes / 60) }
    ],
    absencePie: [
      { label: "Kelgan", value: stats.arrivedDays },
      { label: "Kelmagan", value: stats.absentDays }
    ],
    employeeHoursTrend: records
      .slice(0, 8)
      .reverse()
      .map((record) => ({
        label: formatInTimeZone(zonedDateAt(record.date, "00:00", store.salaryConfig.timezone), store.salaryConfig.timezone, "dd MMM"),
        value: roundCurrency(record.workedMinutes / 60)
      })),
    salaryBreakdown: [
      { label: "Earned", value: stats.totalEarned },
      { label: "Penalty", value: stats.totalPenalty },
      { label: "Net", value: stats.netSalary }
    ],
    dailyAttendanceTrend: recentDates.map((dateKey) => {
      const record = recordMap.get(dateKey);
      return {
        label: formatInTimeZone(zonedDateAt(dateKey, "00:00", store.salaryConfig.timezone), store.salaryConfig.timezone, "dd MMM"),
        value: record?.status === "ABSENT" ? 0 : 1,
        value2: record?.lateMinutes ?? 0
      };
    }),
    latestActivity: getLatestActivity(store, [employee]),
    quickLists: {
      lateToday: [],
      absentToday: [],
      onTimeToday: [employeeInsight(store, employee, statusLabel(getTodayCard(store, employee).status), employee.position)],
      mostLateThisMonth: [employeeInsight(store, employee, `${stats.lateDays} marta`, formatCurrencyUsd(stats.totalPenalty))],
      mostPenalizedThisMonth: [employeeInsight(store, employee, formatCurrencyUsd(stats.totalPenalty), `${formatHoursCompact(stats.workedMinutes)}`)]
    }
  };
}

function toSummaryCards(store: DataStore, rows: Array<{ label: string; value: string; hint?: string }>): SummaryCardItem[] {
  return rows.map((row) => ({
    ...row,
    hint: row.hint ?? getMonthLabel(new Date(), store.salaryConfig.timezone)
  }));
}

function attachEmployee(store: DataStore, record: AttendanceRecord): AttendanceRecord & { employee: Employee } {
  return {
    ...record,
    employee: getEmployeeOrThrow(store, record.employeeId)
  };
}

export async function getSession(headers: Headers): Promise<SessionPayload> {
  return resolveSession(headers);
}

export async function getDashboard(headers: Headers): Promise<DashboardResponse> {
  const session = await resolveSession(headers);
  const store = getStore();
  return session.user.role === "ADMIN" ? buildAdminDashboard(store, session) : buildEmployeeDashboard(store, session);
}

export async function getAttendancePage(headers: Headers, filters: ReportFilters = {}): Promise<AttendancePageResponse> {
  const session = await resolveSession(headers);
  const store = getStore();
  const employee = getEmployeeForUser(store, session.user);
  const period = filters.period ?? "month";
  const range = getPeriodRange(period, store.salaryConfig.timezone, filters.from, filters.to);
  materializeAbsences(store, range.from, range.to);

  const scopedEmployees = getScopedEmployees(store, session).map((item) => item.id);
  const scopedEmployeeIds = filters.employeeId && session.user.role === "ADMIN" ? [filters.employeeId] : scopedEmployees;
  const rows = store.attendanceRecords
    .filter((record) => scopedEmployeeIds.includes(record.employeeId) && record.date >= range.from && record.date <= range.to)
    .sort((left, right) => {
      if (left.date === right.date) {
        return getEmployeeOrThrow(store, left.employeeId).user.fullName.localeCompare(getEmployeeOrThrow(store, right.employeeId).user.fullName);
      }
      return right.date.localeCompare(left.date);
    })
    .map((record) => attachEmployee(store, syncRecord(store, record)));

  const alerts =
    session.user.role === "ADMIN"
      ? store.attendanceRecords
          .filter((record) => record.checkInTime && !record.checkOutTime)
          .sort((left, right) => right.date.localeCompare(left.date))
          .slice(0, 5)
          .map((record) => {
            const item = getEmployeeOrThrow(store, record.employeeId);
            return `${item.user.fullName}: ${record.date} kuni check-out yo'q`;
          })
      : employee
        ? store.attendanceRecords
            .filter((record) => record.employeeId === employee.id && record.checkInTime && !record.checkOutTime)
            .map((record) => `${record.date} kuni check-out hali yopilmagan.`)
        : [];

  return {
    today: getTodayCard(store, employee),
    records: rows,
    alerts
  };
}

export async function checkIn(headers: Headers, timestamp?: string): Promise<AttendancePageResponse> {
  const session = await resolveSession(headers);
  const store = getStore();
  const employee = getEmployeeForUser(store, session.user);

  if (!employee) {
    throw new RepositoryError("Check-in faqat employee uchun.", 403);
  }

  const when = timestamp ? new Date(timestamp) : new Date();
  if (Number.isNaN(when.getTime())) {
    throw new RepositoryError("Noto'g'ri vaqt formati.");
  }

  const dateKey = getDateKey(when, store.salaryConfig.timezone);
  if (!isWorkDay(dateKey, { ...store.salaryConfig, workStartTime: employee.workStartTime, workEndTime: employee.workEndTime }, store.holidays)) {
    throw new RepositoryError("Bugun dam olish kuni. Check-in yopiq.");
  }

  const existingIndex = getRecordIndex(store, employee.id, dateKey);
  const record = existingIndex >= 0 ? store.attendanceRecords[existingIndex] : createEmptyRecord(employee.id, dateKey);
  if (record.checkInTime) {
    throw new RepositoryError("Bugun allaqachon check-in qilingan.", 409);
  }

  const updated: AttendanceRecord = {
    ...record,
    checkInTime: when.toISOString(),
    updatedAt: new Date().toISOString()
  };

  const synced = syncRecord(store, updated);
  logAction(store, {
    actorUserId: session.user.id,
    employeeId: employee.id,
    attendanceRecordId: synced.id,
    action: "CHECK_IN",
    payload: {
      date: dateKey,
      checkInTime: synced.checkInTime
    }
  });

  return getAttendancePage(headers, { period: "today" });
}

export async function checkOut(headers: Headers, timestamp?: string): Promise<AttendancePageResponse> {
  const session = await resolveSession(headers);
  const store = getStore();
  const employee = getEmployeeForUser(store, session.user);

  if (!employee) {
    throw new RepositoryError("Check-out faqat employee uchun.", 403);
  }

  const when = timestamp ? new Date(timestamp) : new Date();
  if (Number.isNaN(when.getTime())) {
    throw new RepositoryError("Noto'g'ri vaqt formati.");
  }

  const dateKey = getDateKey(when, store.salaryConfig.timezone);
  const record = store.attendanceRecords.find((item) => item.employeeId === employee.id && item.date === dateKey);

  if (!record?.checkInTime) {
    throw new RepositoryError("Avval check-in qiling.");
  }

  if (record.checkOutTime) {
    throw new RepositoryError("Bugun allaqachon check-out qilingan.", 409);
  }

  if (new Date(record.checkInTime) > when) {
    throw new RepositoryError("Check-out check-in dan oldin bo'lishi mumkin emas.");
  }

  const synced = syncRecord(store, {
    ...record,
    checkOutTime: when.toISOString(),
    updatedAt: new Date().toISOString()
  });

  logAction(store, {
    actorUserId: session.user.id,
    employeeId: employee.id,
    attendanceRecordId: synced.id,
    action: "CHECK_OUT",
    payload: {
      date: dateKey,
      checkOutTime: synced.checkOutTime
    }
  });

  return getAttendancePage(headers, { period: "today" });
}

export async function manualCorrection(
  headers: Headers,
  payload: {
    employeeId?: string;
    date?: string;
    checkInTime?: string | null;
    checkOutTime?: string | null;
    notes?: string | null;
  }
): Promise<EmployeeDetailResponse> {
  const session = await resolveSession(headers);
  const store = getStore();
  assertAdmin(session);

  if (!payload.employeeId || !payload.date) {
    throw new RepositoryError("employeeId va date majburiy.");
  }

  const employee = getEmployeeOrThrow(store, payload.employeeId);
  const existing = store.attendanceRecords.find((record) => record.employeeId === employee.id && record.date === payload.date);
  const record = existing ?? createEmptyRecord(employee.id, payload.date);

  if (payload.checkInTime && payload.checkOutTime && new Date(payload.checkInTime) > new Date(payload.checkOutTime)) {
    throw new RepositoryError("Check-out check-in dan oldin bo'lishi mumkin emas.");
  }

  const synced = syncRecord(store, {
    ...record,
    checkInTime: payload.checkInTime ?? null,
    checkOutTime: payload.checkOutTime ?? null,
    notes: payload.notes ?? record.notes,
    updatedAt: new Date().toISOString()
  });

  logAction(store, {
    actorUserId: session.user.id,
    employeeId: employee.id,
    attendanceRecordId: synced.id,
    action: "ATTENDANCE_CORRECTED",
    payload
  });

  return getEmployeeDetail(headers, employee.id);
}

export async function getEmployees(headers: Headers): Promise<EmployeeListItem[]> {
  const session = await resolveSession(headers);
  const store = getStore();
  materializeCurrentMonth(store);

  return getScopedEmployees(store, session).map((employee) => {
    const stats = getEmployeeMonthStats(store, employee);
    return {
      employee,
      arrivedDays: stats.arrivedDays,
      lateDays: stats.lateDays,
      absentDays: stats.absentDays,
      workedMinutes: stats.workedMinutes,
      totalPenalty: stats.totalPenalty,
      netSalary: stats.netSalary,
      statusToday: getTodayCard(store, employee).status
    };
  });
}

export async function createEmployee(headers: Headers, payload: EmployeeUpsertPayload): Promise<EmployeeListItem[]> {
  const session = await resolveSession(headers);
  const store = getStore();
  assertAdmin(session);

  if (store.users.some((user) => user.telegramId === payload.telegramId)) {
    throw new RepositoryError("Bu Telegram ID allaqachon mavjud.", 409);
  }

  const userId = uid("user");
  const employeeId = uid("emp");
  const timestamp = new Date().toISOString();

  store.users.push({
    id: userId,
    telegramId: payload.telegramId,
    fullName: payload.fullName,
    username: payload.username ?? null,
    role: payload.role ?? "EMPLOYEE",
    createdAt: timestamp
  });

  const user = store.users.find((item) => item.id === userId)!;
  store.employees.push({
    id: employeeId,
    userId,
    position: payload.position,
    monthlySalaryUsd: payload.monthlySalaryUsd,
    workStartTime: payload.workStartTime,
    workEndTime: payload.workEndTime,
    isActive: payload.isActive ?? true,
    createdAt: timestamp,
    updatedAt: timestamp,
    user
  });

  logAction(store, {
    actorUserId: session.user.id,
    employeeId,
    attendanceRecordId: null,
    action: "EMPLOYEE_CREATED",
    payload
  });

  return getEmployees(headers);
}

export async function updateEmployee(headers: Headers, employeeId: string, payload: Partial<EmployeeUpsertPayload>): Promise<EmployeeDetailResponse> {
  const session = await resolveSession(headers);
  const store = getStore();
  assertAdmin(session);

  const employee = getEmployeeOrThrow(store, employeeId);
  const user = store.users.find((item) => item.id === employee.userId);
  if (!user) {
    throw new RepositoryError("User topilmadi.", 404);
  }

  if (payload.telegramId && payload.telegramId !== user.telegramId && store.users.some((item) => item.telegramId === payload.telegramId)) {
    throw new RepositoryError("Bu Telegram ID boshqa foydalanuvchiga biriktirilgan.", 409);
  }

  Object.assign(user, {
    fullName: payload.fullName ?? user.fullName,
    username: payload.username ?? user.username,
    telegramId: payload.telegramId ?? user.telegramId,
    role: payload.role ?? user.role
  });

  Object.assign(employee, {
    position: payload.position ?? employee.position,
    monthlySalaryUsd: payload.monthlySalaryUsd ?? employee.monthlySalaryUsd,
    workStartTime: payload.workStartTime ?? employee.workStartTime,
    workEndTime: payload.workEndTime ?? employee.workEndTime,
    isActive: payload.isActive ?? employee.isActive,
    updatedAt: new Date().toISOString(),
    user
  });

  for (const record of store.attendanceRecords.filter((item) => item.employeeId === employee.id)) {
    syncRecord(store, { ...record, updatedAt: new Date().toISOString() });
  }

  logAction(store, {
    actorUserId: session.user.id,
    employeeId: employee.id,
    attendanceRecordId: null,
    action: "EMPLOYEE_UPDATED",
    payload
  });

  return getEmployeeDetail(headers, employee.id);
}

export async function deleteEmployee(headers: Headers, employeeId: string): Promise<EmployeeListItem[]> {
  const session = await resolveSession(headers);
  const store = getStore();
  assertAdmin(session);

  const employee = getEmployeeOrThrow(store, employeeId);
  store.attendanceRecords = store.attendanceRecords.filter((record) => record.employeeId !== employee.id);
  store.penalties = store.penalties.filter((penalty) => penalty.employeeId !== employee.id);
  store.employees = store.employees.filter((item) => item.id !== employee.id);
  store.users = store.users.filter((item) => item.id !== employee.userId);

  logAction(store, {
    actorUserId: session.user.id,
    employeeId: employee.id,
    attendanceRecordId: null,
    action: "EMPLOYEE_DELETED",
    payload: {
      fullName: employee.user.fullName
    }
  });

  return getEmployees(headers);
}

export async function getEmployeeDetail(headers: Headers, employeeId: string): Promise<EmployeeDetailResponse> {
  const session = await resolveSession(headers);
  const store = getStore();
  const employee = getEmployeeOrThrow(store, employeeId);

  if (session.user.role !== "ADMIN" && session.user.employeeId !== employeeId) {
    throw new RepositoryError("Bu xodim ma'lumotini ko'rish mumkin emas.", 403);
  }

  const stats = getEmployeeMonthStats(store, employee);

  return {
    employee,
    today: getTodayCard(store, employee),
    stats,
    attendance: getEmployeeMonthRecords(store, employee.id),
    penalties: store.penalties
      .filter((penalty) => penalty.employeeId === employee.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    auditLogs: store.auditLogs
      .filter((log) => log.employeeId === employee.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 20)
  };
}

export async function getReports(headers: Headers, filters: ReportFilters = {}): Promise<ReportsResponse> {
  const session = await resolveSession(headers);
  const store = getStore();
  const period = filters.period ?? "month";
  const range = getPeriodRange(period, store.salaryConfig.timezone, filters.from, filters.to);
  materializeAbsences(store, range.from, range.to);

  const scopedEmployees = getScopedEmployees(store, session).map((item) => item.id);
  const employeeIds = session.user.role === "ADMIN" && filters.employeeId ? [filters.employeeId] : scopedEmployees;
  const rows = store.attendanceRecords
    .filter((record) => employeeIds.includes(record.employeeId) && record.date >= range.from && record.date <= range.to)
    .sort((left, right) => {
      if (left.date === right.date) {
        return getEmployeeOrThrow(store, left.employeeId).user.fullName.localeCompare(getEmployeeOrThrow(store, right.employeeId).user.fullName);
      }
      return right.date.localeCompare(left.date);
    })
    .map((record) => attachEmployee(store, syncRecord(store, record)));

  const totalPenalty = roundCurrency(rows.reduce((sum, row) => sum + row.dailyPenalty, 0));
  const totalEarned = roundCurrency(rows.reduce((sum, row) => sum + row.dailyEarned, 0));
  const net = roundCurrency(rows.reduce((sum, row) => sum + row.netDailyAmount, 0));
  const totalWorkedMinutes = rows.reduce((sum, row) => sum + row.workedMinutes, 0);

  return {
    summary: toSummaryCards(store, [
      { label: "Davr", value: `${range.from} - ${range.to}` },
      { label: "Ishlangan vaqt", value: formatHoursCompact(totalWorkedMinutes) },
      { label: "Earned", value: formatCurrencyUsd(totalEarned) },
      { label: "Penalties", value: formatCurrencyUsd(totalPenalty) },
      { label: "Net", value: formatCurrencyUsd(net) }
    ]),
    rows
  };
}

export async function exportReportsCsv(headers: Headers, filters: ReportFilters = {}): Promise<string> {
  const report = await getReports(headers, filters);
  const headerRow = [
    "Date",
    "Employee",
    "Status",
    "Check In",
    "Check Out",
    "Worked Minutes",
    "Late Minutes",
    "Early Leave Minutes",
    "Daily Earned USD",
    "Daily Penalty USD",
    "Net Daily USD"
  ];

  const rows = report.rows.map((row) => [
    row.date,
    row.employee.user.fullName,
    statusLabel(row.status),
    formatTimeLabel(row.checkInTime, APP_TIMEZONE) ?? "",
    formatTimeLabel(row.checkOutTime, APP_TIMEZONE) ?? "",
    row.workedMinutes,
    row.lateMinutes,
    row.earlyLeaveMinutes,
    row.dailyEarned,
    row.dailyPenalty,
    row.netDailyAmount
  ]);

  return asCsv([headerRow, ...rows]);
}

export async function getSalaryPage(headers: Headers): Promise<SalaryPageResponse> {
  const session = await resolveSession(headers);
  const store = getStore();
  materializeCurrentMonth(store);

  const scoped = getScopedEmployees(store, session);
  const rows = scoped.map((employee) => {
    const stats = getEmployeeMonthStats(store, employee);
    return {
      employee,
      totalWorkedMinutes: stats.workedMinutes,
      totalOvertimeMinutes: stats.overtimeMinutes,
      totalPenalty: stats.totalPenalty,
      totalEarned: stats.totalEarned,
      netSalary: stats.netSalary
    };
  });

  return {
    summary: toSummaryCards(store, [
      { label: "Base monthly", value: formatCurrencyUsd(store.salaryConfig.defaultMonthlySalaryUsd), hint: "Default config" },
      { label: "Work window", value: `${store.salaryConfig.workStartTime} - ${store.salaryConfig.workEndTime}` },
      { label: "Weekly off", value: "Sunday", hint: "Configurable" },
      { label: "Current month net", value: formatCurrencyUsd(roundCurrency(rows.reduce((sum, row) => sum + row.netSalary, 0))) }
    ]),
    rows
  };
}

export async function getSettings(headers: Headers): Promise<SettingsResponse> {
  const session = await resolveSession(headers);
  const store = getStore();
  const note =
    session.user.role === "ADMIN"
      ? "Bu sahifadan default salary, schedule va timezone sozlamalarini yangilaysiz. Manual correction audit log bilan saqlanadi."
      : "Employee view faqat o'qish uchun. Sozlamalarni admin boshqaradi.";

  return {
    config: store.salaryConfig,
    note
  };
}

export async function updateSettings(headers: Headers, payload: SettingsUpdatePayload): Promise<SettingsResponse> {
  const session = await resolveSession(headers);
  const store = getStore();
  assertAdmin(session);

  store.salaryConfig = {
    ...store.salaryConfig,
    ...payload,
    updatedAt: new Date().toISOString()
  };

  for (const record of [...store.attendanceRecords]) {
    syncRecord(store, { ...record, updatedAt: new Date().toISOString() });
  }

  logAction(store, {
    actorUserId: session.user.id,
    employeeId: null,
    attendanceRecordId: null,
    action: "SETTINGS_UPDATED",
    payload
  });

  return getSettings(headers);
}

export async function getEmployeeDashboardData(headers: Headers): Promise<EmployeeDashboardData> {
  const session = await resolveSession(headers);
  const store = getStore();
  materializeCurrentMonth(store);

  // Find employee for this user
  const employee = store.employees.find(
    (emp) => emp.userId === session.user.id && emp.isActive
  );
  if (!employee) {
    // For admins, find their own employee record or use first employee
    const fallback = store.employees.find((emp) => emp.isActive);
    if (!fallback) {
      throw new RepositoryError("Xodim profili topilmadi.", 404);
    }
    return buildNewEmployeeDashboard(store, fallback);
  }
  return buildNewEmployeeDashboard(store, employee);
}

const UZ_MONTHS_DASH = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"
];

function buildNewEmployeeDashboard(store: DataStore, employee: Employee): EmployeeDashboardData {
  const tz = store.salaryConfig.timezone;
  const now = nowInZone(tz);
  const todayKey = getDateKey(now, tz);
  const monthPrefix = formatInTimeZone(now, tz, "yyyy-MM");

  // Build employee-specific salary config
  const empConfig = {
    ...store.salaryConfig,
    defaultMonthlySalaryUsd: employee.monthlySalaryUsd,
    workStartTime: employee.workStartTime,
    workEndTime: employee.workEndTime
  };

  // Get all workdays in current month
  const monthStart = new Date(`${monthPrefix}-01T00:00:00`);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const allDays: string[] = [];
  const cur = new Date(monthStart);
  while (cur <= monthEnd) {
    const dk = getDateKey(cur, tz);
    if (isWorkDay(dk, empConfig, store.holidays)) {
      allDays.push(dk);
    }
    cur.setDate(cur.getDate() + 1);
  }

  const workdays_total = allDays.length;
  const workdays_passed = allDays.filter(dk => dk <= todayKey).length;
  const workdays_remaining = allDays.filter(dk => dk > todayKey).length;

  // Rates — NO rounding (per spec)
  const dayRate = workdays_total > 0 ? employee.monthlySalaryUsd / workdays_total : 0;
  const secondRate = dayRate / (8 * 60 * 60);

  // Month records for this employee
  const monthRecords = store.attendanceRecords
    .filter(r => r.employeeId === employee.id && r.date.startsWith(monthPrefix))
    .sort((a, b) => a.date.localeCompare(b.date));

  const recordMap = new Map(monthRecords.map(r => [r.date, r]));

  // Compute stats
  let on_time = 0;
  let late_days = 0;
  let absent_days = 0;
  let late_seconds_total = 0;

  for (const dk of allDays) {
    if (dk > todayKey) continue; // future workdays not counted yet
    const rec = recordMap.get(dk);
    if (!rec) {
      absent_days++;
    } else if (rec.status === "ABSENT") {
      absent_days++;
    } else if (rec.status === "LATE" || rec.status === "EARLY_LEAVE") {
      late_days++;
      late_seconds_total += rec.lateMinutes * 60;
    } else if (rec.status === "ON_TIME" || rec.status === "FULL_DAY") {
      on_time++;
    }
  }

  // Salary — NO rounding per spec, only format on display
  const absentDeduction = absent_days * dayRate;
  const lateDeduction = late_seconds_total * secondRate;
  const salary_earned = Math.max(0, employee.monthlySalaryUsd - absentDeduction - lateDeduction);
  const salary_deducted = employee.monthlySalaryUsd - salary_earned;
  const salary_projected = Math.min(
    employee.monthlySalaryUsd,
    salary_earned + workdays_remaining * dayRate
  );

  // Daily records (only passed workdays)
  const daily_records: DailyRecord[] = allDays
    .filter(dk => dk <= todayKey)
    .map(dk => {
      const rec = recordMap.get(dk);
      if (!rec) {
        return {
          date: dk,
          status: "absent",
          checkin: null,
          checkout: null,
          worked_seconds: 0,
          late_seconds: 0
        };
      }
      return {
        date: dk,
        status: rec.status.toLowerCase(),
        checkin: rec.checkInTime ? formatInTimeZone(new Date(rec.checkInTime), tz, "HH:mm:ss") : null,
        checkout: rec.checkOutTime ? formatInTimeZone(new Date(rec.checkOutTime), tz, "HH:mm:ss") : null,
        worked_seconds: rec.workedMinutes * 60,
        late_seconds: rec.lateMinutes * 60
      };
    })
    .reverse(); // most recent first

  // Build salary chart data (cumulative per workday)
  let cumEarned = 0;
  const salary_chart: SalaryChartPoint[] = [];
  let projectedIdx = 0;

  for (const dk of allDays) {
    const dayNum = parseInt(dk.split("-")[2], 10);
    const isPast = dk <= todayKey;
    const rec = recordMap.get(dk);

    if (isPast) {
      if (!rec || rec.status === "ABSENT") {
        // absent: no addition
      } else {
        cumEarned += rec.workedMinutes * 60 * secondRate;
      }
      salary_chart.push({
        day: dayNum,
        earned: Math.min(employee.monthlySalaryUsd, Math.max(0, cumEarned)),
        projected: null,
        status: rec ? rec.status.toLowerCase() : "absent"
      });
    } else {
      // future: projection
      projectedIdx++;
      salary_chart.push({
        day: dayNum,
        earned: null,
        projected: Math.min(employee.monthlySalaryUsd, salary_earned + projectedIdx * dayRate),
        status: null
      });
    }
  }

  // Build hours chart data
  const hours_chart: HoursChartPoint[] = allDays
    .filter(dk => dk <= todayKey)
    .map(dk => {
      const dayNum = parseInt(dk.split("-")[2], 10);
      const rec = recordMap.get(dk);
      const hours = rec ? rec.workedMinutes / 60 : 0;
      const status = rec ? rec.status.toLowerCase() : "absent";
      return { day: dayNum, hours: roundCurrency(hours), status };
    });

  const month = `${UZ_MONTHS_DASH[now.getMonth()]} ${now.getFullYear()}`;

  return {
    name: employee.user.fullName,
    month,
    workdays_total,
    workdays_passed,
    workdays_remaining,
    on_time,
    late_days,
    absent_days,
    late_seconds_total,
    salary_base: employee.monthlySalaryUsd,
    salary_earned,
    salary_deducted,
    late_deducted: 0,
    absent_deducted: salary_deducted,
    early_deducted: 0,
    salary_projected,
    day_rate: dayRate,
    second_rate: secondRate,
    daily_records,
    salary_chart,
    hours_chart
  };
}
