import { NextResponse } from "next/server";

import { resolveSession } from "@/lib/auth";
import { botHeaders } from "@/lib/bot-api";
import { TELEGRAM_INIT_DATA_HEADER } from "@/lib/config";

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

export async function POST(request: Request) {
  const botApiUrl = process.env.BOT_API_URL;
  if (!botApiUrl) {
    return NextResponse.json({ ok: false, reason: "no_backend" }, { status: 503 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { month?: string };
    const month = String(body.month ?? "").trim();
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
    }

    const session = await resolveSession(request.headers);
    const telegramId = extractTelegramUserId(request.headers) ?? session.user.telegramId;

    // ⚠️ chat_id UZATILMAYDI — backend faylni har doim user_id ning o'z chatiga yuboradi
    const res = await fetch(`${botApiUrl.replace(/\/$/, "")}/api/request-excel`, {
      method: "POST",
      headers: botHeaders(request.headers, { "Content-Type": "application/json" }),
      body: JSON.stringify({ user_id: telegramId, month }),
      cache: "no-store",
      signal: AbortSignal.timeout(70000),   // Excel + Telegram yuborish sekin bo'lishi mumkin
    });
    return NextResponse.json(await res.json() as unknown, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false, reason: "network" }, { status: 502 });
  }
}
