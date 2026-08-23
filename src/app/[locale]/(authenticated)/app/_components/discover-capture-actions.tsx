"use client";

import Link from "@/app/[locale]/_components/link";
import {useEffect, useState} from "react";
import {giftDisplayName, type GiftCatalog, type GiftDefinition} from "@/lib/capture-gifts";

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

function GiftIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8" />
            <path d="M2 7h20v5H2z" />
            <path d="M12 22V7" />
            <path d="M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7z" />
            <path d="M12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z" />
        </svg>
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
    canChallenge,
    canOffer,
    viewerEndorsementStat,
    onEndorsementChange,
    variant = "pills"
}: {
    captureId: string;
    isOwnPost: boolean;
    canChallenge: boolean;
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
    const [sendingSlug, setSendingSlug] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const response = await fetch("/api/app/gifts/catalog", {cache: "no-store"});
            const json = await response.json().catch(() => null);
            if (cancelled) return;
            if (json && typeof json.enabled === "boolean") {
                setCatalog({
                    enabled: Boolean(json.enabled),
                    definitions: Array.isArray(json.definitions)
                        ? json.definitions.map((item: Record<string, unknown>) => ({
                            id: String(item.id ?? ""),
                            slug: String(item.slug ?? ""),
                            displayName: String(item.display_name ?? giftDisplayName(String(item.slug ?? ""))),
                            description: String(item.description ?? ""),
                            creditCost: Number(item.credit_cost ?? 0),
                            captureXpGrant: Number(item.capture_xp_grant ?? 0),
                            iconKey: String(item.icon_key ?? "gift"),
                            endorsedStat: item.endorsed_stat as GiftDefinition["endorsedStat"],
                            sortOrder: Number(item.sort_order ?? 0)
                        }))
                        : []
                });
            } else {
                setCatalog({enabled: false, definitions: []});
            }
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
    const showsCompare = canChallenge;
    if (!showsGift && !showsEndorse && !showsOffer && !showsCompare) return null;

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

    async function sendGift(definition: GiftDefinition) {
        setSendingSlug(definition.slug);
        setError(null);
        try {
            const response = await fetch("/api/app/gifts", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    captureId,
                    definitionId: definition.id,
                    clientIdempotencyKey: crypto.randomUUID()
                })
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(typeof payload.error === "string" ? payload.error : "Could not send Gift.");
            }
            setOpen(false);
        } catch (sendError) {
            setError(sendError instanceof Error ? sendError.message : "Could not send Gift.");
        } finally {
            setSendingSlug(null);
        }
    }

    const giftModal = open && showsGift ? (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 md:items-center"
            role="dialog"
            aria-modal="true"
            aria-label="Send a Gift"
        >
            <div className="w-full max-w-md rounded-[22px] border border-white/10 bg-[#1f1f1f] p-5 shadow-2xl">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-lg font-semibold text-white">Send a Gift</h3>
                        <p className="mt-2 text-xs font-medium leading-5 text-white/60">
                            Recognise a stat on this animal. You spend Credits. The recipient does not receive Credits.
                        </p>
                    </div>
                    <button type="button" onClick={() => setOpen(false)} className="text-sm font-semibold text-primary-200">
                        Cancel
                    </button>
                </div>
                <div className="mt-4 grid gap-2">
                    {catalog?.definitions.map((definition) => (
                        <button
                            key={definition.id}
                            type="button"
                            disabled={sendingSlug != null}
                            onClick={() => void sendGift(definition)}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left text-xs font-semibold text-white disabled:opacity-40"
                        >
                            {definition.displayName} · Supports {definition.endorsedStat ?? "this animal"} · {definition.creditCost} Credits
                        </button>
                    ))}
                </div>
                {error ? <p className="mt-3 text-xs font-medium text-red-300">{error}</p> : null}
            </div>
        </div>
    ) : null;

    const endorsementModal = open && showsEndorse ? (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 md:items-center"
            role="dialog"
            aria-modal="true"
            aria-label="Endorse this animal"
        >
            <div className="w-full max-w-md rounded-[22px] border border-white/10 bg-[#1f1f1f] p-5 shadow-2xl">
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
                    disabled={pending || sendingSlug != null}
                    onClick={() => setOpen(true)}
                    aria-label={showsGift ? "Gift" : endorseLabel}
                    title={showsGift ? "Gift" : endorseLabel}
                    className={`pointer-events-auto grid h-11 w-11 place-items-center [filter:drop-shadow(0_1px_3px_rgba(0,0,0,0.6))] ${
                        showsGift || localStat ? "text-primary-300" : "text-white"
                    }`}
                >
                    {showsGift ? <GiftIcon /> : <ThumbsUpIcon filled={Boolean(localStat)} />}
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
                    <ActionButton title="Gift" tone="primary" disabled={sendingSlug != null} onClick={() => setOpen(true)} />
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
                {showsCompare ? (
                    <ActionButton title="Compare" href={`/app/matchups?target=${encodeURIComponent(captureId)}`} />
                ) : null}
            </div>
            {giftModal}
            {endorsementModal}
        </>
    );
}
