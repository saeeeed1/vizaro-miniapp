import { NextResponse } from "next/server";

import { resolveSession } from "@/lib/auth";
import { TELEGRAM_INIT_DATA_HEADER } from "@/lib/config";
import { withApi } from "@/lib/api-response";
import { getSalaryPage } from "@/lib/repository";

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
      const session = await resolveSession(request.headers);
      const realId = extractTelegramUserId(request.headers);
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      const isAdmin = searchParams.get("admin") === "1" || session.user.role === "ADMIN";
      const qp = new URLSearchParams({ month });
      // Non-admin: faqat o'z ma'lumotlari
      if (!isAdmin && realId) qp.set("user_id", realId);

      const res = await fetch(
        `${botApiUrl.replace(/\/$/, "")}/api/salary?${qp.toString()}`,
        { cache: "no-store", signal: AbortSignal.timeout(8000) }
      );
      if (res.ok) return NextResponse.json(await res.json() as unknown);
      if (realId) console.warn("Bot salary xatosi:", res.status);
    } catch (err) {
      console.warn("Bot salary ulanmadi:", err);
    }
  }

  return withApi(() => getSalaryPage(request.headers));
}
