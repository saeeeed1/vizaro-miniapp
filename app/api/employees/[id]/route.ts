import { withApi } from "@/lib/api-response";
import { deleteEmployee, getEmployeeDetail, updateEmployee } from "@/lib/repository";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return withApi(() => getEmployeeDetail(request.headers, id));
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  return withApi(() => updateEmployee(request.headers, id, body));
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return withApi(() => deleteEmployee(request.headers, id));
}
