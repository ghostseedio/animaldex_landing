"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import {AltArrowRight, Logout, Magnifer, SidebarMinimalistic, SquareArrowRightUp} from "solar-icon-set";
import {cn} from "@/components/admin/ui";
import PipelineHealth from "@/app/admin/_components/pipeline-health";
import {activeAdminHref, adminBreadcrumbs, adminNavGroups, type AdminNavItem} from "@/app/admin/_components/admin-nav";
import {useRouter} from "next/navigation";

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
                "group/item relative flex h-9 items-center gap-3 px-2.5 text-[13px] font-bold transition",
                collapsed && "justify-center px-0",
                active ? "bg-primary-500/[.12] text-white" : "text-ink-400 hover:bg-white/[.04] hover:text-white",
            )}
        >
            {/* A rail on the leading edge marks the current page, as in the app's tab bar. */}
            {active ? <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-[3px] bg-primary-400" /> : null}
            <Icon size={17} className={cn("shrink-0", active ? "text-primary-300" : "text-ink-500 group-hover/item:text-ink-200")} />
            {collapsed ? null : <span className="min-w-0 flex-1 truncate">{item.label}</span>}
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
                    className="z-[60] border border-line-300 bg-canvas-950 px-3 py-2 text-xs font-bold text-white shadow-2xl"
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
            <span className="grid h-8 w-8 shrink-0 place-items-center bg-primary-400 text-base font-black text-canvas-950">A</span>
            {collapsed ? null : (
                <span className="min-w-0">
                    <span className="block truncate font-display text-base leading-tight text-white">AnimalDex</span>
                    <span className="block text-[10px] font-black uppercase tracking-[.18em] text-ink-500">Operations</span>
                </span>
            )}
        </Link>
    );
}

function NavGroups({collapsed, activeHref, onNavigate}: {collapsed: boolean; activeHref: string | null; onNavigate?: () => void}) {
    return (
        <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden py-1 [scrollbar-width:thin]" aria-label="Admin navigation">
            {adminNavGroups.map((group, index) => (
                <div key={group.label} className="space-y-0.5">
                    {collapsed ? (
                        // A hairline keeps the grouping readable once the labels are gone.
                        index > 0 ? <div aria-hidden="true" className="mx-auto my-2 h-px w-6 bg-line-300" /> : null
                    ) : (
                        <p className="px-2.5 pb-1.5 text-[10px] font-black uppercase tracking-[.18em] text-ink-600">{group.label}</p>
                    )}
                    {group.items.map((item) => (
                        <NavLink key={item.href} item={item} active={activeHref === item.href} collapsed={collapsed} onNavigate={onNavigate} />
                    ))}
                </div>
            ))}
        </nav>
    );
}

function SidebarBody({
    collapsed,
    activeHref,
    onNavigate,
    onSearch,
}: {
    collapsed: boolean;
    activeHref: string | null;
    onNavigate?: () => void;
    onSearch: () => void;
}) {
    return (
        <>
            <div className="px-1 py-1">
                <Brand collapsed={collapsed} />
            </div>
            <button
                type="button"
                onClick={onSearch}
                aria-label="Jump to a page"
                title="Jump to a page (⌘K)"
                className={cn(
                    "mt-4 flex h-9 shrink-0 items-center gap-2.5 border border-line-300 bg-canvas-950/60 px-2.5 text-[13px] font-bold text-ink-500 transition hover:border-line-200 hover:text-ink-200",
                    collapsed && "justify-center px-0",
                )}
            >
                <Magnifer size={15} className="shrink-0" />
                {collapsed ? null : (
                    <>
                        <span className="flex-1 text-left">Jump to…</span>
                        <kbd className="border border-line-300 px-1.5 py-px font-sans text-[10px] font-black text-ink-500">⌘K</kbd>
                    </>
                )}
            </button>
            <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
                <NavGroups collapsed={collapsed} activeHref={activeHref} onNavigate={onNavigate} />
            </div>
            <div className="mt-3 shrink-0 space-y-2 border-t border-line-300 pt-3">
                <a
                    href="/"
                    className={cn(
                        "flex h-9 items-center gap-3 px-2.5 text-[13px] font-bold text-ink-400 transition hover:bg-white/[.04] hover:text-white",
                        collapsed && "justify-center px-0",
                    )}
                >
                    <SquareArrowRightUp size={17} className="shrink-0" />
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
                            "flex h-9 w-full items-center gap-3 px-2.5 text-[13px] font-bold text-ink-400 transition hover:bg-white/[.04] hover:text-white",
                            collapsed && "justify-center px-0",
                        )}
                    >
                        <Logout size={17} className="shrink-0" />
                        {collapsed ? null : <span>Sign out</span>}
                    </button>
                </form>
            </div>
        </>
    );
}

/**
 * ⌘K page switcher. With twenty-odd tools in the sidebar, typing three letters
 * is quicker than scanning seven groups for the one you want.
 */
