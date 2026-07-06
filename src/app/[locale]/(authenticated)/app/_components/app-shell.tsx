"use client";

import {useEffect, useState} from "react";
import {usePathname, useRouter} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import AppIcon, {AppIconName} from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {CreditBalanceChip} from "@/app/[locale]/(authenticated)/app/_components/app-credits";

type AppShellProps = {
    children: React.ReactNode;
    profile: {displayName: string; username: string | null; avatarUrl: string | null};
    unreadCount: number;
    unreadMessageCount: number;
};

const mainLinks: {href: string; label: string; icon: AppIconName}[] = [
    {href: "/app", label: "Home", icon: "home"},
    {href: "/app/collection", label: "Collection", icon: "collection"},
    {href: "/app/arena", label: "Arena", icon: "arena"},
    {href: "/app/profile", label: "Profile", icon: "profile"}
];

const utilityLinks: {href: string; label: string; icon: AppIconName}[] = [
    {href: "/app/missions", label: "Missions", icon: "mission"},
    {href: "/app/sets", label: "Sets", icon: "sets"},
    {href: "/app/trades", label: "Trades", icon: "trade"}
];

function isArenaRoute(pathname: string) {
    return ["/app/arena", "/app/train", "/app/matchups", "/app/missions", "/app/sets"].some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );
}

function normalizedPath(pathname: string) {
    return pathname.replace(/^\/id(?=\/|$)/, "") || "/";
}

function NavBadge({count}: {count: number}) {
    if (!count) return null;
    return <span className="ml-auto rounded-full bg-primary-400 px-2 py-0.5 text-[0.65rem] font-black tabular-nums text-black">{count > 99 ? "99+" : count}</span>;
}

