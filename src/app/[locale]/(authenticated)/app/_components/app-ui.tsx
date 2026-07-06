import Link from "@/app/[locale]/_components/link";
import AppIcon, {AppIconName} from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import type {AppCapture} from "@/data/authenticated-app";
import {formatAppShortDateWithYear} from "@/lib/app-dates";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black";

export function AppPage({children, narrow = false}: {children: React.ReactNode; narrow?: boolean}) {
    return <div className={`space-y-8 md:space-y-10 ${narrow ? "mx-auto max-w-3xl" : ""}`}>{children}</div>;
}

export function AppPageHeader({eyebrow, title, description, action}: {eyebrow: string; title: string; description?: string; action?: React.ReactNode}) {
    return (
        <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
                <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-primary-200">{eyebrow}</p>
                <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">{title}</h1>
                {description ? <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55 md:text-base">{description}</p> : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
        </header>
    );
}

export function AppSurface({children, className = "", padding = true}: {children: React.ReactNode; className?: string; padding?: boolean}) {
    return (
        <div className={`rounded-[1.35rem] border border-white/[0.08] bg-[#121212]/90 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.9)] backdrop-blur-sm ${padding ? "p-5 md:p-6" : ""} ${className}`}>
            {children}
        </div>
    );
}

export function AppMetric({label, value, accent = "green", detail}: {label: string; value: string | number; accent?: "green" | "violet" | "gold" | "blue"; detail?: string}) {
    const accents = {green: "from-primary-400/80 to-primary-400/20", violet: "from-violet-400/80 to-violet-400/20", gold: "from-amber-400/80 to-amber-400/20", blue: "from-sky-400/80 to-sky-400/20"};
    return (
        <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 transition hover:border-white/15">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.15em] text-white/35">{label}</p>
            <p className="mt-2 font-display text-2xl font-bold tabular-nums text-white">{value}</p>
            {detail ? <p className="mt-1 text-xs leading-5 text-white/35">{detail}</p> : null}
            <div className={`mt-3 h-0.5 w-10 rounded-full bg-gradient-to-r ${accents[accent]}`} />
        </div>
    );
}

export function AppProgress({value, accent = "green"}: {value: number; accent?: "green" | "violet" | "gold"}) {
    const fill = accent === "violet" ? "bg-violet-500" : accent === "gold" ? "bg-amber-400" : "bg-primary-400";
    return (
        <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
            <div className={`h-full rounded-full transition-all duration-500 ${fill}`} style={{width: `${Math.max(value > 0 ? 2 : 0, Math.min(100, value))}%`}} />
        </div>
    );
}

export function AppSectionTitle({icon, title, detail, action}: {icon: AppIconName; title: string; detail?: string; action?: React.ReactNode}) {
    return (
        <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-400/10 text-primary-200 ring-1 ring-primary-400/10">
                    <AppIcon name={icon} />
                </span>
                <div className="min-w-0">
                    <h2 className="font-display text-xl font-bold text-white md:text-2xl">{title}</h2>
                    {detail ? <p className="mt-0.5 text-xs leading-5 text-white/40 md:text-sm">{detail}</p> : null}
                </div>
            </div>
            {action}
        </div>
    );
}

export function AppBadge({children, tone = "neutral"}: {children: React.ReactNode; tone?: "neutral" | "primary" | "success" | "warning" | "violet"}) {
    const tones = {
        neutral: "bg-white/5 text-white/55",
        primary: "bg-primary-400/15 text-primary-100",
        success: "bg-primary-400 text-black",
        warning: "bg-amber-400/15 text-amber-200",
        violet: "bg-violet-400/15 text-violet-200"
    };
    return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.08em] ${tones[tone]}`}>{children}</span>;
}

export function AppAvatar({src, name, size = "md"}: {src?: string | null; name: string; size?: "sm" | "md" | "lg"}) {
    const sizes = {sm: "h-10 w-10 rounded-xl text-sm", md: "h-12 w-12 rounded-2xl text-base", lg: "h-16 w-16 rounded-[1.1rem] text-xl"};
    if (src) {
        return <img src={src} alt="" className={`${sizes[size]} shrink-0 object-cover ring-1 ring-white/10`} />;
    }
    return <span className={`${sizes[size]} flex shrink-0 items-center justify-center bg-white/5 font-black text-white/40 ring-1 ring-white/10`}>{name.slice(0, 1).toUpperCase()}</span>;
}

export function AppSegmentedControl<T extends string>({value, options, onChange}: {value: T; options: Array<{id: T; label: string}>; onChange: (value: T) => void}) {
    return (
        <div className="inline-flex rounded-2xl border border-white/10 bg-white/[0.04] p-1" role="tablist">
            {options.map((option) => (
                <button
                    key={option.id}
                    type="button"
                    role="tab"
                    aria-selected={value === option.id}
                    onClick={() => onChange(option.id)}
                    className={`rounded-[0.9rem] px-4 py-2.5 text-sm font-black transition ${value === option.id ? "bg-primary-400 text-black shadow-sm" : `text-white/55 hover:text-white ${focusRing}`}`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

export function AppEmpty({icon, title, detail, action}: {icon: AppIconName; title: string; detail: string; action?: React.ReactNode}) {
    return (
        <AppSurface className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-white/35 ring-1 ring-white/10">
                <AppIcon name={icon} className="h-6 w-6" />
            </span>
            <h2 className="mt-5 font-display text-2xl font-bold text-white">{title}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-white/45">{detail}</p>
            {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
        </AppSurface>
    );
}

export function AppListRow({
    href,
    onClick,
    avatar,
    title,
    subtitle,
    preview,
    meta,
    badge,
    unread = false
}: {
    href?: string;
    onClick?: () => void;
    avatar: React.ReactNode;
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    preview?: React.ReactNode;
    meta?: React.ReactNode;
    badge?: React.ReactNode;
    unread?: boolean;
}) {
    const className = `group flex gap-4 rounded-[1.35rem] border p-4 transition md:p-5 ${unread ? "border-primary-400/25 bg-primary-400/[0.04]" : "border-white/[0.08] bg-[#121212]/80 hover:border-white/18 hover:bg-[#161616]"}`;
    const content = (
        <>
            {avatar}
            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="truncate font-display text-lg font-bold text-white">{title}</div>
                        {subtitle ? <div className="truncate text-sm text-white/40">{subtitle}</div> : null}
                    </div>
                    {meta ? <span className="shrink-0 text-xs font-bold text-white/30">{meta}</span> : null}
                </div>
                {preview ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/55">{preview}</p> : null}
            </div>
            <div className="flex shrink-0 flex-col items-end justify-between gap-3">
                {badge}
                <AppIcon name="chevron" className="h-5 w-5 text-white/20 transition group-hover:text-white/45" />
            </div>
        </>
    );

    if (href) {
        return <Link href={href} className={className}>{content}</Link>;
    }

    return <button type="button" onClick={onClick} className={`${className} w-full text-left`}>{content}</button>;
}

export function AppCaptureCard({capture, compact = false, locale = "en"}: {capture: AppCapture; compact?: boolean; locale?: string}) {
    const date = capture.capturedAt ? formatAppShortDateWithYear(capture.capturedAt, locale) : null;
    return (
        <article className={`group overflow-hidden rounded-[1.4rem] border border-white/[0.09] bg-[#121212] shadow-[0_16px_40px_-28px_rgba(0,0,0,0.95)] transition hover:-translate-y-0.5 hover:border-primary-400/30 ${compact ? "flex" : ""}`}>
            <Link href={capture.href} className={`relative block overflow-hidden bg-white/5 ${compact ? "h-32 w-32 shrink-0" : "aspect-[4/3]"}`}>
                <img src={capture.imageSrc} alt={capture.animalName} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 to-transparent" />
                <span className="absolute right-3 top-3 rounded-full bg-primary-400 px-2.5 py-1 text-xs font-black text-black shadow-sm">{capture.score}</span>
            </Link>
            <div className="min-w-0 p-4">
                <h3 className="truncate font-display text-xl font-bold text-white">
                    <Link href={capture.href} className="hover:text-primary-100">{capture.animalName}</Link>
                </h3>
                <p className="mt-1 truncate text-xs italic text-white/40">{capture.scientificName ?? capture.category ?? "AnimalDex capture"}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[0.68rem] font-bold text-white/55">
                    {capture.contextLabel ? <span className="rounded-full bg-white/[0.06] px-2.5 py-1">{capture.contextLabel}</span> : null}
                    {date ? <span className="rounded-full bg-white/[0.06] px-2.5 py-1">{date}</span> : null}
                </div>
            </div>
        </article>
    );
}

