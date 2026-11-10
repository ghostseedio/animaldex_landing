"use client";

import React, {useCallback, useEffect, useState} from "react";
import {createPortal} from "react-dom";
import {arkShareUrl} from "@/lib/ark-seo";

/**
 * Share the Ark, or one species in it (Part 4c): the system share sheet where
 * the browser has one (Web Share API), otherwise the link copied, as the
 * capture card's share does it. The link opens /ark (with `?focus=` for a
 * species) and says it was shared (`from=share`); its preview is the Ark's
 * share card, with that species' count aboard.
 *
 * The words carry counts and a species' name only: never who brought it.
 */

export type ArkShareTarget = "tap_card" | "population";

export async function shareArk(input: {localePath: string; slug: string | null; title: string; text: string}): Promise<"shared" | "copied" | "none"> {
    const url = arkShareUrl(window.location.origin, input.localePath, input.slug);
    try {
        if (typeof navigator.share === "function") {
            await navigator.share({title: input.title, text: input.text, url});
            return "shared";
        }
        if (!navigator.clipboard) return "none";
        await navigator.clipboard.writeText(url);
        return "copied";
    } catch {
        // Dismissed, or nothing to share with: nothing to say.
        return "none";
    }
}

function ShareIcon({className = "h-4 w-4 shrink-0"}: {className?: string}) {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12" />
            <path d="m7.5 7.5 4.5-4.5 4.5 4.5" />
            <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
        </svg>
    );
}

/** "Link copied", at the top of the window: in a portal, since the tap card's blur would otherwise hold it inside the card. */
function CopiedNote({text, onDone}: {text: string; onDone: () => void}) {
    useEffect(() => {
        const timer = window.setTimeout(onDone, 3200);
        return () => window.clearTimeout(timer);
    }, [onDone, text]);
    return createPortal(
        <p role="status" className="fixed inset-x-4 top-4 z-[75] mx-auto max-w-md border border-white/10 bg-[#141414] px-4 py-3 text-center text-sm font-semibold text-white shadow-2xl">
            {text}
        </p>,
        document.body
    );
}

type Props = {
    target: ArkShareTarget;
    localePath: string;
    /** The species' model slug, or null for the whole Ark. */
    slug: string | null;
    title: string;
    text: string;
    label: string;
    copied: string;
    /** `pill`: a labelled button (the tap card; icon only on a phone); `icon`: a round icon button (the population panel). */
    look: "pill" | "icon";
    className?: string;
};

export default function ArkShareButton({target, localePath, slug, title, text, label, copied, look, className = ""}: Props) {
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState<string | null>(null);
    const clear = useCallback(() => setNote(null), []);
    const share = useCallback(async () => {
        if (busy) return;
        setBusy(true);
        const outcome = await shareArk({localePath, slug, title, text});
        if (outcome === "copied") setNote(copied);
        // TODO(Part 1, ark-measure): Part 1's helper (lib/ark-measure-client) is not on this
        // branch yet. When it is: if (outcome !== "none") trackArk("ark_share", {target}).
        setBusy(false);
    }, [busy, copied, localePath, slug, text, title]);
    return (
        <>
            <button
                type="button"
                onClick={() => void share()}
                disabled={busy}
                aria-label={label}
                title={label}
                data-testid={`ark-share-${target}`}
                className={className}
            >
                <ShareIcon />
                {/* A phone's tap card has no room for the word: the icon alone there. */}
                {look === "pill" ? <span aria-hidden="true" className="hidden sm:inline">{label}</span> : null}
            </button>
            {note ? <CopiedNote text={note} onDone={clear} /> : null}
        </>
    );
}
