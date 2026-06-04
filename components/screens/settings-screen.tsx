"use client";

import { useEffect, useState } from "react";

import type { SettingsResponse } from "@/lib/types";
import { useApiData } from "@/lib/client/use-api";
import { useMiniApp } from "@/components/providers/miniapp-provider";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
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
    <AppShell
      title="Settings"
      subtitle="Work schedule, default salary va timezone boshqaruvi."
      actions={
        session?.user.role === "ADMIN" ? (
          <Button onClick={() => void saveSettings()}>Save Settings</Button>
        ) : null
      }
    >
      {query.loading ? <LoadingState /> : null}
      {query.error ? <ErrorState message={query.error} /> : null}
      {!query.loading && !query.error && query.data ? (
        <>
          <Card>
            <h2>System Config</h2>
            <p className="meta-text">{query.data.note}</p>
            <div className="form-grid">
              <input className="input" type="number" value={form.defaultMonthlySalaryUsd} onChange={(event) => setForm((prev) => ({ ...prev, defaultMonthlySalaryUsd: event.target.value }))} disabled={session?.user.role !== "ADMIN"} />
              <input className="input" type="time" value={form.workStartTime} onChange={(event) => setForm((prev) => ({ ...prev, workStartTime: event.target.value }))} disabled={session?.user.role !== "ADMIN"} />
              <input className="input" type="time" value={form.workEndTime} onChange={(event) => setForm((prev) => ({ ...prev, workEndTime: event.target.value }))} disabled={session?.user.role !== "ADMIN"} />
              <select className="input" value={form.weeklyOffDay} onChange={(event) => setForm((prev) => ({ ...prev, weeklyOffDay: event.target.value }))} disabled={session?.user.role !== "ADMIN"}>
                <option value="0">Sunday</option>
                <option value="6">Saturday</option>
              </select>
              <input className="input" value={form.timezone} onChange={(event) => setForm((prev) => ({ ...prev, timezone: event.target.value }))} disabled={session?.user.role !== "ADMIN"} />
            </div>
            {savedMessage ? <div className="pill">{savedMessage}</div> : null}
          </Card>

          <div className="two-col">
            <Card>
              <h3>Telegram Mini App Notes</h3>
              <div className="stack">
                <div className="pill">BotFather orqali Web App URL ni sozlang.</div>
                <div className="pill">Mini App requestlari Telegram initData bilan auth qilinadi.</div>
                <div className="pill">Demo mode yoqilganida local user switcher ishlaydi.</div>
              </div>
            </Card>
            <Card>
              <h3>Architecture</h3>
              <div className="stack">
                <div className="pill">Frontend: Next.js App Router</div>
                <div className="pill">API: Next Route Handlers</div>
                <div className="pill">DB schema: Prisma + PostgreSQL ready</div>
                <div className="pill">Export: CSV working, Excel hook easy to extend</div>
              </div>
            </Card>
          </div>
        </>
      ) : null}
      {!query.loading && !query.error && !query.data ? <EmptyState label="Settings topilmadi." /> : null}
    </AppShell>
  );
}
