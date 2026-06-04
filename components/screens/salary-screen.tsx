"use client";

import type { SalaryPageResponse } from "@/lib/types";
import { formatCurrencyUsd, formatHoursCompact } from "@/lib/utils";
import { useApiData } from "@/lib/client/use-api";
import { useMiniApp } from "@/components/providers/miniapp-provider";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
          <Card>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Worked</th>
                    <th>Overtime</th>
                    <th>Penalty</th>
                    <th>Earned</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.rows.map((row) => (
                    <tr key={row.employee.id}>
                      <td>
                        {row.employee.user.fullName}
                        <div className="meta-text">{row.employee.position}</div>
                      </td>
                      <td>{formatHoursCompact(row.totalWorkedMinutes)}</td>
                      <td>{formatHoursCompact(row.totalOvertimeMinutes)}</td>
                      <td>{formatCurrencyUsd(row.totalPenalty)}</td>
                      <td>{formatCurrencyUsd(row.totalEarned)}</td>
                      <td>{formatCurrencyUsd(row.netSalary)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}
      {!query.loading && !query.error && !query.data ? <EmptyState label="Salary ma'lumotlari topilmadi." /> : null}
    </AppShell>
  );
}
