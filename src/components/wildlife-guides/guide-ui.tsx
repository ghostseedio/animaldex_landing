import Link from "@/app/[locale]/_components/link";
import {
    MONTH_LETTERS,
    MONTH_NAMES,
    RARITY_COLORS,
    RARITY_LABELS,
    formatGuidePrice,
    guideMediaSrc,
    guideSpeciesLine,
    type GuideCard,
    type GuideMedia,
    type GuideRarity,
    type GuideStatusTone
} from "@/lib/virtual-wildlife-guides";

/**
 * Virtual Wildlife Guide pieces shared by the profile Shop, /app/guides and the
 * public guide pages. Everything is a flush, edge-to-edge band, as in the iOS
 * app: square containers and no gaps between bands.
 */

export const GUIDE_NEON = "#A7F432";
export const GUIDE_BAND = "relative w-full border-b border-white/10 bg-[#1F1F1F] light:bg-surface-900";

export const STATUS_TONE_COLORS: Record<GuideStatusTone, string> = {
    neutral: "rgba(255,255,255,0.62)",
    muted: "rgba(255,255,255,0.42)",
    caution: "#FFCC00",
    live: GUIDE_NEON
};

/** iOS `AnimalDexBandHeader`: a small caps label between bands. */
export function GuideBandHeader({title, trailing, id}: {title: string; trailing?: React.ReactNode; id?: string}) {
    return (
        <div id={id} className="flex scroll-mt-28 items-end justify-between gap-3 border-b border-white/10 px-[18px] pb-2 pt-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.09em] text-white/70">{title}</h2>
            {trailing ? <div className="min-w-0 shrink-0">{trailing}</div> : null}
        </div>
    );
}

export function GuideMessageBand({title, detail, icon = "binoculars", children}: {
    title: string;
    detail: string;
    icon?: "binoculars" | "lock" | "clock" | "warning" | "leaf";
    children?: React.ReactNode;
}) {
    return (
        <div className={`${GUIDE_BAND} flex items-start gap-3 px-[18px] py-4`}>
            <GuideGlyph name={icon} className="mt-0.5 h-4 w-6 shrink-0 text-white/40" />
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-1 text-xs leading-5 text-white/60">{detail}</p>
                {children}
            </div>
        </div>
    );
}

export type GuideGlyphName = "binoculars" | "lock" | "clock" | "warning" | "leaf" | "paw" | "eye-off" | "check" | "note" | "chat" | "people" | "sparkles" | "tick";

export function GuideGlyph({name, className = ""}: {name: GuideGlyphName; className?: string}) {
    const common = {viewBox: "0 0 24 24", className, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true};
    switch (name) {
        case "lock":
            return <svg {...common}><rect x="5" y="11" width="14" height="10" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>;
        case "clock":
            return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
        case "warning":
            return <svg {...common}><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17h.01" /></svg>;
        case "leaf":
            return <svg {...common}><path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15" /><path d="M5 19 13 11" /></svg>;
        case "paw":
            return <svg {...common}><circle cx="7" cy="9" r="1.6" /><circle cx="11" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="18" cy="10" r="1.6" /><path d="M8 17c0-3 2-5 4-5s4 2 4 5c0 2-2 2-4 2s-4 0-4-2Z" /></svg>;
        case "eye-off":
            return <svg {...common}><path d="M3 3l18 18" /><path d="M10.6 6.1A9.7 9.7 0 0 1 12 6c5 0 9 6 9 6a15 15 0 0 1-3 3.4M6.2 7.6A15 15 0 0 0 3 12s4 6 9 6a9 9 0 0 0 3.4-.7" /></svg>;
        case "tick":
            return <svg {...common} strokeWidth={3}><path d="m5 12 5 5 9-10" /></svg>;
        case "sparkles":
            return <svg {...common}><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></svg>;
        case "note":
            return <svg {...common}><path d="M6 3h9l4 4v14H6z" /><path d="M9 11h7M9 15h7M9 7h4" /></svg>;
        case "chat":
            return <svg {...common}><path d="M4 5h12v8H9l-4 3v-3H4z" /><path d="M16 9h4v8h-1v3l-3-3h-5v-2" /></svg>;
        case "people":
            return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.4" /><path d="M16 14.2c2.8.2 5 2.6 5 5.8" /></svg>;
        case "check":
            return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg>;
        default:
            return <svg {...common}><circle cx="6.5" cy="15.5" r="3.5" /><circle cx="17.5" cy="15.5" r="3.5" /><path d="M10 15.5h4M5 12l2-7h3l1 4M19 12l-2-7h-3l-1 4" /></svg>;
    }
}

/** A plain <img> through the capture image proxy (never next/image). */
export function GuidePhoto({media, size = "card", alt = "", className = ""}: {media: GuideMedia | null | undefined; size?: "thumb" | "card" | "hero"; alt?: string; className?: string}) {
    const src = guideMediaSrc(media, size);
    if (!src) return <span className={`block bg-[#2A2A2A] ${className}`} aria-hidden="true" />;
    return <img src={src} alt={alt} loading="lazy" decoding="async" className={`block object-cover ${className}`} />;
}

