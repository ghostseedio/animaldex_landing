/**
 * The words of the System Dynamics ↔ Ark comparison (lane `ark-sd-align`): English, the keys the apps and the other
 * languages translate (`docs/ark/sd-rhythm-contract.md`). Plain and honest: the SD line is a shape, the Ark line the
 * schedule's; a cause is said as it is, and old age is never promised a fix.
 */

import type {ArkRhythmCause, SdCategory, SdFrequency, SdRhythmState} from "@/lib/ark-sd-rhythm";

export type ArkRhythmWords = {
    title: string;
    state: Record<SdRhythmState, string>;
    liveNote: string;
    typicalNote: string;
    chartLabel: string;
    dayAgo: string;
    now: string;
    dayStart: string;
    dayEnd: string;
    sdLine: string;
    arkLine: string;
    shapeNote: string;
    sharesTitle: string;
    sharesNote: string;
    kinds: Record<SdCategory, string>;
    tempoTitle: string;
    tempo: Record<SdFrequency, string>;
    boutNow: string;
    tempoMatches: string;
    tempoFast: string;
    tempoSlow: string;
    causesTitle: string;
    cause: Record<ArkRhythmCause, string>;
    stepFixes: string;
    stepLink: string;
    oldNoFix: string;
    noKnownCause: string;
    howItLives: string;
    seeLive: string;
    working: string;
};

export const ARK_RHYTHM_ENGLISH: ArkRhythmWords = {
    title: "Its rhythm",
    state: {in: "In rhythm", slightly: "Slightly off rhythm", out: "Out of rhythm"},
    liveNote: "Its last 24 hours in the Ark, worked out from its schedule, against its System Dynamics.",
    typicalNote: "One of its kind in the Ark, kept well, over a sample day, worked out from the shared schedule.",
    chartLabel: "Its System Dynamics waveform beside how busy it has been in the Ark",
    dayAgo: "24 h ago",
    now: "now",
    dayStart: "start of day",
    dayEnd: "24 h later",
    sdLine: "System Dynamics",
    arkLine: "In the Ark",
    shapeNote: "The System Dynamics line is its researched signature shape, not a clock; the Ark line is hour by hour.",
    sharesTitle: "Its modes: System Dynamics weight vs Ark time",
    sharesNote: "Top bar: the mode's weight in its System Dynamics. Bottom bar: the share of its waking time in the Ark.",
    kinds: {feed: "Feeding", still: "Still, resting", move: "On the move", social: "Social", dig: "Digging", care: "Grooming"},
    tempoTitle: "Tempo:",
    tempo: {LOW: "low frequency, long slow bouts", MID: "mid frequency, steady bouts", HIGH: "high frequency, quick switching"},
    boutNow: "its bouts lately {minutes} min,",
    tempoMatches: "in step",
    tempoFast: "quicker than its kind",
    tempoSlow: "slower than its kind",
    causesTitle: "Why",
    cause: {hungry: "It is hungry: searching more, resting less.", old: "It is getting old: slower, with longer rests.", unkept: "Not kept by steps lately: less of what its kind does, more idling."},
    stepFixes: "A step that works with it brings it back into rhythm.",
    stepLink: "Talk to it",
    oldNoFix: "Age can't be undone; a step won't change that.",
    noKnownCause: "Nothing in its state explains it: its day just went that way.",
    howItLives: "How it lives: System Dynamics",
    seeLive: "See it live in the Ark",
    working: "Working out its day…"
};
