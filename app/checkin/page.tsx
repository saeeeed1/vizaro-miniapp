"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        initDataUnsafe: { user?: { id: number } };
        initData: string;
      };
    };
  }
}

type GeoStatus = "loading" | "in_office" | "out_of_office" | "denied" | "error";
type ActionStatus = "idle" | "loading" | "done" | "error";

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function getUserId(): number {
  if (typeof window === "undefined") return 0;
  const tg = window.Telegram?.WebApp?.initDataUnsafe?.user;
  if (tg?.id) return tg.id;
  const uid = new URLSearchParams(window.location.search).get("user_id");
  return uid ? parseInt(uid) : 0;
}

export default function CheckinPage() {
  const [geoStatus, setGeoStatus]   = useState<GeoStatus>("loading");
  const [distance, setDistance]     = useState(0);
  const [radiusM, setRadiusM]       = useState(100);
  const [coords, setCoords]         = useState<{ lat: number; lon: number } | null>(null);
  const [actionStatus, setAction]   = useState<ActionStatus>("idle");
  const [resultMsg, setResultMsg]   = useState("");
  const [userId, setUserId]         = useState(0);

  // 1. Sahifa ochilishi bilan darhol GPS + ofis tekshiruvi
  useEffect(() => {
    window.Telegram?.WebApp?.ready?.();
    window.Telegram?.WebApp?.expand?.();
    setUserId(getUserId());

    if (!navigator.geolocation) {
      setGeoStatus("error");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        await checkLocation(latitude, longitude);
      },
      (err) => {
        setGeoStatus(err.code === 1 ? "denied" : "error");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // 2. checkLocation — ofis koordinatalarini olib masofani hisoblaydi
  async function checkLocation(lat: number, lon: number) {
    try {
      const res = await fetch("/api/office-location");
      const office = await res.json() as { lat: number; lon: number; radius_m: number };
      const dist = haversine(lat, lon, office.lat, office.lon);
      setCoords({ lat, lon });
      setDistance(dist);
      setRadiusM(office.radius_m);
      setGeoStatus(dist <= office.radius_m ? "in_office" : "out_of_office");
    } catch {
      setGeoStatus("error");
    }
  }

  // 3. Keldim / Ketdim — qayta GPS so'ramasdan
  async function handleAction(action: "checkin" | "checkout") {
    if (!coords || actionStatus === "loading" || actionStatus === "done") return;
    setAction("loading");

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const initData = window.Telegram?.WebApp?.initData;
    if (initData) headers["x-telegram-init-data"] = initData;

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers,
        body: JSON.stringify({ user_id: userId, lat: coords.lat, lon: coords.lon, action }),
      });
      const json = await res.json() as { ok?: boolean; reason?: string; time?: string };

      if (json.ok) {
        setAction("done");
        const label = action === "checkin" ? "Kelish" : "Ketish";
        setResultMsg(`✅ ${label} qayd etildi — ${json.time}`);
        setTimeout(() => window.Telegram?.WebApp?.close?.(), 1800);
      } else {
        setAction("error");
        const msgs: Record<string, string> = {
          already_checked_in:  "⚠️ Bugun allaqachon keldingiz",
          already_checked_out: "⚠️ Bugun allaqachon ketdingiz",
          not_checked_in:      "⚠️ Avval kelish qayd etilmagan",
          not_in_office:       "📍 Siz ofisda emassiz",
        };
        setResultMsg(msgs[json.reason ?? ""] ?? "❌ Xatolik yuz berdi");
      }
    } catch {
      setAction("error");
      setResultMsg("❌ Server bilan bog'lanib bo'lmadi");
    }
  }

  const inOffice  = geoStatus === "in_office";
  const busy      = actionStatus === "loading" || actionStatus === "done";

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0d1117",
      color: "#e8f5e8",
      fontFamily: "system-ui, sans-serif",
      padding: "20px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 14,
    }}>

      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #0f1a0f, #1a2e1a)",
        borderRadius: 14,
        padding: "14px 16px",
        border: "1px solid #1e3a1e",
      }}>
        <div style={{ color: "#00d084", fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.08em" }}>
          📍 DAVOMAT
        </div>
      </div>

      {/* 4. GPS holati */}
      <div style={{
        background: "#161b22",
        borderRadius: 14,
        padding: "22px 16px",
        textAlign: "center",
        border: `1px solid ${
          inOffice ? "#22c55e33" :
          geoStatus === "out_of_office" ? "#ef444433" : "#1e3a1e"
        }`,
      }}>
        {geoStatus === "loading" && (
          <div style={{ color: "#888", fontSize: "0.9rem" }}>
            📍 Joylashuv aniqlanmoqda...
          </div>
        )}
        {/* 5. Qisqa xabarlar */}
        {geoStatus === "in_office" && (
          <div style={{ color: "#22c55e", fontWeight: 700, fontSize: "1rem" }}>
            ✅ Ofisda — {distance}m
          </div>
        )}
        {geoStatus === "out_of_office" && (
          <>
            <div style={{ color: "#ef4444", fontWeight: 700, fontSize: "1rem", marginBottom: 4 }}>
              ❌ Ofisda emas — {distance}m ({radiusM}m kerak)
            </div>
            <button
              onClick={() => {
                setGeoStatus("loading");
                navigator.geolocation.getCurrentPosition(
                  async (p) => checkLocation(p.coords.latitude, p.coords.longitude),
                  () => setGeoStatus("error"),
                  { enableHighAccuracy: true, timeout: 10000 }
                );
              }}
              style={{
                marginTop: 10, padding: "6px 14px",
                background: "transparent", color: "#00d084",
                border: "1px solid #00d084", borderRadius: 20,
                fontSize: "0.78rem", cursor: "pointer",
              }}
            >
              🔄 Qayta tekshirish
            </button>
          </>
        )}
        {geoStatus === "denied" && (
          <div style={{ color: "#ef4444", fontSize: "0.9rem" }}>❌ GPS ruxsatini bering</div>
        )}
        {geoStatus === "error" && (
          <div style={{ color: "#ef4444", fontSize: "0.9rem" }}>❌ GPS aniqlab bo&apos;lmadi</div>
        )}
      </div>

      {/* Natija */}
      {resultMsg && (
        <div style={{
          background: actionStatus === "done" ? "#0d2b0d" : "#2b0d0d",
          border: `1px solid ${actionStatus === "done" ? "#22c55e44" : "#ef444444"}`,
          borderRadius: 12,
          padding: "12px 16px",
          textAlign: "center",
          fontSize: "0.9rem",
          fontWeight: 600,
        }}>
          {resultMsg}
        </div>
      )}

      {/* Tugmalar */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
        <button
          onClick={() => handleAction("checkin")}
          disabled={!inOffice || busy}
          style={{
            padding: "14px 0",
            borderRadius: 14,
            border: "none",
            background: inOffice && !busy ? "#00c07a" : "#1a1a1a",
            color: inOffice && !busy ? "#000" : "#444",
            fontWeight: 700,
            fontSize: "1rem",
            cursor: inOffice && !busy ? "pointer" : "not-allowed",
            transition: "all 0.2s",
          }}
        >
          {actionStatus === "loading" ? "⏳ Saqlanmoqda..." : "✅ Keldim"}
        </button>

        <button
          onClick={() => handleAction("checkout")}
          disabled={!inOffice || busy}
          style={{
            padding: "14px 0",
            borderRadius: 14,
            border: inOffice && !busy ? "1px solid #1e3a1e" : "1px solid #222",
            background: inOffice && !busy ? "#1a2e1a" : "#1a1a1a",
            color: inOffice && !busy ? "#00d084" : "#444",
            fontWeight: 700,
            fontSize: "1rem",
            cursor: inOffice && !busy ? "pointer" : "not-allowed",
            transition: "all 0.2s",
          }}
        >
          🚪 Ketdim
        </button>
      </div>

    </div>
  );
}
