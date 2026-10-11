/**
 * The sign-in page's looping "spot → collect → learn" card, ported from iOS
 * `WelcomeIntroStage.swift` (~/AnimalDex, Oct 11 2026). One animal at a time:
 * brackets lock onto a silhouette, the shutter fires and the animal appears in
 * colour, its stats draw over it, then the card flips to the lesson it teaches.
 *
 * The lineup is iOS's, verbatim: dex numbers and stats are the live
 * `species_profiles` values, mottos the live Animal Power `short_motto`, and
 * the System Dynamics rows the live `species_system_dynamics` profile and
 * waveform. The voiceover clips are the iOS bundle's ElevenLabs files
 * (scripts/generate-welcome-voiceover.sh there); the cue seconds are measured
 * against those exact files, so regenerate both together or not at all.
 */

import type {SpeciesStats} from "@/lib/battle-tier";
import {type SpeciesSystemDynamics, type SystemDynamicsDomain, type SystemFrequency, decodeSpeciesSystemDynamics} from "@/lib/system-dynamics";

export type WelcomeSystemStory = {
    /** `species_system_dynamics.frequency_profile`, verbatim. */
    profileJSON: string;
    /** `species_system_dynamics.waveform`, verbatim. */
    waveformJSON: string;
    /** Three `cross_domain_matrix` entries, a different set of domains per card. */
    domains: Array<{domain: SystemDynamicsDomain; frequencies: SystemFrequency[]; text: string}>;
    /** When the voice reaches each domain, seconds from the clip's start. */
    cueSeconds: number[];
};

export type WelcomeTrialStory = {
    title: string;
    instruction: string;
    proofLabel: string;
    minutes: number;
    rewardCredits: number;
    /** What the proof is checked for: the Trial's `animal_rule`, as two ticks. */
    checks: string[];
    /** Voice cues: trial shown, record, check, earned. */
    cueSeconds: number[];
};

export type WelcomeIntroAnimal = {
    dexNumber: number;
    /** Basename under /images/welcome. */
    image: string;
    name: string;
    stats: SpeciesStats;
    /** The stats the lesson leans on. */
    keyStats: Array<keyof SpeciesStats>;
    power: string;
    motto: string;
    /** The motto in the reader's own life, reasoned from the key stats. */
    forYou: string;
    /** Basename under /audio/welcome. */
    voiceover: string;
    /** The lesson side shows the System Dynamics wave and where it turns up in human life. */
    system?: WelcomeSystemStory;
    /** The lesson side hands over to the Trial and its evidence flow. */
    trial?: WelcomeTrialStory;
};

const muggerCrocodile: WelcomeSystemStory = {
    profileJSON: `{"baseline_frequency": "LOW", "modes": [{"conceptual_weight": 75, "frequency": "LOW", "label": "Still • Hidden • Waiting", "role": "Long, motionless concealment at the water’s edge while targets draw close"}, {"conceptual_weight": 25, "frequency": "HIGH", "label": "Explosive • Closing • Clamp", "role": "Sudden burst from cover to close the last gap and seize prey"}], "system_behavior": "BIMODAL", "triggered_frequency": "HIGH"}`,
    waveformJSON: `{"description": "A long flat low-activity line for extended waiting, followed by one sharp peak for the ambush strike and a quick drop back toward lower activity.", "path_d": "M 0 40 L 60 40 Q 70 15 80 5 L 90 22 L 100 35", "view_box": "0 0 100 50"}`,
    domains: [
        {domain: "STARS", frequencies: ["LOW", "HIGH"], text: "A quiet magnetar, then a giant flare."},
        {domain: "FOOD_NUTRITION", frequencies: ["LOW", "HIGH"], text: "Low-and-slow smoking, then a final high-heat sear."},
        {domain: "SPORT_ATHLETICS", frequencies: ["LOW", "HIGH"], text: "The fullback holds the line, then sprints on the counter."}
    ],
    cueSeconds: [7.61, 11.39, 14.92]
};

