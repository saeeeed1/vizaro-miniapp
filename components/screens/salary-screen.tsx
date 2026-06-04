"use client";

import type { SalaryPageResponse } from "@/lib/types";
import { formatCurrencyUsd, formatHoursCompact } from "@/lib/utils";
import { useApiData } from "@/lib/client/use-api";
import { useMiniApp } from "@/components/providers/miniapp-provider";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { SummaryGrid } from "@/components/screens/shared";

export function SalaryScreen() {
  const { request, session } = useMiniApp();
  const query = useApiData<SalaryPageResponse>(() => request("/api/salary"), [request, session?.user.id]);

  return (
    <AppShell
      title="Salary & Penalties"
      subtitle="Worked hours, overtime, penalties va net salary breakdown."
      actions={<Button variant="ghost">Current Month</Button>}
    >
      {query.loading ? <LoadingState /> : null}
      {query.error ? <ErrorState message={query.error} /> : null}
      {!query.loading && !query.error && query.data ? (
        <>
          <SummaryGrid items={query.data.summary} />
          <div style={{ display: "grid", gap: 8 }}>
            {query.data.rows.map((row) => {
              const isGood = row.netSalary >= row.employee.monthlySalaryUsd * 0.9;
              return (
                <div key={row.employee.id} className="card" style={{ padding: "12px 14px" }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{row.employee.user.fullName}</div>
                  <div className="meta-text" style={{ fontSize: 12, marginBottom: 6 }}>{row.employee.position}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12 }}>
                    <div className="meta-text">Ishladi: <b>{formatHoursCompact(row.totalWorkedMinutes)}</b></div>
                    <div className="meta-text">Ortiqcha: <b>{formatHoursCompact(row.totalOvertimeMinutes)}</b></div>
                    <div style={{ color: "var(--danger)" }}>Jarima: <b>−{formatCurrencyUsd(row.totalPenalty)}</b></div>
                    <div style={{ color: isGood ? "var(--success)" : "var(--warning)", fontWeight: 700 }}>
                      Net: <b>{formatCurrencyUsd(row.netSalary)}</b>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
      {!query.loading && !query.error && !query.data ? <EmptyState label="Salary ma'lumotlari topilmadi." /> : null}
    </AppShell>
  );
}
