import {SpeciesEntry, speciesEntries} from "@/data/species";
import {SystemsIntelligenceEntry} from "@/data/content-schema";

export type BehavioralPrincipleProfile = {
    principle: string;
    principleSlug: string;
    motto: string;
    coreLesson: string;
    biologicalBasis: string;
    bestFor: string[];
    relatedSpeciesSlugs: string[];
    source: "manual" | "systems_intelligence" | "inferred" | "fallback";
};

const PRINCIPLE_BEST_FOR_MAP: Record<string, string[]> = {
    Memory: ["Strategy", "Discipline", "Long-Term Thinking"],
    Observation: ["Focus", "Pattern Recognition", "Decision Quality"],
    Teamwork: ["Coordination", "Communication", "Execution"],
    Adaptability: ["Resilience", "Creativity", "Uncertain Environments"],
    Endurance: ["Consistency", "Pacing", "Deep Work"],
    Precision: ["Timing", "High-Stakes Decisions", "Craft"],
    Stealth: ["Patience", "Signal Control", "Preparation"],
    Communication: ["Leadership", "Collaboration", "Clarity"],
    Resilience: ["Recovery", "Stress Management", "Persistence"],
    Efficiency: ["Energy Management", "Prioritization", "Sustainable Output"]
};

const CURATED_PROFILES: Record<string, Omit<BehavioralPrincipleProfile, "relatedSpeciesSlugs" | "source" | "principleSlug">> = {
    elephant: {
        principle: "Memory",
        motto: "Remember routes. Reduce risk.",
        coreLesson: "The lessons you already learned become your map for future decisions.",
        biologicalBasis: "Elephants remember migration routes, water access points, and social relationships across years, then use that memory to reduce risk in changing environments.",
        bestFor: PRINCIPLE_BEST_FOR_MAP.Memory
    },
    "barn-owl": {
        principle: "Observation",
        motto: "Listen before you move.",
        coreLesson: "Quiet observation often reveals opportunities that noise hides.",
        biologicalBasis: "Barn owls use asymmetrical ears, a facial sound-disc, and near-silent flight to locate prey precisely in low-light conditions.",
        bestFor: PRINCIPLE_BEST_FOR_MAP.Observation
    },
    crow: {
        principle: "Adaptability",
        motto: "Experiment fast. Keep what works.",
        coreLesson: "Flexible thinking compounds when you keep learning from feedback.",
        biologicalBasis: "Crows combine memory, social learning, and tool use to solve new problems in rapidly changing environments.",
        bestFor: PRINCIPLE_BEST_FOR_MAP.Adaptability
    },
    dolphin: {
        principle: "Communication",
        motto: "Signal clearly in noisy systems.",
        coreLesson: "Shared signals improve coordination when conditions are noisy.",
        biologicalBasis: "Dolphins pair echolocation with social communication so groups can sense, coordinate, and hunt effectively in low-visibility water.",
        bestFor: PRINCIPLE_BEST_FOR_MAP.Communication
    },
    orangutan: {
        principle: "Memory",
        motto: "Learn slowly. Retain deeply.",
        coreLesson: "Slow learning can outperform fast reacting in complex environments.",
        biologicalBasis: "Orangutans rely on long learning windows, strong spatial memory, and deliberate movement to navigate changing canopy routes.",
        bestFor: PRINCIPLE_BEST_FOR_MAP.Memory
    },
    cheetah: {
        principle: "Precision",
        motto: "Commit only when setup is clean.",
        coreLesson: "Use full speed only when setup, timing, and odds are aligned.",
        biologicalBasis: "Cheetahs spend large energy on short accelerations, so successful hunts depend on careful setup and highly selective commitment.",
        bestFor: PRINCIPLE_BEST_FOR_MAP.Precision
    },
    "polar-bear": {
        principle: "Adaptability",
        motto: "Track the platform, not just output.",
        coreLesson: "Track platform changes early, because strategy fails when the environment shifts.",
        biologicalBasis: "Polar bears depend on sea-ice structure for hunting, making environmental tracking essential to survival performance.",
        bestFor: PRINCIPLE_BEST_FOR_MAP.Adaptability
    },
    octopus: {
        principle: "Adaptability",
        motto: "Adapt shape, strategy, and timing.",
        coreLesson: "Decentralized sensing and action can outperform rigid plans under pressure.",
        biologicalBasis: "Octopuses use distributed neural control, flexible body geometry, and adaptive camouflage to solve dynamic threats quickly.",
        bestFor: PRINCIPLE_BEST_FOR_MAP.Adaptability
    },
    "komodo-dragon": {
        principle: "Efficiency",
        motto: "Spend energy where leverage is highest.",
        coreLesson: "Conserve energy, then commit decisively when leverage is high.",
        biologicalBasis: "Komodo dragons combine patient positioning, chemical sensing, and high-impact engagement to minimize wasted effort.",
        bestFor: PRINCIPLE_BEST_FOR_MAP.Efficiency
    }
};

