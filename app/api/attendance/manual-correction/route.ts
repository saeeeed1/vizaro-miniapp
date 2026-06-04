import { withApi } from "@/lib/api-response";
import { manualCorrection } from "@/lib/repository";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    employeeId?: string;
    date?: string;
    checkInTime?: string | null;
    checkOutTime?: string | null;
    notes?: string | null;
  };
  return withApi(() => manualCorrection(request.headers, body));
}
