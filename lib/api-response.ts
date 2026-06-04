import { NextResponse } from "next/server";

import { AuthError } from "@/lib/auth";
import { RepositoryError } from "@/lib/repository";

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 500): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function withApi<T>(handler: () => Promise<T> | T): Promise<NextResponse> {
  try {
    const data = await handler();
    return ok(data);
  } catch (error) {
    if (error instanceof AuthError || error instanceof RepositoryError) {
      return fail(error.message, error.status);
    }

    return fail(error instanceof Error ? error.message : "Unexpected server error.");
  }
}
