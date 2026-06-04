"use client";

import { useEffect, useState } from "react";

import type { SettingsResponse } from "@/lib/types";
import { useApiData } from "@/lib/client/use-api";
import { useMiniApp } from "@/components/providers/miniapp-provider";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";

export function SettingsScreen() {
  const { request, session } = useMiniApp();
  const [savedMessage, setSavedMessage] = useState("");
  const query = useApiData<SettingsResponse>(() => request("/api/settings"), [request, session?.user.id]);
  const [form, setForm] = useState({
    defaultMonthlySalaryUsd: "500",
    workStartTime: "10:00",
    workEndTime: "18:00",
    weeklyOffDay: "0",
    timezone: "Asia/Tashkent"
  });

  useEffect(() => {
    if (!query.data) return;
    setForm({
      defaultMonthlySalaryUsd: String(query.data.config.defaultMonthlySalaryUsd),
      workStartTime: query.data.config.workStartTime,
      workEndTime: query.data.config.workEndTime,
      weeklyOffDay: String(query.data.config.weeklyOffDay),
      timezone: query.data.config.timezone
    });
  }, [query.data]);

  const saveSettings = async () => {
    const result = await request<SettingsResponse>("/api/settings", {
      method: "PATCH",
      body: {
        defaultMonthlySalaryUsd: Number(form.defaultMonthlySalaryUsd),
        workStartTime: form.workStartTime,
        workEndTime: form.workEndTime,
        weeklyOffDay: Number(form.weeklyOffDay),
        timezone: form.timezone
      }
    });
    query.setData(result);
    setSavedMessage("Sozlamalar saqlandi.");
  };

  return (
    <AppShell title="Sozlamalar" subtitle="Ish vaqti va maosh sozlamalari.">
      {query.loading ? <LoadingState /> : null}
      {query.error ? <ErrorState message={query.error} /> : null}
      {!query.loading && !query.error && query.data ? (
        <>
          <Card>
            <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>Sozlamalar</h2>
            <p className="meta-text" style={{ marginBottom: 14 }}>{query.data.note}</p>
            <div style={{ display: "grid", gap: 12 }}>
              <div className="field">
                <label style={{ fontSize: 13, color: "var(--muted)" }}>Oylik maosh ($)</label>
                <input className="input" type="number" style={{ minHeight: 44 }}
                  value={form.defaultMonthlySalaryUsd}
                  onChange={(e) => setForm(p => ({ ...p, defaultMonthlySalaryUsd: e.target.value }))}
                  disabled={session?.user.role !== "ADMIN"} />
              </div>
              <div className="field">
                <label style={{ fontSize: 13, color: "var(--muted)" }}>Ish boshlanish</label>
                <input className="input" type="time" style={{ minHeight: 44 }}
                  value={form.workStartTime}
                  onChange={(e) => setForm(p => ({ ...p, workStartTime: e.target.value }))}
                  disabled={session?.user.role !== "ADMIN"} />
              </div>
              <div className="field">
                <label style={{ fontSize: 13, color: "var(--muted)" }}>Ish tugash</label>
                <input className="input" type="time" style={{ minHeight: 44 }}
                  value={form.workEndTime}
                  onChange={(e) => setForm(p => ({ ...p, workEndTime: e.target.value }))}
                  disabled={session?.user.role !== "ADMIN"} />
              </div>
              <div className="field">
                <label style={{ fontSize: 13, color: "var(--muted)" }}>Dam kuni</label>
                <select className="input" style={{ minHeight: 44 }}
                  value={form.weeklyOffDay}
                  onChange={(e) => setForm(p => ({ ...p, weeklyOffDay: e.target.value }))}
                  disabled={session?.user.role !== "ADMIN"}>
                  <option value="0">Yakshanba</option>
                  <option value="6">Shanba</option>
                </select>
              </div>
              <div className="field">
                <label style={{ fontSize: 13, color: "var(--muted)" }}>Timezone</label>
                <input className="input" style={{ minHeight: 44 }}
                  value={form.timezone}
                  onChange={(e) => setForm(p => ({ ...p, timezone: e.target.value }))}
                  disabled={session?.user.role !== "ADMIN"} />
              </div>
              {session?.user.role === "ADMIN" && (
                <button
                  className="button primary"
                  style={{ width: "100%", minHeight: 48, fontSize: 15, fontWeight: 700 }}
                  onClick={() => void saveSettings()}
                >
                  Saqlash
                </button>
              )}
              {savedMessage && (
                <div style={{ color: "var(--success)", fontSize: 13, textAlign: "center" }}>
                  {savedMessage}
                </div>
              )}
            </div>
          </Card>
        </>
      ) : null}
      {!query.loading && !query.error && !query.data ? <EmptyState label="Settings topilmadi." /> : null}
    </AppShell>
  );
}
