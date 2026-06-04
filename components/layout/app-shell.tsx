"use client";


import { APP_NAME } from "@/lib/config";
import { useMiniApp } from "@/components/providers/miniapp-provider";
import { BottomNav } from "@/components/layout/bottom-nav";
import { LoadingState, ErrorState } from "@/components/ui/state";

export function AppShell({
  title,
  subtitle,
  children,
  actions
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const { session, loading, error } = useMiniApp();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="eyebrow">{APP_NAME}</span>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className="header-side">
          {actions}
        </div>
      </header>

      <div className="session-strip">
        <span>{session ? `${session.user.fullName} / ${session.user.role}` : "Sessiya yuklanmoqda"}</span>
        <span>{session?.config.timezone ?? "Asia/Tashkent"}</span>
      </div>

      <main className="page-body">
        {loading ? <LoadingState label="Mini App sessiyasi yuklanmoqda..." /> : null}
        {error ? <ErrorState message={error} /> : null}
        {!loading && !error ? children : null}
      </main>

      <BottomNav />
    </div>
  );
}
