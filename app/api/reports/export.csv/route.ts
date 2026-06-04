import { exportReportsCsv } from "@/lib/repository";
import { AuthError } from "@/lib/auth";
import { RepositoryError } from "@/lib/repository";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const csv = exportReportsCsv(request.headers, {
      period: (searchParams.get("period") as "today" | "yesterday" | "week" | "month" | "custom" | null) ?? "month",
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      employeeId: searchParams.get("employeeId") ?? undefined
    });

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"attendance-report.csv\""
      }
    });
  } catch (error) {
    const status = error instanceof AuthError || error instanceof RepositoryError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return new Response(message, { status });
  }
}