export function AppPrimaryLink({href, children, icon, className = ""}: {href: string; children: React.ReactNode; icon?: AppIconName; className?: string}) {
    return (
        <Link href={href} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-primary-400 px-5 py-3 text-sm font-black text-black shadow-[0_12px_30px_-18px_rgba(74,222,128,0.8)] transition hover:bg-primary-200 ${focusRing} ${className}`}>
            {icon ? <AppIcon name={icon} /> : null}
            {children}
        </Link>
    );
}

export function AppSecondaryLink({href, children, icon, className = ""}: {href: string; children: React.ReactNode; icon?: AppIconName; className?: string}) {
    return (
        <Link href={href} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-bold text-white/75 transition hover:border-white/20 hover:text-white ${focusRing} ${className}`}>
            {icon ? <AppIcon name={icon} /> : null}
            {children}
        </Link>
    );
}

export function AppIconButton({href, icon, label, badge}: {href: string; icon: AppIconName; label: string; badge?: number}) {
    return (
        <Link href={href} aria-label={label} className={`relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/70 transition hover:border-white/20 hover:text-white ${focusRing}`}>
            <AppIcon name={icon} />
            {badge ? <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-400 px-1 text-[0.62rem] font-black text-black">{badge}</span> : null}
        </Link>
    );
}

export function AppStatBar({label, value, total, color}: {label: string; value: number; total: number; color: string}) {
    const pct = total ? value / total * 100 : 0;
    return (
        <div>
            <div className="mb-2 flex justify-between text-sm">
                <span className="text-white/55">{label}</span>
                <span className="font-bold tabular-nums text-white">{value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
                <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{width: `${pct}%`}} />
            </div>
        </div>
    );
}
