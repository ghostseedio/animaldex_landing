"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useCallback, useEffect, useState, type ReactNode} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import {AltArrowRight, Logout, SidebarMinimalistic, SquareArrowRightUp} from "solar-icon-set";
import {cn} from "@/components/admin/ui";
import PipelineHealth from "@/app/admin/_components/pipeline-health";
import {activeAdminHref, adminBreadcrumbs, adminNavGroups, type AdminNavItem} from "@/app/admin/_components/admin-nav";

const SIDEBAR_COOKIE = "admin_sidebar";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Kept in sync with the `lg:pl-*` padding on the content column below. */
const WIDTH_EXPANDED = "16rem";
const WIDTH_COLLAPSED = "3.5rem";

function NavLink({item, active, collapsed, onNavigate}: {item: AdminNavItem; active: boolean; collapsed: boolean; onNavigate?: () => void}) {
    const Icon = item.icon;
    const link = (
        <Link
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
                "group/item flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-bold transition",
                collapsed && "justify-center px-0",
                active ? "bg-primary-500/15 text-primary-100" : "text-ink-400 hover:bg-white/4 hover:text-white",
            )}
        >
            <Icon size={18} className="shrink-0" />
            {collapsed ? null : (
                <>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {/* The same marker the app uses for a current tab. */}
                    {active ? <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-primary-400" /> : null}
                </>
            )}
        </Link>
    );

    if (!collapsed) return link;

    return (
        <TooltipPrimitive.Root>
            <TooltipPrimitive.Trigger asChild>{link}</TooltipPrimitive.Trigger>
            <TooltipPrimitive.Portal>
                <TooltipPrimitive.Content
                    side="right"
                    sideOffset={8}
                    className="z-[60] rounded-lg border border-line-300 bg-canvas-950 px-3 py-2 text-xs font-bold text-white shadow-2xl"
                >
                    {item.label}
                </TooltipPrimitive.Content>
            </TooltipPrimitive.Portal>
        </TooltipPrimitive.Root>
    );
}

function Brand({collapsed}: {collapsed: boolean}) {
    return (
        <Link href="/admin" className={cn("flex items-center gap-3 px-2", collapsed && "justify-center px-0")} aria-label="AnimalDex admin home">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-400 text-lg font-black text-canvas-950">A</span>
            {collapsed ? null : (
                <span className="min-w-0">
                    <span className="block truncate font-display text-lg text-white">AnimalDex</span>
                    <span className="block text-[10px] font-black uppercase tracking-[.18em] text-ink-500">Operations</span>
                </span>
            )}
        </Link>
    );
}

function NavGroups({collapsed, activeHref, onNavigate}: {collapsed: boolean; activeHref: string | null; onNavigate?: () => void}) {
    return (
        <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden py-1" aria-label="Admin navigation">
            {adminNavGroups.map((group, index) => (
                <div key={group.label} className="space-y-0.5">
                    {collapsed ? (
                        // A hairline keeps the grouping readable once the labels are gone.
                        index > 0 ? <div aria-hidden="true" className="mx-auto my-2 h-px w-6 bg-line-300" /> : null
                    ) : (
                        <p className="px-2.5 pb-1 text-[10px] font-black uppercase tracking-[.18em] text-ink-600">{group.label}</p>
                    )}
                    {group.items.map((item) => (
                        <NavLink key={item.href} item={item} active={activeHref === item.href} collapsed={collapsed} onNavigate={onNavigate} />
                    ))}
                </div>
            ))}
        </nav>
    );
}

function SidebarBody({collapsed, activeHref, onNavigate}: {collapsed: boolean; activeHref: string | null; onNavigate?: () => void}) {
    return (
        <>
            <div className="px-1 py-1">
                <Brand collapsed={collapsed} />
            </div>
            <div className="mt-5 flex min-h-0 flex-1 flex-col overflow-hidden">
                <NavGroups collapsed={collapsed} activeHref={activeHref} onNavigate={onNavigate} />
            </div>
            <div className="mt-3 shrink-0 space-y-2 border-t border-line-300 pt-3">
                <a
                    href="/"
                    className={cn(
                        "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-bold text-ink-400 transition hover:bg-white/4 hover:text-white",
                        collapsed && "justify-center px-0",
                    )}
                >
                    <SquareArrowRightUp size={18} className="shrink-0" />
                    {collapsed ? null : <span>View site</span>}
                </a>
                <form
                    onSubmit={async (event) => {
                        event.preventDefault();
                        await fetch("/api/admin/support/logout", {method: "POST"});
                        window.location.assign("/admin");
                    }}
                >
                    <button
                        type="submit"
                        className={cn(
                            "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-bold text-ink-400 transition hover:bg-white/4 hover:text-white",
                            collapsed && "justify-center px-0",
                        )}
                    >
                        <Logout size={18} className="shrink-0" />
                        {collapsed ? null : <span>Sign out</span>}
                    </button>
                </form>
            </div>
        </>
    );
}

