import { NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth";
import { fail } from "@/lib/api-response";

export async function GET(request: Request) {
  const botApiUrl = process.env.BOT_API_URL;
  try {
    await resolveSession(request.headers);
    if (botApiUrl) {
      const res = await fetch(
        `${botApiUrl.replace(/\/$/, "")}/api/today`,
        { cache: "no-store", signal: AbortSignal.timeout(8000) }
      );
      if (res.ok) return NextResponse.json(await res.json() as unknown);
    }
    // Demo fallback
    return NextResponse.json({
      date: new Date().toISOString().split("T")[0],
      summary: { total: 0, present: 0, late: 0, absent: 0, not_marked: 0 },
      employees: [],
      week_chart: [],
    });
  } catch {
    return fail("Sessiya topilmadi.", 401);
  }
}
