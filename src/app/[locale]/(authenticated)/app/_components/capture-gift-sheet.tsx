"use client";

/**
 * Send a Gift: the web port of the iOS `CaptureGiftSheet` (2026-11-01). A
 * drawer of the Gifts as pictures, four to a row; pick one, Send, and it
 * celebrates: the Gift bursts, "−N Credits" rises, and the balance (here and
 * in the app's header chip) counts down to what the server says is left.
 * A Gift you cannot afford offers Credits instead.
 */

import {useCallback, useEffect, useRef, useState, type CSSProperties} from "react";
import Link from "@/app/[locale]/_components/link";
import {useOptionalAppCredits} from "@/app/[locale]/(authenticated)/app/_components/app-credits";
import {
    giftAccent,
    giftErrorMessage,
    giftImageSrc,
    giftStatTitle,
    parseGiftSendResult,
    type GiftCatalog,
    type GiftDefinition,
    type GiftSendResult
} from "@/lib/capture-gifts";

/** How long the celebration shows before the drawer closes (iOS: 1.65 s). */
const CELEBRATION_MS = 1650;

export function GiftImage({slug, iconKey, size, className = ""}: {slug: string; iconKey: string; size: number; className?: string}) {
    const src = giftImageSrc(slug, iconKey);
    if (!src) {
        return (
            <span aria-hidden="true" className={`grid place-items-center text-primary-300 ${className}`} style={{width: size, height: size}}>
                <GiftGlyph className="h-1/2 w-1/2" />
            </span>
        );
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className={`object-contain ${className}`} style={{width: size, height: size}} draggable={false} />;
}

export function CreditsIcon({size = 14}: {size?: number}) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/images/gifts/credits.webp" alt="" width={size} height={size} style={{width: size, height: size}} className="shrink-0" draggable={false} />;
}

export function GiftGlyph({className = "h-4 w-4"}: {className?: string}) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8" />
            <path d="M2 7h20v5H2z" />
            <path d="M12 22V7" />
            <path d="M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7z" />
            <path d="M12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z" />
        </svg>
    );
}

type Phase = {kind: "pick"} | {kind: "celebrating"; result: GiftSendResult; definition: GiftDefinition};

