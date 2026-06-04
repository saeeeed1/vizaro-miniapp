"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useMiniApp } from "@/components/providers/miniapp-provider";

const ADMIN_TABS = [
  { href: "/dashboard",  label: "📊", title: "Dashboard"  },
  { href: "/attendance", label: "📋", title: "Attendance"  },
  { href: "/employees",  label: "👥", title: "Employees"   },
  { href: "/salary",     label: "💰", title: "Salary"      },
  { href: "/settings",   label: "⚙️", title: "Settings"   },
];

const USER_TABS = [
  { href: "/dashboard",  label: "📊", title: "Dashboard" },
  { href: "/attendance", label: "📋", title: "Davomat"   },
  { href: "/salary",     label: "💰", title: "Oylik"     },
];

export function BottomNav() {
  const pathname = usePathname();
  const { isAdmin } = useMiniApp();
  const tabs = isAdmin ? ADMIN_TABS : USER_TABS;

  return (
    <nav
      className="bottom-nav"
      style={{
        gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
        height: `calc(56px + max(env(safe-area-inset-bottom), 20px))`,
        paddingBottom: "max(env(safe-area-inset-bottom), 20px)",
        alignItems: "flex-start",
        paddingTop: "8px",
      }}
    >
      {tabs.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={pathname === item.href ? "nav-link active" : "nav-link"}
          style={{
            flexDirection: "column",
            gap: 2,
            fontSize: 10,
            color: pathname === item.href ? "var(--success)" : undefined,
            background: pathname === item.href ? "rgba(124,231,172,0.12)" : undefined,
          }}
        >
          <span style={{ fontSize: 16 }}>{item.label}</span>
          <span>{item.title}</span>
        </Link>
      ))}
    </nav>
  );
}
