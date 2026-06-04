"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";

import type { EmployeeDetailResponse } from "@/lib/types";
import { APP_TIMEZONE } from "@/lib/config";
import { formatCurrencyUsd, formatHoursCompact } from "@/lib/utils";
import { useApiData } from "@/lib/client/use-api";
import { useMiniApp } from "@/components/providers/miniapp-provider";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { AttendanceTable, StatusPill, TodayOverviewCard } from "@/components/screens/shared";

function toDateTimeInput(value: string | null) {
  return value ? formatInTimeZone(value, APP_TIMEZONE, "yyyy-MM-dd'T'HH:mm") : "";
}

function toIso(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function EmployeeDetailScreen({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const { request, session } = useMiniApp();
  const [refreshKey, setRefreshKey] = useState(0);
  const query = useApiData<EmployeeDetailResponse>(() => request(`/api/employees/${employeeId}`), [request, employeeId, session?.user.id, refreshKey]);

  const [editForm, setEditForm] = useState({
    fullName: "",
    username: "",
    telegramId: "",
    position: "",
    monthlySalaryUsd: "500",
    workStartTime: "10:00",
    workEndTime: "18:00",
    isActive: true
  });

  const [correctionForm, setCorrectionForm] = useState({
    date: "",
    checkInTime: "",
    checkOutTime: "",
    notes: ""
  });

  useEffect(() => {
    if (!query.data) return;
    const detail = query.data;
    const latestAttendance = detail.attendance[0];

    setEditForm({
      fullName: detail.employee.user.fullName,
      username: detail.employee.user.username ?? "",
      telegramId: detail.employee.user.telegramId,
      position: detail.employee.position,
      monthlySalaryUsd: String(detail.employee.monthlySalaryUsd),
      workStartTime: detail.employee.workStartTime,
      workEndTime: detail.employee.workEndTime,
      isActive: detail.employee.isActive
    });
    setCorrectionForm((previous) => ({
      ...previous,
      date: latestAttendance?.date ?? previous.date,
      checkInTime: latestAttendance?.checkInTime ? toDateTimeInput(latestAttendance.checkInTime) : previous.checkInTime,
      checkOutTime: latestAttendance?.checkOutTime ? toDateTimeInput(latestAttendance.checkOutTime) : previous.checkOutTime
    }));
  }, [query.data]);

  const saveEmployee = async () => {
    const result = await request<EmployeeDetailResponse>(`/api/employees/${employeeId}`, {
      method: "PATCH",
      body: {
        fullName: editForm.fullName,
        username: editForm.username || null,
        telegramId: editForm.telegramId,
        position: editForm.position,
        monthlySalaryUsd: Number(editForm.monthlySalaryUsd),
        workStartTime: editForm.workStartTime,
        workEndTime: editForm.workEndTime,
        isActive: editForm.isActive
      }
    });
    query.setData(result);
  };

  const saveCorrection = async () => {
    const result = await request<EmployeeDetailResponse>("/api/attendance/manual-correction", {
      method: "POST",
      body: {
        employeeId,
        date: correctionForm.date,
        checkInTime: toIso(correctionForm.checkInTime),
        checkOutTime: toIso(correctionForm.checkOutTime),
        notes: correctionForm.notes || null
      }
    });
    query.setData(result);
  };

  const removeEmployee = async () => {
    if (!window.confirm("Xodimni o'chirishni tasdiqlaysizmi?")) {
      return;
    }

    await request(`/api/employees/${employeeId}`, { method: "DELETE" });
    router.push("/employees");
  };

  const detail = query.data;

  return (
    <AppShell
      title="Employee Detail"
      subtitle="Profile, statistics, manual correction va audit trail."
      actions={
        <Button variant="ghost" onClick={() => setRefreshKey((value) => value + 1)}>
          Refresh
        </Button>
      }
    >
      {query.loading ? <LoadingState /> : null}
      {query.error ? <ErrorState message={query.error} /> : null}
      {!query.loading && !query.error && detail ? (
        <>
          <Card>
            <div className="section-heading">
              <div>
                <h2>{detail.employee.user.fullName}</h2>
                <p>
                  {detail.employee.position} / Telegram ID {detail.employee.user.telegramId}
                </p>
              </div>
              <StatusPill status={detail.today.status} />
            </div>
          </Card>

          <TodayOverviewCard title="Bugungi Employee Holati" today={detail.today} />

          <div className="summary-grid">
            <Card>
              <div className="metric-label">Shu oy kelgan</div>
              <div className="metric-value">{detail.stats.arrivedDays} kun</div>
            </Card>
            <Card>
              <div className="metric-label">Kech / absent</div>
              <div className="metric-value">
                {detail.stats.lateDays} / {detail.stats.absentDays}
              </div>
            </Card>
            <Card>
              <div className="metric-label">Worked / Overtime</div>
              <div className="metric-value">
                {formatHoursCompact(detail.stats.workedMinutes)} / {formatHoursCompact(detail.stats.overtimeMinutes)}
              </div>
            </Card>
            <Card>
              <div className="metric-label">Penalty / Earned / Net</div>
              <div className="metric-value">
                {formatCurrencyUsd(detail.stats.totalPenalty)} / {formatCurrencyUsd(detail.stats.totalEarned)} / {formatCurrencyUsd(detail.stats.netSalary)}
              </div>
            </Card>
          </div>

          {session?.user.role === "ADMIN" ? (
            <div className="two-col">
              <Card>
                <div className="section-heading">
                  <div>
                    <h2>Edit Employee</h2>
                    <p>Maosh, username va ish vaqtini yangilang.</p>
                  </div>
                  <div className="pill-row">
                    <Button variant="danger" onClick={() => void removeEmployee()}>
                      Delete
                    </Button>
                    <Button onClick={() => void saveEmployee()}>Save Changes</Button>
                  </div>
                </div>
                <div className="form-grid">
                  <input className="input" value={editForm.fullName} onChange={(event) => setEditForm((prev) => ({ ...prev, fullName: event.target.value }))} />
                  <input className="input" value={editForm.username} onChange={(event) => setEditForm((prev) => ({ ...prev, username: event.target.value }))} />
                  <input className="input" value={editForm.telegramId} onChange={(event) => setEditForm((prev) => ({ ...prev, telegramId: event.target.value }))} />
                  <input className="input" value={editForm.position} onChange={(event) => setEditForm((prev) => ({ ...prev, position: event.target.value }))} />
                  <input className="input" type="number" value={editForm.monthlySalaryUsd} onChange={(event) => setEditForm((prev) => ({ ...prev, monthlySalaryUsd: event.target.value }))} />
                  <input className="input" type="time" value={editForm.workStartTime} onChange={(event) => setEditForm((prev) => ({ ...prev, workStartTime: event.target.value }))} />
                  <input className="input" type="time" value={editForm.workEndTime} onChange={(event) => setEditForm((prev) => ({ ...prev, workEndTime: event.target.value }))} />
                  <label className="pill">
                    <input type="checkbox" checked={editForm.isActive} onChange={(event) => setEditForm((prev) => ({ ...prev, isActive: event.target.checked }))} />
                    Active employee
                  </label>
                </div>
              </Card>

              <Card>
                <div className="section-heading">
                  <div>
                    <h2>Manual Correction</h2>
                    <p>Audit log bilan attendance yozuvini tahrirlang.</p>
                  </div>
                  <Button onClick={() => void saveCorrection()}>Apply Correction</Button>
                </div>
                <div className="form-grid">
                  <input className="input" type="date" value={correctionForm.date} onChange={(event) => setCorrectionForm((prev) => ({ ...prev, date: event.target.value }))} />
                  <input className="input" type="datetime-local" value={correctionForm.checkInTime} onChange={(event) => setCorrectionForm((prev) => ({ ...prev, checkInTime: event.target.value }))} placeholder="Check in" />
                  <input className="input" type="datetime-local" value={correctionForm.checkOutTime} onChange={(event) => setCorrectionForm((prev) => ({ ...prev, checkOutTime: event.target.value }))} placeholder="Check out" />
                  <textarea className="textarea" value={correctionForm.notes} onChange={(event) => setCorrectionForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Notes" />
                </div>
              </Card>
            </div>
          ) : null}

          <AttendanceTable rows={detail.attendance.map((record) => ({ ...record, employee: detail.employee }))} />

          <div className="two-col">
            <Card>
              <h3>Penalties</h3>
              <div className="stack">
                {detail.penalties.length ? (
                  detail.penalties.slice(0, 12).map((penalty) => (
                    <div key={penalty.id} className="list-item">
                      <div>
                        <div>{penalty.type}</div>
                        <div className="meta-text">{penalty.reason ?? "No reason"}</div>
                      </div>
                      <div>{formatCurrencyUsd(penalty.amount)}</div>
                    </div>
                  ))
                ) : (
                  <EmptyState label="Penalty yozuvlari topilmadi." />
                )}
              </div>
            </Card>

            <Card>
              <h3>Audit Logs</h3>
              <div className="stack">
                {detail.auditLogs.length ? (
                  detail.auditLogs.map((log) => (
                    <div key={log.id} className="list-item">
                      <div>
                        <div>{log.action}</div>
                        <div className="meta-text">{log.createdAt}</div>
                      </div>
                      <div className="meta-text">{JSON.stringify(log.payload ?? {})}</div>
                    </div>
                  ))
                ) : (
                  <EmptyState label="Audit log topilmadi." />
                )}
              </div>
            </Card>
          </div>
        </>
      ) : null}
      {!query.loading && !query.error && !query.data ? <EmptyState label="Employee detail topilmadi." /> : null}
    </AppShell>
  );
}
