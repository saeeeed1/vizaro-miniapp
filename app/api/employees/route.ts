import { withApi } from "@/lib/api-response";
import { createEmployee, getEmployees } from "@/lib/repository";

export async function GET(request: Request) {
  return withApi(() => getEmployees(request.headers));
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    fullName: string;
    username?: string | null;
    telegramId: string;
    role?: "ADMIN" | "EMPLOYEE";
    position: string;
    monthlySalaryUsd: number;
    workStartTime: string;
    workEndTime: string;
    isActive?: boolean;
  };
  return withApi(() => createEmployee(request.headers, body));
}
