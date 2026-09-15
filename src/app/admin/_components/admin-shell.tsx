"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export const adminNavigation = [
  { href: "/admin", label: "Overview", icon: "⌂" },
  { href: "/admin/metrics", label: "Metrics", icon: "↗" },
  { href: "/admin/users", label: "Users & LTV", icon: "◎" },
  { href: "/admin/segments", label: "Segments", icon: "▦" },
  { href: "/admin/support", label: "Support", icon: "✦" },
  { href: "/admin/seo", label: "Content", icon: "✎" },
  { href: "/admin/assets", label: "Assets", icon: "▧" },
  { href: "/admin/notifications", label: "Notifications", icon: "◈" },
  { href: "/admin/catalog", label: "Index", icon: "№" },
  { href: "/admin/indexing", label: "Unindexed", icon: "◌" },
  { href: "/admin/maintenance", label: "Maintenance", icon: "↻" },
  { href: "/admin/creator-rewards", label: "Creator Rewards", icon: "¤" },
  { href: "/admin/payouts", label: "Payouts", icon: "⇄" },
  { href: "/admin/guides", label: "Wildlife Guides", icon: "⌖" },
  { href: "/admin/sponsored-challenges", label: "Sponsored Challenges", icon: "★" },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Shared admin chrome: sidebar on desktop, scrollable nav row on phones. */
export default function AdminShell({ children, sidebarFooter }: { children: ReactNode; sidebarFooter?: ReactNode }) {
  const pathname = usePathname() || "/admin";

  return (
    <div className="min-h-screen bg-canvas-950 text-ink-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[110rem]">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line-300 bg-canvas-950/70 px-3 py-5 lg:flex">
          <Link href="/admin" className="flex items-center gap-3 px-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-400 text-lg font-black text-canvas-950">A</span>
            <span>
              <span className="block font-display text-lg text-white">AnimalDex</span>
              <span className="block text-[10px] font-black uppercase tracking-[.18em] text-ink-500">Operations</span>
            </span>
          </Link>
          <nav className="mt-6 min-h-0 flex-1 space-y-0.5 overflow-y-auto" aria-label="Admin navigation">
            {adminNavigation.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-bold transition ${active ? "bg-primary-500/15 text-primary-100" : "text-ink-400 hover:bg-white/[.04] hover:text-white"}`}
                >
                  <span className="grid h-6 w-6 place-items-center text-sm" aria-hidden="true">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          {sidebarFooter ? <div className="mt-4">{sidebarFooter}</div> : null}
        </aside>

        <div className="min-w-0 flex-1">
          <nav className="flex gap-1 overflow-x-auto border-b border-line-300 px-4 py-3 lg:hidden" aria-label="Admin navigation">
            {adminNavigation.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${active ? "border-primary-300 bg-primary-500/15 text-primary-100" : "border-line-300 text-ink-400"}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          {children}
        </div>
      </div>
    </div>
  );
}