const CURATED_RELATED_SPECIES: Record<string, string[]> = {
    elephant: ["crow", "dolphin", "orangutan"],
    "barn-owl": ["snowy-owl", "great-horned-owl", "lynx"]
};

function normalizeSentence(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
        return "";
    }
    return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function toPrincipleSlug(principle: string) {
    return principle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function buildMotto(principle: string) {
    const defaults: Record<string, string> = {
        Memory: "Remember patterns. Move with intent.",
        Observation: "See clearly before acting.",
        Teamwork: "Coordinate roles. Compound outcomes.",
        Adaptability: "Adjust early. Stay effective.",
        Endurance: "Sustain effort. Win over time.",
        Precision: "Target what matters most.",
        Stealth: "Lower signal. Increase leverage.",
        Communication: "Share clean signals fast.",
        Resilience: "Recover quickly. Continue forward.",
        Efficiency: "Preserve energy for decisive moves."
    };
    return defaults[principle] ?? defaults.Efficiency;
}

function inferPrincipleFromSystemsEntry(entry: SystemsIntelligenceEntry): string | null {
    const source = `${entry.roleTitle} ${entry.systemsScript} ${entry.strategicInsight}`.toLowerCase();
    if (/(memory|remember|route|long-term)/.test(source)) return "Memory";
    if (/(quiet|observe|observation|signal|scan|acoustic)/.test(source)) return "Observation";
    if (/(team|pack|coordination|cooperative|shared)/.test(source)) return "Teamwork";
    if (/(adapt|flex|generalist|changing|volatile)/.test(source)) return "Adaptability";
    if (/(endurance|stamina|long-range|distance)/.test(source)) return "Endurance";
    if (/(stealth|ambush|silent|camouflage)/.test(source)) return "Stealth";
    if (/(precis|target|timing|accuracy)/.test(source)) return "Precision";
    if (/(communicat|signal|protocol|waggle|echolocation)/.test(source)) return "Communication";
    if (/(resilien|durable|recovery|stress)/.test(source)) return "Resilience";
    return null;
}

function inferPrincipleFromAnalysis(entry: SpeciesEntry): string | null {
    const source = [
        entry.analysis.summary,
        entry.analysis.category,
        entry.analysis.habitat,
        entry.analysis.nativeRange,
        entry.analysis.rarityReason,
        ...entry.analysis.identification,
        ...entry.premiumDetails.behaviorTraits
    ].join(" ").toLowerCase();
    if (/(memory|remember|route|migration|long-term|tradition)/.test(source)) return "Memory";
    if (/(observe|watch|scan|signal|detect|vision|hearing|acoustic)/.test(source)) return "Observation";
    if (/(pack|team|group|colony|cooperative|social)/.test(source)) return "Teamwork";
    if (/(adapt|flexib|generalist|changing|urban|variable)/.test(source)) return "Adaptability";
    if (/(endurance|stamina|long-distance|migrate|travel far)/.test(source)) return "Endurance";
    if (/(stealth|ambush|silent|camouflage|hidden)/.test(source)) return "Stealth";
    if (/(precise|accuracy|target|timing|sprint|strike)/.test(source)) return "Precision";
    if (/(communicat|calls|vocal|display|courtship)/.test(source)) return "Communication";
    if (/(resilien|recover|hardy|extreme|tolerant)/.test(source)) return "Resilience";
    return null;
}

function buildFallbackProfileFromSystems(systemsEntry: SystemsIntelligenceEntry): Omit<BehavioralPrincipleProfile, "relatedSpeciesSlugs" | "source" | "principleSlug"> {
    const principle = inferPrincipleFromSystemsEntry(systemsEntry) ?? "Efficiency";
    return {
        principle,
        motto: buildMotto(principle),
        coreLesson: normalizeSentence(systemsEntry.strategicInsight),
        biologicalBasis: normalizeSentence(`${systemsEntry.specializedHardware} ${systemsEntry.systemsScript}`),
        bestFor: PRINCIPLE_BEST_FOR_MAP[principle] ?? PRINCIPLE_BEST_FOR_MAP.Efficiency
    };
}

function buildFallbackProfileFromAnalysis(entry: SpeciesEntry): Omit<BehavioralPrincipleProfile, "relatedSpeciesSlugs" | "source" | "principleSlug"> {
    const principle = inferPrincipleFromAnalysis(entry) ?? "Efficiency";
    return {
        principle,
        motto: buildMotto(principle),
        coreLesson: normalizeSentence(`In ${entry.name}, ${principle.toLowerCase()} creates a repeatable survival edge when conditions are uncertain.`),
        biologicalBasis: normalizeSentence(`${entry.analysis.summary} ${entry.analysis.habitat} ${entry.analysis.rarityReason}`),
        bestFor: PRINCIPLE_BEST_FOR_MAP[principle] ?? PRINCIPLE_BEST_FOR_MAP.Efficiency
    };
}

function resolvePrincipleForSpecies(entry: SpeciesEntry, systemsMap: Record<string, SystemsIntelligenceEntry>) {
    const systemsEntry = systemsMap[entry.slug];
    if (CURATED_PROFILES[entry.slug]?.principle) {
        return CURATED_PROFILES[entry.slug].principle;
    }
    if (systemsEntry) {
        return inferPrincipleFromSystemsEntry(systemsEntry) ?? "Efficiency";
    }
    return inferPrincipleFromAnalysis(entry) ?? "Efficiency";
}

function buildRelatedSpeciesSlugs(currentSlug: string, principle: string, allEntries: SpeciesEntry[], systemsMap: Record<string, SystemsIntelligenceEntry>) {
    return allEntries
        .filter((entry) => entry.slug !== currentSlug)
        .map((entry) => ({
            slug: entry.slug,
            principle: resolvePrincipleForSpecies(entry, systemsMap)
        }))
        .filter((item) => item.principle === principle)
        .slice(0, 3)
        .map((item) => item.slug);
}

export function getBehavioralPrincipleProfile(
    speciesSlug: string,
    systemsEntry: SystemsIntelligenceEntry | null | undefined,
    systemsMap: Record<string, SystemsIntelligenceEntry>
): BehavioralPrincipleProfile | null {
    const speciesEntry = speciesEntries.find((item) => item.slug === speciesSlug);

    if (!speciesEntry) {
        return null;
    }

    const curated = CURATED_PROFILES[speciesSlug];
    const profile = curated
        ? {...curated, source: "manual" as const}
        : systemsEntry
            ? {
                ...buildFallbackProfileFromSystems(systemsEntry),
                source: "systems_intelligence" as const
            }
            : {
                ...buildFallbackProfileFromAnalysis(speciesEntry),
                source: inferPrincipleFromAnalysis(speciesEntry) ? "inferred" as const : "fallback" as const
            };
    const curatedRelated = CURATED_RELATED_SPECIES[speciesSlug] ?? [];
    const inferredRelated = buildRelatedSpeciesSlugs(speciesSlug, profile.principle, speciesEntries, systemsMap);
    const relatedSpeciesSlugs = Array.from(new Set([...curatedRelated, ...inferredRelated])).slice(0, 4);
    return {
        ...profile,
        principleSlug: toPrincipleSlug(profile.principle),
        relatedSpeciesSlugs
    };
}

export function getBehavioralPrinciplesIndex(systemsMap: Record<string, SystemsIntelligenceEntry>) {
    const grouped = new Map<string, {
        principle: string;
        principleSlug: string;
        speciesCount: number;
        speciesSlugs: string[];
        sampleMotto: string;
    }>();

    for (const entry of speciesEntries) {
        const profile = getBehavioralPrincipleProfile(entry.slug, systemsMap[entry.slug], systemsMap);
        if (!profile) {
            continue;
        }
        const current = grouped.get(profile.principleSlug) ?? {
            principle: profile.principle,
            principleSlug: profile.principleSlug,
            speciesCount: 0,
            speciesSlugs: [],
            sampleMotto: profile.motto
        };
        current.speciesCount += 1;
        current.speciesSlugs.push(entry.slug);
        grouped.set(profile.principleSlug, current);
    }

    return Array.from(grouped.values()).sort((a, b) => b.speciesCount - a.speciesCount);
}