function CommandPalette({open, onOpenChange}: {open: boolean; onOpenChange: (open: boolean) => void}) {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [cursor, setCursor] = useState(0);
    const listRef = useRef<HTMLUListElement>(null);

    const results = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return adminNavGroups.flatMap((group) =>
            group.items
                .filter((item) => !needle || `${item.label} ${item.hint ?? ""} ${group.label}`.toLowerCase().includes(needle))
                .map((item) => ({...item, group: group.label})),
        );
    }, [query]);

    useEffect(() => {
        if (open) {
            setQuery("");
            setCursor(0);
        }
    }, [open]);

    useEffect(() => setCursor(0), [query]);

    useEffect(() => {
        listRef.current?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)?.scrollIntoView({block: "nearest"});
    }, [cursor]);

    function go(href: string) {
        onOpenChange(false);
        router.push(href);
    }

    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/60" />
                <DialogPrimitive.Content
                    className="fixed left-1/2 top-[12vh] z-[70] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 border border-line-300 bg-canvas-900 shadow-2xl focus:outline-none"
                    onKeyDown={(event) => {
                        if (event.key === "ArrowDown") {
                            event.preventDefault();
                            setCursor((value) => Math.min(value + 1, results.length - 1));
                        } else if (event.key === "ArrowUp") {
                            event.preventDefault();
                            setCursor((value) => Math.max(value - 1, 0));
                        } else if (event.key === "Enter" && results[cursor]) {
                            event.preventDefault();
                            go(results[cursor].href);
                        }
                    }}
                >
                    <DialogPrimitive.Title className="sr-only">Jump to a page</DialogPrimitive.Title>
                    <div className="flex items-center gap-3 border-b border-line-300 px-4">
                        <Magnifer size={16} className="shrink-0 text-ink-500" />
                        <input
                            autoFocus
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search admin pages…"
                            aria-label="Search admin pages"
                            className="h-12 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-ink-600"
                        />
                        <kbd className="border border-line-300 px-1.5 py-px text-[10px] font-black text-ink-500">Esc</kbd>
                    </div>
                    <ul ref={listRef} className="max-h-[50vh] overflow-y-auto p-1.5" role="listbox" aria-label="Admin pages">
                        {results.length === 0 ? <li className="px-3 py-8 text-center text-sm text-ink-500">No page matches “{query}”.</li> : null}
                        {results.map((item, index) => {
                            const Icon = item.icon;
                            const on = index === cursor;
                            return (
                                <li key={item.href} data-index={index} role="option" aria-selected={on}>
                                    <button
                                        type="button"
                                        onMouseMove={() => setCursor(index)}
                                        onClick={() => go(item.href)}
                                        className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left transition", on ? "bg-primary-500/[.12]" : "")}
                                    >
                                        <Icon size={17} className={cn("shrink-0", on ? "text-primary-300" : "text-ink-500")} />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-bold text-white">{item.label}</span>
                                            {item.hint ? <span className="block truncate text-xs text-ink-500">{item.hint}</span> : null}
                                        </span>
                                        <span className="shrink-0 text-[10px] font-black uppercase tracking-[.14em] text-ink-600">{item.group}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}

/**
 * Shared admin chrome: a fixed sidebar that collapses to icons on desktop and
 * opens as a drawer on phones, plus a sticky header carrying the toggle and the
 * breadcrumb trail.
 *
 * Applied once in the admin layout rather than per page, so every tool under
 * /admin is reachable from every other one, and the route's loading skeleton
 * renders inside the chrome instead of replacing it. The collapsed state is written to a
 * cookie and read back on the server, so the first paint after a reload matches
 * what the operator left open instead of flashing wide and snapping shut.
 */
export default function AdminShell({children, defaultCollapsed = false}: {children: ReactNode; defaultCollapsed?: boolean}) {
    const pathname = usePathname() || "/admin";
    const activeHref = activeAdminHref(pathname);
    const trail = adminBreadcrumbs(pathname);
    const [collapsed, setCollapsed] = useState(defaultCollapsed);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [paletteOpen, setPaletteOpen] = useState(false);

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
            if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                setPaletteOpen((open) => !open);
                return;
            }
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
                    className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line-300 bg-canvas-900 px-2 py-4 transition-[width] duration-200 ease-out motion-reduce:transition-none lg:flex"
                >
                    <SidebarBody collapsed={collapsed} activeHref={activeHref} onSearch={() => setPaletteOpen(true)} />
                </aside>

                <div className={cn("flex min-h-screen min-w-0 flex-col transition-[padding] duration-200 ease-out motion-reduce:transition-none", collapsed ? "lg:pl-14" : "lg:pl-64")}>
                    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line-300 bg-canvas-950 px-3 sm:px-5">
                        <button
                            type="button"
                            onClick={() => (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches ? toggle() : setDrawerOpen(true))}
                            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                            title="Toggle sidebar (⌘B)"
                            className="grid h-9 w-9 shrink-0 place-items-center text-ink-400 transition hover:bg-white/[.04] hover:text-white"
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
                        <button
                            type="button"
                            onClick={() => setPaletteOpen(true)}
                            aria-label="Jump to a page"
                            className="grid h-9 w-9 shrink-0 place-items-center text-ink-400 transition hover:bg-white/[.04] hover:text-white lg:hidden"
                        >
                            <Magnifer size={18} />
                        </button>
                        {/* Capture-pipeline status, on every page rather than only the overview. */}
                        <div className="hidden shrink-0 md:block">
                            <PipelineHealth compact />
                        </div>
                    </header>

                    {/* Pages bring their own <main>, so this stays a plain column. */}
                    <div className="min-w-0 flex-1">{children}</div>
                </div>

                <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

                <DialogPrimitive.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
                    <DialogPrimitive.Portal>
                        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 lg:hidden" />
                        <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-line-300 bg-canvas-900 px-2 py-4 shadow-2xl focus:outline-none lg:hidden">
                            <DialogPrimitive.Title className="sr-only">Admin navigation</DialogPrimitive.Title>
                            <SidebarBody
                                collapsed={false}
                                activeHref={activeHref}
                                onNavigate={() => setDrawerOpen(false)}
                                onSearch={() => {
                                    setDrawerOpen(false);
                                    setPaletteOpen(true);
                                }}
                            />
                        </DialogPrimitive.Content>
                    </DialogPrimitive.Portal>
                </DialogPrimitive.Root>
            </div>
        </TooltipPrimitive.Provider>
    );
}
