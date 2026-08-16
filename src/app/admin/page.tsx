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
        href: "/admin/metrics",
        icon: "↗",
        eyebrow: "Growth intelligence",
        title: "Metrics",
        description: "Users, captures, subscriptions, credit purchases, and social growth.",
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
        href: "/admin/maintenance",
        icon: "↻",
        eyebrow: "Post operations",
        title: "Maintenance",
        description: "Inspect user captures and safely refresh production analysis jobs.",
        accent: "from-primary-400/20 to-transparent",
        status: "Admin tools ready"
    }
];

const navigation = [
    {href: "/admin", label: "Overview", icon: "⌂"},
    {href: "/admin/metrics", label: "Metrics", icon: "↗"},
    {href: "/admin/users", label: "Users & LTV", icon: "◎"},
    {href: "/admin/support", label: "Support", icon: "✦"},
    {href: "/admin/seo", label: "Content", icon: "✎"},
    {href: "/admin/assets", label: "Assets", icon: "▧"},
    {href: "/admin/notifications", label: "Notifications", icon: "◈"},
    {href: "/admin/catalog", label: "Index", icon: "№"},
    {href: "/admin/maintenance", label: "Maintenance", icon: "↻"}
];

export default async function AdminDashboardPage() {
    return withAdminGate(
        <main className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,rgba(27,196,81,.12),transparent_28%)] text-ink-100">
            <div className="mx-auto flex min-h-screen w-full max-w-[110rem]">
                <aside className="hidden w-64 shrink-0 border-r border-line-300 bg-canvas-950/70 px-4 py-6 lg:flex lg:flex-col">
                    <Link href="/" className="flex items-center gap-3 px-2">
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-500 text-xl font-black text-canvas-950">A</span>
                        <div><p className="font-display text-xl text-white">AnimalDex</p><p className="text-[10px] font-black uppercase tracking-[.18em] text-ink-500">Operations</p></div>
                    </Link>
                    <nav className="mt-10 space-y-1" aria-label="Admin navigation">
                        {navigation.map((item, index) => <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition ${index === 0 ? "bg-primary-500/15 text-primary-100" : "text-ink-400 hover:bg-white/[.04] hover:text-white"}`}><span className="grid h-7 w-7 place-items-center text-base">{item.icon}</span>{item.label}</Link>)}
                    </nav>
                    <div className="mt-auto rounded-2xl border border-primary-400/20 bg-primary-500/[.06] p-4">
                        <PipelineHealth />
                    </div>
                </aside>

                <div className="min-w-0 flex-1">
                    <header className="border-b border-line-300 bg-canvas-950/70 px-4 py-4 backdrop-blur sm:px-7 lg:px-10">
                        <div className="flex items-center justify-between gap-4">
                            <div><p className="text-xs font-black uppercase tracking-[.18em] text-primary-200">Control center</p><p className="mt-0.5 text-sm text-ink-400">AnimalDex administration</p></div>
                            <Link href="/" className="shrink-0 rounded-xl border border-line-300 px-3 py-2 text-xs font-bold text-white hover:border-primary-300 sm:px-4 sm:text-sm">View site ↗</Link>
                        </div>
                        <nav className="-mx-1 mt-4 flex gap-1 overflow-x-auto pb-1 lg:hidden" aria-label="Admin navigation">
                            {navigation.map((item, index) => <Link key={item.href} href={item.href} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold ${index === 0 ? "border-primary-300 bg-primary-500/15 text-primary-100" : "border-line-300 text-ink-400"}`}>{item.label}</Link>)}
                        </nav>
                    </header>

                    <div className="px-4 py-7 sm:px-7 lg:px-10 lg:py-10">
                        <section className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
                            <div>
                                <PipelineHealth compact />
                                <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.02] text-white sm:text-6xl">Everything you need to run AnimalDex.</h1>
                                <p className="mt-4 max-w-2xl text-sm leading-6 text-ink-300 sm:text-base">Monitor growth, help customers, publish content, and keep user captures healthy from one workspace.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:flex">
                                <Link href="/admin/seo" className="rounded-xl bg-primary-500 px-4 py-3 text-center text-sm font-black text-canvas-950">Create content</Link>
                                <Link href="/admin/support" className="rounded-xl border border-line-300 px-4 py-3 text-center text-sm font-bold text-white">Open inbox</Link>
                            </div>
                        </section>

                        <section className="mt-8 grid grid-cols-2 gap-3 xl:grid-cols-4">
                            {[["5", "Admin workspaces"], ["100", "Posts per maintenance view"], ["10", "Safe bulk refresh limit"], ["24/7", "Operations access"]].map(([value, label]) => (
                                <div key={label} className="rounded-2xl border border-line-300 bg-surface-900/80 p-4 sm:p-5">
                                    <p className="font-display text-2xl text-white sm:text-3xl">{value}</p><p className="mt-1 text-[11px] leading-4 text-ink-500 sm:text-xs">{label}</p>
                                </div>
                            ))}
                        </section>

                        <div className="mt-10 flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-ink-500">Workspace</p><h2 className="mt-2 font-display text-2xl text-white sm:text-3xl">Operations</h2></div><p className="hidden text-xs text-ink-500 sm:block">Choose a tool to get started</p></div>
                        <section className="mt-4 grid gap-4 md:grid-cols-2">
                            {tools.map((tool) => (
                                <Link key={tool.href} href={tool.href} className="group relative overflow-hidden rounded-3xl border border-line-300 bg-surface-900 p-5 transition hover:-translate-y-0.5 hover:border-primary-400/50 sm:p-7">
                                    <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tool.accent} opacity-60`} />
                                    <div className="relative">
                                        <div className="flex items-start justify-between gap-4"><span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-canvas-950/70 text-xl text-white">{tool.icon}</span><span className="rounded-full border border-line-300 bg-canvas-950/60 px-2.5 py-1 text-[10px] font-bold text-ink-400">{tool.status}</span></div>
                                        <p className="mt-7 text-[10px] font-black uppercase tracking-[.18em] text-primary-200">{tool.eyebrow}</p>
                                        <div className="mt-2 flex items-end justify-between gap-4"><div className="min-w-0"><h3 className="font-display text-2xl text-white sm:text-3xl">{tool.title}</h3><p className="mt-2 max-w-lg text-sm leading-6 text-ink-300">{tool.description}</p></div><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[.05] text-lg text-white transition group-hover:bg-primary-500 group-hover:text-canvas-950">→</span></div>
                                    </div>
                                </Link>
                            ))}
                        </section>
                    </div>
                </div>
            </div>
        </main>
    );
}

export const dynamic = "force-dynamic";
