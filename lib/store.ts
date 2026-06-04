import type { DataStore } from "@/lib/types";
import { createDemoData } from "@/lib/demo-data";
import { IS_DEMO_MODE, DEFAULT_SALARY_CONFIG } from "@/lib/config";

declare global {
  var __attendanceMiniAppStore: DataStore | undefined;
}

function cloneStore(store: DataStore): DataStore {
  return JSON.parse(JSON.stringify(store)) as DataStore;
}

function createEmptyStore(): DataStore {
  return {
    users: [],
    employees: [],
    attendanceRecords: [],
    penalties: [],
    holidays: [],
    auditLogs: [],
    salaryConfig: { ...DEFAULT_SALARY_CONFIG },
  };
}

export function getStore(): DataStore {
  if (!globalThis.__attendanceMiniAppStore) {
    globalThis.__attendanceMiniAppStore = IS_DEMO_MODE
      ? createDemoData()
      : createEmptyStore();
  }
  return globalThis.__attendanceMiniAppStore;
}

export function resetStore(): DataStore {
  globalThis.__attendanceMiniAppStore = IS_DEMO_MODE
    ? cloneStore(createDemoData())
    : createEmptyStore();
  return globalThis.__attendanceMiniAppStore;
}
