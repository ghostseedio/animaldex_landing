"use client";

import {createContext, useContext} from "react";
import {POWER_LOOP_COPY, type PowerLoopStepId, stepEyebrow} from "@/lib/power-loop";

/** Scroll targets for the three Power Loop steps, one per section on the Play tab. */
export const POWER_LOOP_ANCHORS: Record<PowerLoopStepId, string> = {
    train: "power-loop-train",
    prove: "power-loop-prove",
    battleFuse: "power-loop-battle-fuse"
};

const STEP_TITLES: Record<PowerLoopStepId, {number: number; title: string}> = {
    train: {number: 1, title: POWER_LOOP_COPY.train},
    prove: {number: 2, title: POWER_LOOP_COPY.proveIt},
    battleFuse: {number: 3, title: POWER_LOOP_COPY.battleAndFuse}
};

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

/** "STEP 1 · TRAIN" over a Play section, in the accent as on iOS, carrying that step's scroll target. */
export function PowerLoopEyebrow({step, className = ""}: {step: PowerLoopStepId; className?: string}) {
    const {number, title} = STEP_TITLES[step];
    return (
        <p
            id={POWER_LOOP_ANCHORS[step]}
            className={`scroll-mt-24 px-5 pb-2 pt-4 text-[10px] font-black uppercase tracking-[0.12em] ${className}`}
            style={{color: "rgb(var(--c-primary-text-400))"}}
        >
            {stepEyebrow(number, title)}
        </p>
    );
}
