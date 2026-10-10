/**
 * Species-level System Dynamics, ported from the iOS source of truth
 * (`AnimalDex/Models/SpeciesSystemDynamics.swift` and `SystemVisualSignature.swift`).
 *
 * Conceptual AnimalDex mappings, never measured biology. This module is pure
 * model + resolver so both server components and client components can import
 * it; the Supabase read lives in `@/data/species-system-dynamics`.
 */

/** Highest schema version this client fully understands. */
export const SYSTEM_DYNAMICS_SUPPORTED_SCHEMA_VERSION = 1;

export type SystemFrequency = "LOW" | "MID" | "HIGH" | "UNKNOWN";

export type SystemFrequencyBehavior =
    | "SINGLE"
    | "BIMODAL"
    | "MULTIMODAL"
    | "ADAPTIVE"
    | "PHASE_CHANGE"
    | "UNKNOWN";

export type SystemVisualSignatureType =
    | "STEADY_LOW"
    | "BURST_RECOVERY"
    | "AMBUSH_PULSE"
    | "PHASE_WAVE"
    | "NETWORK_SYNC"
    | "ROTATING_LOAD"
    | "DISTRIBUTED_ADAPTIVE"
    | "OSCILLATING"
    | "MULTIMODAL"
    | "UNKNOWN";

export type SystemFrequencyMode = {
    frequency: SystemFrequency;
    /** Conceptual AnimalDex weight (0–100). Not a measured biological percentage. */
    weight: number | null;
    /** Short trait line, e.g. "Dispersed • Independent". */
    label: string | null;
    /** One-line description of what the mode does in the animal's biology. */
    role: string | null;
};

export type SystemFrequencyProfile = {
    behavior: SystemFrequencyBehavior;
    modes: SystemFrequencyMode[];
    baselineFrequency: SystemFrequency | null;
    triggeredFrequency: SystemFrequency | null;
    visualSignature: SystemVisualSignatureDescriptor | null;
};

export type SystemVisualSignatureDescriptor = {
    type: SystemVisualSignatureType;
    phases: Array<{name: string; frequency: SystemFrequency | null}>;
    accessibilityLabel: string | null;
};

export type FrequencyWaveformPoint = {x: number; y: number};

export type FrequencyWaveform = {
    viewBoxWidth: number;
    viewBoxHeight: number;
    points: FrequencyWaveformPoint[];
    pathD: string | null;
    accessibilityLabel: string | null;
};

export type CrossDomainEntry = {
    frequency: SystemFrequency | null;
    equivalent: string;
    reasoning: string;
};

export type CrossDomainMapping = {
    domain: string;
    entries: CrossDomainEntry[];
};

export type SystemFailureMode = {
    frequency: SystemFrequency | null;
    title: string;
    explanation: string;
};

export type SpeciesSystemDynamics = {
    speciesProfileId: string;
    schemaVersion: number;
    promptVersion: string | null;
    archetypeName: string;
    frequencyProfile: SystemFrequencyProfile;
    waveform: FrequencyWaveform | null;
    /** Authoritative prose: biology → operating pattern → frequency rationale. */
    signatureExplanation: string | null;
    crossDomainMatrix: CrossDomainMapping[];
    failureModes: SystemFailureMode[];
    /**
     * Canonical species-level principle, resolved from
     * `species_behavior_principles` for this same `species_profile_id`. Never a
     * capture-specific, fused or ranking-derived principle.
     */
    canonicalPrincipleName: string | null;
    canonicalPrincipleExpression: string | null;
};

// MARK: - Display vocabulary

export function frequencyCompactLabel(frequency: SystemFrequency) {
    switch (frequency) {
        case "LOW": return "LOW";
        case "MID": return "MID";
        case "HIGH": return "HIGH";
        default: return "—";
    }
}

export function frequencyDisplayTitle(frequency: SystemFrequency) {
    switch (frequency) {
        case "LOW": return "Low Frequency";
        case "MID": return "Mid Frequency";
        case "HIGH": return "High Frequency";
        default: return "Frequency";
    }
}

/** Colour identity from `SystemDynamicsStyle.frequencyColor`. */
export function frequencyColor(frequency: SystemFrequency) {
    switch (frequency) {
        case "LOW": return "#FF5A5A";
        case "MID": return "#F0C040";
        case "HIGH": return "#A7F432";
        default: return "#9AA0A6";
    }
}

