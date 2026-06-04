export type UserRole = "ADMIN" | "EMPLOYEE";

export type AttendanceStatus =
  | "PENDING"
  | "ON_TIME"
  | "LATE"
  | "EARLY_LEAVE"
  | "FULL_DAY"
  | "ABSENT"
  | "OFF_DAY"
  | "SUNDAY";

export type PenaltyType = "LATE" | "EARLY_LEAVE" | "ABSENT" | "MANUAL";

export type AuditAction =
  | "EMPLOYEE_CREATED"
  | "EMPLOYEE_UPDATED"
  | "EMPLOYEE_DELETED"
  | "ATTENDANCE_CREATED"
  | "ATTENDANCE_UPDATED"
  | "ATTENDANCE_CORRECTED"
  | "CHECK_IN"
  | "CHECK_OUT"
  | "SETTINGS_UPDATED";

export type PeriodKey = "today" | "yesterday" | "week" | "month" | "custom";

export interface User {
  id: string;
  telegramId: string;
  fullName: string;
  username: string | null;
  role: UserRole;
  createdAt: string;
}

export interface Employee {
  id: string;
  userId: string;
  position: string;
  monthlySalaryUsd: number;
  workStartTime: string;
  workEndTime: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user: User;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  status: AttendanceStatus;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workedMinutes: number;
  expectedMinutes: number;
  dailyEarned: number;
  dailyPenalty: number;
  netDailyAmount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Penalty {
  id: string;
  employeeId: string;
  attendanceRecordId: string | null;
  type: PenaltyType;
  minutes: number;
  amount: number;
  reason: string | null;
  createdAt: string;
}

export interface SalaryConfig {
  id: string;
  defaultMonthlySalaryUsd: number;
  workStartTime: string;
  workEndTime: string;
  weeklyOffDay: number;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface Holiday {
  id: string;
  date: string;
  title: string;
  isPaid: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorUserId: string | null;
  employeeId: string | null;
  attendanceRecordId: string | null;
  action: AuditAction;
  payload: unknown | null;
  createdAt: string;
}

export interface SessionUser {
  id: string;
  telegramId: string;
  fullName: string;
  username: string | null;
  role: UserRole;
  employeeId: string | null;
  isDemo: boolean;
}

export interface SessionPayload {
  user: SessionUser;
  config: SalaryConfig;
  availableUsers?: Array<Pick<SessionUser, "id" | "fullName" | "role" | "employeeId">>;
}

export interface SummaryCardItem {
  label: string;
  value: string;
  hint?: string;
  trend?: string;
}

export interface ActivityItem {
  id: string;
  title: string;
  subtitle: string;
  amount?: string;
  tone?: "default" | "success" | "warning" | "danger";
}

export interface ChartPoint {
  label: string;
  value: number;
  value2?: number;
  value3?: number;
}

export interface DashboardResponse {
  summary: SummaryCardItem[];
  weeklyAttendance: ChartPoint[];
  monthlyLateChart: ChartPoint[];
  absencePie: ChartPoint[];
  employeeHoursTrend: ChartPoint[];
  salaryBreakdown: ChartPoint[];
  dailyAttendanceTrend: ChartPoint[];
  latestActivity: ActivityItem[];
  quickLists: {
    lateToday: EmployeeInsight[];
    absentToday: EmployeeInsight[];
    onTimeToday: EmployeeInsight[];
    mostLateThisMonth: EmployeeInsight[];
    mostPenalizedThisMonth: EmployeeInsight[];
  };
}

export interface EmployeeInsight {
  employeeId: string;
  fullName: string;
  position: string;
  value: string;
  secondary?: string;
}

export interface TodayAttendanceCard {
  status: AttendanceStatus;
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

export interface AttendancePageResponse {
  today: TodayAttendanceCard;
  records: Array<AttendanceRecord & { employee: Employee }>;
  alerts: string[];
}

export interface EmployeeListItem {
  employee: Employee;
  arrivedDays: number;
  lateDays: number;
  absentDays: number;
  workedMinutes: number;
  totalPenalty: number;
  netSalary: number;
  statusToday: AttendanceStatus;
}

export interface EmployeeDetailResponse {
  employee: Employee;
  today: TodayAttendanceCard;
  stats: {
    arrivedDays: number;
    lateDays: number;
    absentDays: number;
    workedMinutes: number;
    overtimeMinutes: number;
    totalPenalty: number;
    totalEarned: number;
    netSalary: number;
  };
  attendance: AttendanceRecord[];
  penalties: Penalty[];
  auditLogs: AuditLog[];
}

export interface ReportsResponse {
  summary: SummaryCardItem[];
  rows: Array<AttendanceRecord & { employee: Employee }>;
}

export interface SalaryPageResponse {
  summary: SummaryCardItem[];
  rows: Array<{
    employee: Employee;
    totalWorkedMinutes: number;
    totalOvertimeMinutes: number;
    totalPenalty: number;
    totalEarned: number;
    netSalary: number;
  }>;
}

export interface SettingsResponse {
  config: SalaryConfig;
  note: string;
}

export interface CheckActionPayload {
  timestamp?: string;
}

export interface ManualCorrectionPayload {
  date?: string;
  employeeId?: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  notes?: string | null;
}

export interface EmployeeUpsertPayload {
  fullName: string;
  username?: string | null;
  telegramId: string;
  role?: UserRole;
  position: string;
  monthlySalaryUsd: number;
  workStartTime: string;
  workEndTime: string;
  isActive?: boolean;
}

export interface SettingsUpdatePayload {
  defaultMonthlySalaryUsd: number;
  workStartTime: string;
  workEndTime: string;
  weeklyOffDay: number;
  timezone: string;
}

export interface DataStore {
  users: User[];
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  penalties: Penalty[];
  holidays: Holiday[];
  auditLogs: AuditLog[];
  salaryConfig: SalaryConfig;
}

export interface DailyRecord {
  date: string;
  status: string;
  checkin: string | null;
  checkout: string | null;
  worked_seconds: number;
  late_seconds: number;
}

export interface SalaryChartPoint {
  day: number;
  earned: number | null;
  projected: number | null;
  status: string | null;
}

export interface HoursChartPoint {
  day: number;
  hours: number;
  status: string;
}

export interface EmployeeDashboardData {
  name: string;
  month: string;
  workdays_total: number;
  workdays_passed: number;
  workdays_remaining: number;
  on_time: number;
  late_days: number;
  absent_days: number;
  late_seconds_total: number;
  salary_base: number;
  salary_earned: number;
  salary_deducted: number;
  salary_projected: number;
  day_rate: number;
  second_rate: number;
  daily_records: DailyRecord[];
  salary_chart: SalaryChartPoint[];
  hours_chart: HoursChartPoint[];
}
