"use client";

import { useState, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer
} from "recharts";

import type { EmployeeDashboardData, DailyRecord, HoursChartPoint } from "@/lib/types";
import { useApiData } from "@/lib/client/use-api";
import { useMiniApp } from "@/components/providers/miniapp-provider";
import { AppShell } from "@/components/layout/app-shell";
import { ErrorState, EmptyState } from "@/components/ui/state";

// ── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonCard({ height = 120 }: { height?: number }) {
  return (
    <div
      className="card"
      style={{
        height,
        background: "linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.6s infinite"
      }}
    />
  );
}

function DashboardSkeleton() {
  return (
    <div className="page-body">
      <div className="dash-salary-grid">
        <SkeletonCard height={140} />
        <SkeletonCard height={140} />
        <SkeletonCard height={140} />
      </div>
      <div className="dash-stat-grid">
        <SkeletonCard height={90} />
        <SkeletonCard height={90} />
        <SkeletonCard height={90} />
        <SkeletonCard height={90} />
      </div>
      <SkeletonCard height={320} />
      <SkeletonCard height={280} />
    </div>
  );
}

// ── Salary Cards ─────────────────────────────────────────────────────────────

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const color = pct >= 90 ? "var(--success)" : pct >= 70 ? "var(--warning)" : "var(--danger)";
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{
        height: 6,
        borderRadius: 999,
        background: "rgba(255,255,255,0.10)",
        overflow: "hidden"
      }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: color,
          borderRadius: 999,
          transition: "width 0.8s ease"
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span className="meta-text">{pct.toFixed(0)}%</span>
        <span className="meta-text">${max.toFixed(2)}</span>
      </div>
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
  const late_ded = data.late_seconds_total * data.second_rate;
  const absent_ded = data.absent_days * data.day_rate;
  return (
    <div className="card dash-anim" style={{ animationDelay: "80ms" }}>
      <div className="meta-text">📉 Ayirilgan summa</div>
      <div style={{ fontSize: 32, fontWeight: 800, margin: "8px 0 8px", color: "var(--danger)" }}>
        −${data.salary_deducted.toFixed(2)}
      </div>
      {late_ded > 0 && (
        <div className="meta-text" style={{ marginBottom: 2 }}>
          ⏰ Kechikish: ${late_ded.toFixed(2)}
        </div>
      )}
      {absent_ded > 0 && (
        <div className="meta-text">
          ❌ Kelmadi: ${absent_ded.toFixed(2)}
        </div>
      )}
      {data.salary_deducted < 0.01 && (
        <div className="meta-text" style={{ color: "var(--success)" }}>Barcha kunlar vaqtida ✓</div>
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
      <div className="meta-text">
        {data.workdays_remaining > 0
          ? `${data.workdays_remaining} kun qoldi, vaqtida kelsa`
          : "Oy tugadi"}
      </div>
      <div className="meta-text" style={{ marginTop: 4 }}>
        Kun tarifi: ${data.day_rate.toFixed(2)}
      </div>
    </div>
  );
}

// ── Stat Cards ────────────────────────────────────────────────────────────────

function StatCard({
  icon, count, label, color, delay
}: {
  icon: string; count: number; label: string; color: string; delay: number;
}) {
  return (
    <div className="card dash-anim" style={{ animationDelay: `${delay}ms`, textAlign: "center", padding: "16px 12px" }}>
      <div style={{ fontSize: 24 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, margin: "6px 0 2px" }}>{count}</div>
      <div className="meta-text">{label}</div>
    </div>
  );
}

// ── Custom Tooltips ─────────────────────────────────────────────────────────

interface SalaryTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
}

function SalaryTooltip({ active, payload, label }: SalaryTooltipProps) {
  if (!active || !payload?.length) return null;
  const earned = payload.find(p => p.name === "earned");
  const projected = payload.find(p => p.name === "projected");
  return (
    <div style={{
      background: "var(--panel-strong)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: "8px 12px",
      fontSize: 13
    }}>
      <div style={{ color: "var(--muted)", marginBottom: 4 }}>{label}-kun</div>
      {earned && <div style={{ color: "var(--success)" }}>Haqiqiy: ${earned.value.toFixed(2)}</div>}
      {projected && <div style={{ color: "var(--primary)" }}>Prognoz: ${projected.value.toFixed(2)}</div>}
    </div>
  );
}

interface HoursTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string; payload: HoursChartPoint }>;
  label?: string;
}

function HoursTooltip({ active, payload, label }: HoursTooltipProps) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const h = Math.floor(entry.value);
  const m = Math.round((entry.value - h) * 60);
  return (
    <div style={{
      background: "var(--panel-strong)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: "8px 12px",
      fontSize: 13
    }}>
      <div style={{ color: "var(--muted)", marginBottom: 4 }}>{label}-kun</div>
      <div>{h} soat {m} daqiqa ishlagan</div>
    </div>
  );
}

// ── Charts ────────────────────────────────────────────────────────────────────

