import { NextResponse } from "next/server";

import { botHeaders } from "@/lib/bot-api";

export async function GET(request: Request) {
  const botApiUrl = process.env.BOT_API_URL;
  if (botApiUrl) {
    try {
      const res = await fetch(`${botApiUrl.replace(/\/$/, "")}/api/office-location`, {
        cache: "no-store",
        headers: botHeaders(request.headers),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        return NextResponse.json(await res.json() as unknown);
      }
    } catch (err) {
      console.warn("office-location bot API ulanmadi:", err);
    }
  }
  // Fallback: geofence o'chiq (0,0)
  return NextResponse.json({ lat: 0, lon: 0, radius_m: 100 });
}
