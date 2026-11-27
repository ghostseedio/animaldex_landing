"use client";

import {useAppShellChrome} from "@/app/[locale]/(authenticated)/app/_components/app-shell-chrome";
import {useEffect, useSyncExternalStore} from "react";
import Link from "@/app/[locale]/_components/link";
import {arkAboardHref, createArkAboardStore, decodeArkAboard, type ArkAboardStore} from "@/lib/ark-aboard";

/**
 * "Aboard the Ark" on a Discover capture post (`lib/ark-aboard.ts`): a small sailboat chip beside the post's other
 * chips that opens the Ark on the post's animal and follows it. Nothing at all until the server has said the animal is
 * aboard and alive now; it never waits or spins, and a post whose animal is not aboard (or may not be shown) looks
 * exactly as before. English, like the rest of the signed-in app's chips (iOS and Android translate the same words).
 */

async function fetchBatch(ids: string[]): Promise<Record<string, string> | null> {
    try {
        const response = await fetch(`/api/ark/capture-aboard?captures=${ids.map(encodeURIComponent).join(",")}`, {
            credentials: "same-origin",
            cache: "no-store"
        });
        if (!response.ok) return null;
        const body = await response.json() as {aboard?: unknown};
        return decodeArkAboard(body.aboard, ids);
    } catch {
        return null;
    }
}

let shared: ArkAboardStore | null = null;

function arkAboardStore(): ArkAboardStore {
    shared ??= createArkAboardStore({fetchBatch});
    return shared;
}

const CHIP = "pointer-events-auto inline-flex h-[26px] shrink-0 items-center gap-1 rounded-full bg-primary-400/15 px-2.5 text-[0.68rem] font-black text-primary-100 ring-1 ring-primary-400/30 transition-colors hover:bg-primary-400/25";

/** The sailboat the Ark's capture band uses. */
function SailboatGlyph() {
    return (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 14h18l-2.2 4.2a2 2 0 0 1-1.8 1.1H7a2 2 0 0 1-1.8-1.1L3 14Z" />
            <path d="M7 14V9.5h10V14" />
            <path d="M12 9.5V5.5M10 5.5h4" />
        </svg>
    );
}

/** The chip's look, on its own (the dev fixtures and the tests draw it without a read). */
export function ArkAboardChipLink({animalId}: {animalId: string}) {
    // The app shell's words (English outside the shell: the dev fixtures and the tests).
    const {words} = useAppShellChrome();
    return (
        <Link href={arkAboardHref(animalId)} className={CHIP} data-testid="discover-aboard-chip" aria-label={words.arkAboardLabel}>
            <SailboatGlyph />
            <span>{words.arkAboard}</span>
        </Link>
    );
}

export default function ArkAboardChip({captureId, store}: {captureId: string; store?: ArkAboardStore}) {
    const active = store ?? (typeof window === "undefined" ? null : arkAboardStore());
    useEffect(() => {
        active?.request(captureId);
    }, [active, captureId]);
    const animalId = useSyncExternalStore(
        (listener) => active?.subscribe(listener) ?? (() => undefined),
        () => active?.get(captureId) ?? null,
        () => null
    );
    return animalId ? <ArkAboardChipLink animalId={animalId} /> : null;
}
