import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subDays } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

import { APP_TIMEZONE, STATUS_LABELS } from "@/lib/config";
import type { AttendanceStatus, PeriodKey } from "@/lib/types";

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatCurrencyUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

export function formatMinutes(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hoursPart = Math.floor(safe / 60);
  const minutesPart = safe % 60;
  return `${hoursPart} soat ${minutesPart} daqiqa`;
}

export function formatHoursCompact(minutes: number): string {
  return `${roundCurrency(minutes / 60)} soat`;
}

export function formatDateLabel(dateLike: string | Date, timeZone = APP_TIMEZONE): string {
  return formatInTimeZone(dateLike, timeZone, "dd MMM yyyy");
}

export function formatTimeLabel(dateLike: string | Date | null, timeZone = APP_TIMEZONE): string | null {
  if (!dateLike) return null;
  return formatInTimeZone(dateLike, timeZone, "HH:mm");
}

export function getDateKey(dateLike: string | Date, timeZone = APP_TIMEZONE): string {
  return formatInTimeZone(dateLike, timeZone, "yyyy-MM-dd");
}

export function getMonthLabel(dateLike: string | Date, timeZone = APP_TIMEZONE): string {
  return formatInTimeZone(dateLike, timeZone, "yyyy MMMM").toUpperCase();
}

export function zonedDateAt(dateKey: string, timeValue: string, timeZone = APP_TIMEZONE): Date {
  return fromZonedTime(`${dateKey}T${timeValue}:00`, timeZone);
}

export function nowInZone(timeZone = APP_TIMEZONE): Date {
  return toZonedTime(new Date(), timeZone);
}

export function statusLabel(status: AttendanceStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function slugifyName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function getPeriodRange(
  period: PeriodKey,
  timeZone = APP_TIMEZONE,
  from?: string,
  to?: string
): { from: string; to: string } {
  const zonedNow = nowInZone(timeZone);

  if (period === "custom" && from && to) {
    return { from, to };
  }

  if (period === "yesterday") {
    const day = subDays(zonedNow, 1);
    const dateKey = getDateKey(day, timeZone);
    return { from: dateKey, to: dateKey };
  }

  if (period === "today") {
    const dateKey = getDateKey(zonedNow, timeZone);
    return { from: dateKey, to: dateKey };
  }

  if (period === "week") {
    const start = startOfWeek(zonedNow, { weekStartsOn: 1 });
    const end = endOfWeek(zonedNow, { weekStartsOn: 1 });
    return { from: getDateKey(start, timeZone), to: getDateKey(end, timeZone) };
  }

  const start = startOfMonth(zonedNow);
  const end = endOfMonth(zonedNow);
  return { from: getDateKey(start, timeZone), to: getDateKey(end, timeZone) };
}

export function asCsv(rows: Array<Array<string | number>>): string {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const stringValue = String(value ?? "");
          if (/[",\n]/.test(stringValue)) {
            return `"${stringValue.replace(/"/g, "\"\"")}"`;
          }
          return stringValue;
        })
        .join(",")
    )
    .join("\n");
}

export function safeParseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function formatNativeDateInput(dateKey: string): string {
  return format(zonedDateAt(dateKey, "00:00"), "yyyy-MM-dd");
}
