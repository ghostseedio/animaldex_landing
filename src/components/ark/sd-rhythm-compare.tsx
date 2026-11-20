"use client";

import {useId} from "react";
import {intensityPath, SD_TEMPO, type SdCategory, type SdFrequency, type SdRhythmState} from "@/lib/ark-sd-rhythm";
import {ARK_RHYTHM_ENGLISH, type ArkRhythmWords} from "@/lib/ark-sd-rhythm-words";

/**
 * System Dynamics beside the Ark (lane `ark-sd-align`): the species' researched waveform (its signature shape, over
 * the SD row's own `0 0 100 50` box) and the Ark's line (how busy it looked, from the shared schedule), its SD modes'
 * kinds against the Ark's share of its waking time, and its tempo. One component for the Ark card (live: one animal,
 * its last 24 hours, a "now" marker at the right) and the species page's System Dynamics section (typical: one of its
 * kind on a sample day). Honest labels: the SD line is a shape, not a clock; the Ark line is the schedule's.
 */

import {RHYTHM_TONE, RhythmDot} from "@/components/ark/sd-rhythm-dot";

export {RHYTHM_TONE, RhythmDot};
const SD_STROKE = "#A7F432";
const ARK_STROKE = "#7cc4ff";

export type SdRhythmCompareProps = {
    /** The SD waveform's path over `0 0 100 50` (its row's `path_d`), when the page has it. */
    sdPath: string | null;
    /** The Ark's line, oldest first (0–1). */
    line: readonly number[];
    /** Live: one animal's last 24 hours to now. Typical: a sample day of one of its kind. */
    live: boolean;
    shares: ReadonlyArray<{category: SdCategory; sd: number; ark: number}>;
    tempo: SdFrequency;
    boutMinutes: number | null;
    state: SdRhythmState;
    score: number;
    words?: ArkRhythmWords;
};

export default function SdRhythmCompare({sdPath, line, live, shares, tempo, boutMinutes, state, score, words = ARK_RHYTHM_ENGLISH}: SdRhythmCompareProps) {
    const clip = useId();
    const arkPath = intensityPath(line);
    const [lo, hi] = SD_TEMPO[tempo].minutes;
    const tempoOk = boutMinutes === null ? null : boutMinutes >= lo && boutMinutes <= hi;
    return (
        <div className="flex flex-col gap-3" data-testid="sd-rhythm-compare" data-state={state}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{color: RHYTHM_TONE[state]}}>
                    <RhythmDot state={state} />
                    {words.state[state]}
                    <span className="font-semibold tabular-nums text-ink-300">· {Math.round(score * 100)}%</span>
                </span>
                <span className="text-[11.5px] text-ink-400">{live ? words.liveNote : words.typicalNote}</span>
            </div>

            <figure className="m-0">
                <svg viewBox="0 0 100 50" preserveAspectRatio="none" role="img" aria-label={words.chartLabel} className="h-[92px] w-full overflow-visible rounded-sm bg-white/[0.03] md:h-[110px]">
                    <defs>
                        <clipPath id={clip}><rect x="0" y="0" width="100" height="50" /></clipPath>
                    </defs>
                    {[12.5, 25, 37.5].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="white" strokeOpacity="0.06" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />)}
                    <g clipPath={`url(#${clip})`}>
                        {sdPath ? <path d={sdPath} fill="none" stroke={SD_STROKE} strokeOpacity="0.85" strokeWidth="1.6" strokeDasharray="3 2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /> : null}
                        {arkPath ? <path d={arkPath} fill="none" stroke={ARK_STROKE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /> : null}
                    </g>
                    {live ? <line x1="100" x2="100" y1="0" y2="50" stroke="white" strokeOpacity="0.55" strokeWidth="1" vectorEffect="non-scaling-stroke" /> : null}
                </svg>
                <figcaption className="mt-1 flex items-center justify-between text-[10.5px] text-ink-400">
                    <span>{live ? words.dayAgo : words.dayStart}</span>
                    <span className="flex flex-wrap items-center justify-center gap-x-3">
                        {sdPath ? <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="inline-block w-3 border-t-2 border-dashed" style={{borderColor: SD_STROKE}} />{words.sdLine}</span> : null}
                        <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="inline-block w-3 border-t-2" style={{borderColor: ARK_STROKE}} />{words.arkLine}</span>
                    </span>
                    <span>{live ? words.now : words.dayEnd}</span>
                </figcaption>
                {sdPath ? <p className="mt-1 text-[10.5px] leading-snug text-ink-500">{words.shapeNote}</p> : null}
            </figure>

            <div>
                <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-400">{words.sharesTitle}</p>
                <ul className="mt-1.5 flex flex-col gap-1.5">
                    {shares.map((s) => (
                        <li key={s.category} className="grid grid-cols-[4.8rem_minmax(0,1fr)] items-center gap-2 text-[11.5px]" data-category={s.category}>
                            <span className="truncate font-semibold text-ink-100">{words.kinds[s.category]}</span>
                            <span className="flex flex-col gap-[3px]">
                                <span className="flex items-center gap-1.5"><span className="h-[5px] rounded-full" style={{width: `${Math.max(s.sd * 100, 1.5)}%`, background: SD_STROKE}} /><span className="tabular-nums text-ink-300">{Math.round(s.sd * 100)}%</span></span>
                                <span className="flex items-center gap-1.5"><span className="h-[5px] rounded-full" style={{width: `${Math.max(s.ark * 100, 1.5)}%`, background: ARK_STROKE}} /><span className="tabular-nums text-ink-300">{Math.round(s.ark * 100)}%</span></span>
                            </span>
                        </li>
                    ))}
                </ul>
                <p className="mt-1 text-[10.5px] leading-snug text-ink-500">{words.sharesNote}</p>
            </div>

            <p className="text-[12px] leading-snug text-ink-200">
                <span className="font-semibold text-ink-100">{words.tempoTitle}</span> {words.tempo[tempo]}
                {boutMinutes !== null ? (
                    <>
                        {" · "}
                        {words.boutNow.replace("{minutes}", boutMinutes.toFixed(1))}
                        {" "}
                        <span style={{color: tempoOk ? RHYTHM_TONE.in : RHYTHM_TONE.slightly}}>{tempoOk ? words.tempoMatches : boutMinutes < lo ? words.tempoFast : words.tempoSlow}</span>
                    </>
                ) : null}
            </p>
        </div>
    );
}
