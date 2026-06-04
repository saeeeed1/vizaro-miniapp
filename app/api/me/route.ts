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

export async function GET(request: Request) {
  const botApiUrl = process.env.BOT_API_URL;

  try {
    const session = await resolveSession(request.headers);
    const telegramId = extractTelegramUserId(request.headers) ?? session.user.telegramId;

    if (botApiUrl) {
      const res = await fetch(
        `${botApiUrl.replace(/\/$/, "")}/api/me?user_id=${telegramId}`,
        { cache: "no-store", signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        return NextResponse.json(await res.json() as unknown);
      }
    }

    // Fallback: session dan role ni ishlatamiz
    return NextResponse.json({
      user_id: parseInt(telegramId) || 0,
      full_name: session.user.fullName,
      username: session.user.username,
      is_admin: session.user.role === "ADMIN",
      is_allowed: true,
    });
  } catch {
    return NextResponse.json({
      user_id: 0,
      full_name: "Guest",
      username: null,
      is_admin: false,
      is_allowed: false,
    });
  }
}
