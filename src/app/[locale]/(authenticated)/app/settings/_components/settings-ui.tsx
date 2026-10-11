import type {ReactNode} from "react";
import Link from "@/app/[locale]/_components/link";

/**
 * Settings building blocks — web twins of iOS `SettingsScreen`,
 * `SettingsSection`, `SettingsNavigationRow`, `SettingsIconToggleRow`,
 * `SettingsActionRow`, `SettingsDetailRow` and `SettingsDestructiveRow`.
 *
 * The iOS rules carry over: a row that shows a chevron opens a screen and
 * nothing else shows one; a row that navigates carries its current value.
 */

export const NEON = "#A7F432";

export function SettingsIcon({children, tint = NEON}: {children: ReactNode; tint?: string}) {
    return (
        <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center" style={{color: tint}} aria-hidden="true">
            {children}
        </span>
    );
}

function Chevron() {
    return (
        <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0 text-white/35" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 5 7 7-7 7" />
        </svg>
    );
}

/** A pushed screen: back to Settings, a centred title, then its sections. */
export function SettingsScreen({title, backHref = "/app/settings", backLabel = "Settings", children}: {
    title: string;
    backHref?: string;
    backLabel?: string;
    children: ReactNode;
}) {
    return (
        <div className="mx-auto w-full max-w-2xl pb-10">
            <header className="sticky top-16 z-20 -mx-4 mb-2 grid grid-cols-[1fr_auto_1fr] items-center bg-black/95 px-4 py-2.5 backdrop-blur-xl lg:top-0 md:mx-0 md:px-0">
                <Link href={backHref} className="inline-flex min-h-10 items-center gap-1 justify-self-start text-sm font-bold text-primary-200 transition hover:text-primary-100" aria-label={`Back to ${backLabel}`}>
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
                    {backLabel}
                </Link>
                <h1 className="truncate text-center text-[17px] font-bold text-white">{title}</h1>
                <span />
            </header>
            <div className="space-y-5">{children}</div>
        </div>
    );
}

export function SettingsSection({title, footer, children}: {title?: string; footer?: ReactNode; children: ReactNode}) {
    return (
        <section>
            {title ? <h2 className="mb-2 px-4 text-[11px] font-bold uppercase tracking-[0.12em] text-white/40">{title}</h2> : null}
            <div className="-mx-4 overflow-hidden border-y border-white/[0.08] bg-[#141414] md:mx-0 md:rounded-2xl md:border">
                {children}
            </div>
            {footer ? <p className="mt-2 px-4 text-xs leading-5 text-white/40">{footer}</p> : null}
        </section>
    );
}

export function SettingsDivider() {
    return <div className="ml-[54px] h-px bg-white/[0.08]" />;
}

const rowClass = "flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.04] focus-visible:bg-white/[0.06] focus-visible:outline-none";

function RowText({title, subtitle}: {title: string; subtitle?: ReactNode}) {
    return (
        <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-white">{title}</span>
            {subtitle ? <span className="mt-0.5 block text-[11px] leading-snug text-white/40">{subtitle}</span> : null}
        </span>
    );
}

/** Opens a screen: icon, title, the current value, a chevron. */
export function SettingsNavigationRow({href, icon, title, subtitle, value, external = false}: {
    href: string;
    icon: ReactNode;
    title: string;
    subtitle?: ReactNode;
    value?: string | null;
    external?: boolean;
}) {
    const body = (
        <>
            <SettingsIcon>{icon}</SettingsIcon>
            <RowText title={title} subtitle={subtitle} />
            {value ? <span className="max-w-[45%] truncate text-sm text-white/45">{value}</span> : null}
            {external ? <span aria-hidden="true" className="text-xs text-white/35">↗</span> : <Chevron />}
        </>
    );
    return external ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={rowClass}>{body}</a>
    ) : (
        <Link href={href} className={rowClass}>{body}</Link>
    );
}

/** Does something in place: no chevron. */
export function SettingsActionRow({icon, title, subtitle, onClick, disabled = false, trailing, tint}: {
    icon: ReactNode;
    title: string;
    subtitle?: ReactNode;
    onClick: () => void;
    disabled?: boolean;
    trailing?: ReactNode;
    tint?: string;
}) {
    return (
        <button type="button" onClick={onClick} disabled={disabled} className={`${rowClass} disabled:opacity-50`}>
            <SettingsIcon tint={tint}>{icon}</SettingsIcon>
            <RowText title={title} subtitle={subtitle} />
            {trailing}
        </button>
    );
}

