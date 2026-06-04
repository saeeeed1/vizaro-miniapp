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
  const { request, session, isAdmin } = useMiniApp();
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSalary, setEditSalary] = useState("");
  const query = useApiData<EmployeeListItem[]>(() => request("/api/employees"), [request, session?.user.id, refreshKey]);

  const saveSalary = async (employeeId: string) => {
    const val = parseFloat(editSalary);
    if (!val || val <= 0) return;
    // employeeId = "emp_{telegram_user_id}"
    const userId = employeeId.replace("emp_", "");
    await request(`/api/employees/${userId}/salary`, {
      method: "PATCH",
      body: { monthly_salary: val },
    });
    setEditingId(null);
    setRefreshKey(k => k + 1);
  };

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
                    <h3 style={{ fontSize: 15, margin: 0 }}>{row.employee.user.fullName}</h3>
                  </Link>
                  <p className="meta-text" style={{ margin: "2px 0 0", fontSize: 12 }}>
                    @{row.employee.user.username ?? "—"}
                  </p>
                </div>
                <StatusPill status={row.statusToday} />
              </div>

              {/* Oylik satri */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0 4px" }}>
                <span className="meta-text" style={{ fontSize: 12 }}>
                  💰 Oylik: <b>${row.employee.monthlySalaryUsd.toFixed(0)}</b>
                </span>
                {isAdmin && editingId !== row.employee.id && (
                  <button
                    className="button ghost"
                    style={{ padding: "3px 8px", fontSize: 11, minHeight: "unset" }}
                    onClick={() => { setEditingId(row.employee.id); setEditSalary(String(row.employee.monthlySalaryUsd)); }}
                  >
                    ✏️
                  </button>
                )}
              </div>

              {/* Inline tahrirlash */}
              {isAdmin && editingId === row.employee.id && (
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <input
                    className="input"
                    type="number"
                    style={{ maxWidth: 120, minHeight: 36, fontSize: 13, padding: "4px 10px" }}
                    value={editSalary}
                    onChange={e => setEditSalary(e.target.value)}
                    placeholder="Oylik ($)"
                    autoFocus
                  />
                  <button
                    className="button primary"
                    style={{ padding: "4px 14px", fontSize: 12, minHeight: 36 }}
                    onClick={() => void saveSalary(row.employee.id)}
                  >
                    Saqlash
                  </button>
                  <button
                    className="button secondary"
                    style={{ padding: "4px 10px", fontSize: 12, minHeight: 36 }}
                    onClick={() => setEditingId(null)}
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Statistika */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                <div className="card" style={{ padding: "8px 10px", textAlign: "center" }}>
                  <div className="meta-text" style={{ fontSize: 11 }}>Keldi</div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{row.arrivedDays}</div>
                </div>
                <div className="card" style={{ padding: "8px 10px", textAlign: "center" }}>
                  <div className="meta-text" style={{ fontSize: 11 }}>Kech/❌</div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{row.lateDays}/{row.absentDays}</div>
                </div>
                <div className="card" style={{ padding: "8px 10px", textAlign: "center" }}>
                  <div className="meta-text" style={{ fontSize: 11 }}>Net</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--success)" }}>{formatCurrencyUsd(row.netSalary)}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
      {!query.loading && !query.error && !query.data?.length ? <EmptyState label="Employee ro'yxati bo'sh." /> : null}
    </AppShell>
  );
}
