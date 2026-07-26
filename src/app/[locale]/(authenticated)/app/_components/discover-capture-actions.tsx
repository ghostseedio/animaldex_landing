"use client";

import Link from "@/app/[locale]/_components/link";
import {useState} from "react";

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

export default function DiscoverCaptureActions({
    captureId,
    isOwnPost,
    canChallenge,
    canOffer,
    viewerEndorsementStat,
    onEndorsementChange
}: {
    captureId: string;
    isOwnPost: boolean;
    canChallenge: boolean;
    canOffer: boolean;
    viewerEndorsementStat: string | null;
    onEndorsementChange?: (stat: string | null, endorsementCountDelta: number) => void;
}) {
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [localStat, setLocalStat] = useState(viewerEndorsementStat);

    if (isOwnPost) return null;

    const showsEndorse = true;
    const showsOffer = canOffer;
    const showsCompare = canChallenge;
    if (!showsEndorse && !showsOffer && !showsCompare) return null;

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

    return (
        <>
            <div className="-mx-1 flex max-h-10 gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

            {open ? (
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
                                    Choose one trait carefully. Each endorsement adds one point to that stat until you withdraw it.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="text-sm font-semibold text-primary-200"
                            >
                                Cancel
                            </button>
                        </div>

                        {localStat ? (
                            <p className="mt-3 text-xs leading-5 text-white/45">
                                You already endorsed this animal in {localStat.toLowerCase()}. Withdraw it first if you want to free up your one endorsement on this capture.
                            </p>
                        ) : null}

                        <div className="mt-4 grid grid-cols-2 gap-2">
                            {ENDORSEMENT_STATS.map((stat) => (
                                <button
                                    key={stat}
                                    type="button"
                                    disabled={pending || Boolean(localStat)}
                                    onClick={() => submitEndorsement(stat)}
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
                                onClick={() => submitEndorsement(null)}
                                className="mt-3 w-full rounded-full border border-red-400/30 bg-red-500/10 px-3 py-2.5 text-xs font-semibold text-red-200"
                            >
                                Withdraw {localStat} endorsement
                            </button>
                        ) : null}

                        {error ? <p className="mt-3 text-xs font-medium text-red-300">{error}</p> : null}
                    </div>
                </div>
            ) : null}
        </>
    );
}
