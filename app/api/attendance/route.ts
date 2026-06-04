import { NextResponse } from "next/server";

import { resolveSession } from "@/lib/auth";
import { TELEGRAM_INIT_DATA_HEADER } from "@/lib/config";
import { withApi } from "@/lib/api-response";
import { getAttendancePage } from "@/lib/repository";

function extractTelegramUserId(headers: Headers): string | null {
  const initData = headers.get(TELEGRAM_INIT_DATA_HEADER);
  if (!initData) return null;
  try {
    const params = new URLSearchParams(initData);
    const userParam = params.get("user");
    if (!userParam) return null;
    const tgUser = JSON.parse(userParam) as { id?: number | string };
    return tgUser.id ? String(tgUser.id) : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const botApiUrl = process.env.BOT_API_URL;
  const { searchParams } = new URL(request.url);

  if (botApiUrl) {
    try {
      resolveSession(request.headers);
      const realId = extractTelegramUserId(request.headers);
      const period = searchParams.get("period") ?? "month";
      const from = searchParams.get("from") ?? "";
      const to = searchParams.get("to") ?? "";

      const qp = new URLSearchParams({ period });
      if (from) qp.set("from", from);
      if (to) qp.set("to", to);

      const res = await fetch(
        `${botApiUrl.replace(/\/$/, "")}/api/attendance?${qp.toString()}`,
        { cache: "no-store", signal: AbortSignal.timeout(8000) }
      );
      if (res.ok) {
        return NextResponse.json(await res.json() as unknown);
      }
      if (realId) console.warn("Bot attendance xatosi:", res.status);
    } catch (err) {
      console.warn("Bot attendance ulanmadi:", err);
    }
  }

  return withApi(() =>
    getAttendancePage(request.headers, {
      period: (searchParams.get("period") as "today" | "yesterday" | "week" | "month" | "custom" | null) ?? "month",
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      employeeId: searchParams.get("employeeId") ?? undefined,
    })
  );
}
