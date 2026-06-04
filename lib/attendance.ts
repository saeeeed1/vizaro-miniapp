import {
  addDays,
  differenceInMinutes,
  eachDayOfInterval,
  endOfMonth,
  getDay,
  isAfter,
  isBefore,
  isSameDay,
  startOfMonth
} from "date-fns";
import { toZonedTime } from "date-fns-tz";

import type {
  AttendanceRecord,
  AttendanceStatus,
  Holiday,
  Penalty,
  PenaltyType,
  SalaryConfig
} from "@/lib/types";
import { getDateKey, roundCurrency, zonedDateAt } from "@/lib/utils";

export interface SalaryRates {
  workingDays: number;
  dailyRate: number;
  hourlyRate: number;
  minuteRate: number;
}

export interface AttendanceComputation {
  status: AttendanceStatus;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workedMinutes: number;
  expectedMinutes: number;
  overtimeMinutes: number;
  dailyEarned: number;
  dailyPenalty: number;
  netDailyAmount: number;
  penalties: Array<{
    type: PenaltyType;
    minutes: number;
    amount: number;
    reason: string;
  }>;
}

export function getExpectedMinutes(config: SalaryConfig): number {
  const sampleDay = "2026-01-05";
  return Math.max(
    0,
    differenceInMinutes(
      zonedDateAt(sampleDay, config.workEndTime, config.timezone),
      zonedDateAt(sampleDay, config.workStartTime, config.timezone)
    )
  );
}

export function isHoliday(dateKey: string, holidays: Holiday[], timeZone = "Asia/Tashkent"): boolean {
  return holidays.some((holiday) => getDateKey(holiday.date, timeZone) === dateKey);
}

export function isWeeklyOffDay(dateKey: string, config: SalaryConfig): boolean {
  const localDate = toZonedTime(zonedDateAt(dateKey, "00:00", config.timezone), config.timezone);
  return getDay(localDate) === config.weeklyOffDay;
}

export function isWorkDay(dateKey: string, config: SalaryConfig, holidays: Holiday[] = []): boolean {
  return !isWeeklyOffDay(dateKey, config) && !isHoliday(dateKey, holidays, config.timezone);
}

export function getSalaryRates(dateKey: string, config: SalaryConfig, holidays: Holiday[] = []): SalaryRates {
  const monthStart = startOfMonth(zonedDateAt(dateKey, "00:00", config.timezone));
  const monthEnd = endOfMonth(monthStart);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const workingDays = days.filter((day) => isWorkDay(getDateKey(day, config.timezone), config, holidays)).length;
  const dailyRate = workingDays > 0 ? config.defaultMonthlySalaryUsd / workingDays : 0;
  const hourlyRate = getExpectedMinutes(config) > 0 ? dailyRate / (getExpectedMinutes(config) / 60) : 0;
  return {
    workingDays,
    dailyRate: roundCurrency(dailyRate),
    hourlyRate: roundCurrency(hourlyRate),
    minuteRate: roundCurrency(hourlyRate / 60)
  };
}

export function deriveAttendanceStatus(input: {
  dateKey: string;
  config: SalaryConfig;
  holidays?: Holiday[];
  checkInTime: string | null;
  checkOutTime: string | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workedMinutes: number;
  expectedMinutes: number;
}): AttendanceStatus {
  const { dateKey, config, holidays = [], checkInTime, checkOutTime, lateMinutes, earlyLeaveMinutes, workedMinutes, expectedMinutes } = input;

  if (isWeeklyOffDay(dateKey, config)) {
    return "SUNDAY";
  }

  if (isHoliday(dateKey, holidays, config.timezone)) {
    return "OFF_DAY";
  }

  if (!checkInTime) {
    return "ABSENT";
  }

  if (checkInTime && !checkOutTime) {
    return lateMinutes > 0 ? "LATE" : "ON_TIME";
  }

  if (earlyLeaveMinutes > 0) {
    return "EARLY_LEAVE";
  }

  if (lateMinutes > 0) {
    return "LATE";
  }

  if (workedMinutes >= expectedMinutes) {
    return "FULL_DAY";
  }

  return "ON_TIME";
}

