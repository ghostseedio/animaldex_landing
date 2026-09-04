import "server-only";

import {getSupabaseHeaders, getSupabaseServerReadKey, getSupabaseUrl} from "@/lib/supabase-http";

export type AnimalPowerEvidenceItem = {
    title: string;
    observation: string;
    biologicalFunction: string;
    interpretation: string;
};

export type AnimalPowerContinuum = {
    deficientExpression: string;
    balancedExpression: string;
    excessExpression: string;
};

export type AnimalPowerPractice = {
    title: string;
    instruction: string;
    animalConnection: string;
    timeframe: string | null;
};

export type EnhancedAnimalPowerProfile = {
    speciesProfileId: string;
    principleName: string;
    principleExpression: string | null;
    coreLesson: string | null;
    shortMotto: string | null;
    corePattern: string | null;
    biologicalBasis: string | null;
    applicationExample: string | null;
    behavioralEvidence: AnimalPowerEvidenceItem[];
    powerContinuum: AnimalPowerContinuum | null;
    embodimentPractices: AnimalPowerPractice[];
    reflectionQuestions: string[];
    relatedPowers: string[];
    availability: "enhanced" | "legacy";
};

type PowerRow = {
    species_profile_id: string;
    principle_name: string | null;
    principle_expression: string | null;
    core_lesson: string | null;
    short_motto: string | null;
    core_pattern: string | null;
    biological_basis: string | null;
    application_example: string | null;
    behavioral_evidence: unknown;
    power_continuum: unknown;
    embodiment_practices: unknown;
    reflection_questions: unknown;
    related_powers: unknown;
    power_profile_status: string | null;
    power_profile_enhanced?: boolean | null;
};

function text(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringList(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim());
}

function evidenceList(value: unknown): AnimalPowerEvidenceItem[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        const title = text(row.title);
        const observation = text(row.observation);
        if (!title || !observation) return [];
        return [{
            title,
            observation,
            biologicalFunction: text(row.biological_function ?? row.biologicalFunction) ?? "",
            interpretation: text(row.interpretation) ?? ""
        }];
    });
}

function continuum(value: unknown): AnimalPowerContinuum | null {
    if (!value || typeof value !== "object") return null;
    const row = value as Record<string, unknown>;
    const deficientExpression = text(row.deficient_expression ?? row.deficientExpression);
    const balancedExpression = text(row.balanced_expression ?? row.balancedExpression);
    const excessExpression = text(row.excess_expression ?? row.excessExpression);
    if (!deficientExpression || !balancedExpression || !excessExpression) return null;
    return {deficientExpression, balancedExpression, excessExpression};
}

function practices(value: unknown): AnimalPowerPractice[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        const title = text(row.title);
        const instruction = text(row.instruction);
        if (!title || !instruction) return [];
        return [{
            title,
            instruction,
            animalConnection: text(row.animal_connection ?? row.animalConnection) ?? "",
            timeframe: text(row.timeframe)
        }];
    });
}

function isEnhanced(profile: Omit<EnhancedAnimalPowerProfile, "availability">) {
    return Boolean(
        profile.corePattern
        && profile.behavioralEvidence.length > 0
        && profile.powerContinuum
        && profile.embodimentPractices.length > 0
    );
}

export async function getEnhancedAnimalPowerProfile(
    speciesProfileId: string | null | undefined
): Promise<EnhancedAnimalPowerProfile | null> {
    const profileId = speciesProfileId?.trim();
    const supabaseUrl = getSupabaseUrl();
    const readKey = getSupabaseServerReadKey();
    if (!profileId || !supabaseUrl || !readKey) return null;

    const searchParams = new URLSearchParams({
        select: [
            "species_profile_id",
            "principle_name",
            "principle_expression",
            "core_lesson",
            "short_motto",
            "core_pattern",
            "biological_basis",
            "application_example",
            "behavioral_evidence",
            "power_continuum",
            "embodiment_practices",
            "reflection_questions",
            "related_powers",
            "power_profile_status",
            "power_profile_enhanced"
        ].join(","),
        species_profile_id: `eq.${profileId}`,
        limit: "1"
    });

    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/species_behavior_principles?${searchParams.toString()}`, {
            headers: getSupabaseHeaders(readKey),
            next: {revalidate: 3600}
        });
        if (!response.ok) return null;
        const [row] = await response.json() as PowerRow[];
        const principleName = text(row?.principle_name);
        if (!row || !principleName) return null;

        const parsed = {
            speciesProfileId: row.species_profile_id,
            principleName,
            principleExpression: text(row.principle_expression),
            coreLesson: text(row.core_lesson),
            shortMotto: text(row.short_motto),
            corePattern: text(row.core_pattern),
            biologicalBasis: text(row.biological_basis),
            applicationExample: text(row.application_example),
            behavioralEvidence: evidenceList(row.behavioral_evidence),
            powerContinuum: continuum(row.power_continuum),
            embodimentPractices: practices(row.embodiment_practices),
            reflectionQuestions: stringList(row.reflection_questions),
            relatedPowers: stringList(row.related_powers)
        };

        return {
            ...parsed,
            availability: isEnhanced(parsed) || row.power_profile_status === "generated" || row.power_profile_status === "approved" || row.power_profile_enhanced === true
                ? "enhanced"
                : "legacy"
        };
    } catch {
        return null;
    }
}
