import { NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const botApiUrl = process.env.BOT_API_URL;
  const { id } = await params;

  try {
    resolveSession(request.headers);
    const body = await request.json() as { monthly_salary: number };

    if (botApiUrl) {
      const res = await fetch(
        `${botApiUrl.replace(/\/$/, "")}/api/employees/${id}/salary`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ monthly_salary: body.monthly_salary }),
          signal: AbortSignal.timeout(5000),
        }
      );
      if (res.ok) return NextResponse.json(await res.json() as unknown);
      const err = await res.json().catch(() => ({})) as { error?: string };
      return NextResponse.json({ error: err.error ?? "Bot server xatosi" }, { status: res.status });
    }

    return NextResponse.json({ error: "BOT_API_URL sozlanmagan" }, { status: 503 });
  } catch {
    return NextResponse.json({ error: "Sessiya topilmadi." }, { status: 401 });
  }
}