export function behaviorDisplayTitle(behavior: SystemFrequencyBehavior) {
    switch (behavior) {
        case "SINGLE": return "Single-frequency system";
        case "BIMODAL": return "Bimodal system";
        case "MULTIMODAL": return "Multimodal system";
        case "ADAPTIVE": return "Adaptive system";
        case "PHASE_CHANGE": return "Phase-change system";
        default: return "System profile";
    }
}

/** Short tag for compact contexts ("PHASE CHANGE", "BIMODAL"). */
export function behaviorCompactTitle(behavior: SystemFrequencyBehavior) {
    switch (behavior) {
        case "SINGLE": return "Single frequency";
        case "BIMODAL": return "Bimodal";
        case "MULTIMODAL": return "Multimodal";
        case "ADAPTIVE": return "Adaptive";
        case "PHASE_CHANGE": return "Phase change";
        default: return "System";
    }
}

export function signatureShapeLabel(type: SystemVisualSignatureType) {
    switch (type) {
        case "STEADY_LOW": return "Steady reserve";
        case "BURST_RECOVERY": return "Burst & recovery";
        case "AMBUSH_PULSE": return "Ambush pulse";
        case "PHASE_WAVE": return "Phase change";
        case "NETWORK_SYNC": return "Coordinated network";
        case "ROTATING_LOAD": return "Rotating load";
        case "DISTRIBUTED_ADAPTIVE": return "Adaptive switching";
        case "OSCILLATING": return "Rapid cycling";
        case "MULTIMODAL": return "Two operating modes";
        default: return "System profile";
    }
}

/**
 * First trait of the label ("Dispersed • Independent" → "Dispersed"), used as
 * the mode's state name in transition indicators.
 */
export function modeStateName(mode: SystemFrequencyMode) {
    if (mode.label) {
        const first = mode.label.split("•")[0]?.trim() ?? "";
        if (first) return first;
    }
    const compact = frequencyCompactLabel(mode.frequency);
    return compact.charAt(0) + compact.slice(1).toLowerCase();
}

// MARK: - Derived card copy

/**
 * Species-specific biological implementation (HOW), shown subordinate to the
 * Principle. Presentation strips a leading "The " without rewriting data.
 */
export function mechanismLabel(dynamics: SpeciesSystemDynamics) {
    const name = dynamics.archetypeName.trim();
    if (name.length <= 4) return name;
    return name.slice(0, 4).toLowerCase() === "the " ? name.slice(4) : name;
}

/**
 * Headline identity: the AnimalDex Principle (WHAT). Falls back to the
 * mechanism label only when a species genuinely has no principle row.
 */
export function displayHeadline(dynamics: SpeciesSystemDynamics) {
    return dynamics.canonicalPrincipleName?.trim() || mechanismLabel(dynamics);
}

/** True when the mechanism should render as its own subordinate line. */
export function showsMechanismSeparately(dynamics: SpeciesSystemDynamics) {
    return displayHeadline(dynamics) !== mechanismLabel(dynamics);
}

/** Usable for Learn-tab summary rendering. */
export function isRenderable(dynamics: SpeciesSystemDynamics) {
    return dynamics.schemaVersion >= 1
        && dynamics.schemaVersion <= SYSTEM_DYNAMICS_SUPPORTED_SCHEMA_VERSION
        && dynamics.archetypeName.trim().length > 0
        && dynamics.frequencyProfile.modes.length > 0;
}

/** Target length of the first-visible explanation on mobile. */
const EXPLANATION_TARGET_CHARACTERS = 240;

export function sentenceComponents(text: string) {
    const sentences: string[] = [];
    let current = "";
    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        current += character;
        const next = index + 1 < text.length ? text[index + 1] : null;
        const isTerminator = character === "." || character === "!" || character === "?";
        const nextIsBoundary = next === null || /\s/.test(next);
        if (isTerminator && nextIsBoundary) {
            const trimmed = current.trim();
            if (trimmed) sentences.push(trimmed);
            current = "";
        }
    }
    const tail = current.trim();
    if (tail) sentences.push(tail);
    return sentences;
}

/**
 * Leading sentences of `text` up to roughly the target length, always at least
 * one sentence. Deterministic; never rewrites the prose.
 */
export function explanationSummary(text: string | null | undefined) {
    const trimmed = text?.trim();
    if (!trimmed) return null;
    const sentences = sentenceComponents(trimmed);
    if (sentences.length <= 1) return trimmed;

    let result = "";
    for (const sentence of sentences) {
        const candidate = result ? `${result} ${sentence}` : sentence;
        if (result && candidate.length > EXPLANATION_TARGET_CHARACTERS) break;
        result = candidate;
    }
    return result;
}

