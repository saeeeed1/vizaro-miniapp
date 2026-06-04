import { withApi } from "@/lib/api-response";
import { getSettings, updateSettings } from "@/lib/repository";

export async function GET(request: Request) {
  return withApi(() => getSettings(request.headers));
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    defaultMonthlySalaryUsd: number;
    workStartTime: string;
    workEndTime: string;
    weeklyOffDay: number;
    timezone: string;
  };
  return withApi(() => updateSettings(request.headers, body));
}
