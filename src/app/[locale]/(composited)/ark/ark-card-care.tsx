"use client";

import React, {useCallback, useEffect, useState} from "react";
import {arkCareDoes, arkCareError, arkCareLines, arkCareWords, parseArkCare, type ArkCare, type ArkCareOffer, type ArkCareWords} from "@/lib/ark-care-gifts";
import {fillArkWords} from "@/lib/ark-words";

/**
 * The tap card's care from visitors (AnimalDex GIFTS-CARE, owner decision 387; `lib/ark-care-gifts.ts`): what was given
 * to this animal ("Fed by @ada · fuller for 2 days") and, for a signed-in visitor who does not own it, the care they
 * could give now, each saying what it does before anything is spent ("Fuller for 2 days", then "Send for 5 Credits").
 * Nothing at all while the server's `gift_care` switch is off. Lazy (loads with the first card that asks), so /ark's
 * static JavaScript stays inside its budget.
 */
/** The server's switch read as off once on this page: no more asks until the page is opened again. */
let switchedOff = false;

export default function ArkCardCare({animalId, words: given, locale}: {animalId: string; words?: Partial<ArkCareWords> | null; locale: string}) {
    const words = arkCareWords(given);
    const [care, setCare] = useState<ArkCare | null>(null);
    const [picked, setPicked] = useState<ArkCareOffer | null>(null);
    const [sending, setSending] = useState(false);
    const [note, setNote] = useState<{text: string; ok: boolean} | null>(null);

    const read = useCallback(
        async (signal?: AbortSignal) => {
            try {
                const res = await fetch(`/api/ark/care?id=${encodeURIComponent(animalId)}`, {cache: "no-store", signal});
                if (!res.ok) return setCare(null);
                const json = (await res.json()) as {care?: unknown; off?: unknown};
                if (json?.off === true) switchedOff = true;
                setCare(parseArkCare(json));
            } catch {
                if (!signal?.aborted) setCare(null);
            }
        },
        [animalId]
    );

    useEffect(() => {
        const ctl = new AbortController();
        setCare(null);
        setPicked(null);
        setNote(null);
        if (!switchedOff) void read(ctl.signal);
        return () => ctl.abort();
    }, [read]);

    const send = async (offer: ArkCareOffer) => {
        if (!care?.card || sending) return;
        setSending(true);
        try {
            const res = await fetch("/api/app/gifts", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({captureId: care.card, definitionId: offer.id, clientIdempotencyKey: crypto.randomUUID(), catalogSource: "v2"})
            });
            const body = (await res.json().catch(() => ({}))) as {error?: string};
            if (!res.ok) setNote({text: arkCareError(body.error, words), ok: false});
            else setNote({text: words.sent, ok: true});
        } catch {
            setNote({text: words.failed, ok: false});
        } finally {
            setSending(false);
            setPicked(null);
            void read();
        }
    };

    if (!care) return null;
    const now = Date.now();
    const lines = arkCareLines(care, words, locale, now);
    const offers = care.mine || !care.card ? [] : care.offers.filter((offer) => offer.available);
    if (!lines.length && !offers.length && !note) return null;

    return (
        <div data-testid="ark-card-care" className="min-w-0">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-400">{words.title}</p>
            {lines.length ? (
                <ul className="mt-1 space-y-0.5">
                    {lines.map((line, i) => (
                        <li key={i} data-testid="ark-card-care-line" className="flex min-w-0 items-center gap-2 text-[12.5px] leading-snug text-ink-100">
                            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#ffd27a]" />
                            <span className="min-w-0 truncate" dir="auto">{line}</span>
                        </li>
                    ))}
                </ul>
            ) : null}
            {offers.length && !picked ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {offers.map((offer) => (
                        <button
                            key={offer.id}
                            type="button"
                            data-testid="ark-card-care-offer"
                            data-care={offer.care}
                            onClick={() => {
                                setNote(null);
                                setPicked(offer);
                            }}
                            className="flex items-center gap-1.5 border border-[#ffd27a]/35 bg-[#ffd27a]/[0.08] px-2.5 py-1 text-[12px] font-semibold text-[#ffe2a8] transition-colors hover:border-[#ffd27a]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffd27a]"
                        >
                            <span>{words[offer.care]}</span>
                            <span className="font-normal tabular-nums text-ink-300">{fillArkWords(words.credits, {n: offer.cost.toLocaleString(locale)})}</span>
                        </button>
                    ))}
                </div>
            ) : null}
            {picked ? (
                <div data-testid="ark-card-care-confirm" className="mt-1.5 border-s-2 border-[#ffd27a]/60 ps-2.5">
                    <p className="text-[12.5px] font-semibold leading-snug text-white">
                        {words[picked.care]} <span className="font-normal text-ink-200">· {arkCareDoes(picked, words, locale)}</span>
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                        <button type="button" disabled={sending} onClick={() => void send(picked)} className="bg-[#ffd27a] px-3 py-1 text-[12px] font-bold text-canvas-950 transition-opacity disabled:opacity-60">
                            {fillArkWords(words.send, {n: picked.cost.toLocaleString(locale)})}
                        </button>
                        <button type="button" disabled={sending} onClick={() => setPicked(null)} className="px-2 py-1 text-[12px] font-semibold text-ink-300 hover:text-white">
                            {words.cancel}
                        </button>
                    </div>
                </div>
            ) : null}
            {note ? (
                <p role="status" className={`mt-1 text-[11.5px] leading-snug ${note.ok ? "text-primary-300" : "text-[#ffb4a8]"}`}>
                    {note.text}
                </p>
            ) : null}
        </div>
    );
}
