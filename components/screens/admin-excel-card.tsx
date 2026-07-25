"use client";

import { useEffect, useState } from "react";

import { useMiniApp } from "@/components/providers/miniapp-provider";

interface MonthOption {
  value: string;
  label: string;
}

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "ok" }
  | { kind: "err"; text: string };

/**
 * Admin kartasi: hamma xodim bitta Excel faylida (1-varaq umumiy jadval,
 * keyin har xodimga alohida varaq). Fayl Telegram chatga yuboriladi —
 * brauzerda yuklab olinmaydi.
 *
 * ⚠️ Faqat admin ekranida joylashadi; bundan tashqari server tomonda ham
 * rol tekshiriladi (proxy route + Python admin_chat_ids).
 */
export function AdminExcelCard() {
  const { request, requestRaw, isAdmin } = useMiniApp();
  const [months, setMonths] = useState<MonthOption[]>([]);
  const [month, setMonth] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    request<{ months?: MonthOption[] }>("/api/admin/months")
      .then((d) => {
        if (!alive) return;
        const list = d.months ?? [];
        setMonths(list);
        if (list.length) setMonth(list[0].value);
      })
      .catch(() => { if (alive) setMonths([]); });
    return () => { alive = false; };
  }, [request, isAdmin]);

  // Muvaffaqiyat xabari 3 soniyadan keyin o'chadi
  useEffect(() => {
    if (status.kind !== "ok") return;
    const t = setTimeout(() => setStatus({ kind: "idle" }), 3000);
    return () => clearTimeout(t);
  }, [status.kind]);

  async function send() {
    if (!month || status.kind === "sending") return;
    setStatus({ kind: "sending" });
    try {
      const res = await requestRaw("/api/admin/request-all-excel", {
        method: "POST",
        body: { month },
      });
      const d = (await res.json()) as { ok?: boolean; reason?: string };
      if (d.ok) {
        setStatus({ kind: "ok" });
      } else if (d.reason === "no_data") {
        setStatus({ kind: "err", text: "Bu oyda yozuv yo'q" });
      } else if (d.reason === "forbidden") {
        setStatus({ kind: "err", text: "Ruxsat yo'q" });
      } else {
        setStatus({ kind: "err", text: "Xatolik, qayta urinib ko'ring" });
      }
    } catch {
      setStatus({ kind: "err", text: "Xatolik, qayta urinib ko'ring" });
    }
  }

  if (!isAdmin || months.length === 0) return null;

  const sending = status.kind === "sending";

  return (
    <div className="card" style={{ display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 600, fontSize: 14 }}>📊 Hamma xodimlar Excel</div>

      <select
        value={month}
        onChange={(e) => setMonth(e.target.value)}
        aria-label="Oy tanlash"
        style={{
          width: "100%", padding: "10px 12px", borderRadius: 10,
          background: "var(--card-2)", color: "var(--text)",
          border: "1px solid var(--border)", fontSize: 14, outline: "none",
        }}
      >
        {months.map((m) => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>

      <button
        onClick={send}
        disabled={sending}
        style={{
          width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
          fontSize: 14, fontWeight: 500,
          background: sending ? "var(--card-2)" : "var(--accent)",
          color: sending ? "var(--text-dim)" : "var(--accent-text)",
          cursor: sending ? "default" : "pointer",
          transition: "background 0.2s",
        }}
      >
        {sending ? "Yuborilmoqda..." : "Telegram'ga yuborish"}
      </button>

      {status.kind === "ok" && (
        <div style={{ fontSize: 13, color: "var(--accent)", textAlign: "center" }}>
          ✅ Excel Telegram&apos;ga yuborildi
        </div>
      )}
      {status.kind === "err" && (
        <div style={{ fontSize: 13, color: "var(--danger)", textAlign: "center" }}>
          {status.text}
        </div>
      )}

      <div style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "center" }}>
        Fayl Telegram chatingizga keladi — 1-varaq umumiy, keyin har xodimga alohida
      </div>
    </div>
  );
}
