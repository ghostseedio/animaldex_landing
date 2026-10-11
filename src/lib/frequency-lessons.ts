/**
 * An animal's frequency, read as a lesson: the tempo of its behaviour (how
 * often it commits effort and how long each commitment lasts) and what that
 * tempo asks of you. Used by the /animal-frequencies explainer and section.
 *
 * Each example's archetype and waveform come from the published frequency
 * snapshot (src/data/published-animal-behaviours.json), looked up by slug, so
 * the wave drawn is the species' real one. The crocodile's "seen in" lines are
 * its live `cross_domain_matrix` entries (the same ones the sign-in card uses).
 */

import type {SystemDynamicsDomain, SystemFrequency} from "@/lib/system-dynamics";

export type FrequencyLessonKey = "LOW" | "MID" | "HIGH" | "LOW_HIGH";

export type FrequencyLesson = {
    key: FrequencyLessonKey;
    /** Tab label. */
    label: string;
    sublabel: string;
    /** The frequencies the wave moves through, for its chips. */
    frequencies: SystemFrequency[];
    slug: string;
    title: string;
    lesson: string;
    seenIn?: Array<{domain: SystemDynamicsDomain; text: string}>;
};

export const FREQUENCY_LESSONS: FrequencyLesson[] = [
    {
        key: "LOW",
        label: "LOW",
        sublabel: "Low frequency",
        frequencies: ["LOW"],
        slug: "aldabra-giant-tortoise",
        title: "Commit rarely, hold it long.",
        lesson: "A low-frequency animal's lesson is patience and endurance: choose the moment, then stay with it. Measure it by how long you hold, not by how often you act."
    },
    {
        key: "MID",
        label: "MID",
        sublabel: "Mid frequency",
        frequencies: ["MID"],
        slug: "western-honey-bee",
        title: "Keep a rhythm you can sustain.",
        lesson: "A mid-frequency animal's lesson works by repetition: show up at a steady pace and let the results build. No single attempt has to be the big one."
    },
    {
        key: "HIGH",
        label: "HIGH",
        sublabel: "High frequency",
        frequencies: ["HIGH", "LOW"],
        slug: "bee-hummingbird",
        title: "Try fast, try often.",
        lesson: "A high-frequency animal's lesson rewards many cheap attempts: a miss costs little, so take the next try. Then rest hard, the way a hummingbird drops into torpor every night."
    },
    {
        key: "LOW_HIGH",
        label: "LOW → HIGH",
        sublabel: "Two speeds",
        frequencies: ["LOW", "HIGH"],
        slug: "mugger-crocodile",
        title: "Wait, then strike.",
        lesson: "A two-speed animal's lesson is timing: stay low and still while the moment builds, then go all out when it arrives.",
        seenIn: [
            {domain: "STARS", text: "A quiet magnetar, then a giant flare."},
            {domain: "FOOD_NUTRITION", text: "Low-and-slow smoking, then a final high-heat sear."},
            {domain: "SPORT_ATHLETICS", text: "The fullback holds the line, then sprints on the counter."}
        ]
    }
];