const commonOctopus: WelcomeSystemStory = {
    profileJSON: `{"modes": [{"conceptual_weight": 45, "frequency": "LOW", "label": "Denning • Sheltered • Brooding", "role": "It rests in a den among rocks or rubble, often with a midden of shells outside, and a brooding female stays in her den guarding her eggs until she dies"}, {"conceptual_weight": 55, "frequency": "MID", "label": "Foraging • Camouflaging • Probing", "role": "It leaves the den to hunt crabs, molluscs and fish, changing colour and texture as it moves, and probing crevices with arms that can explore semi-independently"}], "system_behavior": "BIMODAL"}`,
    waveformJSON: `{"description": "Quiet den time broken by repeated foraging excursions.", "path_d": "M 0 40 L 10 41 L 20 40 L 28 28 L 36 24 L 44 27 L 52 40 L 62 41 L 70 30 L 78 25 L 86 28 L 94 40 L 100 41", "view_box": "0 0 100 50"}`,
    domains: [
        {domain: "ENGINEERING", frequencies: ["MID"], text: "Soft robot arms that sense and respond on their own."},
        {domain: "MUSIC", frequencies: ["MID"], text: "Free jazz: each player acts on local cues."},
        {domain: "ENTERTAINMENT", frequencies: ["MID"], text: "The quick-change artist, transformed in seconds."}
    ],
    cueSeconds: [12.78, 17.51, 19.57]
};

const whiteThroatedKingfisher: WelcomeSystemStory = {
    profileJSON: `{"modes": [{"conceptual_weight": 100, "frequency": "MID", "label": "Prey below the surface appearing displaced because light bends as it leaves the water • The bird judging the real position rather than the apparent one before committing to a dive • That correction applied from a perch at whatever angle the bird happens to be sitting at, so the offset differs on every attempt", "role": "Strikes at where a submerged fish actually is rather than where it appears to be, correcting for refraction at whatever angle it is looking from, which is a different calculation on every dive"}], "system_behavior": "SINGLE"}`,
    waveformJSON: `{"description": "A long still watching line with brief committed dives, because the bird waits motionless and then strikes.", "path_d": "M 0 30 L 12 30 L 22 29 L 30 30 L 38 29 L 44 21 L 49 29 L 60 30 L 72 30 L 80 29 L 86 22 L 91 30 L 100 30", "view_box": "0 0 100 50"}`,
    domains: [
        {domain: "NATURAL_FORCES", frequencies: ["MID"], text: "Light bending as it crosses into water."},
        {domain: "TRANSPORT", frequencies: ["MID"], text: "Steering corrected for a known drift."},
        {domain: "ARCHITECTURE", frequencies: ["MID"], text: "A building drawn for how it will be seen."}
    ],
    cueSeconds: [8.59, 11.27, 14.47]
};

const hawaiianCrowTrial: WelcomeTrialStory = {
    title: "The Skill Was Already There",
    instruction: "Try one thing you've decided you can't do. Smallest honest scale.",
    proofLabel: "Video",
    minutes: 2,
    rewardCredits: 3,
    checks: ["Never tried before", "Outcome said out loud"],
    cueSeconds: [8.22, 15.23, 17.69, 19.4]
};

