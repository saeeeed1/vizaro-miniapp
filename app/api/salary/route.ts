import { withApi } from "@/lib/api-response";
import { getSalaryPage } from "@/lib/repository";

export async function GET(request: Request) {
  return withApi(() => getSalaryPage(request.headers));
}
