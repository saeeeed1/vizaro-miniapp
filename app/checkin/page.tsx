"use client";

import { useEffect, useState, useCallback } from "react";

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        initDataUnsafe: { user?: { id: number; first_name?: string } };
        initData: string;
      };
    };
  }
}

type GeoState = "idle" | "loading" | "in_office" | "out_of_office" | "denied" | "error";
type ActionState = "idle" | "loading" | "success" | "error";

interface OfficeData {
  lat: number;
  lon: number;
  radius_m: number;
}

function calcDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

function getInitData(): string {
  if (typeof window === "undefined") return "";
  return window.Telegram?.WebApp?.initData ?? "";
}

export default function CheckinPage() {
  const [office, setOffice]         = useState<OfficeData | null>(null);
  const [geoState, setGeoState]     = useState<GeoState>("idle");
  const [distance, setDistance]     = useState(0);
  const [userLat, setUserLat]       = useState(0);
  const [userLon, setUserLon]       = useState(0);
  const [actionState, setAction]    = useState<ActionState>("idle");
  const [resultMsg, setResultMsg]   = useState("");
  const [userId, setUserId]         = useState(0);

  useEffect(() => {
    window.Telegram?.WebApp?.ready?.();
    window.Telegram?.WebApp?.expand?.();
    setUserId(getUserId());
  }, []);

  // Ofis ma'lumotini yuklash
  useEffect(() => {
    fetch("/api/office-location")
      .then(r => r.json())
      .then((data: OfficeData) => setOffice(data))
      .catch(() => setGeoState("error"));
  }, []);

  // GPS tekshiruvi — office yuklanganidan keyin
  const checkGps = useCallback(() => {
    if (!office) return;
    if (!navigator.geolocation) {
      setGeoState("error");
      return;
    }
    setGeoState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLat(latitude);
        setUserLon(longitude);
        const dist = calcDistance(latitude, longitude, office.lat, office.lon);
        setDistance(dist);
        setGeoState(dist <= office.radius_m ? "in_office" : "out_of_office");
      },
      (err) => {
        setGeoState(err.code === 1 ? "denied" : "error");
      },
      { timeout: 10000, maximumAge: 0, enableHighAccuracy: true }
    );
  }, [office]);

  useEffect(() => {
    if (office) checkGps();
  }, [office, checkGps]);

  const handleAction = async (action: "checkin" | "checkout") => {
    if (geoState !== "in_office" || actionState === "loading") return;
    setAction("loading");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const initData = getInitData();
      if (initData) headers["x-telegram-init-data"] = initData;

      const res = await fetch("/api/checkin", {
        method: "POST",
        headers,
        body: JSON.stringify({ user_id: userId, lat: userLat, lon: userLon, action }),
      });
      const json = await res.json() as { ok?: boolean; reason?: string; time?: string; status?: string };

      if (json.ok) {
        setAction("success");
        const label = action === "checkin" ? "Kelish" : "Ketish";
        setResultMsg(`✅ ${label} qayd etildi — ${json.time}`);
        setTimeout(() => window.Telegram?.WebApp?.close?.(), 2000);
      } else if (json.reason === "already_checked_in") {
        setAction("error");
        setResultMsg("⚠️ Siz bugun allaqachon keldingiz");
      } else if (json.reason === "already_checked_out") {
        setAction("error");
        setResultMsg("⚠️ Siz bugun allaqachon ketdingiz");
      } else if (json.reason === "not_checked_in") {
        setAction("error");
        setResultMsg("⚠️ Avval kelish qayd etilmagan");
      } else if (json.reason === "not_in_office") {
        setAction("error");
        setResultMsg("📍 Siz ofisda emassiz");
      } else {
        setAction("error");
        setResultMsg("❌ Xatolik yuz berdi");
      }
    } catch {
      setAction("error");
      setResultMsg("❌ Server bilan bog'lanib bo'lmadi");
    }
  };

  const inOffice  = geoState === "in_office";
  const isLoading = geoState === "loading" || !office;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0d1117",
      color: "#e8f5e8",
      fontFamily: "system-ui, sans-serif",
      padding: "20px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 16,
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

      {/* GPS holati */}
      <div style={{
        background: "#161b22",
        borderRadius: 14,
        padding: "20px 16px",
        textAlign: "center",
        border: `1px solid ${inOffice ? "#22c55e33" : geoState === "out_of_office" ? "#ef444433" : "#1e3a1e"}`,
      }}>
        {isLoading && (
          <div style={{ color: "#888", fontSize: "0.9rem" }}>📍 Joylashuv aniqlanmoqda...</div>
        )}
        {geoState === "in_office" && (
          <>
            <div style={{ color: "#22c55e", fontWeight: 700, fontSize: "1.1rem", marginBottom: 6 }}>
              ✅ Ofis hududida
            </div>
            <div style={{ color: "#888", fontSize: "0.8rem" }}>{distance}m uzoqlikda</div>
          </>
        )}
        {geoState === "out_of_office" && (
          <>
            <div style={{ color: "#ef4444", fontWeight: 700, fontSize: "1rem", marginBottom: 6 }}>
              ❌ Ofis hududida emassiz
            </div>
            <div style={{ color: "#888", fontSize: "0.8rem" }}>
              Masofa: {distance}m ({office?.radius_m}m kerak)
            </div>
            <button
              onClick={checkGps}
              style={{
                marginTop: 12, padding: "7px 16px",
                background: "transparent", color: "#00d084",
                border: "1px solid #00d084", borderRadius: 20,
                fontSize: "0.8rem", cursor: "pointer",
              }}
            >
              🔄 Qayta tekshirish
            </button>
          </>
        )}
        {geoState === "denied" && (
          <div style={{ color: "#ef4444", fontSize: "0.9rem" }}>❌ GPS ruxsatini bering</div>
        )}
        {geoState === "error" && (
          <div style={{ color: "#ef4444", fontSize: "0.9rem" }}>❌ GPS aniqlab bo&apos;lmadi</div>
        )}
      </div>

      {/* Natija xabari */}
      {resultMsg && (
        <div style={{
          background: actionState === "success" ? "#0d2b0d" : "#2b0d0d",
          border: `1px solid ${actionState === "success" ? "#22c55e33" : "#ef444433"}`,
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
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          onClick={() => handleAction("checkin")}
          disabled={!inOffice || actionState === "loading" || actionState === "success"}
          style={{
            padding: "14px 0",
            borderRadius: 14,
            border: "none",
            background: inOffice ? "#00c07a" : "#1a1a1a",
            color: inOffice ? "#000" : "#444",
            fontWeight: 700,
            fontSize: "1rem",
            cursor: inOffice ? "pointer" : "not-allowed",
            transition: "all 0.2s",
          }}
        >
          {actionState === "loading" ? "⏳ Saqlanmoqda..." : "✅ Keldim qayd etish"}
        </button>

        <button
          onClick={() => handleAction("checkout")}
          disabled={!inOffice || actionState === "loading" || actionState === "success"}
          style={{
            padding: "14px 0",
            borderRadius: 14,
            border: "none",
            background: inOffice ? "#1a2e1a" : "#1a1a1a",
            color: inOffice ? "#00d084" : "#444",
            fontWeight: 700,
            fontSize: "1rem",
            cursor: inOffice ? "pointer" : "not-allowed",
            border: inOffice ? "1px solid #1e3a1e" : "1px solid #222",
            transition: "all 0.2s",
          } as React.CSSProperties}
        >
          🚪 Ketdim qayd etish
        </button>
      </div>

    </div>
  );
}
