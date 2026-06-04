import { withApi } from "@/lib/api-response";
import { checkIn } from "@/lib/repository";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { timestamp?: string };
  return withApi(() => checkIn(request.headers, body.timestamp));
}
