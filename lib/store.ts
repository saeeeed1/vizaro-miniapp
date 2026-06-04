import type { DataStore } from "@/lib/types";
import { createDemoData } from "@/lib/demo-data";

declare global {
  var __attendanceMiniAppStore: DataStore | undefined;
}

function cloneStore(store: DataStore): DataStore {
  return JSON.parse(JSON.stringify(store)) as DataStore;
}

export function getStore(): DataStore {
  if (!globalThis.__attendanceMiniAppStore) {
    globalThis.__attendanceMiniAppStore = createDemoData();
  }
  return globalThis.__attendanceMiniAppStore;
}

export function resetStore(): DataStore {
  globalThis.__attendanceMiniAppStore = cloneStore(createDemoData());
  return globalThis.__attendanceMiniAppStore;
}