export function computeAttendance(params: {
  dateKey: string;
  config: SalaryConfig;
  holidays?: Holiday[];
  checkInTime: string | null;
  checkOutTime: string | null;
}): AttendanceComputation {
  const { dateKey, config, holidays = [], checkInTime, checkOutTime } = params;
  const expectedMinutes = getExpectedMinutes(config);
  const workStart = zonedDateAt(dateKey, config.workStartTime, config.timezone);
  const workEnd = zonedDateAt(dateKey, config.workEndTime, config.timezone);
  const checkIn = checkInTime ? new Date(checkInTime) : null;
  const checkOut = checkOutTime ? new Date(checkOutTime) : null;
  const rates = getSalaryRates(dateKey, config, holidays);

  const lateMinutes = checkIn ? Math.max(0, differenceInMinutes(checkIn, workStart)) : 0;
  const earlyLeaveMinutes = checkOut ? Math.max(0, differenceInMinutes(workEnd, checkOut)) : 0;
  const workedMinutes =
    checkIn && checkOut && !isBefore(checkOut, checkIn) ? Math.max(0, differenceInMinutes(checkOut, checkIn)) : 0;
  const overtimeMinutes = checkOut && isAfter(checkOut, workEnd) ? differenceInMinutes(checkOut, workEnd) : 0;
  const isAbsent = !checkIn && isWorkDay(dateKey, config, holidays);

  const penalties: AttendanceComputation["penalties"] = [];
  let penalty = 0;

  if (lateMinutes > 0) {
    const amount = roundCurrency(lateMinutes * rates.minuteRate);
    penalty += amount;
    penalties.push({
      type: "LATE",
      minutes: lateMinutes,
      amount,
      reason: `${lateMinutes} minut kechikish`
    });
  }

  if (earlyLeaveMinutes > 0) {
    const amount = roundCurrency(earlyLeaveMinutes * rates.minuteRate);
    penalty += amount;
    penalties.push({
      type: "EARLY_LEAVE",
      minutes: earlyLeaveMinutes,
      amount,
      reason: `${earlyLeaveMinutes} minut erta ketish`
    });
  }

  if (isAbsent) {
    penalty += rates.dailyRate;
    penalties.push({
      type: "ABSENT",
      minutes: expectedMinutes,
      amount: rates.dailyRate,
      reason: "Ish kunida umuman kelmadi"
    });
  }

  const earned = roundCurrency((workedMinutes / 60) * rates.hourlyRate);
  const dailyPenalty = roundCurrency(penalty);
  const netDailyAmount = roundCurrency(earned - dailyPenalty);
  const status = deriveAttendanceStatus({
    dateKey,
    config,
    holidays,
    checkInTime,
    checkOutTime,
    lateMinutes,
    earlyLeaveMinutes,
    workedMinutes,
    expectedMinutes
  });

  return {
    status,
    lateMinutes,
    earlyLeaveMinutes,
    workedMinutes,
    expectedMinutes,
    overtimeMinutes,
    dailyEarned: earned,
    dailyPenalty,
    netDailyAmount,
    penalties
  };
}

export function rebuildRecord(
  record: AttendanceRecord,
  config: SalaryConfig,
  holidays: Holiday[] = []
): AttendanceRecord & { overtimeMinutes: number; penalties: Penalty[] } {
  const computed = computeAttendance({
    dateKey: record.date,
    config,
    holidays,
    checkInTime: record.checkInTime,
    checkOutTime: record.checkOutTime
  });

  return {
    ...record,
    status: computed.status,
    lateMinutes: computed.lateMinutes,
    earlyLeaveMinutes: computed.earlyLeaveMinutes,
    workedMinutes: computed.workedMinutes,
    expectedMinutes: computed.expectedMinutes,
    dailyEarned: computed.dailyEarned,
    dailyPenalty: computed.dailyPenalty,
    netDailyAmount: computed.netDailyAmount,
    penalties: computed.penalties.map((penalty) => ({
      id: `${record.id}_${penalty.type.toLowerCase()}`,
      employeeId: record.employeeId,
      attendanceRecordId: record.id,
      type: penalty.type,
      minutes: penalty.minutes,
      amount: penalty.amount,
      reason: penalty.reason,
      createdAt: record.updatedAt
    })),
    overtimeMinutes: computed.overtimeMinutes
  };
}

export function summarizeRecords(
  records: AttendanceRecord[],
  config: SalaryConfig,
  holidays: Holiday[] = []
): {
  totalWorkedMinutes: number;
  totalOvertimeMinutes: number;
  totalPenalty: number;
  totalEarned: number;
  netSalary: number;
  arrivedDays: number;
  lateDays: number;
  absentDays: number;
} {
  return records.reduce(
    (acc, record) => {
      const rebuilt = rebuildRecord(record, config, holidays);
      const isArrived = Boolean(record.checkInTime);
      return {
        totalWorkedMinutes: acc.totalWorkedMinutes + rebuilt.workedMinutes,
        totalOvertimeMinutes: acc.totalOvertimeMinutes + rebuilt.overtimeMinutes,
        totalPenalty: roundCurrency(acc.totalPenalty + rebuilt.dailyPenalty),
        totalEarned: roundCurrency(acc.totalEarned + rebuilt.dailyEarned),
        netSalary: roundCurrency(acc.netSalary + rebuilt.netDailyAmount),
        arrivedDays: acc.arrivedDays + (isArrived ? 1 : 0),
        lateDays: acc.lateDays + (rebuilt.lateMinutes > 0 ? 1 : 0),
        absentDays: acc.absentDays + (rebuilt.status === "ABSENT" ? 1 : 0)
      };
    },
    {
      totalWorkedMinutes: 0,
      totalOvertimeMinutes: 0,
      totalPenalty: 0,
      totalEarned: 0,
      netSalary: 0,
      arrivedDays: 0,
      lateDays: 0,
      absentDays: 0
    }
  );
}

export function ensureMonthlyDates(
  targetDate: Date,
  config: SalaryConfig,
  holidays: Holiday[] = []
): string[] {
  const monthStart = startOfMonth(targetDate);
  const monthEnd = endOfMonth(targetDate);
  return eachDayOfInterval({ start: monthStart, end: monthEnd })
    .map((day) => getDateKey(day, config.timezone))
    .filter((dateKey) => isWorkDay(dateKey, config, holidays));
}

export function isTodayRecord(record: AttendanceRecord, config: SalaryConfig): boolean {
  const now = toZonedTime(new Date(), config.timezone);
  return isSameDay(zonedDateAt(record.date, "00:00", config.timezone), now);
}

export function getRecentWorkingDateKeys(config: SalaryConfig, count = 7): string[] {
  const now = toZonedTime(new Date(), config.timezone);
  const result: string[] = [];
  let cursor = now;
  while (result.length < count) {
    const dateKey = getDateKey(cursor, config.timezone);
    if (isWorkDay(dateKey, config)) {
      result.unshift(dateKey);
    }
    cursor = addDays(cursor, -1);
  }
  return result;
}