export function shortExplanation(dynamics: SpeciesSystemDynamics) {
    return explanationSummary(dynamics.signatureExplanation);
}

export function hasLongerExplanation(dynamics: SpeciesSystemDynamics) {
    const short = shortExplanation(dynamics);
    const full = dynamics.signatureExplanation?.trim();
    if (!short || !full) return false;
    return short.length < full.length;
}

/** Distinct frequencies for summary chips (labels live in the teaser line). */
export function summaryFrequencyModes(dynamics: SpeciesSystemDynamics): SystemFrequencyMode[] {
    const seen = new Set<SystemFrequency>();
    const unique: SystemFrequencyMode[] = [];
    for (const mode of dynamics.frequencyProfile.modes) {
        if (mode.frequency === "UNKNOWN" || seen.has(mode.frequency)) continue;
        seen.add(mode.frequency);
        unique.push({frequency: mode.frequency, weight: null, label: null, role: null});
    }
    return unique.length ? unique : dynamics.frequencyProfile.modes;
}

/** Compact Learn-card teaser from mode labels (not a lesson / principle). */
export function summaryModeLabelLine(dynamics: SpeciesSystemDynamics) {
    const labels = dynamics.frequencyProfile.modes
        .map((mode) => mode.label)
        .filter((label): label is string => Boolean(label));
    return labels.length ? labels.join(" • ") : null;
}

/**
 * One-line state relationship for the compact Learn card, e.g.
 * "Dispersed → Collective", "Armored · Explosive", or the single mode's trait line.
 */
export function summaryStateLine(dynamics: SpeciesSystemDynamics) {
    const signature = resolveVisualSignature(dynamics);
    if (signature.transition) {
        return `${signature.transition.sourceName} → ${signature.transition.destinationName}`;
    }
    const modes = dynamics.frequencyProfile.modes.filter((mode) => mode.frequency !== "UNKNOWN");
    if (modes.length >= 2) {
        const names = modes.map(modeStateName);
        return dynamics.frequencyProfile.behavior === "ADAPTIVE"
            ? `Switches between ${names.join(" · ").toLowerCase()}`
            : names.join(" · ");
    }
    return summaryModeLabelLine(dynamics);
}

// MARK: - Visual signature

export type SystemVisualPhaseRole = "baseline" | "transition" | "destination" | "mode";

export type SystemVisualPhase = {
    name: string;
    frequency: SystemFrequency | null;
    role: SystemVisualPhaseRole;
    weight?: number | null;
};

export type SystemStateTransition = {
    kind: "phaseChange" | "trigger";
    source: SystemFrequency;
    sourceName: string;
    destination: SystemFrequency;
    destinationName: string;
    triggerName: string | null;
};

export type SystemVisualSignature = {
    type: SystemVisualSignatureType;
    phases: SystemVisualPhase[];
    transition: SystemStateTransition | null;
    source: "declared" | "derived" | "fallback";
    /** Defining frequency for single-mode systems, or the most prominent mode otherwise. */
    primaryFrequency: SystemFrequency;
    accessibilityDescription: string;
};

/**
 * Word-stem hints read from the row's own mode labels / roles / archetype name.
 * Used only to pick between visually distinct grammars that the structured
 * fields alone cannot separate. Species are never named here.
 */
const VOCABULARY_STEMS = {
    trigger: ["trigger", "ambush"],
    coordination: ["coordinat", "network", "mesh", "sync", "hive", "colony", "swarm", "collective", "consensus"],
    rotation: ["rotat", "risk-sharing", "shield", "huddle", "relay", "burden", "turn-taking", "shift"],
    repetition: ["repetit", "repeated", "oscillat", "cycle", "cycling", "rhythm", "sampling", "reactive"]
} as const;

function vocabularyWords(sources: Array<string | null | undefined>) {
    const result = new Set<string>();
    for (const source of sources) {
        if (!source) continue;
        // Keep hyphenated compounds ("risk-sharing") as single tokens as well as their parts.
        for (const token of source.toLowerCase().split(/[^a-z-]+/)) {
            if (!token) continue;
            result.add(token);
            for (const part of token.split("-")) {
                if (part) result.add(part);
            }
        }
    }
    return result;
}

function containsAny(words: Set<string>, stems: readonly string[]) {
    let found = false;
    words.forEach((word) => {
        if (!found && stems.some((stem) => word.startsWith(stem))) found = true;
    });
    return found;
}

