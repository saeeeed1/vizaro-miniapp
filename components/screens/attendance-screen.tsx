"use client";

import { useMemo, useState } from "react";

import type { AttendancePageResponse, PeriodKey } from "@/lib/types";
import { useApiData } from "@/lib/client/use-api";
import { useMiniApp } from "@/components/providers/miniapp-provider";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { AttendanceTable, TodayOverviewCard } from "@/components/screens/shared";

function buildAttendanceUrl(period: PeriodKey, from: string, to: string) {
  const params = new URLSearchParams();
  params.set("period", period);
  if (period === "custom" && from && to) {
    params.set("from", from);
    params.set("to", to);
  }
  return `/api/attendance?${params.toString()}`;
}

export function AttendanceScreen() {
  const { request, session } = useMiniApp();
  const [refreshKey, setRefreshKey] = useState(0);
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const path = useMemo(() => buildAttendanceUrl(period, from, to), [period, from, to]);
  const query = useApiData<AttendancePageResponse>(() => request(path), [request, path, session?.user.id, refreshKey]);

  const handleAction = async (kind: "check-in" | "check-out") => {
    const result = await request<AttendancePageResponse>(`/api/attendance/${kind}`, {
      method: "POST",
      body: {}
    });
    query.setData(result);
  };

  return (
    <AppShell
      title="Attendance"
      subtitle="Check-in, check-out va period bo'yicha davomat ko'rinishi."
      actions={
        <div className="pill-row">
          {session?.user.employeeId ? (
            <>
              <Button variant="primary" onClick={() => void handleAction("check-in")}>
                Check In
              </Button>
              <Button variant="secondary" onClick={() => void handleAction("check-out")}>
                Check Out
              </Button>
            </>
          ) : null}
          <Button variant="ghost" onClick={() => setRefreshKey((value) => value + 1)}>
            Refresh
          </Button>
        </div>
      }
    >
      <Card>
        <div className="toolbar">
          <div className="field">
            <span>Period</span>
            <select className="input" value={period} onChange={(event) => setPeriod(event.target.value as PeriodKey)}>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          {period === "custom" ? (
            <>
              <div className="field">
                <span>From</span>
                <input className="input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              </div>
              <div className="field">
                <span>To</span>
                <input className="input" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
              </div>
            </>
          ) : null}
        </div>
      </Card>

      {query.loading ? <LoadingState /> : null}
      {query.error ? <ErrorState message={query.error} /> : null}
      {!query.loading && !query.error && query.data ? (
        <>
          {session?.user.employeeId ? <TodayOverviewCard title="Bugungi Holat" today={query.data.today} /> : null}
          {query.data.alerts.length ? (
            <Card>
              <h3>Alerts</h3>
              <div className="stack">
                {query.data.alerts.map((alert) => (
                  <div key={alert} className="pill">
                    {alert}
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
          <AttendanceTable rows={query.data.records} showEmployee={session?.user.role === "ADMIN"} />
        </>
      ) : null}
      {!query.loading && !query.error && !query.data ? <EmptyState label="Attendance ma'lumotlari topilmadi." /> : null}
    </AppShell>
  );
}
