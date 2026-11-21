import React from "react";
import {ARK_HEARTS_MAX, clampArkHearts} from "@/lib/ark-hearts";

/** ♥♥♡: an Ark animal's hearts (its lives), filled for each one left. Decorative: its holder says the count in words. */
export function ArkHeartIcons({hearts, size = 14}: {hearts: number; size?: number}) {
    const n = clampArkHearts(hearts);
    return (
        <span className="inline-flex shrink-0 items-center gap-0.5 text-[#ff8f8f]" aria-hidden="true">
            {Array.from({length: ARK_HEARTS_MAX}, (_, index) => (
                <svg key={index} viewBox="0 0 24 24" style={{width: size, height: size}} fill={index < n ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2.2} strokeLinejoin="round">
                    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
                </svg>
            ))}
        </span>
    );
}
