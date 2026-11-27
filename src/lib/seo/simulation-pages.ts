import type {ArkRisk, ArkRiskKind, ArkSurvival} from "@/lib/ark-rankings";
import {arkIsVertebrate} from "@/lib/ark-rankings";
import {ANIMAL_SIMULATION_PATH, ANIMAL_SURVIVAL_PATH, ECOSYSTEM_SIMULATION_PATH} from "@/lib/seo/ark-pages";

/**
 * The Ark's search pages (SEO audits 2026-11-27, docs/seo/; `src/components/seo/simulation-page.tsx`): what each one
 * shows, pure so it can be tested without the server. /animal-survival was added after the "animal survival" audit.
 */

export type SimulationPageId = "animalSimulation" | "ecosystemSimulation" | "animalSurvival";

export type SimulationPageConfig = {
    path: string;
    /** The sections of `pages.<id>.sections`, in page order. */
    sections: readonly string[];
    /** Topics for the page's schema: what it is about, never a claim. */
    topics: readonly string[];
    /** The most numerous species aboard, linked to their pages. */
    topSpecies: boolean;
    /** The last 24 hours' births, arrivals, meals and deaths (the event log). */
    day: boolean;
    /** The week's survival from the survival ranking's own report: share alive, deaths by cause, the species closest to the end. */
    survival: boolean;
    /** The page the closing links offer beside the Ark. */
    other: string;
    /** Blog posts listed under `sections.strategies` (`posts.<key>` holds each label). */
    posts?: Readonly<Record<string, string>>;
};

export const SIMULATION_PAGES: Record<SimulationPageId, SimulationPageConfig> = {
    animalSimulation: {
        path: ANIMAL_SIMULATION_PATH,
        sections: ["what", "runs", "real", "watch", "honest"],
        topics: ["Animal simulation", "Animal simulator", "Wildlife simulation", "Animal behaviour", "Virtual world"],
        topSpecies: true,
        day: true,
        survival: false,
        other: ECOSYSTEM_SIMULATION_PATH
    },
    ecosystemSimulation: {
        path: ECOSYSTEM_SIMULATION_PATH,
        sections: ["food", "predators", "populations", "background", "controls", "honest"],
        topics: ["Ecosystem simulation", "Food web", "Predation", "Population dynamics", "Food chain"],
        topSpecies: false,
        day: true,
        survival: false,
        other: ANIMAL_SIMULATION_PATH
    },
    animalSurvival: {
        path: ANIMAL_SURVIVAL_PATH,
        sections: ["decides", "hunts", "age", "falls", "kinds", "strategies", "watch", "honest"],
        topics: ["Animal survival", "Survival rate", "Predation", "Lifespan", "Extinction", "Animal adaptation"],
        topSpecies: false,
        day: false,
        survival: true,
        other: ANIMAL_SIMULATION_PATH,
        posts: {
            rates: "/blog/animal-survival-rates-real-species",
            resilient: "/blog/what-is-the-most-resilient-animal",
            tigers: "/blog/how-tigers-survive-as-solo-apex-hunters",
            wolves: "/blog/how-wolves-hunt-survive-and-shape-ecosystems",
            orangutans: "/blog/how-orangutans-think-and-survive-in-the-canopy",
            cobras: "/blog/how-king-cobras-survive-and-hunt-other-snakes",
            eagles: "/blog/how-eagles-use-height-vision-and-timing",
            crocodiles: "/blog/how-crocodiles-dominate-the-water-edge"
        }
    }
};

export const SIMULATION_FAQ_COUNT = 6;

/** The page's questions and answers (`faq.q1`, `faq.a1`, …), skipping any pair a locale lacks. */
export function simulationFaq(read: (key: string) => string): Array<{question: string; answer: string}> {
    const out: Array<{question: string; answer: string}> = [];
    for (let i = 1; i <= SIMULATION_FAQ_COUNT; i++) {
        const question = read(`q${i}`).trim();
        const answer = read(`a${i}`).trim();
        if (question && answer) out.push({question, answer});
    }
    return out;
}

export type SurvivalSummary = {
    /** Alive or recovering, out of every animal in the Ark at some point in the window (0 to 1). */
    share: number;
    everThere: number;
    old: number;
    starved: number;
    eaten: number;
};

/** The week across every place: the share still alive (recovering counts, because it comes back) and deaths by cause. */
export function survivalSummary(survival: ArkSurvival | null): SurvivalSummary | null {
    if (!survival) return null;
    let alive = 0;
    let everThere = 0;
    for (const place of survival.places) {
        alive += place.alive + place.recovering;
        everThere += place.everThere;
    }
    if (!everThere) return null;
    const {old, starved, eaten} = survival.causes.falls;
    return {share: alive / everThere, everThere, old, starved, eaten};
}

/** The vertebrate species closest to the end, most at risk first: the ranking's insects would otherwise be all there is. */
export function survivalAtRisk(risk: Pick<ArkRisk, "kinds"> | null, limit = 6): ArkRiskKind[] {
    return risk ? risk.kinds.filter((kind) => arkIsVertebrate(kind.group)).slice(0, limit) : [];
}
