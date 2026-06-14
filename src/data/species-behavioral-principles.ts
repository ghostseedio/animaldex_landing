import {SpeciesEntry, speciesEntries} from "@/data/species";
import {SystemsIntelligenceEntry} from "@/data/content-schema";

export type BehavioralPrincipleProfile = {
    principle: string;
    principleSlug: string;
    motto: string;
    principleExpression?: string;
    coreLesson: string;
    biologicalBasis: string;
    bestFor: string[];
    relatedSpeciesSlugs: string[];
    source: "manual" | "systems_intelligence" | "inferred" | "fallback" | "catalog_db";
};

type CuratedBehavioralPrincipleProfile = Omit<BehavioralPrincipleProfile, "relatedSpeciesSlugs" | "source" | "principleSlug">;

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

const CURATED_PROFILES: Record<string, CuratedBehavioralPrincipleProfile> = {
    elephant: {
        principle: "Living Archive",
        principleExpression: "Remember what matters. Move with wisdom.",
        motto: "Remember what matters.",
        coreLesson: "Memory becomes wisdom when it protects the future.",
        biologicalBasis:
            "Elephants remember migration routes, water sources, social bonds, threats, and lost companions across long periods, turning experience into survival guidance for the herd.",
        bestFor: ["Long-Term Thinking", "Family", "Strategy", "Emotional Intelligence"]
    },
    dolphin: {
        principle: "Echo Social Intelligence",
        principleExpression: "Find your people. Share the signal.",
        motto: "Find your pod. Share the signal.",
        coreLesson: "Clear communication becomes power when the environment is noisy.",
        biologicalBasis:
            "Dolphins combine echolocation, whistles, social learning, and coordinated movement to navigate murky water, hunt together, and maintain group bonds across distance.",
        bestFor: ["Communication", "Leadership", "Collaboration", "Emotional Intelligence"]
    },
    octopus: {
        principle: "Distributed Nervous Intelligence",
        principleExpression: "Think with the whole body.",
        motto: "Think with the whole body.",
        coreLesson: "Flexible awareness beats rigid control when conditions change fast.",
        biologicalBasis:
            "Octopuses use a highly distributed nervous system, flexible arms, camouflage, problem-solving, and escape behavior to respond quickly without relying on one rigid command center.",
        bestFor: ["Creativity", "Adaptability", "Nervous System Awareness", "Uncertain Environments"]
    },
    snake: {
        principle: "Coiled Transformation",
        principleExpression: "Shed the old skin. Keep the life force.",
        motto: "Shed the old skin.",
        coreLesson: "Efficient power often comes from removing what is unnecessary and perfecting what remains.",
        biologicalBasis:
            "Snakes use limbless movement, forked-tongue chemosensing, flexible skulls, shedding, coiling, venom or constriction, and ground contact to symbolize transformation, instinct, and hidden force.",
        bestFor: ["Transformation", "Instinct", "Healing", "Hidden Power"]
    },
    fox: {
        principle: "Clever Adaptation",
        principleExpression: "Change route before the trap closes.",
        motto: "Change route early.",
        coreLesson: "Survival favors the one who reads the edge and adjusts early.",
        biologicalBasis:
            "Foxes use quiet movement, sharp hearing, opportunistic diet, denning behavior, and comfort at forest, field, and urban edges to survive through strategy rather than force.",
        bestFor: ["Strategy", "Adaptability", "Cunning", "Uncertain Environments"]
    },
    cat: {
        principle: "Threshold Independence",
        principleExpression: "Stay soft. Keep your claws.",
        motto: "Stay soft. Keep your claws.",
        coreLesson: "Independence works best when comfort and readiness exist together.",
        biologicalBasis:
            "Cats combine retractable claws, night-adapted eyes, flexible bodies, stalking behavior, grooming rituals, and home-threshold living to move between affection, solitude, play, and predation.",
        bestFor: ["Independence", "Boundaries", "Sensitivity", "Self-Trust"]
    },
    owl: {
        principle: "Silent Night Vision",
        principleExpression: "See what moves in the dark.",
        motto: "See in the dark.",
        coreLesson: "Wisdom begins where ordinary visibility ends.",
        biologicalBasis:
            "Owls combine forward-facing eyes, silent flight feathers, facial disks, night hearing, and patient perching to detect hidden movement with minimal noise.",
        bestFor: ["Wisdom", "Observation", "Intuition", "Night Work"]
    },
    raven: {
        principle: "Pattern Messenger",
        principleExpression: "Remember the pattern. Speak from the shadow.",
        motto: "Speak from the shadow.",
        coreLesson: "Intelligence becomes power when memory, timing, and communication meet.",
        biologicalBasis:
            "Ravens use problem-solving, social memory, vocal mimicry, caching, carrion tracking, and bold black presence to operate as intelligent scavengers and symbolic messengers.",
        bestFor: ["Intelligence", "Mystery", "Memory", "Communication"]
    },
    dragonfly: {
        principle: "Transformation Precision",
        principleExpression: "Change form. Strike clean.",
        motto: "Change form. Strike clean.",
        coreLesson: "Transformation becomes power when new vision creates new movement.",
        biologicalBasis:
            "Dragonflies begin life as aquatic nymphs, then emerge into agile aerial predators with independent wings and near-360-degree vision, symbolizing transformation plus precision.",
        bestFor: ["Transformation", "Focus", "Timing", "New Identity"]
    },
    rhino: {
        principle: "Sovereign Endurance",
        principleExpression: "Do not be moved. Keep applying pressure.",
        motto: "Do not be moved.",
        coreLesson: "True power is not always explosive; sometimes it is the refusal to stop until reality bends.",
        biologicalBasis:
            "Rhinos are massive herbivores with thick skin, few natural predators as adults, solitary habits, forward-facing horn force, and grounded movement that symbolize persistence, protection, wealth, and self-contained power.",
        bestFor: ["Endurance", "Protection", "Wealth", "Persistence"]
    },
    "white-rhinoceros": {
        principle: "Sovereign Endurance",
        principleExpression: "Do not be moved. Keep applying pressure.",
        motto: "Do not be moved.",
        coreLesson: "True power is not always explosive; sometimes it is the refusal to stop until reality bends.",
        biologicalBasis:
            "White rhinoceroses are large grazing herbivores with massive bodies, broad mouths, thick skin, horns, and few natural predators as adults, symbolizing grounded force, protection, wealth, and persistence.",
        bestFor: ["Endurance", "Protection", "Wealth", "Persistence"]
    },
    "black-rhinoceros": {
        principle: "Armored Direction",
        principleExpression: "Choose the path. Push through it.",
        motto: "Push through.",
        coreLesson: "Focused direction becomes power when the whole body commits to one point.",
        biologicalBasis:
            "Black rhinoceroses are browsers with hooked lips, thick skin, strong bodies, horns, solitary habits, and intense territorial behavior, symbolizing concentrated force, self-direction, protection, and persistence.",
        bestFor: ["Direction", "Protection", "Persistence", "Self-Command"]
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
    dolphin: ["elephant", "crow", "gorilla"],
    octopus: ["crow", "chameleon", "cuttlefish"],
    fox: ["crow", "cat", "coyote"],
    cat: ["fox", "lynx", "tiger"],
    owl: ["barn-owl", "snowy-owl", "great-horned-owl"],
    raven: ["crow", "magpie", "jackdaw"],
    snake: ["king-cobra", "python", "rattlesnake"],
    dragonfly: ["damselfly", "praying-mantis", "jumping-spider"],
    "barn-owl": ["snowy-owl", "great-horned-owl", "lynx"]
};

type BehavioralPrincipleIndexEntry = {
    principle: string;
    principleSlug: string;
    speciesCount: number;
    speciesSlugs: string[];
    sampleMotto: string;
};

const profileMapCache = new WeakMap<Record<string, SystemsIntelligenceEntry>, Map<string, BehavioralPrincipleProfile>>();
const principleIndexCache = new WeakMap<Record<string, SystemsIntelligenceEntry>, BehavioralPrincipleIndexEntry[]>();

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

function buildPrincipleBuckets(systemsMap: Record<string, SystemsIntelligenceEntry>) {
    const speciesSlugsByPrinciple = new Map<string, string[]>();

    for (const entry of speciesEntries) {
        const principle = resolvePrincipleForSpecies(entry, systemsMap);
        speciesSlugsByPrinciple.set(
            principle,
            [...(speciesSlugsByPrinciple.get(principle) ?? []), entry.slug]
        );
    }

    return {
        speciesSlugsByPrinciple
    };
}

function buildRelatedSpeciesSlugs(
    currentSlug: string,
    principle: string,
    speciesSlugsByPrinciple: Map<string, string[]>
) {
    return (speciesSlugsByPrinciple.get(principle) ?? [])
        .filter((slug) => slug !== currentSlug)
        .slice(0, 3);
}

function getProfileMap(systemsMap: Record<string, SystemsIntelligenceEntry>) {
    const cached = profileMapCache.get(systemsMap);

    if (cached) {
        return cached;
    }

    const {speciesSlugsByPrinciple} = buildPrincipleBuckets(systemsMap);
    const profileMap = new Map<string, BehavioralPrincipleProfile>();

    for (const speciesEntry of speciesEntries) {
        const systemsEntry = systemsMap[speciesEntry.slug];
        const curated = CURATED_PROFILES[speciesEntry.slug];
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
        const curatedRelated = CURATED_RELATED_SPECIES[speciesEntry.slug] ?? [];
        const inferredRelated = buildRelatedSpeciesSlugs(speciesEntry.slug, profile.principle, speciesSlugsByPrinciple);
        const relatedSpeciesSlugs = Array.from(new Set([...curatedRelated, ...inferredRelated])).slice(0, 4);

        profileMap.set(speciesEntry.slug, {
            ...profile,
            principleSlug: toPrincipleSlug(profile.principle),
            relatedSpeciesSlugs
        });
    }

    profileMapCache.set(systemsMap, profileMap);

    return profileMap;
}

export function getBehavioralPrincipleProfile(
    speciesSlug: string,
    systemsEntry: SystemsIntelligenceEntry | null | undefined,
    systemsMap: Record<string, SystemsIntelligenceEntry>
): BehavioralPrincipleProfile | null {
    return getProfileMap(systemsMap).get(speciesSlug) ?? null;
}

export function getBehavioralPrinciplesIndex(systemsMap: Record<string, SystemsIntelligenceEntry>) {
    const cached = principleIndexCache.get(systemsMap);

    if (cached) {
        return cached;
    }

    const grouped = new Map<string, BehavioralPrincipleIndexEntry>();

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

    const index = Array.from(grouped.values()).sort((a, b) => b.speciesCount - a.speciesCount);
    principleIndexCache.set(systemsMap, index);

    return index;
}
