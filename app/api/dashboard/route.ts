import { NextResponse } from "next/server";

import { resolveSession } from "@/lib/auth";
import { TELEGRAM_INIT_DATA_HEADER } from "@/lib/config";
import { fail, withApi } from "@/lib/api-response";
import { getEmployeeDashboardData } from "@/lib/repository";

/** x-telegram-init-data headerdan real Telegram user.id ni parse qiladi. */
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

  if (botApiUrl) {
    try {
      const session = resolveSession(request.headers);

      // Birinchi navbatda initData dan real Telegram ID ni olamiz —
      // demo mode yoki token xatosida ham ishlaydi
      const telegramId =
        extractTelegramUserId(request.headers) ?? session.user.telegramId;

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

      // 404 = foydalanuvchi yozuvi yo'q → demo ga o'tamiz
      if (res.status !== 404) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        return fail(body.error ?? "Bot server xatosi", res.status);
      }
    } catch (err) {
      console.warn("Bot API ulanmadi, demo data ishlatiladi:", err);
    }
  }

  return withApi(() => getEmployeeDashboardData(request.headers));
}
