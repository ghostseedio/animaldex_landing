"use client";

import {useEffect} from "react";
import EarnPowerMount from "@/components/animal-detail/animal-powers/earn-power-mount";

/**
 * The earning flow, reachable from wherever a Power lock is shown. Ported from
 * iOS `EarnPowerSheet`.
 *
 * This is NOT a second earning screen. It is `EarnPowerSection` — the same
 * component the Play tab renders — in a sheet, so a locked Comparison row or a
 * locked Fusion panel can open the real thing instead of being a dead end.
 *
 * Returning is the reason it is a sheet rather than a navigation. Closing puts
 * the person back exactly where they were — the picker they were choosing
 * from — and the caller re-reads eligibility on close, so a capture they just
 * unlocked is immediately usable without leaving and coming back.
 */
export default function EarnPowerSheet({
    speciesProfileId,
    animalName,
    onClose
}: {
    speciesProfileId: string | null | undefined;
    /**
     * What the person was looking at when they hit the lock. Shown in the title
     * so the sheet is obviously about that animal.
     */
    animalName?: string | null;
    onClose: () => void;
}) {
    useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previous;
        };
    }, []);

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Earn this Power"
            className="fixed inset-0 z-[57] flex flex-col bg-black"
        >
            <header className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3">
                <span className="truncate text-[10px] font-black uppercase tracking-[0.13em] text-white/55">
                    {animalName?.trim() || "Animal Power"}
                </span>
                {/* Never a dead end: every presented surface closes. */}
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-white"
                >
                    ✕
                </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-2xl pb-6">
                    <EarnPowerMount speciesProfileId={speciesProfileId} />
                </div>
            </div>
        </div>
    );
}
