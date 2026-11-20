import type {SdRhythmState} from "@/lib/ark-sd-rhythm";

/**
 * The rhythm's state dot and tones, apart from the waveform (`sd-rhythm-compare.tsx`), so the Ark card's line can
 * show the dot while the waveform loads only when its panel opens (the page's static JavaScript budget,
 * `ark-page-weight.test.ts`).
 */
export const RHYTHM_TONE: Record<SdRhythmState, string> = {in: "#8fd694", slightly: "#f2c14e", out: "#ef6f5c"};

export function RhythmDot({state, className = ""}: {state: SdRhythmState; className?: string}) {
    return <span aria-hidden="true" className={`inline-block h-2 w-2 shrink-0 rounded-full ${className}`} style={{background: RHYTHM_TONE[state], boxShadow: `0 0 0 2px ${RHYTHM_TONE[state]}33`}} />;
}
