import { NextResponse } from "next/server";
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

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(request: Request) {
  const botApiUrl = process.env.BOT_API_URL;
  if (!botApiUrl) {
    return NextResponse.json({ error: "BOT_API_URL sozlanmagan" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON xatosi" }, { status: 400 });
  }

  // Telegram init data dan user_id olish (xavfsizlik uchun)
  const telegramId = extractTelegramUserId(request.headers);
  if (telegramId && typeof body === "object" && body !== null) {
    (body as Record<string, unknown>).user_id = parseInt(telegramId);
  }

  try {
    const res = await fetch(
      `${botApiUrl.replace(/\/$/, "")}/api/checkin`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      }
    );
    return NextResponse.json(await res.json() as unknown, { status: res.status });
  } catch {
    return NextResponse.json({ error: "API ulanmadi" }, { status: 503 });
  }
}
