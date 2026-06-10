import { NextResponse } from "next/server";

import { resolveSession } from "@/lib/auth";
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
  const body = (await request.json().catch(() => ({}))) as {
    lat?: number;
    lon?: number;
    action?: "checkin" | "checkout";
  };

  if (!botApiUrl) {
    return NextResponse.json({ ok: false, reason: "no_bot_api" }, { status: 503 });
  }

  let telegramId = extractTelegramUserId(request.headers);
  if (!telegramId) {
    try {
      const session = await resolveSession(request.headers);
      telegramId = session.user.telegramId;
    } catch {
      telegramId = null;
    }
  }
  if (!telegramId) {
    return NextResponse.json({ ok: false, reason: "no_user" }, { status: 401 });
  }

  try {
    const res = await fetch(`${botApiUrl.replace(/\/$/, "")}/api/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: telegramId,
        lat: body.lat,
        lon: body.lon,
        action: body.action ?? "checkin",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json().catch(() => ({ ok: false, reason: "bad_response" }));
    return NextResponse.json(data as unknown, { status: res.status });
  } catch (err) {
    console.warn("checkin bot API ulanmadi:", err);
    return NextResponse.json({ ok: false, reason: "server_error" }, { status: 503 });
  }
}
