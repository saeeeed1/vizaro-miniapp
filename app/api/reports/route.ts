import { withApi } from "@/lib/api-response";
import { getReports } from "@/lib/repository";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return withApi(() =>
    getReports(request.headers, {
      period: (searchParams.get("period") as "today" | "yesterday" | "week" | "month" | "custom" | null) ?? "month",
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      employeeId: searchParams.get("employeeId") ?? undefined
    })
  );
}
