"use client";

import Link from "@/app/[locale]/_components/link";
import {useEffect, useState} from "react";
import CaptureGiftSheet, {GiftGlyph} from "@/app/[locale]/(authenticated)/app/_components/capture-gift-sheet";
import {parseGiftCatalog, type GiftCatalog} from "@/lib/capture-gifts";

/** Mirrors `FEED_RAIL_BUTTON_CLASS` in discover-timeline-cards (kept local to avoid an import cycle). */
const FEED_RAIL_BUTTON_CLASS = "pointer-events-auto grid h-11 w-11 place-items-center [filter:drop-shadow(0_1px_3px_rgba(0,0,0,0.6))] [@media(max-height:760px)]:h-9 [@media(max-height:760px)]:w-9 [&_svg]:h-5 [&_svg]:w-5 [@media(max-height:760px)]:[&_svg]:h-[1.1rem] [@media(max-height:760px)]:[&_svg]:w-[1.1rem]";

const ENDORSEMENT_STATS = ["dominance", "speed", "size", "intelligence", "rarity"] as const;
type EndorsementStat = (typeof ENDORSEMENT_STATS)[number];

function shortStatTitle(stat: string) {
    if (stat === "intelligence") return "Int";
    return stat.charAt(0).toUpperCase() + stat.slice(1);
}

function statTitle(stat: string) {
    return stat.charAt(0).toUpperCase() + stat.slice(1);
}

function ActionButton({
    title,
    tone = "neutral",
    disabled,
    onClick,
    href
}: {
    title: string;
    tone?: "neutral" | "primary";
    disabled?: boolean;
    onClick?: () => void;
    href?: string;
}) {
    const className = `inline-flex shrink-0 items-center justify-center rounded-full px-3.5 py-2 text-[0.72rem] font-black transition ${
        tone === "primary"
            ? "bg-primary-400 text-black hover:brightness-105"
            : "border border-white/10 bg-white/[0.06] text-white/80 hover:bg-white/[0.1] hover:text-white"
    } disabled:opacity-50`;

    if (href) {
        return (
            <Link href={href} className={className}>
                {title}
            </Link>
        );
    }

    return (
        <button type="button" disabled={disabled} onClick={onClick} className={className}>
            {title}
        </button>
    );
}

function ThumbsUpIcon({filled}: {filled: boolean}) {
    return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 10.4 11.1 3a2 2 0 0 1 2.9 2.3l-.9 4h5.1a2 2 0 0 1 2 2.5l-1.7 6.6A2.6 2.6 0 0 1 16 20H7z" />
            <path d="M7 10.4V20H4.6A1.6 1.6 0 0 1 3 18.4v-6.4a1.6 1.6 0 0 1 1.6-1.6z" />
        </svg>
    );
}

