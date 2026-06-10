"use client";

import { useState, useMemo, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer, Legend,
} from "recharts";

import type {
  EmployeeDashboardData, DailyRecord, HoursChartPoint,
  TodayDashboardData, TodayEmployee, WeekChartPoint,
} from "@/lib/types";
import { useApiData } from "@/lib/client/use-api";
import { useMiniApp } from "@/components/providers/miniapp-provider";
import { AppShell } from "@/components/layout/app-shell";
import { ErrorState, EmptyState } from "@/components/ui/state";

// ── Shared skeleton ───────────────────────────────────────────────────────────

function SkeletonCard({ height = 120 }: { height?: number }) {
  return (
    <div className="card" style={{
      height,
      background: "linear-gradient(90deg,rgba(255,255,255,.04) 25%,rgba(255,255,255,.08) 50%,rgba(255,255,255,.04) 75%)",
      backgroundSize: "200% 100%", animation: "shimmer 1.6s infinite",
    }} />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

// Chegara rangi: working/late=yashil, present/late_done=kulrang, absent=qizil, not_marked=kulrang
const STATUS_BORDER: Record<string, string> = {
  working:    "#7ce7ac",
  late:       "#7ce7ac",
  present:    "rgba(255,255,255,0.25)",
  late_done:  "rgba(255,255,255,0.25)",
  absent:     "#f98077",
  not_marked: "rgba(255,255,255,0.12)",
};

// Sarlavha emoji
const STATUS_HEAD_ICON: Record<string, string> = {
  working: "🟢", late: "🟢",
  present: "⚫", late_done: "⚫",
  absent: "❌", not_marked: "⚪",
};

// Holat satri matni
const STATUS_LINE: Record<string, string> = {
  working:    "🟢 Ishda",
  late:       "🟢 Ishda",
  present:    "⚫ Ketdi",
  late_done:  "⚫ Ketdi",
  absent:     "❌ Kelmadi",
  not_marked: "⚪ Belgilamagan",
};

function AdminStatCard({ icon, count, label, color }: {
  icon: string; count: number; label: string; color: string;
}) {
  return (
    <div className="card" style={{ textAlign: "center", padding: "14px 10px" }}>
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, margin: "4px 0 2px" }}>{count}</div>
      <div className="meta-text" style={{ fontSize: 12 }}>{label}</div>
    </div>
  );
}

function EmployeeCard({ emp, beforeWork }: { emp: TodayEmployee; beforeWork: boolean }) {
  const border = STATUS_BORDER[emp.status] ?? "rgba(255,255,255,0.15)";
  const headIcon = STATUS_HEAD_ICON[emp.status] ?? "⚪";
  const statusLine = beforeWork && emp.status === "not_marked"
    ? "⏳ Ish boshlanmagan"
    : STATUS_LINE[emp.status] ?? "⚪";

  return (
    <div className="card" style={{ borderLeft: `3px solid ${border}`, padding: "12px 16px" }}>
      {/* Sarlavha: emoji + ism + username */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>
          {headIcon} {emp.full_name}
        </span>
        {emp.username && (
          <span className="meta-text" style={{ fontSize: 12 }}>@{emp.username}</span>
        )}
      </div>

      {/* Vaqt satri */}
      <div className="meta-text" style={{ marginTop: 6, fontSize: 13 }}>
        {emp.checkin_at ? (
          <>
            Keldi: <b>{emp.checkin_at.slice(0, 5)}</b>
            {emp.checkout_at && <>&nbsp;&nbsp;Ketdi: <b>{emp.checkout_at.slice(0, 5)}</b></>}
            {emp.late_minutes > 0 && (
              <span style={{ color: "var(--warning)", marginLeft: 8 }}>
                +{emp.late_minutes} daqiqa kech
              </span>
            )}
          </>
        ) : null}
      </div>

      {/* Holat satri */}
      <div className="meta-text" style={{ fontSize: 12, marginTop: 3 }}>
        {statusLine}
        {emp.checkin_at && emp.worked !== "—" && emp.worked !== "ishda" && (
          <span style={{ marginLeft: 8 }}>⏱ {emp.worked}</span>
        )}
      </div>
    </div>
  );
}

interface WeekTooltipProps { active?: boolean; payload?: Array<{name: string; value: number; color: string}>; label?: string }
function WeekTooltip({ active, payload, label }: WeekTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--panel-strong)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px", fontSize: 12 }}>
      <div style={{ color: "var(--muted)", marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</div>
      ))}
    </div>
  );
}

