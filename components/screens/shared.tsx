"use client";

import Link from "next/link";

import { STATUS_TONES } from "@/lib/config";
import type {
  ActivityItem,
  AttendanceRecord,
  Employee,
  EmployeeInsight,
  SummaryCardItem,
  TodayAttendanceCard
} from "@/lib/types";
import { formatCurrencyUsd, formatHoursCompact, formatTimeLabel, statusLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function SummaryGrid({ items }: { items: SummaryCardItem[] }) {
  return (
    <div className="summary-grid">
      {items.map((item) => (
        <Card key={`${item.label}_${item.value}`}>
          <div className="metric-label">{item.label}</div>
          <div className="metric-value">{item.value}</div>
          {item.hint ? <div className="meta-text">{item.hint}</div> : null}
        </Card>
      ))}
    </div>
  );
}

export function StatusPill({ status }: { status: AttendanceRecord["status"] }) {
  return <Badge tone={STATUS_TONES[status]}>{statusLabel(status)}</Badge>;
}

export function TodayOverviewCard({
  title,
  today
}: {
  title: string;
  today: TodayAttendanceCard;
}) {
  return (
    <Card>
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <p>Bugungi check-in / check-out holati</p>
        </div>
        <StatusPill status={today.status} />
      </div>
      <div className="stats-grid">
        <Card>
          <div className="metric-label">Check-in</div>
          <div className="metric-value">{formatTimeLabel(today.checkInTime) ?? "--"}</div>
        </Card>
        <Card>
          <div className="metric-label">Check-out</div>
          <div className="metric-value">{formatTimeLabel(today.checkOutTime) ?? "--"}</div>
        </Card>
        <Card>
          <div className="metric-label">Worked</div>
          <div className="metric-value">{formatHoursCompact(today.workedMinutes)}</div>
        </Card>
        <Card>
          <div className="metric-label">Late / Early</div>
          <div className="metric-value">
            {today.lateMinutes} / {today.earlyLeaveMinutes} min
          </div>
        </Card>
        <Card>
          <div className="metric-label">Earned</div>
          <div className="metric-value">{formatCurrencyUsd(today.dailyEarned)}</div>
        </Card>
        <Card>
          <div className="metric-label">Penalty / Net</div>
          <div className="metric-value">
            {formatCurrencyUsd(today.dailyPenalty)} / {formatCurrencyUsd(today.netDailyAmount)}
          </div>
        </Card>
      </div>
    </Card>
  );
}

export function InsightCard({
  title,
  items
}: {
  title: string;
  items: EmployeeInsight[];
}) {
  return (
    <Card>
      <h3>{title}</h3>
      <div className="stack">
        {items.length ? (
          items.map((item) => (
            <div className="list-item" key={`${item.employeeId}_${item.value}`}>
              <div>
                <Link href={`/employees/${item.employeeId}`}>{item.fullName}</Link>
                <div className="meta-text">{item.position}</div>
              </div>
              <div>
                <div>{item.value}</div>
                {item.secondary ? <div className="meta-text">{item.secondary}</div> : null}
              </div>
            </div>
          ))
        ) : (
          <div className="meta-text">Hozircha ma'lumot yo'q.</div>
        )}
      </div>
    </Card>
  );
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <Card>
      <h3>Latest Attendance Activity</h3>
      <div className="activity-list">
        {items.length ? (
          items.map((item) => (
            <div className="activity-item" key={item.id}>
              <div>
                <div>{item.title}</div>
                <div className="meta-text">{item.subtitle}</div>
              </div>
              <div>
                {item.amount ? <div>{item.amount}</div> : null}
                {item.tone ? <Badge tone={item.tone}>{item.tone}</Badge> : null}
              </div>
            </div>
          ))
        ) : (
          <div className="meta-text">Aktivlik topilmadi.</div>
        )}
      </div>
    </Card>
  );
}

export function AttendanceTable({
  rows,
  showEmployee = false
}: {
  rows: Array<AttendanceRecord & { employee?: Employee }>;
  showEmployee?: boolean;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {rows.length === 0 && (
        <div className="meta-text" style={{ textAlign: "center", padding: 24 }}>
          Yozuvlar topilmadi.
        </div>
      )}
      {rows.map((row) => {
        const isAbsent = row.status === "ABSENT";
        const isLate = row.status === "LATE" || row.status === "EARLY_LEAVE";
        const borderColor = isAbsent ? "var(--danger)" : isLate ? "var(--warning)" : "var(--success)";
        const ciTime = formatTimeLabel(row.checkInTime) ?? "—";
        const coTime = formatTimeLabel(row.checkOutTime) ?? "—";
        return (
          <div
            key={row.id}
            className="card"
            style={{ borderLeft: `3px solid ${borderColor}`, padding: "10px 14px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{row.date}</span>
              <StatusPill status={row.status} />
            </div>
            {showEmployee && row.employee && (
              <div style={{ fontSize: 13, marginBottom: 3 }}>
                {row.employee.user.fullName}
              </div>
            )}
            <div className="meta-text" style={{ fontSize: 12 }}>
              Kirdi: <b>{ciTime}</b>&nbsp; Chiqdi: <b>{coTime}</b>
            </div>
            <div className="meta-text" style={{ fontSize: 12, marginTop: 2 }}>
              Ishladi: {formatHoursCompact(row.workedMinutes)}
              {row.lateMinutes > 0 && (
                <span style={{ color: "var(--warning)", marginLeft: 8 }}>+{row.lateMinutes}d kech</span>
              )}
              <span style={{ marginLeft: 8, color: "var(--success)" }}>
                +{formatCurrencyUsd(row.netDailyAmount)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