export const WELCOME_INTRO_LINEUP: WelcomeIntroAnimal[] = [
    {
        dexNumber: 1933, image: "little-owl", name: "Little Owl",
        stats: {dominance: 31, speed: 50, size: 14, intelligence: 39, rarity: 19},
        keyStats: ["speed"],
        power: "Night Focus", motto: "Focus in the quiet.",
        forYou: "Fast, yet it waits for calm. Find your quiet hour and give it everything.",
        voiceover: "welcome_vo_little_owl"
    },
    {
        dexNumber: 2329, image: "mugger-crocodile", name: "Mugger Crocodile",
        stats: {dominance: 84, speed: 55, size: 88, intelligence: 42, rarity: 66},
        keyStats: ["dominance", "size"],
        power: "Bank Ambush", motto: "Wait where they must come.",
        forYou: "Powerful, yet it doesn't chase. Be where the chance has to come.",
        voiceover: "welcome_vo_mugger_crocodile",
        system: muggerCrocodile
    },
    {
        dexNumber: 2363, image: "common-octopus", name: "Common Octopus",
        stats: {dominance: 30, speed: 25, size: 20, intelligence: 45, rarity: 15},
        keyStats: ["intelligence"],
        power: "Flexible Intelligence", motto: "Switch the method.",
        forYou: "Its strength is its mind. Plan not working? Change the method, not the goal.",
        voiceover: "welcome_vo_common_octopus",
        system: commonOctopus
    },
    {
        dexNumber: 1655, image: "hawaiian-crow", name: "Hawaiian Crow",
        stats: {dominance: 42, speed: 50, size: 20, intelligence: 78, rarity: 98},
        keyStats: ["rarity", "intelligence"],
        power: "Comeback Mind", motto: "Teach the return.",
        forYou: "Almost lost from the wild, it comes back by learning. Setbacks aren't final.",
        voiceover: "welcome_vo_hawaiian_crow",
        trial: hawaiianCrowTrial
    },
    {
        dexNumber: 2218, image: "white-throated-kingfisher", name: "White-throated Kingfisher",
        stats: {dominance: 35, speed: 50, size: 20, intelligence: 36, rarity: 12},
        keyStats: ["speed"],
        power: "Precision Dive", motto: "Aim, then dive.",
        forYou: "Its speed only counts after the aim. Pick one target, then commit.",
        voiceover: "welcome_vo_kingfisher",
        system: whiteThroatedKingfisher
    },
    {
        dexNumber: 1999, image: "lar-gibbon", name: "Lar Gibbon",
        stats: {dominance: 54, speed: 58, size: 29, intelligence: 73, rarity: 62},
        keyStats: ["intelligence", "dominance"],
        power: "Brachiation", motto: "Swing with purpose.",
        forYou: "Smart enough to plan the swing, strong enough to let go. Leave what's behind you.",
        voiceover: "welcome_vo_lar_gibbon"
    }
];

export const WELCOME_INTRO_VOICEOVER = "welcome_vo_intro";

export const WELCOME_INTRO_MUTED_KEY = "animaldex.welcomeIntroMuted";

export type WelcomeIntroBeat = "spot" | "collect" | "learn";

export const WELCOME_INTRO_BEATS: Array<{id: WelcomeIntroBeat; title: string}> = [
    {id: "spot", title: "Spot"},
    {id: "collect", title: "Collect"},
    {id: "learn", title: "Learn"}
];

/** Same order, short titles and tints as the species page's stat radar (iOS AnimalRadarMetric). */
export const WELCOME_STAT_METRICS: Array<{key: keyof SpeciesStats; shortTitle: string; tint: string}> = [
    {key: "dominance", shortTitle: "DOM", tint: "rgba(239, 68, 68, 0.92)"},
    {key: "speed", shortTitle: "SPD", tint: "#A7F432"},
    {key: "size", shortTitle: "SIZE", tint: "#9454fa"},
    {key: "intelligence", shortTitle: "INT", tint: "rgba(34, 211, 238, 0.92)"},
    {key: "rarity", shortTitle: "RAR", tint: "rgba(251, 146, 60, 0.92)"}
];

/** The story's live rows decoded the same way the species page decodes them. */
export function welcomeSystemDynamics(story: WelcomeSystemStory): SpeciesSystemDynamics | null {
    try {
        return decodeSpeciesSystemDynamics({
            species_profile_id: "welcome-intro",
            archetype: {name: "Welcome"},
            frequency_profile: JSON.parse(story.profileJSON),
            waveform: JSON.parse(story.waveformJSON)
        });
    } catch {
        return null;
    }
}

/** The card's accessibility line, as iOS reads it: "<name>. <motto> <forYou>". */
export function welcomeCardLabel(animal: WelcomeIntroAnimal) {
    return `${animal.name}. ${animal.motto} ${animal.forYou}`;
}
