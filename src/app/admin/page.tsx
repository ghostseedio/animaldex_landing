import Link from "next/link";
import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import PipelineHealth from "@/app/admin/_components/pipeline-health";

const tools = [
    {
        href: "/admin/users",
        icon: "◎",
        eyebrow: "Customer intelligence",
        title: "Users & LTV",
        description: "See credit buyers, estimated lifetime value, purchase mix, activity, and retention signals.",
        accent: "from-cyan-400/20 to-transparent",
        status: "Customer insights"
    },
    {
        href: "/admin/segments",
        icon: "▦",
        eyebrow: "Customer intelligence",
        title: "User segments",
        description: "Cohort counts, country mix, and notify a segment with the same push + in-app pipeline.",
        accent: "from-teal-400/20 to-transparent",
        status: "Notify by cohort"
    },
    {
        href: "/admin/metrics",
        icon: "↗",
        eyebrow: "Growth intelligence",
        title: "Metrics",
        description: "Users by platform, paid vs organic, channels, retention and revenue by store.",
        accent: "from-sky-400/20 to-transparent",
        status: "Live reporting"
    },
    {
        href: "/admin/support",
        icon: "✦",
        eyebrow: "Customer operations",
        title: "Support inbox",
        description: "Customer conversations, attachments, priority mail, and unread state.",
        accent: "from-violet-400/20 to-transparent",
        status: "Inbox connected"
    },
    {
        href: "/admin/seo",
        icon: "✎",
        eyebrow: "Content studio",
        title: "SEO & content",
        description: "Create and edit pages, publish articles, upload media, and manage code blocks.",
        accent: "from-amber-400/20 to-transparent",
        status: "Publishing ready"
    },
    {
        href: "/admin/assets",
        icon: "▧",
        eyebrow: "Media library",
        title: "Assets",
        description: "Upload reusable images, preview originals, and copy public URLs for pages and code blocks.",
        accent: "from-emerald-400/20 to-transparent",
        status: "Public media"
    },
    {
        href: "/admin/notifications",
        icon: "◈",
        eyebrow: "Messaging",
        title: "Notifications",
        description: "Push a message to one person or everyone, with templates for indexing, merges and ID corrections.",
        accent: "from-rose-400/20 to-transparent",
        status: "Reaches the shipped app"
    },
    {
        href: "/admin/catalog",
        icon: "№",
        eyebrow: "Catalog",
        title: "Index management",
        description: "Every AnimalDex number with its identity key, public captures, and whether it still needs a subtitle, lesson or artwork.",
        accent: "from-indigo-400/20 to-transparent",
        status: "Catalog ready"
    },
    {
        href: "/admin/indexing",
        icon: "◌",
        eyebrow: "Catalog cleanup",
        title: "Unindexed captures",
        description: "Watch the daily cron that re-analyses captures whose species still has no AnimalDex number.",
        accent: "from-lime-400/20 to-transparent",
        status: "Daily at 04:00 UTC"
    },
    {
        href: "/admin/maintenance",
        icon: "↻",
        eyebrow: "Post operations",
        title: "Maintenance",
        description: "Inspect user captures and safely refresh production analysis jobs.",
        accent: "from-primary-400/20 to-transparent",
        status: "Admin tools ready"
    },
    {
        href: "/admin/creator-rewards",
        icon: "¤",
        eyebrow: "Creator economy",
        title: "Creator Rewards",
        description: "Inspect and operate company-funded Creator Rewards periods. Disabled by default. No payouts.",
        accent: "from-emerald-400/20 to-transparent",
        status: "Accounting ops"
    },
    {
        href: "/admin/payouts",
        icon: "⇄",
        eyebrow: "Creator economy",
        title: "Payouts",
        description: "Wise sandbox payout console. Named finance operators only. No real money.",
        accent: "from-teal-400/20 to-transparent",
        status: "Sandbox only"
    },
    {
        href: "/admin/guides",
        icon: "⌖",
        eyebrow: "Guide marketplace",
        title: "Wildlife Guides",
        description: "Review seller applications, publish listings, and see booking requests waiting on Guides.",
        accent: "from-cyan-400/20 to-transparent",
        status: "Review queue"
    },
    {
        href: "/admin/sponsored-challenges",
        icon: "★",
        eyebrow: "Time-limited events",
        title: "Sponsored Challenges",
        description: "Create and review AnimalDex-authored or sponsored Challenges. Internal operators only. No consumer app UI and no /business portal.",
        accent: "from-lime-400/20 to-transparent",
        status: "Admin foundation"
    }
];

export default async function AdminDashboardPage() {
    return withAdminGate(
        <main className="bg-[radial-gradient(circle_at_20%_0%,rgba(33,192,94,.12),transparent_28%)] px-4 py-7 sm:px-7 lg:px-10 lg:py-10">
                <section className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
                    <div>
                        <h1 className="max-w-3xl font-display text-4xl leading-[1.02] text-white sm:text-5xl">Run AnimalDex.</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-300 sm:text-base">Growth, customers, content and capture health in one place.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex">
                        <Link href="/admin/metrics" className="rounded-xl bg-primary-400 px-4 py-3 text-center text-sm font-black text-canvas-950">Open metrics</Link>
                        <Link href="/admin/support" className="rounded-xl border border-line-300 px-4 py-3 text-center text-sm font-bold text-white">Open inbox</Link>
                    </div>
                </section>

                <section className="mt-8" aria-label="Capture pipeline health">
                    <PipelineHealth />
                </section>

                <section className="mt-8 grid gap-4 md:grid-cols-2" aria-label="Admin tools">
                    {tools.map((tool) => (
                        <Link key={tool.href} href={tool.href} className="group relative overflow-hidden rounded-3xl border border-line-300 bg-surface-900 p-5 transition hover:-translate-y-0.5 hover:border-primary-400/50 sm:p-7">
                            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tool.accent} opacity-60`} />
                            <div className="relative">
                                <div className="flex items-start justify-between gap-4"><span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-canvas-950/70 text-xl text-white">{tool.icon}</span><span className="rounded-full border border-line-300 bg-canvas-950/60 px-2.5 py-1 text-[10px] font-bold text-ink-400">{tool.status}</span></div>
                                <p className="mt-7 text-[10px] font-black uppercase tracking-[.18em] text-primary-200">{tool.eyebrow}</p>
                                <div className="mt-2 flex items-end justify-between gap-4"><div className="min-w-0"><h3 className="font-display text-2xl text-white sm:text-3xl">{tool.title}</h3><p className="mt-2 max-w-lg text-sm leading-6 text-ink-300">{tool.description}</p></div><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[.05] text-lg text-white transition group-hover:bg-primary-400 group-hover:text-canvas-950">→</span></div>
                            </div>
                        </Link>
                    ))}
                </section>
        </main>
    );
}

export const dynamic = "force-dynamic";