export default function DiscoverCaptureActions({
    captureId,
    isOwnPost,
    canOffer,
    viewerEndorsementStat,
    onEndorsementChange,
    variant = "pills"
}: {
    captureId: string;
    isOwnPost: boolean;
    canOffer: boolean;
    viewerEndorsementStat: string | null;
    onEndorsementChange?: (stat: string | null, endorsementCountDelta: number) => void;
    variant?: "pills" | "rail";
}) {
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [localStat, setLocalStat] = useState(viewerEndorsementStat);
    const [catalog, setCatalog] = useState<GiftCatalog | null>(null);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const response = await fetch("/api/app/gifts/catalog", {cache: "no-store"});
            const next = parseGiftCatalog(await response.json().catch(() => null));
            if (!cancelled) setCatalog(next);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    if (isOwnPost) return null;

    const giftsEnabled = catalog?.enabled === true && (catalog.definitions.length ?? 0) > 0;
    const showsGift = giftsEnabled;
    const showsEndorse = !giftsEnabled;
    const showsOffer = canOffer;
    // 3.2: no battle "Compare" here; debates start from the animal's own chat.
    if (!showsGift && !showsEndorse && !showsOffer) return null;

    const endorseLabel = localStat ? `Endorsed ${shortStatTitle(localStat.toLowerCase())}` : "Endorse";

    async function submitEndorsement(stat: EndorsementStat | null) {
        setPending(true);
        setError(null);
        try {
            const response = await fetch("/api/app/endorsement", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({captureId, endorsedStat: stat})
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.error ?? "Could not update endorsement.");
            }
            const nextStat = typeof payload.endorsedStat === "string" ? payload.endorsedStat : null;
            const delta = localStat && !nextStat ? -1 : !localStat && nextStat ? 1 : 0;
            setLocalStat(nextStat ? statTitle(nextStat) : null);
            onEndorsementChange?.(nextStat ? statTitle(nextStat) : null, delta);
            setOpen(false);
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "Could not update endorsement.");
        } finally {
            setPending(false);
        }
    }

    const giftModal = open && showsGift && catalog ? (
        <CaptureGiftSheet captureId={captureId} catalog={catalog} onClose={() => setOpen(false)} />
    ) : null;

    const endorsementModal = open && showsEndorse ? (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 md:items-center"
            role="dialog"
            aria-modal="true"
            aria-label="Endorse this animal"
        >
            <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto border border-white/10 bg-[#1f1f1f] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-lg font-semibold text-white">Endorse this animal</h3>
                        <p className="mt-2 text-xs font-medium leading-5 text-white/60">
                            Compatibility path for older clients while Gifts are disabled.
                        </p>
                    </div>
                    <button type="button" onClick={() => setOpen(false)} className="text-sm font-semibold text-primary-200">
                        Cancel
                    </button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                    {ENDORSEMENT_STATS.map((stat) => (
                        <button
                            key={stat}
                            type="button"
                            disabled={pending || Boolean(localStat)}
                            onClick={() => void submitEndorsement(stat)}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-semibold capitalize text-white disabled:opacity-40"
                        >
                            Endorse {statTitle(stat)}
                        </button>
                    ))}
                </div>
                {localStat ? (
                    <button
                        type="button"
                        disabled={pending}
                        onClick={() => void submitEndorsement(null)}
                        className="mt-3 w-full rounded-full border border-red-400/30 bg-red-500/10 px-3 py-2.5 text-xs font-semibold text-red-200"
                    >
                        Withdraw {localStat} endorsement
                    </button>
                ) : null}
                {error ? <p className="mt-3 text-xs font-medium text-red-300">{error}</p> : null}
            </div>
        </div>
    ) : null;

    if (variant === "rail") {
        return (
            <>
                <button
                    type="button"
                    disabled={pending}
                    onClick={() => setOpen(true)}
                    aria-label={showsGift ? "Gift" : endorseLabel}
                    title={showsGift ? "Gift" : endorseLabel}
                    className={`${FEED_RAIL_BUTTON_CLASS} ${
                        showsGift || localStat ? "text-primary-300" : "text-white"
                    }`}
                >
                    {showsGift ? <GiftGlyph className="h-5 w-5" /> : <ThumbsUpIcon filled={Boolean(localStat)} />}
                </button>
                {giftModal}
                {endorsementModal}
            </>
        );
    }

    return (
        <>
            <div className="-mx-1 flex max-h-10 gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {showsGift ? (
                    <ActionButton title="Gift" tone="primary" onClick={() => setOpen(true)} />
                ) : null}
                {showsEndorse ? (
                    <ActionButton
                        title={endorseLabel}
                        tone={localStat ? "neutral" : "primary"}
                        disabled={pending}
                        onClick={() => setOpen(true)}
                    />
                ) : null}
                {showsOffer ? (
                    <ActionButton title="Offer" href={`/app/trades?theirCapture=${encodeURIComponent(captureId)}`} />
                ) : null}
            </div>
            {giftModal}
            {endorsementModal}
        </>
    );
}