/**
 * Driving variable for a threshold system. iOS reads this from the analytical
 * visualization, which the web card does not render, so it stays null here.
 */
function thresholdName(): string | null {
    return null;
}

function resolveTransition(dynamics: SpeciesSystemDynamics): SystemStateTransition | null {
    const profile = dynamics.frequencyProfile;
    const modes = profile.modes.filter((mode) => mode.frequency !== "UNKNOWN");

    // 1. Explicit baseline/triggered fields.
    const {baselineFrequency: baseline, triggeredFrequency: triggered} = profile;
    if (baseline && triggered && baseline !== "UNKNOWN" && triggered !== "UNKNOWN" && baseline !== triggered) {
        const sourceMode = modes.find((mode) => mode.frequency === baseline);
        const destinationMode = modes.find((mode) => mode.frequency === triggered);
        const compact = (frequency: SystemFrequency) => {
            const label = frequencyCompactLabel(frequency);
            return label.charAt(0) + label.slice(1).toLowerCase();
        };
        return {
            kind: profile.behavior === "PHASE_CHANGE" ? "phaseChange" : "trigger",
            source: baseline,
            sourceName: sourceMode ? modeStateName(sourceMode) : compact(baseline),
            destination: triggered,
            destinationName: destinationMode ? modeStateName(destinationMode) : compact(triggered),
            triggerName: thresholdName()
        };
    }

    // 2. Phase change: first mode → last mode, in row order.
    if (profile.behavior === "PHASE_CHANGE" && modes.length >= 2) {
        const first = modes[0];
        const last = modes[modes.length - 1];
        if (first.frequency !== last.frequency) {
            return {
                kind: "phaseChange",
                source: first.frequency,
                sourceName: modeStateName(first),
                destination: last.frequency,
                destinationName: modeStateName(last),
                triggerName: thresholdName()
            };
        }
    }

    // 3. Bimodal with an explicitly triggered mode in its own vocabulary.
    if ((profile.behavior === "BIMODAL" || profile.behavior === "MULTIMODAL") && modes.length === 2) {
        const triggeredMode = modes.find((mode) =>
            containsAny(vocabularyWords([mode.label, mode.role]), VOCABULARY_STEMS.trigger));
        const sourceMode = triggeredMode
            ? modes.find((mode) => mode.frequency !== triggeredMode.frequency)
            : undefined;
        if (triggeredMode && sourceMode) {
            return {
                kind: "trigger",
                source: sourceMode.frequency,
                sourceName: modeStateName(sourceMode),
                destination: triggeredMode.frequency,
                destinationName: modeStateName(triggeredMode),
                triggerName: null
            };
        }
    }

    return null;
}

/** True when the waveform repeats — a cycling system rather than one burst. */
function waveformIsRepeating(waveform: FrequencyWaveform | null): boolean | null {
    if (!waveform || waveform.points.length < 6) return null;
    const values = waveform.points.map((point) => point.y);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max - min < 1e-6) return false;
    const midpoint = (min + max) / 2;
    // Count rising crossings of the midpoint: two or more means it repeats.
    let crossings = 0;
    for (let index = 1; index < values.length; index += 1) {
        if (values[index - 1] <= midpoint && values[index] > midpoint) crossings += 1;
    }
    return crossings >= 2;
}

function derivedType(
    dynamics: SpeciesSystemDynamics,
    modes: SystemFrequencyMode[],
    transition: SystemStateTransition | null
): SystemVisualSignatureType {
    const profile = dynamics.frequencyProfile;
    const words = vocabularyWords([
        dynamics.archetypeName,
        ...profile.modes.flatMap((mode) => [mode.label, mode.role])
    ]);

    switch (profile.behavior) {
        case "PHASE_CHANGE":
            return "PHASE_WAVE";
        case "ADAPTIVE":
            return "DISTRIBUTED_ADAPTIVE";
        case "SINGLE": {
            const defining = modes[0]?.frequency ?? profile.modes[0]?.frequency;
            if (!defining) return "UNKNOWN";
            if (defining === "LOW") return "STEADY_LOW";
            if (defining === "HIGH") {
                const repeating = waveformIsRepeating(dynamics.waveform);
                if (repeating !== null) return repeating ? "OSCILLATING" : "BURST_RECOVERY";
                return containsAny(words, VOCABULARY_STEMS.repetition) ? "OSCILLATING" : "BURST_RECOVERY";
            }
            if (defining === "MID") {
                if (containsAny(words, VOCABULARY_STEMS.rotation)) return "ROTATING_LOAD";
                if (containsAny(words, VOCABULARY_STEMS.coordination)) return "NETWORK_SYNC";
                return "OSCILLATING";
            }
            return "UNKNOWN";
        }
        case "BIMODAL":
        case "MULTIMODAL": {
            if (modes.length < 2) return modes.length === 0 ? "UNKNOWN" : "MULTIMODAL";
            if (transition && transition.kind === "trigger" && transition.source === "LOW") {
                return "AMBUSH_PULSE";
            }
            return "MULTIMODAL";
        }
        default:
            return "UNKNOWN";
    }
}

