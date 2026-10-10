import {
    Bell,
    ChatRound,
    ClapperboardPlay,
    ClipboardCheck,
    Compass,
    CupStar,
    GalleryWide,
    Graph,
    Hourglass,
    MagicStick3,
    Stopwatch,
    Notebook,
    Pen,
    PieChart,
    Refresh,
    Routing,
    ShieldCheck,
    ShieldWarning,
    Star,
    UsersGroupRounded,
    Wallet,
    Widget,
} from "solar-icon-set";
import type {ReactElement} from "react";

/**
 * Solar icons take every prop optionally, so a narrower call signature is all
 * the sidebar needs to render one.
 */
export type AdminIcon = (props: {size?: number; className?: string}) => ReactElement;

export type AdminNavItem = {
    href: string;
    label: string;
    icon: AdminIcon;
    /** Shown under the label when the sidebar is expanded. */
    hint?: string;
};

export type AdminNavGroup = {
    label: string;
    items: AdminNavItem[];
};

/**
 * The admin menu, grouped by the job being done rather than by the order the
 * pages were built. Every page under /admin that an operator can open is here:
 * before this, a third of them (reliability, creator reviews, payout corridors)
 * could only be reached by typing the URL.
 */
export const adminNavGroups: AdminNavGroup[] = [
    {
        label: "Overview",
        items: [{href: "/admin", label: "Overview", icon: Widget, hint: "Everything at a glance"}],
    },
    {
        label: "Growth",
        items: [
            {href: "/admin/metrics", label: "Metrics", icon: Graph, hint: "Platform, channel and revenue"},
            {href: "/admin/users", label: "Users & LTV", icon: UsersGroupRounded, hint: "Buyers and lifetime value"},
            {href: "/admin/segments", label: "Segments", icon: PieChart, hint: "Cohorts and notifications"},
        ],
    },
    {
        label: "Operations",
        items: [
            {href: "/admin/jobs", label: "Scheduled jobs", icon: Stopwatch, hint: "pg_cron scheduler health"},
            {href: "/admin/support", label: "Support", icon: ChatRound, hint: "Customer inbox"},
            {href: "/admin/notifications", label: "Notifications", icon: Bell, hint: "Push and in-app messages"},
            {href: "/admin/integrity", label: "Capture integrity", icon: ShieldWarning, hint: "Forged provenance signals"},
            {href: "/admin/reliability", label: "Reliability", icon: ShieldCheck, hint: "Error and latency budgets"},
            {href: "/admin/maintenance", label: "Maintenance", icon: Refresh, hint: "Inspect and re-run captures"},
        ],
    },
    {
        label: "Catalog",
        items: [
            {href: "/admin/catalog", label: "Index", icon: Notebook, hint: "Every AnimalDex number"},
            {href: "/admin/indexing", label: "Unindexed", icon: Hourglass, hint: "Captures still awaiting a number"},
            {href: "/admin/identity-review", label: "Identity review", icon: ClipboardCheck, hint: "Same animal under two numbers"},
        ],
    },
    {
        label: "Content",
        items: [
            {href: "/admin/seo", label: "Content studio", icon: Pen, hint: "Pages and articles"},
            {href: "/admin/blog-generator", label: "Blog generator", icon: MagicStick3, hint: "AI-researched articles"},
            {href: "/admin/assets", label: "Assets", icon: GalleryWide, hint: "Reusable media"},
            {href: "/admin/story-videos", label: "Story videos", icon: ClapperboardPlay, hint: "Share to official socials"},
            {href: "/admin/guides", label: "Wildlife Guides", icon: Compass, hint: "Sellers and listings"},
        ],
    },
    {
        label: "Creator economy",
        items: [
            {href: "/admin/creator-rewards", label: "Creator Rewards", icon: CupStar, hint: "Company-funded periods"},
            {href: "/admin/creator-reviews", label: "Creator reviews", icon: ClipboardCheck, hint: "Application queue"},
            {href: "/admin/payouts", label: "Payouts", icon: Wallet, hint: "Wise payout console"},
            {href: "/admin/payout-corridors", label: "Payout corridors", icon: Routing, hint: "Supported destinations"},
        ],
    },
    {
        label: "Events",
        items: [{href: "/admin/sponsored-challenges", label: "Sponsored Challenges", icon: Star, hint: "Time-limited campaigns"}],
    },
];

const allItems = adminNavGroups.flatMap((group) => group.items);

/**
 * The entry that best matches the current location: the longest href that is
 * the current path or an ancestor of it, so /admin/support/reply keeps Support
 * lit while /admin itself only matches exactly.
 */
export function activeAdminHref(pathname: string): string | null {
    let best: AdminNavItem | null = null;
    for (const item of allItems) {
        const matches = item.href === "/admin" ? pathname === "/admin" : pathname === item.href || pathname.startsWith(`${item.href}/`);
        if (matches && (!best || item.href.length > best.href.length)) best = item;
    }
    return best?.href ?? null;
}

/** The trail shown in the header, e.g. Admin › Creator economy › Payouts. */
export function adminBreadcrumbs(pathname: string): {label: string; href?: string}[] {
    const active = activeAdminHref(pathname);
    if (!active || active === "/admin") return [{label: "Overview"}];

    const group = adminNavGroups.find((candidate) => candidate.items.some((item) => item.href === active));
    const item = allItems.find((candidate) => candidate.href === active);
    const trail: {label: string; href?: string}[] = [{label: "Admin", href: "/admin"}];
    if (group && group.label !== "Overview") trail.push({label: group.label});
    if (item) trail.push({label: item.label});
    return trail;
}
