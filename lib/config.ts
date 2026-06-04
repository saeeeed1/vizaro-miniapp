import type { SalaryConfig } from "@/lib/types";

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Davomat Mini App";
export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE ?? "Asia/Tashkent";
export const IS_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";
export const DEMO_USER_HEADER = "x-demo-user-id";
export const TELEGRAM_INIT_DATA_HEADER = "x-telegram-init-data";

export const DEFAULT_SALARY_CONFIG: SalaryConfig = {
  id: "salary_default",
  defaultMonthlySalaryUsd: 500,
  workStartTime: "10:00",
  workEndTime: "18:00",
  weeklyOffDay: 0,
  timezone: APP_TIMEZONE,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

export const STATUS_LABELS: Record<string, string> = {
  PENDING: "Kutilmoqda",
  ON_TIME: "Vaqtida kelgan",
  LATE: "Kech kelgan",
  EARLY_LEAVE: "Erta ketgan",
  FULL_DAY: "To'liq ishlagan",
  ABSENT: "Kelmagan",
  OFF_DAY: "Dam olish kuni",
  SUNDAY: "Yakshanba"
};

export const STATUS_TONES: Record<string, "default" | "success" | "warning" | "danger"> = {
  PENDING: "default",
  ON_TIME: "success",
  LATE: "warning",
  EARLY_LEAVE: "warning",
  FULL_DAY: "success",
  ABSENT: "danger",
  OFF_DAY: "default",
  SUNDAY: "default"
};
