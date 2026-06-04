"use client";

import Link from "next/link";
import { useState } from "react";

import type { EmployeeListItem } from "@/lib/types";
import { formatCurrencyUsd, formatHoursCompact } from "@/lib/utils";
import { useApiData } from "@/lib/client/use-api";
import { useMiniApp } from "@/components/providers/miniapp-provider";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { StatusPill } from "@/components/screens/shared";

const INITIAL_FORM = {
  fullName: "",
  username: "",
  telegramId: "",
  position: "",
  monthlySalaryUsd: "500",
  workStartTime: "10:00",
  workEndTime: "18:00"
};

export function EmployeesScreen() {
  const { request, session } = useMiniApp();
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState(INITIAL_FORM);
  const query = useApiData<EmployeeListItem[]>(() => request("/api/employees"), [request, session?.user.id, refreshKey]);

  const createNewEmployee = async () => {
    const result = await request<EmployeeListItem[]>("/api/employees", {
      method: "POST",
      body: {
        fullName: form.fullName,
        username: form.username || null,
        telegramId: form.telegramId,
        position: form.position,
        monthlySalaryUsd: Number(form.monthlySalaryUsd),
        workStartTime: form.workStartTime,
        workEndTime: form.workEndTime
      }
    });
    query.setData(result);
    setForm(INITIAL_FORM);
  };

  return (
    <AppShell
      title="Employees"
      subtitle="Xodimlar ro'yxati, oylik summary va tezkor boshqaruv."
      actions={
        <Button variant="ghost" onClick={() => setRefreshKey((value) => value + 1)}>
          Refresh
        </Button>
      }
    >
      {session?.user.role === "ADMIN" ? (
        <Card>
          <div className="section-heading">
            <div>
              <h2>Yangi Xodim Qo'shish</h2>
              <p>Telegram ID, position va schedule bilan employee yarating.</p>
            </div>
            <Button onClick={() => void createNewEmployee()}>Save Employee</Button>
          </div>
          <div className="form-grid">
            <input className="input" placeholder="Full name" value={form.fullName} onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))} />
            <input className="input" placeholder="Username" value={form.username} onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))} />
            <input className="input" placeholder="Telegram ID" value={form.telegramId} onChange={(event) => setForm((prev) => ({ ...prev, telegramId: event.target.value }))} />
            <input className="input" placeholder="Position" value={form.position} onChange={(event) => setForm((prev) => ({ ...prev, position: event.target.value }))} />
            <input className="input" type="number" placeholder="Monthly salary" value={form.monthlySalaryUsd} onChange={(event) => setForm((prev) => ({ ...prev, monthlySalaryUsd: event.target.value }))} />
            <input className="input" type="time" value={form.workStartTime} onChange={(event) => setForm((prev) => ({ ...prev, workStartTime: event.target.value }))} />
            <input className="input" type="time" value={form.workEndTime} onChange={(event) => setForm((prev) => ({ ...prev, workEndTime: event.target.value }))} />
          </div>
        </Card>
      ) : null}

      {query.loading ? <LoadingState /> : null}
      {query.error ? <ErrorState message={query.error} /> : null}
      {!query.loading && !query.error && query.data?.length ? (
        <div className="stack">
          {query.data.map((row) => (
            <Card key={row.employee.id}>
              <div className="row-between">
                <div>
                  <Link href={`/employees/${row.employee.id}`}>
                    <h3>{row.employee.user.fullName}</h3>
                  </Link>
                  <p className="meta-text">
                    {row.employee.position} / @{row.employee.user.username ?? "username yo'q"}
                  </p>
                </div>
                <StatusPill status={row.statusToday} />
              </div>
              <div className="stats-grid">
                <Card>
                  <div className="metric-label">Kelgan kunlar</div>
                  <div className="metric-value">{row.arrivedDays}</div>
                </Card>
                <Card>
                  <div className="metric-label">Late / Absent</div>
                  <div className="metric-value">
                    {row.lateDays} / {row.absentDays}
                  </div>
                </Card>
                <Card>
                  <div className="metric-label">Worked</div>
                  <div className="metric-value">{formatHoursCompact(row.workedMinutes)}</div>
                </Card>
                <Card>
                  <div className="metric-label">Penalty</div>
                  <div className="metric-value">{formatCurrencyUsd(row.totalPenalty)}</div>
                </Card>
                <Card>
                  <div className="metric-label">Net Salary</div>
                  <div className="metric-value">{formatCurrencyUsd(row.netSalary)}</div>
                </Card>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
      {!query.loading && !query.error && !query.data?.length ? <EmptyState label="Employee ro'yxati bo'sh." /> : null}
    </AppShell>
  );
}
