import { NextResponse } from "next/server";

export async function GET() {
  const botApiUrl = process.env.BOT_API_URL;
  if (!botApiUrl) {
    return NextResponse.json({ error: "BOT_API_URL sozlanmagan" }, { status: 503 });
  }
  try {
    const res = await fetch(
      `${botApiUrl.replace(/\/$/, "")}/api/office-location`,
      { cache: "no-store", signal: AbortSignal.timeout(5000) }
    );
    return NextResponse.json(await res.json() as unknown, { status: res.status });
  } catch {
    return NextResponse.json({ error: "API ulanmadi" }, { status: 503 });
  }
}
