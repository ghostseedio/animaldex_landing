import {ANIMAL_SIMULATION_PATH, ECOSYSTEM_SIMULATION_PATH} from "@/lib/seo/ark-pages";

/**
 * The two simulation search pages (SEO audit 2026-11-27; `src/components/seo/simulation-page.tsx`): what each one
 * shows, pure so it can be tested without the server.
 */

export type SimulationPageId = "animalSimulation" | "ecosystemSimulation";

export type SimulationPageConfig = {
    path: string;
    /** The sections of `pages.<id>.sections`, in page order. */
    sections: readonly string[];
    /** Topics for the page's schema: what it is about, never a claim. */
    topics: readonly string[];
    /** The most numerous species aboard, linked to their pages. */
    topSpecies: boolean;
};

export const SIMULATION_PAGES: Record<SimulationPageId, SimulationPageConfig> = {
    animalSimulation: {
        path: ANIMAL_SIMULATION_PATH,
        sections: ["what", "runs", "real", "watch", "honest"],
        topics: ["Animal simulation", "Animal simulator", "Wildlife simulation", "Animal behaviour", "Virtual world"],
        topSpecies: true
    },
    ecosystemSimulation: {
        path: ECOSYSTEM_SIMULATION_PATH,
        sections: ["food", "predators", "populations", "background", "controls", "honest"],
        topics: ["Ecosystem simulation", "Food web", "Predation", "Population dynamics", "Food chain"],
        topSpecies: false
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
