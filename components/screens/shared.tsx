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
    <Card>
      <div className="section-heading">
        <div>
          <h2>Attendance Records</h2>
          <p>Davomat, penalty va daily earning tafsilotlari</p>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sana</th>
              {showEmployee ? <th>Xodim</th> : null}
              <th>Status</th>
              <th>Kirgan</th>
              <th>Chiqqan</th>
              <th>Ishlagan</th>
              <th>Kech / Erta</th>
              <th>Earned</th>
              <th>Penalty</th>
              <th>Net</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.date}</td>
                {showEmployee ? <td>{row.employee?.user.fullName ?? "--"}</td> : null}
                <td>
                  <StatusPill status={row.status} />
                </td>
                <td>{formatTimeLabel(row.checkInTime) ?? "--"}</td>
                <td>{formatTimeLabel(row.checkOutTime) ?? "--"}</td>
                <td>{formatHoursCompact(row.workedMinutes)}</td>
                <td>
                  {row.lateMinutes} / {row.earlyLeaveMinutes} min
                </td>
                <td>{formatCurrencyUsd(row.dailyEarned)}</td>
                <td>{formatCurrencyUsd(row.dailyPenalty)}</td>
                <td>{formatCurrencyUsd(row.netDailyAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
