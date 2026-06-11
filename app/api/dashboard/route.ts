import { NextResponse } from "next/server";

import { resolveSession } from "@/lib/auth";
import { TELEGRAM_INIT_DATA_HEADER } from "@/lib/config";
import { fail, withApi } from "@/lib/api-response";
import { getEmployeeDashboardData } from "@/lib/repository";

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
      const session = await resolveSession(request.headers);
      const realTelegramId = extractTelegramUserId(request.headers);
      const telegramId = realTelegramId ?? session.user.telegramId;

      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      const res = await fetch(
        `${botApiUrl.replace(/\/$/, "")}/api/dashboard?user_id=${telegramId}&month=${month}`,
        { cache: "no-store", signal: AbortSignal.timeout(8000) }
      );

      if (res.ok) {
        return NextResponse.json(await res.json() as unknown);
      }

      if (res.status === 404) {
        if (realTelegramId) {
          // Foydalanuvchi mavjud emas yoki yozuv yo'q — demo ga tushmaslik uchun
          // bo'sh (nol) dashboard qaytaramiz
          return NextResponse.json({
            name: "",
            month,
            workdays_total: 0, workdays_passed: 0, workdays_remaining: 0,
            on_time: 0, late_days: 0, absent_days: 0, late_seconds_total: 0,
            salary_base: 500, salary_earned: 0, salary_deducted: 0, salary_projected: 0,
            late_deducted: 0, absent_deducted: 0, early_deducted: 0,
            day_rate: 0, second_rate: 0,
            reason_submitted: false, late_reason_submitted: false, early_reason_submitted: false,
            daily_records: [], salary_chart: [], hours_chart: [],
          });
        }
        // Demo/brauzer rejimi — demo data ga o'tamiz
      } else {
        const body = await res.json().catch(() => ({})) as { error?: string };
        return fail(body.error ?? "Bot server xatosi", res.status);
      }
    } catch (err) {
      console.warn("Bot API ulanmadi, demo data ishlatiladi:", err);
    }
  }

  return withApi(() => getEmployeeDashboardData(request.headers));
}
