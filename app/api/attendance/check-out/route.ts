import { withApi } from "@/lib/api-response";
import { checkOut } from "@/lib/repository";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { timestamp?: string };
  return withApi(() => checkOut(request.headers, body.timestamp));
}