export default function CaptureGiftSheet({captureId, catalog, onClose, onSent}: {
    captureId: string;
    catalog: GiftCatalog;
    onClose: () => void;
    /** After a Gift lands: the caller refreshes what it shows (the Gifts list, community support). */
    onSent?: (result: GiftSendResult, definition: GiftDefinition) => void;
}) {
    const credits = useOptionalAppCredits();
    const balance = credits?.balance ?? null;
    const [selectedId, setSelectedId] = useState<string | null>(catalog.definitions[0]?.id ?? null);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [phase, setPhase] = useState<Phase>({kind: "pick"});

    const selected = catalog.definitions.find((definition) => definition.id === selectedId) ?? null;
    const celebrating = phase.kind === "celebrating";
    // The caller's onClose may be a new function each render (it re-renders when a Gift lands).
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    const close = useCallback(() => {
        if (sending) return;
        onCloseRef.current();
    }, [sending]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !celebrating) close();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [close, celebrating]);

    useEffect(() => {
        if (!celebrating) return;
        const timer = window.setTimeout(() => onCloseRef.current(), CELEBRATION_MS);
        return () => window.clearTimeout(timer);
    }, [celebrating]);

    async function send(definition: GiftDefinition) {
        if (sending) return;
        setSending(true);
        setError(null);
        try {
            const response = await fetch("/api/app/gifts", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({captureId, definitionId: definition.id, clientIdempotencyKey: crypto.randomUUID()})
            });
            const json = await response.json().catch(() => ({}));
            if (!response.ok) {
                setError(giftErrorMessage(typeof json.error === "string" ? json.error : null));
                return;
            }
            const result = parseGiftSendResult(json, definition.creditCost);
            if (credits) {
                // The header chip flashes "−N" and counts down; the server's own balance wins if it differs.
                const expected = Math.max(0, (credits.balance ?? 0) - result.creditCost);
                credits.applyDelta(-result.creditCost);
                if (result.senderBalance != null && result.senderBalance !== expected) credits.setBalance(result.senderBalance);
            }
            setPhase({kind: "celebrating", result, definition});
            onSent?.(result, definition);
        } catch {
            setError(giftErrorMessage(null));
        } finally {
            setSending(false);
        }
    }

    const shownBalance = credits ? credits.displayBalance : phase.kind === "celebrating" ? phase.result.senderBalance : null;

    return (
        <div
            className="theme-dark fixed inset-0 z-50 flex items-end justify-center bg-black/70 md:items-center md:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Send a Gift"
            onClick={(event) => {
                if (event.target === event.currentTarget && !celebrating) close();
            }}
        >
            <div className="flex max-h-[min(36rem,calc(100dvh-1rem))] w-full max-w-md flex-col border border-white/10 bg-[#1a1a1c] shadow-[0_-20px_60px_rgba(0,0,0,0.5)]">
                {phase.kind === "pick" ? (
                    <>
                        {/* What the picked Gift recognises, in one line (the TikTok drawer's strip). */}
                        <div className="flex items-center gap-2 px-4 pb-2 pt-3">
                            <GiftGlyph className="h-3.5 w-3.5 shrink-0 text-primary-300" />
                            {selected ? (
                                <p className="min-w-0 flex-1 truncate text-xs">
                                    <span className="font-semibold text-white/90">{giftStatTitle(selected.endorsedStat)}</span>
                                    {selected.description ? <span className="ml-2 text-white/55">{selected.description}</span> : null}
                                </p>
                            ) : (
                                <p className="min-w-0 flex-1 truncate text-xs text-white/55">Pick a Gift to recognise a stat on this animal.</p>
                            )}
                            <button
                                type="button"
                                onClick={close}
                                disabled={sending}
                                aria-label="Close"
                                className="grid h-8 w-8 shrink-0 place-items-center text-white/45 transition-colors hover:text-white"
                            >
                                <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                                    <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
                                </svg>
                            </button>
                        </div>

                        {error ? <p className="px-4 pb-2 text-xs font-medium text-red-300" role="alert">{error}</p> : null}

                        <div className="grid min-h-0 flex-1 grid-cols-4 gap-1.5 overflow-y-auto px-2.5 pb-3">
                            {catalog.definitions.map((definition) => {
                                const isSelected = definition.id === selectedId;
                                const unaffordable = balance != null && balance < definition.creditCost;
                                const accent = giftAccent(definition.iconKey);

                                return (
                                    <div
                                        key={definition.id}
                                        className={`flex flex-col transition-[background-color,opacity] duration-200 ${isSelected ? "bg-white/[0.08]" : ""} ${unaffordable && !isSelected ? "opacity-45" : ""}`}
                                    >
                                        <button
                                            type="button"
                                            aria-pressed={isSelected}
                                            aria-label={`${definition.displayName}, ${definition.creditCost} Credits`}
                                            onClick={() => {
                                                setSelectedId(definition.id);
                                                setError(null);
                                            }}
                                            className="flex flex-col items-center gap-1 px-1 pb-2 pt-2"
                                        >
                                            <span
                                                className="grid h-[4.25rem] w-full place-items-center"
                                                style={{background: isSelected ? `radial-gradient(circle, color-mix(in srgb, ${accent} 30%, transparent), transparent 62%)` : undefined}}
                                            >
                                                <GiftImage
                                                    slug={definition.slug}
                                                    iconKey={definition.iconKey}
                                                    size={isSelected ? 56 : 48}
                                                    className="transition-[width,height] duration-200"
                                                />
                                            </span>
                                            <span className="w-full truncate text-center text-[11px] font-semibold text-white/90">{definition.displayName}</span>
                                            <span className="flex items-center gap-1 text-[11px] font-medium text-white/70">
                                                <CreditsIcon size={12} />
                                                {definition.creditCost}
                                            </span>
                                        </button>
                                        {isSelected ? (
                                            unaffordable ? (
                                                <Link
                                                    href="/app/credits"
                                                    className="mx-1.5 mb-2 flex h-8 items-center justify-center rounded-[2px] bg-primary-400 text-[13px] font-black text-black"
                                                >
                                                    Get Credits
                                                </Link>
                                            ) : (
                                                <button
                                                    type="button"
                                                    disabled={sending}
                                                    onClick={() => void send(definition)}
                                                    className="mx-1.5 mb-2 flex h-8 items-center justify-center rounded-[2px] bg-primary-400 text-[13px] font-black text-black transition hover:brightness-105 disabled:opacity-70"
                                                >
                                                    {sending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/25 border-t-black" aria-label="Sending" /> : "Send"}
                                                </button>
                                            )
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex items-center gap-3 border-t border-white/[0.06] bg-[#141416] px-4 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-2.5">
                            <span className="text-[15px] font-semibold text-white">Gifts</span>
                            <span className="flex-1" />
                            {balance != null ? (
                                <Link
                                    href="/app/credits"
                                    aria-label={`Credits, ${balance} available`}
                                    className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 transition-colors hover:bg-white/[0.14]"
                                >
                                    <CreditsIcon size={14} />
                                    <span className="text-[13px] font-bold tabular-nums text-white">{(shownBalance ?? balance).toLocaleString()}</span>
                                    <span className="text-xs font-semibold text-white/70">Credits</span>
                                    <span aria-hidden="true" className="text-[10px] font-bold text-white/45">›</span>
                                </Link>
                            ) : null}
                        </div>
                    </>
                ) : (
                    <GiftCelebration definition={phase.definition} result={phase.result} balance={shownBalance} />
                )}
            </div>
        </div>
    );
}

/** "Gift sent!": the Gift bursts, the cost rises, the balance counts down (iOS `celebrationContent`). */
function GiftCelebration({definition, result, balance}: {definition: GiftDefinition; result: GiftSendResult; balance: number | null}) {
    const accent = giftAccent(definition.iconKey);

    return (
        <div className="flex flex-col items-center gap-5 px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-10 text-center" role="status" aria-live="polite">
            <div className="relative grid h-56 w-56 place-items-center">
                {Array.from({length: 10}, (_, index) => {
                    const angle = (index / 10) * Math.PI * 2;
                    return (
                        <span
                            key={index}
                            aria-hidden="true"
                            className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full motion-safe:animate-[giftBurst_850ms_ease-out_both] motion-reduce:hidden"
                            style={{
                                backgroundColor: accent,
                                animationDelay: `${index * 30}ms`,
                                "--gift-dx": `${Math.cos(angle) * 92}px`,
                                "--gift-dy": `${Math.sin(angle) * 92}px`
                            } as CSSProperties}
                        />
                    );
                })}
                <span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full motion-safe:animate-[giftPop_600ms_cubic-bezier(.2,.9,.3,1.3)_both]"
                    style={{background: `radial-gradient(circle, color-mix(in srgb, ${accent} 55%, transparent) 4%, color-mix(in srgb, ${accent} 5%, transparent) 50%, transparent 70%)`}}
                />
                <span
                    className="relative grid h-[6.75rem] w-[6.75rem] place-items-center rounded-full motion-safe:animate-[giftPop_600ms_cubic-bezier(.2,.9,.3,1.3)_both]"
                    style={{
                        background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 65%, transparent))`,
                        boxShadow: `0 0 44px color-mix(in srgb, ${accent} 55%, transparent)`
                    }}
                >
                    <GiftImage slug={definition.slug} iconKey={definition.iconKey} size={68} />
                </span>
            </div>
            <div className="flex flex-col gap-1.5">
                <p className="font-display text-3xl font-bold text-white">Gift sent!</p>
                <p className="text-sm font-semibold" style={{color: accent}}>{definition.displayName}</p>
                <p className="text-xs text-white/60">Boosted {giftStatTitle(definition.endorsedStat)}</p>
            </div>
            <div className="flex flex-col items-center gap-2.5">
                <p className="font-display text-3xl font-bold text-orange-400 motion-safe:animate-[giftRise_350ms_ease-out_120ms_both]">
                    −{result.creditCost} Credits
                </p>
                {balance != null ? (
                    <p className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-4 py-3 text-xs text-white/60">
                        Balance
                        <span className="inline-flex items-center gap-1.5 text-sm font-bold tabular-nums text-primary-300">
                            <CreditsIcon size={14} />
                            {balance.toLocaleString()}
                        </span>
                        Credits
                    </p>
                ) : null}
            </div>
        </div>
    );
}