function derivedPhases(
    type: SystemVisualSignatureType,
    modes: SystemFrequencyMode[],
    transition: SystemStateTransition | null
): SystemVisualPhase[] {
    if (transition && (type === "PHASE_WAVE" || type === "AMBUSH_PULSE")) {
        const phases: SystemVisualPhase[] = [
            {name: transition.sourceName, frequency: transition.source, role: "baseline"},
            {
                name: transition.triggerName ?? (transition.kind === "phaseChange" ? "Threshold" : "Trigger"),
                frequency: null,
                role: "transition"
            },
            {name: transition.destinationName, frequency: transition.destination, role: "destination"}
        ];
        // The pulse returns to baseline; keep three semantic regions only.
        return phases.slice(0, 3);
    }
    return modes.map((mode) => ({
        name: modeStateName(mode),
        frequency: mode.frequency,
        role: "mode" as const,
        weight: mode.weight
    }));
}

function primaryFrequency(profile: SystemFrequencyProfile, modes: SystemFrequencyMode[]): SystemFrequency {
    const weighted = modes.reduce<SystemFrequencyMode | null>((best, mode) => {
        if (mode.weight == null) return best;
        if (!best || (best.weight ?? 0) < mode.weight) return mode;
        return best;
    }, null);
    if (weighted) return weighted.frequency;
    return modes[0]?.frequency ?? profile.modes[0]?.frequency ?? "UNKNOWN";
}

function accessibilityDescription(
    type: SystemVisualSignatureType,
    phases: SystemVisualPhase[],
    transition: SystemStateTransition | null,
    waveform: FrequencyWaveform | null
) {
    const parts: string[] = [`Frequency signature: ${signatureShapeLabel(type)}.`];

    if (transition) {
        const verb = transition.kind === "phaseChange" ? "changes into" : "briefly switches into";
        const trigger = transition.triggerName ? ` at the ${transition.triggerName.toLowerCase()} threshold` : "";
        parts.push(
            `${transition.sourceName} at ${frequencyDisplayTitle(transition.source).toLowerCase()} ${verb} `
            + `${transition.destinationName.toLowerCase()} at ${frequencyDisplayTitle(transition.destination).toLowerCase()}${trigger}.`
        );
    } else if (phases.length) {
        const names = phases
            .filter((phase) => phase.frequency)
            .map((phase) => `${phase.name} at ${frequencyDisplayTitle(phase.frequency as SystemFrequency).toLowerCase()}`);
        if (names.length) parts.push(`Modes: ${names.join(", ")}.`);
    }

    const dataLabel = waveform?.accessibilityLabel;
    if (dataLabel) parts.push(dataLabel.endsWith(".") ? dataLabel : `${dataLabel}.`);

    return parts.join(" ");
}

/** Resolved visual grammar (declared → derived → fallback). */
export function resolveVisualSignature(dynamics: SpeciesSystemDynamics): SystemVisualSignature {
    const profile = dynamics.frequencyProfile;
    const modes = profile.modes.filter((mode) => mode.frequency !== "UNKNOWN");
    const transition = resolveTransition(dynamics);
    const primary = primaryFrequency(profile, modes);

    const declared = profile.visualSignature;
    if (declared && declared.type !== "UNKNOWN") {
        const phases = declared.phases.length
            ? declared.phases.map((phase) => ({name: phase.name, frequency: phase.frequency, role: "mode" as const}))
            : derivedPhases(declared.type, modes, transition);
        return {
            type: declared.type,
            phases,
            transition,
            source: "declared",
            primaryFrequency: primary,
            accessibilityDescription: declared.accessibilityLabel
                ?? accessibilityDescription(declared.type, phases, transition, dynamics.waveform)
        };
    }

    const type = derivedType(dynamics, modes, transition);
    const phases = derivedPhases(type, modes, transition);
    return {
        type,
        phases,
        transition,
        source: type === "UNKNOWN" ? "fallback" : "derived",
        primaryFrequency: primary,
        accessibilityDescription: accessibilityDescription(type, phases, transition, dynamics.waveform)
    };
}

