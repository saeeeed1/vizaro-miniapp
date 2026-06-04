import { withApi } from "@/lib/api-response";
import { getEmployeeDashboardData } from "@/lib/repository";

export async function GET(request: Request) {
  return withApi(() => getEmployeeDashboardData(request.headers));
}