export function SettingsToggleRow({icon, title, subtitle, checked, onChange, disabled = false}: {
    icon: ReactNode;
    title: string;
    subtitle?: ReactNode;
    checked: boolean;
    onChange: (next: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <label className={`${rowClass} cursor-pointer ${disabled ? "opacity-50" : ""}`}>
            <SettingsIcon>{icon}</SettingsIcon>
            <RowText title={title} subtitle={subtitle} />
            <span className="relative inline-flex shrink-0">
                <input
                    type="checkbox"
                    role="switch"
                    className="peer sr-only"
                    checked={checked}
                    disabled={disabled}
                    onChange={(event) => onChange(event.target.checked)}
                />
                <span className="h-[31px] w-[51px] rounded-full bg-white/[0.16] transition peer-checked:bg-primary-400 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-300" />
                <span className="pointer-events-none absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition peer-checked:translate-x-5" />
            </span>
        </label>
    );
}

export function SettingsDetailRow({title, value, selectable = false}: {title: string; value: string; selectable?: boolean}) {
    return (
        <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-3">
            <span className="shrink-0 text-[15px] font-semibold text-white">{title}</span>
            <span className={`min-w-0 break-all text-right text-sm text-white/55 ${selectable ? "select-all font-mono text-xs" : ""}`}>{value}</span>
        </div>
    );
}

export function SettingsDestructiveRow({icon, title, onClick, prominent = false, busy = false, disabled = false}: {
    icon: ReactNode;
    title: string;
    onClick: () => void;
    prominent?: boolean;
    busy?: boolean;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`${rowClass} ${prominent ? "text-red-400" : "text-red-300/90"} disabled:opacity-60`}
        >
            <SettingsIcon tint="currentColor">{busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : icon}</SettingsIcon>
            <span className={`flex-1 text-[15px] ${prominent ? "font-bold" : "font-semibold"}`}>{title}</span>
        </button>
    );
}

/** A tick for the selected option in a list screen. */
export function SelectedMark({selected}: {selected: boolean}) {
    return selected ? (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-label="Selected"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.3 14.2-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4-7 7Z" /></svg>
    ) : null;
}

// Icons (SF Symbol stand-ins), 15px.
const svg = (path: ReactNode, filled = false) => (
    <svg viewBox="0 0 24 24" className="h-[16px] w-[16px]" fill={filled ? "currentColor" : "none"} stroke={filled ? "none" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>
);

export const SettingsIcons = {
    endorse: svg(<path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3Zm2 11h8.2a2 2 0 0 0 2-1.6l1.3-7A2 2 0 0 0 18.5 11H14V6a2.5 2.5 0 0 0-2.5-2.5L9 10v11Z" />, true),
    missions: svg(<path d="M12 2 14.6 4l3.3-.2.9 3.2 2.7 2-1.2 3.1 1.2 3.1-2.7 2-.9 3.2-3.3-.2L12 22l-2.6-2-3.3.2-.9-3.2-2.7-2 1.2-3.1L2.5 9.1l2.7-2 .9-3.2 3.3.2L12 2Zm-1.3 13.6 5.6-5.6-1.4-1.4-4.2 4.2-2-2-1.4 1.4 3.4 3.4Z" />, true),
    credits: svg(<path d="M13 2 3 14h7l-1 8 10-12h-7z" />, true),
    earnings: svg(<><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>),
    guides: svg(<path d="M12 3 4 9v12h5v-7h6v7h5V9z" />),
    bell: svg(<><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></>),
    globe: svg(<><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></>),
    banknote: svg(<><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></>),
    speaker: svg(<><path d="M11 5 6 9H2v6h4l5 4V5Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /></>),
    location: svg(<><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" /><path d="m3 3 18 18" /></>),
    instagram: svg(<><path d="M12 3v12M7 10l5 5 5-5" /><rect x="3" y="17" width="18" height="4" rx="1" /></>),
    help: svg(<><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" /></>),
    star: svg(<path d="M12 2.5 14.8 8l6.2.9-4.5 4.4 1.1 6.3L12 17.2 6.4 19.6l1.1-6.3L3 8.9 9.2 8z" />, true),
    privacy: svg(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>),
    terms: svg(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>),
    person: svg(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>),
    shield: svg(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>),
    key: svg(<><circle cx="7.5" cy="15.5" r="5.5" /><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3" /></>),
    signOut: svg(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>),
    trash: svg(<><path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></>),
    photo: svg(<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></>),
    people: svg(<><circle cx="9" cy="7" r="4" /><path d="M2 21a7 7 0 0 1 14 0M16 3.1a4 4 0 0 1 0 7.8M22 21a7 7 0 0 0-5-6.7" /></>),
    message: svg(<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7a2.5 2.5 0 0 1-2.5 2.5H9.7L5 18.2V15h1.5A2.5 2.5 0 0 1 4 12.5v-7Z" />, true),
    pin: svg(<><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" /><circle cx="12" cy="10" r="2.5" /></>),
    character: svg(<><path d="M4 7V4h16v3M9 20h6M12 4v16" /></>)
};