export default function AppShell({children, profile, unreadCount, unreadMessageCount}: AppShellProps) {
    const pathname = normalizedPath(usePathname() || "/app");
    const router = useRouter();
    const [menuOpen, setMenuOpen] = useState(false);
    const isActive = (href: string) => {
        if (href === "/app") return pathname === href;
        if (href === "/app/arena") return isArenaRoute(pathname);
        return pathname.startsWith(href);
    };

    useEffect(() => {
        setMenuOpen(false);
    }, [pathname]);

    async function signOut() {
        await fetch("/api/auth/logout", {method: "POST"});
        router.push("/account");
        router.refresh();
    }

    const navClass = (active: boolean, mobile = false) => {
        const base = mobile
            ? "flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 text-[0.62rem] font-bold transition"
            : "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition";
        return active
            ? `${base} bg-white text-black shadow-sm`
            : `${base} text-white/50 hover:bg-white/5 hover:text-white`;
    };

    const navLink = (item: typeof mainLinks[number], mobile = false) => (
        <Link key={item.href} href={item.href} className={navClass(isActive(item.href), mobile)}>
            <AppIcon name={item.icon} className={mobile ? "h-5 w-5" : "h-[1.15rem] w-[1.15rem]"} />
            <span>{item.label}</span>
        </Link>
    );

    const utilityLink = (href: string, label: string, icon: AppIconName, badge = 0) => (
        <Link key={href} href={href} className={navClass(isActive(href))}>
            <AppIcon name={icon} />
            {label}
            <NavBadge count={badge} />
        </Link>
    );

    return (
        <div className="min-h-screen bg-black text-white">
            <aside className="fixed inset-y-0 left-0 z-40 hidden w-[17rem] flex-col border-r border-white/[0.08] bg-[#0b0b0b]/95 p-5 backdrop-blur-xl lg:flex">
                <Link href="/app" className="flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-white/[0.04]">
                    <img src="/images/logo.webp" alt="" className="h-11 w-11 rounded-xl ring-1 ring-white/10" />
                    <div>
                        <p className="font-display text-xl font-bold">AnimalDex</p>
                        <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-primary-200">Web app</p>
                    </div>
                </Link>

                <nav className="mt-8 space-y-1">{mainLinks.map((item) => navLink(item))}</nav>

                <p className="mb-2 mt-8 px-3 text-[0.62rem] font-black uppercase tracking-[0.18em] text-white/25">Progress & community</p>
                <nav className="space-y-1">
                    {utilityLinks.map((item) => utilityLink(item.href, item.label, item.icon))}
                    {utilityLink("/app/messages", "Messages", "message", unreadMessageCount)}
                    {utilityLink("/app/notifications", "Notifications", "bell", unreadCount)}
                </nav>

                <div className="mt-auto space-y-4">
                    <CreditBalanceChip className="w-full justify-center px-4 py-2.5" />
                    <Link href="/app/capture" className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-400 to-violet-500 px-4 py-3.5 text-sm font-black text-black shadow-[0_16px_40px_-24px_rgba(139,92,246,0.9)] transition hover:brightness-105">
                        <AppIcon name="camera" />
                        Add capture
                    </Link>
                    <div className="flex items-center gap-2 border-t border-white/[0.08] px-1 pt-4">
                        <Link href="/app/profile" aria-label="Open profile" className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-white/[0.04]">
                            {profile.avatarUrl
                                ? <img src={profile.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-white/10" />
                                : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-400/10 text-primary-200 ring-1 ring-primary-400/10"><AppIcon name="profile" /></span>}
                            <div className="min-w-0">
                                <p className="truncate text-sm font-bold">{profile.displayName}</p>
                                <p className="truncate text-xs text-white/35">{profile.username ? `@${profile.username}` : "Collector"}</p>
                            </div>
                        </Link>
                        <button onClick={signOut} className="ml-auto text-xs font-bold text-white/35 transition hover:text-white">Exit</button>
                    </div>
                </div>
            </aside>

            <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-black/80 backdrop-blur-xl lg:hidden">
                <div className="flex h-16 items-center justify-between px-4">
                    <Link href="/app" aria-label="AnimalDex" className="flex items-center">
                        <img src="/images/logo.webp" alt="" className="h-9 w-9 rounded-xl ring-1 ring-white/10" />
                    </Link>
                    <div className="flex items-center gap-2">
                        <CreditBalanceChip />
                        <Link href="/app/messages" className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white/70">
                            <AppIcon name="message" />
                            {unreadMessageCount ? <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary-400" /> : null}
                        </Link>
                        <Link href="/app/notifications" className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white/70">
                            <AppIcon name="bell" />
                            {unreadCount ? <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary-400" /> : null}
                        </Link>
                        <button onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? "Close menu" : "Open menu"} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white/70">
                            <AppIcon name={menuOpen ? "close" : "menu"} />
                        </button>
                    </div>
                </div>
            </header>

            {menuOpen ? (
                <>
                    <button type="button" aria-label="Close menu" className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] lg:hidden" onClick={() => setMenuOpen(false)} />
                    <div className="fixed inset-x-4 top-[4.75rem] z-50 max-h-[70vh] overflow-y-auto rounded-[1.5rem] border border-white/10 bg-[#141414]/95 p-3 shadow-2xl backdrop-blur-xl lg:hidden">
                        <Link href="/app/profile" className="mb-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 transition hover:bg-white/[0.07]">
                            {profile.avatarUrl
                                ? <img src={profile.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-white/10" />
                                : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-400/10 text-primary-200 ring-1 ring-primary-400/10"><AppIcon name="profile" /></span>}
                            <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-white">{profile.displayName}</p>
                                <p className="truncate text-xs text-white/35">{profile.username ? `@${profile.username}` : "View profile"}</p>
                            </div>
                        </Link>
                        <p className="px-3 py-2 text-[0.62rem] font-black uppercase tracking-[0.18em] text-white/25">More</p>
                        {utilityLinks.map((item) => utilityLink(item.href, item.label, item.icon))}
                        {utilityLink("/app/messages", "Messages", "message", unreadMessageCount)}
                        {utilityLink("/app/notifications", "Notifications", "bell", unreadCount)}
                        <button onClick={signOut} className="mt-2 w-full rounded-2xl border border-white/10 px-3 py-3 text-left text-sm font-bold text-white/50 transition hover:text-white">Sign out</button>
                    </div>
                </>
            ) : null}

            <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(26,26,26,0.55)_0%,_rgba(0,0,0,0)_45%)] pb-28 lg:ml-[17rem] lg:pb-0">
                <div className="mx-auto w-full max-w-[92rem] px-4 py-7 sm:px-7 lg:px-10 lg:py-10">{children}</div>
            </main>

            <nav className="fixed inset-x-3 bottom-3 z-40 flex items-center rounded-[1.75rem] border border-white/10 bg-[#141414]/95 p-1.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl lg:hidden">
                {mainLinks.slice(0, 2).map((item) => navLink(item, true))}
                <Link href="/app/capture" aria-label="Add capture" className="-mt-6 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-violet-500 text-black shadow-lg shadow-violet-500/25 ring-4 ring-black">
                    <AppIcon name="plus" className="h-6 w-6" />
                </Link>
                {mainLinks.slice(2).map((item) => navLink(item, true))}
            </nav>
        </div>
    );
}
