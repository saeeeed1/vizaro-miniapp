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

export async function GET(request: Request) {
  const botApiUrl = process.env.BOT_API_URL;
  if (!botApiUrl) return NextResponse.json({ months: [] });

  try {
    const session = await resolveSession(request.headers);
    const telegramId = extractTelegramUserId(request.headers) ?? session.user.telegramId;

    const res = await fetch(
      `${botApiUrl.replace(/\/$/, "")}/api/my-months?user_id=${telegramId}`,
      { cache: "no-store", headers: botHeaders(request.headers), signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return NextResponse.json({ months: [] });
    return NextResponse.json(await res.json() as unknown);
  } catch {
    return NextResponse.json({ months: [] });
  }
}