/**
 * Shared admin chrome: a fixed sidebar that collapses to icons on desktop and
 * opens as a drawer on phones, plus a sticky header carrying the toggle and the
 * breadcrumb trail.
 *
 * Applied once in the admin gate rather than per page, so every tool under
 * /admin is reachable from every other one. The collapsed state is written to a
 * cookie and read back on the server, so the first paint after a reload matches
 * what the operator left open instead of flashing wide and snapping shut.
 */
export default function AdminShell({children, defaultCollapsed = false}: {children: ReactNode; defaultCollapsed?: boolean}) {
    const pathname = usePathname() || "/admin";
    const activeHref = activeAdminHref(pathname);
    const trail = adminBreadcrumbs(pathname);
    const [collapsed, setCollapsed] = useState(defaultCollapsed);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const toggle = useCallback(() => {
        setCollapsed((previous) => {
            const next = !previous;
            document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; samesite=lax`;
            return next;
        });
    }, []);

    // ⌘B / Ctrl-B, the shortcut the operations dashboard uses.
    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (event.key.toLowerCase() !== "b" || !(event.metaKey || event.ctrlKey)) return;
            event.preventDefault();
            if (window.matchMedia("(min-width: 1024px)").matches) toggle();
            else setDrawerOpen((open) => !open);
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [toggle]);

    // The drawer is a phone affordance; leaving it mounted across a resize
    // would trap the page behind an overlay that has no visible close.
    useEffect(() => {
        if (drawerOpen) setDrawerOpen(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    return (
        <TooltipPrimitive.Provider delayDuration={150}>
            <div className="min-h-screen bg-canvas-950 text-ink-100">
                <aside
                    style={{width: collapsed ? WIDTH_COLLAPSED : WIDTH_EXPANDED}}
                    className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line-300 bg-canvas-900/80 px-2 py-4 transition-[width] duration-200 ease-out motion-reduce:transition-none lg:flex"
                >
                    <SidebarBody collapsed={collapsed} activeHref={activeHref} />
                </aside>

                <div className={cn("flex min-h-screen min-w-0 flex-col transition-[padding] duration-200 ease-out motion-reduce:transition-none", collapsed ? "lg:pl-14" : "lg:pl-64")}>
                    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line-300 bg-canvas-950/90 px-3 backdrop-blur sm:px-5">
                        <button
                            type="button"
                            onClick={() => (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches ? toggle() : setDrawerOpen(true))}
                            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                            title="Toggle sidebar (⌘B)"
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-400 transition hover:bg-white/4 hover:text-white"
                        >
                            <SidebarMinimalistic size={19} />
                        </button>
                        <span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-line-300" />
                        <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
                            <ol className="flex min-w-0 items-center gap-1.5 text-sm">
                                {trail.map((crumb, index) => (
                                    <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
                                        {index > 0 ? <AltArrowRight size={13} className="shrink-0 text-ink-600" /> : null}
                                        {crumb.href ? (
                                            <Link href={crumb.href} className="shrink-0 font-bold text-ink-400 transition hover:text-white">
                                                {crumb.label}
                                            </Link>
                                        ) : (
                                            <span className={cn("truncate", index === trail.length - 1 ? "font-bold text-white" : "font-bold text-ink-400")}>{crumb.label}</span>
                                        )}
                                    </li>
                                ))}
                            </ol>
                        </nav>
                        {/* Capture-pipeline status, on every page rather than only the overview. */}
                        <div className="hidden shrink-0 md:block">
                            <PipelineHealth compact />
                        </div>
                    </header>

                    {/* Pages bring their own <main>, so this stays a plain column. */}
                    <div className="min-w-0 flex-1">{children}</div>
                </div>

                <DialogPrimitive.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
                    <DialogPrimitive.Portal>
                        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 lg:hidden" />
                        <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-line-300 bg-canvas-900 px-2 py-4 shadow-2xl focus:outline-none lg:hidden">
                            <DialogPrimitive.Title className="sr-only">Admin navigation</DialogPrimitive.Title>
                            <SidebarBody collapsed={false} activeHref={activeHref} onNavigate={() => setDrawerOpen(false)} />
                        </DialogPrimitive.Content>
                    </DialogPrimitive.Portal>
                </DialogPrimitive.Root>
            </div>
        </TooltipPrimitive.Provider>
    );
}
