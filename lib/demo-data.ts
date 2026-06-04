import { eachDayOfInterval, endOfMonth, startOfMonth, subDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import { computeAttendance, isWorkDay, rebuildRecord } from "@/lib/attendance";
import { DEFAULT_SALARY_CONFIG } from "@/lib/config";
import type {
  AttendanceRecord,
  AuditLog,
  DataStore,
  Employee,
  Holiday,
  Penalty,
  SalaryConfig,
  User
} from "@/lib/types";
import { getDateKey, uid, zonedDateAt } from "@/lib/utils";

function buildUser(input: {
  id: string;
  telegramId: string;
  fullName: string;
  username: string | null;
  role: "ADMIN" | "EMPLOYEE";
}): User {
  return {
    ...input,
    createdAt: new Date().toISOString()
  };
}

function buildEmployee(input: {
  id: string;
  userId: string;
  position: string;
  monthlySalaryUsd: number;
  workStartTime: string;
  workEndTime: string;
  isActive?: boolean;
}) {
  const timestamp = new Date().toISOString();
  return {
    ...input,
    isActive: input.isActive ?? true,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function createAttendanceRecord(params: {
  employeeId: string;
  dateKey: string;
  config: SalaryConfig;
  holidays: Holiday[];
  checkInClock?: string | null;
  checkOutClock?: string | null;
  notes?: string | null;
  createdAt?: string;
}): AttendanceRecord & { penalties: Penalty[] } {
  const checkInTime = params.checkInClock
    ? zonedDateAt(params.dateKey, params.checkInClock, params.config.timezone).toISOString()
    : null;
  const checkOutTime = params.checkOutClock
    ? zonedDateAt(params.dateKey, params.checkOutClock, params.config.timezone).toISOString()
    : null;

  const computed = computeAttendance({
    dateKey: params.dateKey,
    config: params.config,
    holidays: params.holidays,
    checkInTime,
    checkOutTime
  });

  const createdAt =
    params.createdAt ??
    checkOutTime ??
    checkInTime ??
    zonedDateAt(params.dateKey, params.config.workEndTime, params.config.timezone).toISOString();

  const record: AttendanceRecord = {
    id: uid("att"),
    employeeId: params.employeeId,
    date: params.dateKey,
    checkInTime,
    checkOutTime,
    status: computed.status,
    lateMinutes: computed.lateMinutes,
    earlyLeaveMinutes: computed.earlyLeaveMinutes,
    workedMinutes: computed.workedMinutes,
    expectedMinutes: computed.expectedMinutes,
    dailyEarned: computed.dailyEarned,
    dailyPenalty: computed.dailyPenalty,
    netDailyAmount: computed.netDailyAmount,
    notes: params.notes ?? null,
    createdAt,
    updatedAt: createdAt
  };

  const hydrated = rebuildRecord(record, params.config, params.holidays);

  return {
    ...record,
    status: hydrated.status,
    lateMinutes: hydrated.lateMinutes,
    earlyLeaveMinutes: hydrated.earlyLeaveMinutes,
    workedMinutes: hydrated.workedMinutes,
    expectedMinutes: hydrated.expectedMinutes,
    dailyEarned: hydrated.dailyEarned,
    dailyPenalty: hydrated.dailyPenalty,
    netDailyAmount: hydrated.netDailyAmount,
    penalties: hydrated.penalties
  };
}

function buildAuditLog(input: Omit<AuditLog, "id" | "createdAt">): AuditLog {
  return {
    id: uid("audit"),
    createdAt: new Date().toISOString(),
    ...input
  };
}

export function createDemoData(now = new Date()): DataStore {
  const config: SalaryConfig = {
    ...DEFAULT_SALARY_CONFIG,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
  const zonedNow = toZonedTime(now, config.timezone);
  const todayKey = getDateKey(zonedNow, config.timezone);
  const currentHour = Number(new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hour12: false,
    timeZone: config.timezone
  }).format(now));

  const users: User[] = [
    buildUser({
      id: "user_admin_1",
      telegramId: "10001",
      fullName: "Aziza Karimova",
      username: "aziza_admin",
      role: "ADMIN"
    }),
    buildUser({
      id: "user_emp_1",
      telegramId: "10011",
      fullName: "Muhammad Xasanov",
      username: "muhammadx",
      role: "EMPLOYEE"
    }),
    buildUser({
      id: "user_emp_2",
      telegramId: "10012",
      fullName: "Ismoil Ergashev",
      username: "ismoile",
      role: "EMPLOYEE"
    }),
    buildUser({
      id: "user_emp_3",
      telegramId: "10013",
      fullName: "Madina Raximova",
      username: "madinar",
      role: "EMPLOYEE"
    }),
    buildUser({
      id: "user_emp_4",
      telegramId: "10014",
      fullName: "Sardor Aliyev",
      username: "sardora",
      role: "EMPLOYEE"
    }),
    buildUser({
      id: "user_emp_5",
      telegramId: "10015",
      fullName: "Dilnoza Qodirova",
      username: "dilnozaq",
      role: "EMPLOYEE"
    })
  ];

  const baseEmployees = [
    buildEmployee({
      id: "emp_1",
      userId: "user_emp_1",
      position: "Frontend Developer",
      monthlySalaryUsd: 500,
      workStartTime: "10:00",
      workEndTime: "18:00"
    }),
    buildEmployee({
      id: "emp_2",
      userId: "user_emp_2",
      position: "Sales Manager",
      monthlySalaryUsd: 500,
      workStartTime: "10:00",
      workEndTime: "18:00"
    }),
    buildEmployee({
      id: "emp_3",
      userId: "user_emp_3",
      position: "Designer",
      monthlySalaryUsd: 520,
      workStartTime: "10:00",
      workEndTime: "18:00"
    }),
    buildEmployee({
      id: "emp_4",
      userId: "user_emp_4",
      position: "Accountant",
      monthlySalaryUsd: 480,
      workStartTime: "10:00",
      workEndTime: "18:00"
    }),
    buildEmployee({
      id: "emp_5",
      userId: "user_emp_5",
      position: "HR Specialist",
      monthlySalaryUsd: 500,
      workStartTime: "10:00",
      workEndTime: "18:00"
    })
  ];

  const employees = baseEmployees.map((employee) => ({
    ...employee,
    user: users.find((user) => user.id === employee.userId)!
  }));

  const potentialHoliday = getDateKey(subDays(endOfMonth(zonedNow), 3), config.timezone);
  const holidays: Holiday[] = [
    {
      id: "holiday_1",
      date: zonedDateAt(potentialHoliday, "00:00", config.timezone).toISOString(),
      title: "Office Planning Day",
      isPaid: true,
      createdAt: now.toISOString()
    }
  ];

  const days = eachDayOfInterval({ start: startOfMonth(zonedNow), end: zonedNow });
  const attendanceRecords: AttendanceRecord[] = [];
  const penalties: Penalty[] = [];
  const auditLogs: AuditLog[] = [];

  const patterns: Record<string, (dayIndex: number, dateKey: string) => { checkIn?: string | null; checkOut?: string | null; notes?: string | null }> = {
    emp_1: (dayIndex, dateKey) => {
      if (dateKey === todayKey) {
        return currentHour >= 18 ? { checkIn: "09:59", checkOut: "18:22" } : { checkIn: "10:03", checkOut: null };
      }
      if (dayIndex % 7 === 0) return { checkIn: "10:12", checkOut: "18:14" };
      if (dayIndex % 5 === 0) return { checkIn: "09:55", checkOut: "18:25" };
      return { checkIn: "09:58", checkOut: "18:08" };
    },
    emp_2: (dayIndex, dateKey) => {
      if (dateKey === todayKey) {
        return {};
      }
      if (dayIndex % 6 === 0) return {};
      if (dayIndex % 4 === 0) return { checkIn: "10:24", checkOut: "17:32" };
      return { checkIn: "10:08", checkOut: "18:02" };
    },
    emp_3: (dayIndex, dateKey) => {
      if (dateKey === todayKey) {
        return currentHour >= 18 ? { checkIn: "09:57", checkOut: "17:54" } : { checkIn: "09:56", checkOut: null };
      }
      if (dayIndex % 8 === 0) return { checkIn: "09:59", checkOut: "17:40" };
      return { checkIn: "09:54", checkOut: "18:06" };
    },
    emp_4: (dayIndex, dateKey) => {
      if (dateKey === todayKey) {
        return { checkIn: "10:17", checkOut: null, notes: "Checkout pending for admin alert." };
      }
      if (dayIndex % 9 === 0) return { checkIn: "10:18", checkOut: null, notes: "Manual correction required." };
      if (dayIndex % 5 === 0) return { checkIn: "10:11", checkOut: "17:50" };
      return { checkIn: "10:01", checkOut: "18:03" };
    },
    emp_5: (dayIndex, dateKey) => {
      if (dateKey === todayKey) {
        return currentHour >= 18 ? { checkIn: "10:00", checkOut: "18:11" } : { checkIn: "10:00", checkOut: null };
      }
      if (dayIndex % 10 === 0) return {};
      if (dayIndex % 3 === 0) return { checkIn: "10:05", checkOut: "18:18" };
      return { checkIn: "09:59", checkOut: "18:00" };
    }
  };

  let workdayIndex = 0;
  for (const day of days) {
    const dateKey = getDateKey(day, config.timezone);
    if (!isWorkDay(dateKey, config, holidays)) {
      continue;
    }

    workdayIndex += 1;
    for (const employee of employees) {
      const pattern = patterns[employee.id];
      const created = createAttendanceRecord({
        employeeId: employee.id,
        dateKey,
        config: {
          ...config,
          defaultMonthlySalaryUsd: employee.monthlySalaryUsd
        },
        holidays,
        checkInClock: pattern(workdayIndex, dateKey).checkIn ?? null,
        checkOutClock: pattern(workdayIndex, dateKey).checkOut ?? null,
        notes: pattern(workdayIndex, dateKey).notes ?? null
      });
      const { penalties: recordPenalties, ...attendanceRecord } = created;
      attendanceRecords.push(attendanceRecord);
      penalties.push(...recordPenalties);
      auditLogs.push(
        buildAuditLog({
          actorUserId: employee.userId,
          employeeId: employee.id,
          attendanceRecordId: created.id,
          action: created.checkInTime ? "CHECK_IN" : "ATTENDANCE_CREATED",
          payload: {
            date: created.date,
            checkInTime: created.checkInTime,
            checkOutTime: created.checkOutTime,
            status: created.status
          }
        })
      );
    }
  }

  for (const employee of employees) {
    auditLogs.push(
      buildAuditLog({
        actorUserId: "user_admin_1",
        employeeId: employee.id,
        attendanceRecordId: null,
        action: "EMPLOYEE_CREATED",
        payload: {
          fullName: employee.user.fullName,
          position: employee.position,
          monthlySalaryUsd: employee.monthlySalaryUsd
        }
      })
    );
  }

  return {
    users,
    employees,
    attendanceRecords,
    penalties,
    holidays,
    auditLogs,
    salaryConfig: config
  };
}
