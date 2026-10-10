import behavioursSnapshot from "@/data/published-animal-behaviours.json";
import trialsSnapshot from "@/data/published-animal-trials.json";

export type BehaviourFrequency = "LOW" | "MID" | "HIGH" | "UNKNOWN";

export type BehaviourSignature = {
    slug: string;
    name: string;
    archetype: string;
    frequency: string;
    modes: Array<{label: string | null; frequency: string}>;
    waveform: {pathD: string | null; viewBox: string; description: string | null} | null;
    closingLine: string | null;
};

export type AnimalTrialEntry = {
    slug: string;
    species: string;
    title: string;
    objective: string | null;
    instructions: string | null;
    animalRule: string | null;
    userBenefit: string | null;
    principleName: string | null;
    mechanismConnection: string;
    frequency: string;
    difficulty: number;
    estimatedMinutes: number | null;
    completionCount: number;
};

/**
 * Both pages read committed snapshots, never Supabase.
 *
 * `assertNoRemoteDuringSeoSsg` makes a remote read during the production build
 * a hard error, so these pages are static by construction. Refresh the data with
 * `scripts/refreshAnimalBehaviourSnapshots.mts`.
 */
export const behaviourSignatures = behavioursSnapshot.entries as BehaviourSignature[];
export const animalTrials = trialsSnapshot.entries as AnimalTrialEntry[];

export const BEHAVIOUR_FREQUENCIES: BehaviourFrequency[] = ["LOW", "MID", "HIGH"];

export const FREQUENCY_COPY: Record<BehaviourFrequency, {title: string; tempo: string; meaning: string}> = {
    LOW: {
        title: "Low frequency",
        tempo: "Slow, sustained, infrequent",
        meaning: "The animal commits rarely and holds the commitment for a long time. Energy goes into duration, mass or waiting rather than into repetition."
    },
    MID: {
        title: "Mid frequency",
        tempo: "Rhythmic, repeatable, paced",
        meaning: "A working rhythm the animal can keep up. Effort repeats at a steady rate, and the result comes from accumulation rather than from any single attempt."
    },
    HIGH: {
        title: "High frequency",
        tempo: "Fast, repeated, short-burst",
        meaning: "Many attempts, each one cheap. The animal accepts a low success rate per try because trying again costs almost nothing."
    },
    UNKNOWN: {
        title: "Unclassified",
        tempo: "Not yet modelled",
        meaning: "No frequency has been assigned to this species yet."
    }
};

export function frequencyOf(value: string): BehaviourFrequency {
    return value === "LOW" || value === "MID" || value === "HIGH" ? value : "UNKNOWN";
}

export function countByFrequency<T extends {frequency: string}>(entries: T[]) {
    return entries.reduce<Record<BehaviourFrequency, number>>((totals, entry) => {
        totals[frequencyOf(entry.frequency)] += 1;
        return totals;
    }, {LOW: 0, MID: 0, HIGH: 0, UNKNOWN: 0});
}
