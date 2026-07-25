import { NextResponse } from "next/server";

import { AuthError, resolveSession } from "@/lib/auth";
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

/** Admin Excel'i uchun oy ro'yxati — biror xodimda yozuv bor oylar. */
export async function GET(request: Request) {
  const botApiUrl = process.env.BOT_API_URL;
  if (!botApiUrl) return NextResponse.json({ months: [] });

  try {
    const session = await resolveSession(request.headers);
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Ruxsat yo'q." }, { status: 403 });
    }
    const telegramId = extractTelegramUserId(request.headers) ?? session.user.telegramId;

    const res = await fetch(
      `${botApiUrl.replace(/\/$/, "")}/api/admin/months?user_id=${telegramId}`,
      { cache: "no-store", headers: botHeaders(request.headers), signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return NextResponse.json({ months: [] }, { status: res.status });
    return NextResponse.json(await res.json() as unknown);
  } catch (err) {
    // Sessiya rad etilishi "bo'sh ro'yxat" bo'lib ko'rinmasin — aks holda
    // sozlama nosozligi ham, ruxsatsizlik ham "ma'lumot yo'q"ga aylanadi.
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Sessiya topilmadi." }, { status: err.status });
    }
    return NextResponse.json({ months: [] });
  }
}
