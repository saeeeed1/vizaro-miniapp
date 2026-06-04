import { NextResponse } from "next/server";

import { resolveSession } from "@/lib/auth";
import { fail, withApi } from "@/lib/api-response";
import { getEmployeeDashboardData } from "@/lib/repository";

export async function GET(request: Request) {
  const botApiUrl = process.env.BOT_API_URL;

  // Bot server API mavjud bo'lsa — real SQLite data
  if (botApiUrl) {
    try {
      const session = resolveSession(request.headers);
      const telegramId = session.user.telegramId;
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      const res = await fetch(
        `${botApiUrl.replace(/\/$/, "")}/api/dashboard?user_id=${telegramId}&month=${month}`,
        { cache: "no-store", signal: AbortSignal.timeout(8000) }
      );

      if (res.ok) {
        const data = await res.json() as unknown;
        return NextResponse.json(data);
      }

      if (res.status !== 404) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        return fail(body.error ?? "Bot server xatosi", res.status);
      }
    } catch (err) {
      console.warn("Bot API ulanmadi, demo data ishlatiladi:", err);
    }
  }

  // Fallback: in-memory demo data
  return withApi(() => getEmployeeDashboardData(request.headers));
}