/** iOS `WildlifeGuideCoverThumbnail`: the author's banner, or up to four photos tiled into one square. */
export function GuideCoverTiles({media, banner, size = 76}: {media?: GuideMedia[]; banner?: GuideMedia; size?: number}) {
    const items = banner?.imageUrl || banner?.captureId ? [banner] : (media ?? []).filter((item) => item?.captureId).slice(0, 4);
    const style = {width: size, height: size};
    if (items.length === 0) {
        return (
            <span style={style} className="grid shrink-0 place-items-center bg-[#2A2A2A] text-white/35" aria-hidden="true">
                <GuideGlyph name="binoculars" className="h-6 w-6" />
            </span>
        );
    }
    if (items.length === 1) {
        return <span style={style} className="block shrink-0 overflow-hidden bg-[#2A2A2A]" aria-hidden="true"><GuidePhoto media={items[0]} size="thumb" className="h-full w-full" /></span>;
    }
    if (items.length < 4) {
        return (
            <span style={style} className="grid shrink-0 grid-cols-2 gap-px overflow-hidden bg-white/10" aria-hidden="true">
                <GuidePhoto media={items[0]} size="thumb" className="h-full w-full" />
                <span className="grid gap-px" style={{gridTemplateRows: `repeat(${items.length - 1}, minmax(0, 1fr))`}}>
                    {items.slice(1).map((item, index) => <GuidePhoto key={`${item.id ?? item.captureId}-${index}`} media={item} size="thumb" className="h-full w-full" />)}
                </span>
            </span>
        );
    }
    return (
        <span style={style} className="grid shrink-0 grid-cols-2 grid-rows-2 gap-px overflow-hidden bg-white/10" aria-hidden="true">
            {items.map((item, index) => <GuidePhoto key={`${item.id ?? item.captureId}-${index}`} media={item} size="thumb" className="h-full w-full" />)}
        </span>
    );
}

/** iOS `guideRow`: cover tiles, title, place, species line, status and price. */
export function GuideRow({card, href, status, locale = "en", speciesLine, trailingSpace = false}: {
    card: GuideCard;
    href: string;
    status?: {label: string; tone: GuideStatusTone} | null;
    locale?: string;
    /** Translated "N species · N rare"; English by default. */
    speciesLine?: string;
    /** Room on the right for the owner's options button. */
    trailingSpace?: boolean;
}) {
    return (
        <Link href={href} className={`${GUIDE_BAND} flex items-start gap-3.5 py-3.5 pl-[18px] transition hover:bg-[#262626] ${trailingSpace ? "pr-12" : "pr-[18px]"}`}>
            <GuideCoverTiles media={card.coverMedia} banner={card.banner} />
            <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block text-sm font-semibold text-white">{card.title}</span>
                <span className="mt-1 block truncate text-xs text-white/60">{card.areaLabel}</span>
                <span className="mt-1.5 flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-white/45">
                        {speciesLine ?? guideSpeciesLine(card.speciesCount, card.rareSpeciesCount)}
                    </span>
                    {status ? (
                        <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-[0.06em]" style={{color: STATUS_TONE_COLORS[status.tone]}}>
                            {status.label}
                        </span>
                    ) : null}
                    <span className="shrink-0 text-xs font-bold text-white">{formatGuidePrice(card.amountMinor, card.currencyCode, locale)}</span>
                </span>
            </span>
        </Link>
    );
}

export function RarityLabel({rarity, label}: {rarity: GuideRarity; label?: string}) {
    return (
        <span className="text-[10px] font-extrabold uppercase tracking-[0.06em]" style={{color: RARITY_COLORS[rarity] ?? RARITY_COLORS.common}}>
            {label ?? RARITY_LABELS[rarity] ?? "Common"}
        </span>
    );
}

/** iOS `WildlifeGuideMonthBars`: twelve months of sightings. */
export function GuideMonthBars({counts}: {counts: number[]}) {
    const months = Array.from({length: 12}, (_, index) => Math.max(0, counts[index] ?? 0));
    const peak = Math.max(1, ...months);
    const summary = months.map((count, index) => (count > 0 ? `${MONTH_NAMES[index]} ${count}` : null)).filter(Boolean).join(", ");
    return (
        <div className="flex h-[58px] items-end gap-1" role="img" aria-label={`Sightings by month: ${summary}`}>
            {months.map((count, index) => (
                <div key={index} className="flex flex-1 flex-col items-center justify-end gap-1">
                    <span
                        className="block w-full"
                        style={{height: count > 0 ? Math.max(6, (40 * count) / peak) : 3, backgroundColor: count > 0 ? GUIDE_NEON : "rgba(255,255,255,0.12)"}}
                    />
                    <span className="text-[10px] text-white/40">{MONTH_LETTERS[index]}</span>
                </div>
            ))}
        </div>
    );
}

/** An iOS-style switch. */
export function GuideSwitch({checked, disabled, label, onChange}: {checked: boolean; disabled?: boolean; label: string; onChange: (next: boolean) => void}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={(event) => {
                event.preventDefault();
                onChange(!checked);
            }}
            className="relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full transition disabled:opacity-50"
            style={{backgroundColor: checked ? GUIDE_NEON : "rgba(255,255,255,0.16)"}}
        >
            <span className={`absolute h-[27px] w-[27px] rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[22px]" : "translate-x-[2px]"}`} />
        </button>
    );
}