// MARK: - Cross-domain vocabulary

export type SystemDynamicsDomain =
    | "MONEY_FINANCE" | "BUSINESS" | "HUMAN_BEHAVIOR" | "PLANT_KINGDOM" | "FOOD_NUTRITION"
    | "SPORT_ATHLETICS" | "TECHNOLOGY" | "ENTERTAINMENT" | "ARCHITECTURE" | "TRANSPORT"
    | "STRATEGY" | "PEOPLE_HISTORY_POWER" | "PLACE_GEOGRAPHY" | "STARS" | "MUSIC"
    | "ART" | "ENGINEERING" | "NATURAL_FORCES" | "UNKNOWN";

/** Retired raw values kept so pre-normalization rows keep rendering. */
const DOMAIN_LEGACY_ALIASES: Record<string, SystemDynamicsDomain> = {
    CURRENCY_STYLE: "MONEY_FINANCE",
    GAMING: "ENTERTAINMENT",
    HISTORY_POWER: "PEOPLE_HISTORY_POWER",
    SPACE_STELLAR: "STARS"
};

const DOMAIN_TITLES: Record<SystemDynamicsDomain, string> = {
    MONEY_FINANCE: "Money & Finance",
    BUSINESS: "Business",
    HUMAN_BEHAVIOR: "Human Behaviour",
    PLANT_KINGDOM: "Plants",
    FOOD_NUTRITION: "Food",
    SPORT_ATHLETICS: "Sport",
    TECHNOLOGY: "Technology",
    ENTERTAINMENT: "Entertainment",
    ARCHITECTURE: "Architecture",
    TRANSPORT: "Transport",
    STRATEGY: "Strategy",
    PEOPLE_HISTORY_POWER: "People, History & Power",
    PLACE_GEOGRAPHY: "Places",
    STARS: "Stars",
    MUSIC: "Music",
    ART: "Art",
    ENGINEERING: "Engineering",
    NATURAL_FORCES: "Natural forces",
    UNKNOWN: "Other"
};

export function normalizeDomain(raw: string): SystemDynamicsDomain {
    const value = raw.trim().toUpperCase();
    if (value in DOMAIN_TITLES) return value as SystemDynamicsDomain;
    return DOMAIN_LEGACY_ALIASES[value] ?? "UNKNOWN";
}

export function domainDisplayTitle(domain: string) {
    return DOMAIN_TITLES[normalizeDomain(domain)];
}

/** Domain names as they read mid-sentence ("turns up in history, sport and business"). */
const DOMAIN_PHRASES: Record<SystemDynamicsDomain, string> = {
    MONEY_FINANCE: "money",
    BUSINESS: "business",
    HUMAN_BEHAVIOR: "human behaviour",
    PLANT_KINGDOM: "plants",
    FOOD_NUTRITION: "food",
    SPORT_ATHLETICS: "sport",
    TECHNOLOGY: "technology",
    ENTERTAINMENT: "entertainment",
    ARCHITECTURE: "architecture",
    TRANSPORT: "transport",
    STRATEGY: "strategy",
    PEOPLE_HISTORY_POWER: "history",
    PLACE_GEOGRAPHY: "places",
    STARS: "the stars",
    MUSIC: "music",
    ART: "art",
    ENGINEERING: "engineering",
    NATURAL_FORCES: "natural forces",
    UNKNOWN: ""
};

