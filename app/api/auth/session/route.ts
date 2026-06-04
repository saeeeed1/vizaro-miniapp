import { withApi } from "@/lib/api-response";
import { getSession } from "@/lib/repository";

export async function GET(request: Request) {
  return withApi(() => getSession(request.headers));
}