function WeekChart({ data }: { data: WeekChartPoint[] }) {
  return (
    <div className="card" style={{ padding: "16px 16px 10px" }}>
      <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>📊 Oxirgi 7 kun</div>
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<WeekTooltip />} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="on_time" name="Vaqtida" stackId="a" fill="#7ce7ac" fillOpacity={0.9} radius={[0,0,0,0]} />
            <Bar dataKey="late"    name="Kech"    stackId="a" fill="#f1bc53" fillOpacity={0.9} />
            <Bar dataKey="absent"  name="Kelmadi" stackId="a" fill="#f98077" fillOpacity={0.9} radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AdminDashboardScreen() {
  const { request } = useMiniApp();
  const [refreshKey, setRefreshKey] = useState(0);

  const query = useApiData<TodayDashboardData>(
    () => request("/api/today"),
    [request, refreshKey]
  );

  // Har 60 soniyada avtomatik yangilash
  useEffect(() => {
    const timer = setInterval(() => setRefreshKey(k => k + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  const d = query.data;

  return (
    <AppShell
      title="Admin Dashboard"
      subtitle={d ? `Bugun: ${d.date}` : "Yuklanmoqda..."}
      actions={
        <button className="button secondary" style={{ fontSize: 13 }}
          onClick={() => setRefreshKey(k => k + 1)}>
          ↺ Yangilash
        </button>
      }
    >
      {query.loading && (
        <div className="page-body">
          <div className="dash-stat-grid"><SkeletonCard height={90} /><SkeletonCard height={90} /><SkeletonCard height={90} /><SkeletonCard height={90} /></div>
          <SkeletonCard height={240} /><SkeletonCard height={200} />
        </div>
      )}
      {query.error && <ErrorState message={query.error} />}
      {!query.loading && !query.error && d && (
        <div className="page-body">
          {/* 4 ta bugungi karta */}
          <div className="dash-stat-grid">
            <AdminStatCard icon="✅" count={d.summary.present} label="Keldi"        color="var(--success)" />
            <AdminStatCard icon="⏰" count={d.summary.late}    label="Kech"         color="var(--warning)" />
            <AdminStatCard icon="❌" count={d.summary.absent}  label="Kelmadi"      color="var(--danger)"  />
            <AdminStatCard icon="⚪" count={d.summary.not_marked} label="Belgilamagan" color="var(--muted)"  />
          </div>

          {/* Xodimlar ro'yxati */}
          {(() => {
            const nowH = new Date().getHours();
            const nowM = new Date().getMinutes();
            const beforeWork = nowH < 10 || (nowH === 10 && nowM === 0);
            return (
              <div style={{ display: "grid", gap: 8 }}>
                {d.employees.length === 0
                  ? <div className="meta-text" style={{ textAlign: "center", padding: 24 }}>Xodimlar topilmadi</div>
                  : d.employees.map(emp => (
                      <EmployeeCard key={emp.user_id} emp={emp} beforeWork={beforeWork} />
                    ))
                }
              </div>
            );
          })()}

          {/* 7 kunlik grafik */}
          {d.week_chart.length > 0 && <WeekChart data={d.week_chart} />}
        </div>
      )}
      {!query.loading && !query.error && !d && <EmptyState label="Ma'lumot topilmadi." />}
    </AppShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE DASHBOARD (mavjud)
// ═══════════════════════════════════════════════════════════════════════════════

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const color = pct >= 90 ? "var(--success)" : pct >= 70 ? "var(--warning)" : "var(--danger)";
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.10)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 999, transition: "width 0.8s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span className="meta-text">{pct.toFixed(0)}%</span>
        <span className="meta-text">${max.toFixed(2)}</span>
      </div>
    </div>
  );
}

// ── Keldim/Ketdim (GPS bilan, Mini App ichida) ─────────────────────────────────

interface CheckinResponse {
  ok: boolean;
  reason?: string;
  action?: "checkin" | "checkout";
  time?: string;
  distance?: number;
  late_seconds?: number;
  is_late?: boolean;
  early_seconds?: number;
  is_early?: boolean;
}

type RequestRaw = (
  path: string,
  init?: { method?: string; body?: Record<string, unknown> },
) => Promise<Response>;

function tashkentToday(): string {
  // YYYY-MM-DD (Asia/Tashkent) — daily_records sanasiga moslash uchun
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());
}

function CheckButtons({
  data, requestRaw, onDone,
}: { data: EmployeeDashboardData; requestRaw: RequestRaw; onDone: () => void }) {
  const todayISO = tashkentToday();
  const todayRec = data.daily_records.find((r) => r.date === todayISO);
  const checkedIn = !!todayRec?.checkin;
  const checkedOut = !!todayRec?.checkout;

  const [busy, setBusy] = useState<"checkin" | "checkout" | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  const [reason, setReason] = useState<{ type: "late" | "early"; minutes: number } | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [reasonBusy, setReasonBusy] = useState(false);

  async function handleCheck(action: "checkin" | "checkout") {
    if (busy) return;
    setBusy(action);
    setToast(null);
    setReason(null);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setToast({ text: "❌ GPS qo'llab-quvvatlanmaydi", tone: "err" });
      setBusy(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await requestRaw("/api/checkin", {
            method: "POST",
            body: { lat: pos.coords.latitude, lon: pos.coords.longitude, action },
          });
          const d = (await res.json()) as CheckinResponse;
          if (d.ok) {
            const t = (d.time ?? "").slice(0, 5);
            setToast({ text: `✅ Qayd etildi ${t}`, tone: "ok" });
            if (action === "checkin" && d.is_late) {
              setReason({ type: "late", minutes: Math.round((d.late_seconds ?? 0) / 60) });
            } else if (action === "checkout" && d.is_early) {
              setReason({ type: "early", minutes: Math.round((d.early_seconds ?? 0) / 60) });
            }
            onDone();
          } else {
            setToast({ text: mapError(d), tone: "err" });
          }
        } catch {
          setToast({ text: "❌ Server bilan ulanish yo'q", tone: "err" });
        } finally {
          setBusy(null);
        }
      },
      (err) => {
        setBusy(null);
        setToast({
          text: err.code === err.PERMISSION_DENIED
            ? "❌ GPS ruxsatini bering"
            : "❌ Joylashuv aniqlanmadi",
          tone: "err",
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  function mapError(d: CheckinResponse): string {
    switch (d.reason) {
      case "not_in_office":   return `📍 Ofisda emassiz (${d.distance ?? "?"}m uzoq)`;
      case "already_checkin": return `⚠️ Allaqachon keldingiz ${(d.time ?? "").slice(0, 5)}`;
      case "already_checkout":return `⚠️ Allaqachon ketdingiz ${(d.time ?? "").slice(0, 5)}`;
      case "no_checkin":      return "⚠️ Avval Keldim ni bosing";
      case "not_workday":     return "🚫 Bugun dam kuni";
      case "marked_absent":   return "⚠️ Bugun kelmaysiz deb belgilangan";
      default:                return "❌ Xatolik yuz berdi";
    }
  }

  async function submitReason() {
    if (!reason || !reasonText.trim() || reasonBusy) return;
    setReasonBusy(true);
    try {
      const res = await requestRaw("/api/reason", {
        method: "POST",
        body: { date: todayISO, type: reason.type, reason: reasonText.trim() },
      });
      const d = (await res.json()) as { ok?: boolean };
      if (d.ok) {
        setToast({ text: "✅ Sabab yuborildi", tone: "ok" });
        setReason(null);
        setReasonText("");
      } else {
        setToast({ text: "❌ Sabab yuborilmadi", tone: "err" });
      }
    } catch {
      setToast({ text: "❌ Sabab yuborilmadi", tone: "err" });
    } finally {
      setReasonBusy(false);
    }
  }

  const inLabel = busy === "checkin"
    ? "📍 Tekshirilmoqda..."
    : checkedIn ? `✅ ${todayRec?.checkin?.slice(0, 5)}` : "✅ Keldim";
  const outLabel = busy === "checkout"
    ? "📍 Tekshirilmoqda..."
    : checkedOut ? `🚪 ${todayRec?.checkout?.slice(0, 5)}` : "🚪 Ketdim";

  const bigBtn = (active: boolean, disabled: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "18px 0",
    borderRadius: 16,
    border: "none",
    fontSize: 17,
    fontWeight: 800,
    color: disabled ? "var(--muted)" : "#04140c",
    background: disabled
      ? "rgba(255,255,255,0.06)"
      : active
        ? "linear-gradient(135deg,#7ce7ac,#4fd18b)"
        : "rgba(255,255,255,0.06)",
    cursor: disabled ? "default" : "pointer",
    transition: "transform 0.1s, opacity 0.2s",
  });

  return (
    <div className="card dash-anim" style={{ animationDelay: "0ms" }}>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          style={bigBtn(true, checkedIn || busy !== null)}
          disabled={checkedIn || busy !== null}
          onClick={() => handleCheck("checkin")}
        >
          {inLabel}
        </button>
        <button
          style={bigBtn(checkedIn, checkedOut || !checkedIn || busy !== null)}
          disabled={checkedOut || !checkedIn || busy !== null}
          onClick={() => handleCheck("checkout")}
        >
          {outLabel}
        </button>
      </div>

      {toast && (
        <div
          className="meta-text"
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 10,
            textAlign: "center",
            fontWeight: 600,
            color: toast.tone === "ok" ? "var(--success)" : "var(--danger)",
            background: toast.tone === "ok" ? "rgba(124,231,172,0.10)" : "rgba(249,128,119,0.10)",
          }}
        >
          {toast.text}
        </div>
      )}

      {reason && (
        <div style={{ marginTop: 12, padding: "12px", borderRadius: 12, background: "rgba(241,188,83,0.08)", border: "1px solid rgba(241,188,83,0.25)" }}>
          <div className="meta-text" style={{ color: "var(--warning)", fontWeight: 700, marginBottom: 8 }}>
            {reason.type === "late"
              ? `⏰ ${reason.minutes} daqiqa kech keldingiz`
              : `🚪 ${reason.minutes} daqiqa erta ketdingiz`}
          </div>
          <textarea
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder="Sababini yozing..."
            rows={2}
            style={{
              width: "100%", boxSizing: "border-box", resize: "none",
              padding: "10px 12px", borderRadius: 10, fontSize: 14,
              background: "var(--panel-strong)", color: "var(--text, #fff)",
              border: "1px solid var(--border)", outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              className="button primary"
              style={{ flex: 1, fontSize: 14, opacity: reasonText.trim() && !reasonBusy ? 1 : 0.5 }}
              disabled={!reasonText.trim() || reasonBusy}
              onClick={submitReason}
            >
              {reasonBusy ? "..." : "Yuborish"}
            </button>
            <button
              className="button secondary"
              style={{ flex: 1, fontSize: 14 }}
              onClick={() => { setReason(null); setReasonText(""); }}
            >
              Keyinroq
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EarnedCard({ data }: { data: EmployeeDashboardData }) {
  return (
    <div className="card dash-anim" style={{ animationDelay: "0ms" }}>
      <div className="meta-text">💰 Hozirgi oylik</div>
      <div style={{ fontSize: 32, fontWeight: 800, margin: "8px 0 2px", color: "var(--success)" }}>
        ${data.salary_earned.toFixed(2)}
      </div>
      <ProgressBar value={data.salary_earned} max={data.salary_base} />
    </div>
  );
}

function DeductionCard({ data }: { data: EmployeeDashboardData }) {
  const earned    = data.salary_earned;
  const base      = data.salary_base;
  const remaining = base - earned;
  const remainingPct = base > 0 ? Math.round((remaining / base) * 100) : 0;

  const lateD   = data.late_deducted   ?? 0;
  const absentD = data.absent_deducted ?? 0;
  const earlyD  = data.early_deducted  ?? 0;

  const hasPenalties = lateD > 0.01 || absentD > 0.01 || earlyD > 0.01;

  return (
    <div className="card dash-anim" style={{ animationDelay: "80ms" }}>
      <div className="meta-text">📉 Oy holati</div>

      <div style={{ height: 1, background: "var(--border)", margin: "10px 0 8px" }} />

      {/* Qoldi */}
      <div className="meta-text" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>📅 Qoldi:</span>
        <span style={{ color: "var(--muted)", fontWeight: 500 }}>
          ${remaining.toFixed(2)} <span style={{ fontWeight: 400 }}>({remainingPct}%)</span>
        </span>
      </div>

      {/* Jarima qatorlari */}
      {hasPenalties && (
        <>
          <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />
          {lateD > 0.01 && (
            <div className="meta-text" style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span>⏰ Kech kelish:</span>
              <span style={{ color: "var(--warning)", fontWeight: 600 }}>−${lateD.toFixed(2)}</span>
            </div>
          )}
          {absentD > 0.01 && (
            <div className="meta-text" style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span>❌ Kelmagan:</span>
              <span style={{ color: "var(--danger)", fontWeight: 600 }}>−${absentD.toFixed(2)}</span>
            </div>
          )}
          {earlyD > 0.01 && (
            <div className="meta-text" style={{ display: "flex", justifyContent: "space-between" }}>
              <span>🚪 Erta ketish:</span>
              <span style={{ color: "var(--danger)", fontWeight: 600 }}>−${earlyD.toFixed(2)}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ProjectionCard({ data }: { data: EmployeeDashboardData }) {
  return (
    <div className="card dash-anim" style={{ animationDelay: "160ms" }}>
      <div className="meta-text">🎯 Prognoz (oy oxiri)</div>
      <div style={{ fontSize: 32, fontWeight: 800, margin: "8px 0 8px", color: "var(--primary)" }}>
        ${data.salary_projected.toFixed(2)}
      </div>
      <div className="meta-text">{data.workdays_remaining > 0 ? `${data.workdays_remaining} kun qoldi, vaqtida kelsa` : "Oy tugadi"}</div>
      <div className="meta-text" style={{ marginTop: 4 }}>Kun tarifi: ${data.day_rate.toFixed(2)}</div>
    </div>
  );
}

function StatCard({ icon, count, label, color, delay }: { icon: string; count: number; label: string; color: string; delay: number }) {
  return (
    <div className="card dash-anim" style={{ animationDelay: `${delay}ms`, textAlign: "center", padding: "16px 12px" }}>
      <div style={{ fontSize: 24 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, margin: "6px 0 2px" }}>{count}</div>
      <div className="meta-text">{label}</div>
    </div>
  );
}

interface SalaryTooltipProps { active?: boolean; payload?: Array<{value: number; name: string}>; label?: string }
function SalaryTooltip({ active, payload, label }: SalaryTooltipProps) {
  if (!active || !payload?.length) return null;
  const earned = payload.find(p => p.name === "earned");
  const projected = payload.find(p => p.name === "projected");
  return (
    <div style={{ background: "var(--panel-strong)", border: "1px solid var(--border)", borderRadius: 12, padding: "8px 12px", fontSize: 13 }}>
      <div style={{ color: "var(--muted)", marginBottom: 4 }}>{label}-kun</div>
      {earned && <div style={{ color: "var(--success)" }}>Haqiqiy: ${earned.value.toFixed(2)}</div>}
      {projected && <div style={{ color: "var(--primary)" }}>Prognoz: ${projected.value.toFixed(2)}</div>}
    </div>
  );
}

interface HoursTooltipProps { active?: boolean; payload?: Array<{value: number; name: string; payload: HoursChartPoint}>; label?: string }
function HoursTooltip({ active, payload, label }: HoursTooltipProps) {
  if (!active || !payload?.length) return null;
  const h = Math.floor(payload[0].value);
  const m = Math.round((payload[0].value - h) * 60);
  return (
    <div style={{ background: "var(--panel-strong)", border: "1px solid var(--border)", borderRadius: 12, padding: "8px 12px", fontSize: 13 }}>
      <div style={{ color: "var(--muted)", marginBottom: 4 }}>{label}-kun</div>
      <div>{h} soat {m} daqiqa ishlagan</div>
    </div>
  );
}

function ChartSection({ data }: { data: EmployeeDashboardData }) {
  const [tab, setTab] = useState<"salary" | "hours">("salary");
  const salaryChartData = useMemo(() => data.salary_chart.map(pt => ({ ...pt })), [data.salary_chart]);

  return (
    <div className="card" style={{ padding: "18px 18px 12px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button className={`button ${tab === "salary" ? "primary" : "secondary"}`} style={{ fontSize: 13, padding: "8px 16px" }} onClick={() => setTab("salary")}>📈 Oylik trend</button>
        <button className={`button ${tab === "hours" ? "primary" : "secondary"}`} style={{ fontSize: 13, padding: "8px 16px" }} onClick={() => setTab("hours")}>⏱ Kunlik davomat</button>
      </div>
      {tab === "salary" && (
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={salaryChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradEarned" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7ce7ac" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#7ce7ac" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradProjected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#57c8ff" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#57c8ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} domain={[0, data.salary_base]} tickFormatter={(v: number) => `$${v}`} />
              <Tooltip content={<SalaryTooltip />} />
              <ReferenceLine y={data.salary_base} stroke="rgba(255,255,255,0.15)" strokeDasharray="6 3" label={{ value: `$${data.salary_base}`, fill: "var(--muted)", fontSize: 11, position: "right" }} />
              <Area type="monotone" dataKey="earned" name="earned" stroke="#7ce7ac" strokeWidth={2} fill="url(#gradEarned)"
                dot={(props: { key?: string; cx: number; cy: number; index: number }) => {
                  const point = data.salary_chart[props.index];
                  if (!point || point.earned == null) return <g key={props.key} />;
                  const color = point.status === "absent" ? "#f98077" : point.status?.includes("late") ? "#f1bc53" : "transparent";
                  if (color === "transparent") return <g key={props.key} />;
                  return <circle key={props.key} cx={props.cx} cy={props.cy} r={5} fill={color} stroke="#fff" strokeWidth={1.5} />;
                }}
                connectNulls={false}
              />
              <Area type="monotone" dataKey="projected" name="projected" stroke="#57c8ff" strokeWidth={2} strokeDasharray="6 4" fill="url(#gradProjected)" connectNulls={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
            <span><span style={{ color: "#7ce7ac" }}>──</span> Haqiqiy</span>
            <span><span style={{ color: "#57c8ff" }}>╌╌</span> Prognoz</span>
          </div>
        </div>
      )}
      {tab === "hours" && (
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.hours_chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} domain={[0, 12]} tickFormatter={(v: number) => `${v}s`} />
              <Tooltip content={<HoursTooltip />} />
              <ReferenceLine y={8} stroke="#f98077" strokeDasharray="4 2" label={{ value: "8 soat", fill: "#f98077", fontSize: 11, position: "right" }} />
              <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                {data.hours_chart.map((entry, idx) => (
                  <Cell key={idx} fill={entry.hours >= 8 ? "#7ce7ac" : entry.hours > 0 ? "#f1bc53" : "#f98077"} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

const UZ_MONTHS_SHORT = ["yan","fev","mar","apr","may","iyn","iyl","avg","sen","okt","noy","dek"];
function formatDateShort(dateKey: string) {
  const parts = dateKey.split("-");
  return `${parts[2]}-${UZ_MONTHS_SHORT[parseInt(parts[1], 10) - 1]}`;
}
function statusIcon(s: string) {
  if (s.includes("absent")) return "❌";
  if (s.includes("late") || s.includes("early")) return "⏰";
  if (s === "on_time" || s === "full_day") return "✅";
  if (s.includes("off") || s.includes("sunday")) return "🏖";
  return "⏳";
}
function formatWorked(sec: number) {
  if (!sec) return "—";
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h} s ${m} d` : `${m} d`;
}

function DailyRow({ record, secondRate, dayRate }: { record: DailyRecord; secondRate: number; dayRate: number }) {
  const isAbsent = record.status.includes("absent");
  const isLate = record.status.includes("late") || record.status.includes("early");
  const isOff = record.status.includes("off") || record.status.includes("sunday");
  let rowBg = "transparent";
  if (isAbsent) rowBg = "rgba(249,128,119,0.07)";
  else if (isLate) rowBg = "rgba(241,188,83,0.07)";
  else if (isOff) rowBg = "rgba(255,255,255,0.03)";
  let impact = "—";
  if (isAbsent) impact = `−$${dayRate.toFixed(2)}`;
  else if (isLate && record.late_seconds > 0) {
    const ded = record.late_seconds * secondRate;
    const m = Math.floor(record.late_seconds / 60);
    impact = `+${m}d | −$${ded.toFixed(2)}`;
  } else if (record.status === "on_time" || record.status === "full_day") {
    impact = `+$${dayRate.toFixed(2)}`;
  }
  return (
    <tr style={{ background: rowBg }}>
      <td style={{ fontWeight: 600, fontSize: 13 }}>{formatDateShort(record.date)}</td>
      <td style={{ fontSize: 18 }}>{statusIcon(record.status)}</td>
      <td style={{ fontFamily: "monospace", fontSize: 13, color: "var(--muted)" }}>{record.checkin ?? "—"}</td>
      <td style={{ fontFamily: "monospace", fontSize: 13, color: "var(--muted)" }}>{record.checkout ?? "—"}</td>
      <td style={{ fontSize: 13 }}>{formatWorked(record.worked_seconds)}</td>
      <td style={{ fontSize: 13, color: isAbsent ? "var(--danger)" : isLate ? "var(--warning)" : "var(--success)", fontWeight: 600 }}>{impact}</td>
    </tr>
  );
}

function DailyTable({ data }: { data: EmployeeDashboardData }) {
  const [expanded, setExpanded] = useState(false);
  const records = expanded ? data.daily_records : data.daily_records.slice(0, 10);
  return (
    <div className="card" style={{ padding: "16px 0 0" }}>
      <div style={{ padding: "0 18px 12px", borderBottom: "1px solid var(--border)" }}>
        <strong>📋 Kunlik jadval</strong>
        <span className="meta-text" style={{ marginLeft: 8 }}>{data.workdays_passed} kun</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Sana</th><th>Holat</th><th>Keldi</th><th>Ketdi</th><th>Ishlagan</th><th>Ta&apos;sir</th></tr>
          </thead>
          <tbody>
            {records.map(r => <DailyRow key={r.date} record={r} secondRate={data.second_rate} dayRate={data.day_rate} />)}
          </tbody>
        </table>
      </div>
      {data.daily_records.length > 10 && (
        <div style={{ padding: "12px 18px" }}>
          <button className="button ghost" style={{ width: "100%", fontSize: 13 }} onClick={() => setExpanded(v => !v)}>
            {expanded ? "Kamroq ko'rsatish ↑" : `Yana ${data.daily_records.length - 10} ta ↓`}
          </button>
        </div>
      )}
    </div>
  );
}

function EmployeeDashboardScreen() {
  const { request, requestRaw, session } = useMiniApp();
  const [refreshKey, setRefreshKey] = useState(0);
  const query = useApiData<EmployeeDashboardData>(
    () => request("/api/dashboard"),
    [request, session?.user.id, refreshKey]
  );
  return (
    <AppShell
      title={query.data?.name ?? "Dashboard"}
      subtitle={query.data?.month ?? "Yuklanmoqda..."}
      actions={
        <button className="button secondary" style={{ fontSize: 13 }} onClick={() => setRefreshKey(k => k + 1)}>
          ↺ Yangilash
        </button>
      }
    >
      {query.loading && (
        <div className="page-body">
          <div className="dash-salary-grid"><SkeletonCard height={140} /><SkeletonCard height={140} /><SkeletonCard height={140} /></div>
          <div className="dash-stat-grid"><SkeletonCard height={90} /><SkeletonCard height={90} /><SkeletonCard height={90} /><SkeletonCard height={90} /></div>
          <SkeletonCard height={320} /><SkeletonCard height={280} />
        </div>
      )}
      {query.error && <ErrorState message={query.error} />}
      {!query.loading && !query.error && !query.data && <EmptyState label="Ma'lumot topilmadi." />}
      {!query.loading && !query.error && query.data && (
        <div className="page-body">
          <CheckButtons
            data={query.data}
            requestRaw={requestRaw}
            onDone={() => setRefreshKey((k) => k + 1)}
          />
          <div className="dash-salary-grid">
            <EarnedCard data={query.data} />
            <DeductionCard data={query.data} />
            <ProjectionCard data={query.data} />
          </div>
          <div className="dash-stat-grid">
            <StatCard icon="✅" count={query.data.on_time} label="Vaqtida" color="var(--success)" delay={0} />
            <StatCard icon="⏰" count={query.data.late_days} label="Kech keldi" color="var(--warning)" delay={60} />
            <StatCard icon="❌" count={query.data.absent_days} label="Kelmadi" color="var(--danger)" delay={120} />
            <StatCard icon="📅" count={query.data.workdays_remaining} label="Qoldi" color="var(--primary)" delay={180} />
          </div>
          <ChartSection data={query.data} />
          <DailyTable data={query.data} />
        </div>
      )}
    </AppShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT — admin yoki user ga yo'naltiradi
// ═══════════════════════════════════════════════════════════════════════════════

export function DashboardScreen() {
  const { isAdmin } = useMiniApp();
  return isAdmin ? <AdminDashboardScreen /> : <EmployeeDashboardScreen />;
}
