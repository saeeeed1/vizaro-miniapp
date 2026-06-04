"use client";

import { useMemo, useState } from "react";

import type { PeriodKey, ReportsResponse } from "@/lib/types";
import { useApiData } from "@/lib/client/use-api";
import { useMiniApp } from "@/components/providers/miniapp-provider";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { AttendanceTable, SummaryGrid } from "@/components/screens/shared";

function buildReportUrl(period: PeriodKey, from: string, to: string, employeeId: string) {
  const params = new URLSearchParams();
  params.set("period", period);
  if (period === "custom" && from && to) {
    params.set("from", from);
    params.set("to", to);
  }
  if (employeeId) {
    params.set("employeeId", employeeId);
  }
  return `/api/reports?${params.toString()}`;
}

export function ReportsScreen() {
  const { request, requestRaw, session } = useMiniApp();
  const [refreshKey, setRefreshKey] = useState(0);
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [employeeId, setEmployeeId] = useState("");

  const path = useMemo(() => buildReportUrl(period, from, to, employeeId), [period, from, to, employeeId]);
  const query = useApiData<ReportsResponse>(() => request(path), [request, path, session?.user.id, refreshKey]);

  const exportCsv = async () => {
    const response = await requestRaw(path.replace("/api/reports", "/api/reports/export.csv"));
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "attendance-report.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell
      title="Reports"
      subtitle="Daily, weekly, monthly va custom interval bo'yicha hisobotlar."
      actions={
        <div className="pill-row">
          <Button variant="secondary" onClick={() => void exportCsv()}>
            Export CSV
          </Button>
          <Button variant="ghost" onClick={() => setRefreshKey((value) => value + 1)}>
            Refresh
          </Button>
        </div>
      }
    >
      <Card>
        <div className="toolbar">
          <select className="input" value={period} onChange={(event) => setPeriod(event.target.value as PeriodKey)}>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="custom">Custom</option>
          </select>
          {session?.user.role === "ADMIN" ? (
            <select className="input" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
              <option value="">Hamma xodimlar</option>
              {(session.availableUsers ?? [])
                .filter((user) => user.employeeId)
                .map((user) => (
                  <option key={user.id} value={user.employeeId ?? ""}>
                    {user.fullName}
                  </option>
                ))}
            </select>
          ) : null}
          {period === "custom" ? (
            <>
              <input className="input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              <input className="input" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </>
          ) : null}
        </div>
      </Card>

      {query.loading ? <LoadingState /> : null}
      {query.error ? <ErrorState message={query.error} /> : null}
      {!query.loading && !query.error && query.data ? (
        <>
          <SummaryGrid items={query.data.summary} />
          <AttendanceTable rows={query.data.rows} showEmployee={session?.user.role === "ADMIN"} />
        </>
      ) : null}
      {!query.loading && !query.error && !query.data ? <EmptyState label="Report topilmadi." /> : null}
    </AppShell>
  );
}