function ChartSection({ data }: { data: EmployeeDashboardData }) {
  const [tab, setTab] = useState<"salary" | "hours">("salary");

  const salaryChartData = useMemo(() => {
    return data.salary_chart.map(pt => ({ ...pt }));
  }, [data.salary_chart]);

  const hoursChartData = data.hours_chart;

  return (
    <div className="card" style={{ padding: "18px 18px 12px" }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          className={`button ${tab === "salary" ? "primary" : "secondary"}`}
          style={{ fontSize: 13, padding: "8px 16px" }}
          onClick={() => setTab("salary")}
        >
          📈 Oylik trend
        </button>
        <button
          className={`button ${tab === "hours" ? "primary" : "secondary"}`}
          style={{ fontSize: 13, padding: "8px 16px" }}
          onClick={() => setTab("hours")}
        >
          ⏱ Kunlik davomat
        </button>
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
              <Area
                type="monotone"
                dataKey="earned"
                name="earned"
                stroke="#7ce7ac"
                strokeWidth={2}
                fill="url(#gradEarned)"
                dot={(props: { key?: string; cx: number; cy: number; index: number }) => {
                  const point = data.salary_chart[props.index];
                  if (!point || point.earned == null) return <g key={props.key} />;
                  const color = point.status === "absent" ? "#f98077" : point.status?.includes("late") ? "#f1bc53" : "transparent";
                  if (color === "transparent") return <g key={props.key} />;
                  return <circle key={props.key} cx={props.cx} cy={props.cy} r={5} fill={color} stroke="#fff" strokeWidth={1.5} />;
                }}
                connectNulls={false}
              />
              <Area
                type="monotone"
                dataKey="projected"
                name="projected"
                stroke="#57c8ff"
                strokeWidth={2}
                strokeDasharray="6 4"
                fill="url(#gradProjected)"
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
            <span><span style={{ color: "#7ce7ac" }}>──</span> Haqiqiy</span>
            <span><span style={{ color: "#57c8ff" }}>╌╌</span> Prognoz</span>
            <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#f98077", verticalAlign: "middle" }} /> Kelmadi</span>
            <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#f1bc53", verticalAlign: "middle" }} /> Kech keldi</span>
          </div>
        </div>
      )}

      {tab === "hours" && (
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={hoursChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} domain={[0, 12]} tickFormatter={(v: number) => `${v}s`} />
              <Tooltip content={<HoursTooltip />} />
              <ReferenceLine y={8} stroke="#f98077" strokeDasharray="4 2" label={{ value: "8 soat", fill: "#f98077", fontSize: 11, position: "right" }} />
              <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                {hoursChartData.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={entry.hours >= 8 ? "#7ce7ac" : entry.hours > 0 ? "#f1bc53" : "#f98077"}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
            <span><span style={{ color: "#7ce7ac" }}>■</span> ≥8 soat</span>
            <span><span style={{ color: "#f1bc53" }}>■</span> &lt;8 soat</span>
            <span><span style={{ color: "#f98077" }}>■</span> Kelmadi</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Daily Table ───────────────────────────────────────────────────────────────

const UZ_MONTHS_SHORT = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];

function formatDateShort(dateKey: string): string {
  const parts = dateKey.split("-");
  const m = parseInt(parts[1], 10) - 1;
  return `${parts[2]}-${UZ_MONTHS_SHORT[m]}`;
}

function statusIcon(status: string): string {
  if (status.includes("absent")) return "❌";
  if (status.includes("late") || status.includes("early")) return "⏰";
  if (status === "on_time" || status === "full_day") return "✅";
  if (status === "off_day" || status === "sunday") return "🏖";
  return "⏳";
}

function formatWorked(seconds: number): string {
  if (seconds === 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
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
      <td style={{ fontSize: 13, color: isAbsent ? "var(--danger)" : isLate ? "var(--warning)" : "var(--success)", fontWeight: 600 }}>
        {impact}
      </td>
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
            <tr>
              <th>Sana</th>
              <th>Holat</th>
              <th>Keldi</th>
              <th>Ketdi</th>
              <th>Ishlagan</th>
              <th>Ta&apos;sir</th>
            </tr>
          </thead>
          <tbody>
            {records.map(r => (
              <DailyRow key={r.date} record={r} secondRate={data.second_rate} dayRate={data.day_rate} />
            ))}
          </tbody>
        </table>
      </div>
      {data.daily_records.length > 10 && (
        <div style={{ padding: "12px 18px" }}>
          <button
            className="button ghost"
            style={{ width: "100%", fontSize: 13 }}
            onClick={() => setExpanded(v => !v)}
          >
            {expanded ? "Kamroq ko'rsatish ↑" : `Yana ${data.daily_records.length - 10} ta ko'rsatish ↓`}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export function DashboardScreen() {
  const { request, session } = useMiniApp();
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
      {query.loading && <DashboardSkeleton />}
      {query.error && <ErrorState message={query.error} />}
      {!query.loading && !query.error && !query.data && <EmptyState label="Ma'lumot topilmadi." />}

      {!query.loading && !query.error && query.data && (
        <div className="page-body">
          {/* Salary cards */}
          <div className="dash-salary-grid">
            <EarnedCard data={query.data} />
            <DeductionCard data={query.data} />
            <ProjectionCard data={query.data} />
          </div>

          {/* Stat cards */}
          <div className="dash-stat-grid">
            <StatCard icon="✅" count={query.data.on_time} label="Vaqtida" color="var(--success)" delay={0} />
            <StatCard icon="⏰" count={query.data.late_days} label="Kech keldi" color="var(--warning)" delay={60} />
            <StatCard icon="❌" count={query.data.absent_days} label="Kelmadi" color="var(--danger)" delay={120} />
            <StatCard icon="📅" count={query.data.workdays_remaining} label="Qoldi" color="var(--primary)" delay={180} />
          </div>

          {/* Charts */}
          <ChartSection data={query.data} />

          {/* Daily table */}
          <DailyTable data={query.data} />
        </div>
      )}
    </AppShell>
  );
}