function listPhrase(items: string[]) {
    if (items.length <= 1) return items[0] ?? "";
    return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/**
 * One line for the summary card. Locked viewers get the Pro hook — the domain
 * matrix is what Pro unlocks, and a locked payload carries none of it.
 */
export function systemDynamicsIntro(dynamics: SpeciesSystemDynamics, animal: string) {
    const domains = orderedCrossDomainMappings(dynamics.crossDomainMatrix)
        .map((mapping) => DOMAIN_PHRASES[normalizeDomain(mapping.domain)])
        .filter(Boolean);
    if (!domains.length) {
        return `Want to see the ${animal}'s system in history, sport and business? Unlock it with Pro.`;
    }
    return `The ${animal}'s system across ${domains.length} areas of life, from ${listPhrase(domains.slice(0, 2))}.`;
}

/** Six high-value domains first; the rest on request. */
export const DOMAIN_PREFERRED_ORDER: SystemDynamicsDomain[] = [
    "MONEY_FINANCE",
    "BUSINESS",
    "HUMAN_BEHAVIOR",
    "TECHNOLOGY",
    "PEOPLE_HISTORY_POWER",
    "NATURAL_FORCES"
];

export const CROSS_DOMAIN_INITIAL_VISIBLE_COUNT = 6;

/**
 * Merges legacy-aliased duplicates onto one canonical domain, then orders
 * preferred domains first and the rest alphabetically — the ordering half of
 * iOS's `CrossDomainBrowserModel`.
 */
export function orderedCrossDomainMappings(mappings: CrossDomainMapping[]): CrossDomainMapping[] {
    const order: SystemDynamicsDomain[] = [];
    const entries = new Map<SystemDynamicsDomain, CrossDomainEntry[]>();

    for (const mapping of mappings) {
        if (!mapping.entries.length) continue;
        const domain = normalizeDomain(mapping.domain);
        const existing = entries.get(domain);
        if (!existing) {
            order.push(domain);
            entries.set(domain, [...mapping.entries]);
            continue;
        }
        const additions = mapping.entries.filter((entry) =>
            !existing.some((seen) => seen.equivalent === entry.equivalent && seen.frequency === entry.frequency));
        entries.set(domain, [...existing, ...additions]);
    }

    const merged: CrossDomainMapping[] = order.map((domain) => ({domain, entries: entries.get(domain) ?? []}));
    const preferred = new Set<string>(DOMAIN_PREFERRED_ORDER);
    const primary = DOMAIN_PREFERRED_ORDER
        .map((domain) => merged.find((mapping) => mapping.domain === domain))
        .filter((mapping): mapping is CrossDomainMapping => mapping !== undefined);
    const rest = merged
        .filter((mapping) => !preferred.has(mapping.domain))
        .sort((a, b) => domainDisplayTitle(a.domain).localeCompare(domainDisplayTitle(b.domain)));

    return [...primary, ...rest];
}

/**
 * Entries ordered source → destination when a mapping genuinely encodes both
 * sides of the system's transition; null otherwise (no fabricated arrows).
 */
export function crossDomainTransitionLadder(
    mapping: CrossDomainMapping,
    transition: SystemStateTransition | null
): CrossDomainEntry[] | null {
    if (!transition || mapping.entries.length !== 2) return null;
    const source = mapping.entries.find((entry) => entry.frequency === transition.source);
    const destination = mapping.entries.find((entry) => entry.frequency === transition.destination);
    return source && destination ? [source, destination] : null;
}

// MARK: - Row decoding

const FREQUENCIES: SystemFrequency[] = ["LOW", "MID", "HIGH"];
const BEHAVIORS: SystemFrequencyBehavior[] = ["SINGLE", "BIMODAL", "MULTIMODAL", "ADAPTIVE", "PHASE_CHANGE"];
const SIGNATURE_TYPES: SystemVisualSignatureType[] = [
    "STEADY_LOW", "BURST_RECOVERY", "AMBUSH_PULSE", "PHASE_WAVE", "NETWORK_SYNC",
    "ROTATING_LOAD", "DISTRIBUTED_ADAPTIVE", "OSCILLATING", "MULTIMODAL"
];

export function optionalText(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

function frequency(value: unknown): SystemFrequency {
    const raw = optionalText(value)?.toUpperCase();
    return raw && (FREQUENCIES as string[]).includes(raw) ? raw as SystemFrequency : "UNKNOWN";
}

/** Null-preserving variant: cross-domain entries and failure modes may omit it. */
function optionalFrequency(value: unknown): SystemFrequency | null {
    if (value == null) return null;
    const resolved = frequency(value);
    return resolved === "UNKNOWN" ? null : resolved;
}

function behavior(value: unknown): SystemFrequencyBehavior {
    const raw = optionalText(value)?.toUpperCase();
    return raw && (BEHAVIORS as string[]).includes(raw) ? raw as SystemFrequencyBehavior : "UNKNOWN";
}

/** Clamped to 0–100 and integer-rounded, matching the iOS decoder. */
function weight(value: unknown): number | null {
    const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (!Number.isFinite(numeric)) return null;
    return Math.min(100, Math.max(0, Math.round(numeric)));
}

function decodeMode(raw: any): SystemFrequencyMode {
    return {
        frequency: frequency(raw?.frequency),
        weight: weight(raw?.weight ?? raw?.conceptual_weight),
        label: optionalText(raw?.label),
        role: optionalText(raw?.role)
    };
}

function decodeVisualSignature(raw: any): SystemVisualSignatureDescriptor | null {
    const type = optionalText(raw?.type)?.toUpperCase();
    if (!type || !(SIGNATURE_TYPES as string[]).includes(type)) return null;
    const phases = Array.isArray(raw?.phases)
        ? raw.phases
            .map((phase: any) => ({
                name: optionalText(phase?.name) ?? optionalText(phase?.label) ?? "",
                frequency: optionalFrequency(phase?.frequency)
            }))
            .filter((phase: {name: string}) => Boolean(phase.name))
        : [];
    return {
        type: type as SystemVisualSignatureType,
        phases,
        accessibilityLabel: optionalText(raw?.accessibility_label)
    };
}

function decodeProfile(raw: any): SystemFrequencyProfile {
    return {
        behavior: behavior(raw?.behavior ?? raw?.system_behavior),
        modes: Array.isArray(raw?.modes) ? raw.modes.map(decodeMode) : [],
        baselineFrequency: optionalFrequency(raw?.baseline_frequency),
        triggeredFrequency: optionalFrequency(raw?.triggered_frequency),
        // Soft-decode: a malformed declaration must never hide the whole profile.
        visualSignature: decodeVisualSignature(raw?.visual_signature)
    };
}

function parseViewBox(raw: unknown) {
    const value = optionalText(raw);
    if (!value) return null;
    const parts = value.split(/\s+/).map(Number).filter(Number.isFinite);
    return parts.length >= 4 ? {width: parts[2], height: parts[3]} : null;
}

function decodeWaveform(raw: any): FrequencyWaveform | null {
    if (!raw || typeof raw !== "object") return null;
    const viewBox = parseViewBox(raw.view_box);
    const points = Array.isArray(raw.points)
        ? raw.points
            .map((point: any) => ({x: Number(point?.x), y: Number(point?.y)}))
            .filter((point: {x: number; y: number}) => Number.isFinite(point.x) && Number.isFinite(point.y))
        : [];
    const pathD = optionalText(raw.path_d);
    // Nothing to draw and nothing to describe is the same as no waveform.
    if (points.length < 2 && !pathD) return null;
    return {
        viewBoxWidth: Math.max(1, Number(raw.view_box_width) || viewBox?.width || 100),
        viewBoxHeight: Math.max(1, Number(raw.view_box_height) || viewBox?.height || 50),
        points,
        pathD,
        accessibilityLabel: optionalText(raw.accessibility_label) ?? optionalText(raw.description)
    };
}

function decodeCrossDomain(raw: any): CrossDomainMapping[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((mapping: any) => ({
            domain: optionalText(mapping?.domain) ?? "",
            entries: (Array.isArray(mapping?.entries) ? mapping.entries : [])
                .map((entry: any) => ({
                    frequency: optionalFrequency(entry?.frequency),
                    equivalent: optionalText(entry?.equivalent) ?? "",
                    reasoning: optionalText(entry?.reasoning) ?? ""
                }))
                .filter((entry: {equivalent: string}) => Boolean(entry.equivalent))
        }))
        .filter((mapping: CrossDomainMapping) => Boolean(mapping.domain) && mapping.entries.length > 0);
}

function decodeFailureModes(raw: any): SystemFailureMode[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((mode: any) => ({
            frequency: optionalFrequency(mode?.frequency),
            title: optionalText(mode?.title) ?? optionalText(mode?.name) ?? "",
            explanation: optionalText(mode?.explanation) ?? optionalText(mode?.description) ?? ""
        }))
        .filter((mode: SystemFailureMode) => Boolean(mode.title) && Boolean(mode.explanation));
}

export function decodeSpeciesSystemDynamics(row: any): SpeciesSystemDynamics | null {
    const speciesProfileId = optionalText(row?.species_profile_id);
    if (!speciesProfileId) return null;
    const archetypeName = optionalText(row?.archetype?.name);
    if (!archetypeName) return null;

    return {
        speciesProfileId,
        schemaVersion: Number(row?.schema_version) || 1,
        promptVersion: optionalText(row?.prompt_version),
        archetypeName,
        frequencyProfile: decodeProfile(row?.frequency_profile),
        waveform: decodeWaveform(row?.waveform),
        signatureExplanation: optionalText(row?.signature_explanation),
        crossDomainMatrix: decodeCrossDomain(row?.cross_domain_matrix),
        failureModes: decodeFailureModes(row?.failure_modes),
        canonicalPrincipleName: null,
        canonicalPrincipleExpression: null
    };
}
