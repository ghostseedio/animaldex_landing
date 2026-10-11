"use client";

import {createContext, useContext} from "react";
import {stepEyebrow} from "@/lib/power-loop";

/** Scroll targets for the four Power Loop steps, one per section on the Play tab. */
export const POWER_LOOP_ANCHORS = {
    training: "power-loop-training",
    trials: "power-loop-trials",
    battles: "power-loop-battles",
    fusion: "power-loop-fusion"
} as const;

/**
 * What the Power Loop bar tells the Play sections it sits above. The growth
 * panel is built on the server and handed to the capture card as a node, so it
 * cannot take callbacks as props; it reads this instead. Null everywhere the
 * bar is not shown, which leaves every other surface exactly as it was.
 */
export type PowerLoopContextValue = {
    /** Bumped by the bar's "Fuse Powers" button; each bump opens Fusion once. */
    fusionOpenRequest: number;
};

export const PowerLoopContext = createContext<PowerLoopContextValue | null>(null);

export function usePowerLoopContext() {
    return useContext(PowerLoopContext);
}

/** "STEP 1" over a Play section, in the accent as on iOS, carrying that step's scroll target. */
export function PowerLoopEyebrow({step, anchor, className = ""}: {step: number; anchor: string; className?: string}) {
    return (
        <p
            id={anchor}
            className={`scroll-mt-24 px-5 pb-2 pt-4 text-[10px] font-black uppercase tracking-[0.12em] ${className}`}
            style={{color: "rgb(var(--c-primary-text-400))"}}
        >
            {stepEyebrow(step)}
        </p>
    );
}
