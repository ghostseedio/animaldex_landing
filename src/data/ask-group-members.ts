import "server-only";

/**
 * The animals in a group conversation: the reader's own cards, each one's
 * whole record, voice card, stats and nature, as the apps'
 * `handleAnimalGroupQuery` loads its members. Service role, server only.
 *
 * A card that is not the reader's makes the whole group refused; a species
 * AnimalDex holds no Power for is left out of the room rather than failing it.
 */

import {createSupabaseServiceClient} from "@/lib/supabase/server";
import {buildAskSpeciesGrounding} from "@/data/ask-grounding";
import {loadAskCompanion} from "@/data/ask-companion-voice";
import {sanitizeAskNickname} from "@/lib/ask-animaldex/companion";
import type {AskSpeciesGrounding} from "@/lib/ask-animaldex/grounding";
import type {AskGroupParticipant} from "@/lib/ask-animaldex/group-rules";
import {askAnimalNatureFor, type AskAnimalNature} from "@/lib/ask-animaldex/nature";
import {
    askPersonaDials,
    type AskPersonaStats,
    type AskSpeciesTaxonomy,
    type AskStatQuantiles
} from "@/lib/ask-animaldex/persona";

export type AskGroupMember = AskGroupParticipant & {
    /** The species' catalogue slug, which its icon art is filed under too. */
    slug: string;
    species: AskSpeciesGrounding;
    stats: AskPersonaStats | null;
    nature: AskAnimalNature;
};

export type AskGroupMembersResult =
    | {ok: true; members: AskGroupMember[]}
    | {ok: false; error: "capture_not_owned" | "database_error"};

type Row = Record<string, unknown>;

function str(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** The field guide in the record's own keys, as the nature layer reads it. */
function fieldGuideFor(species: AskSpeciesGrounding): Record<string, unknown> {
    return {
        species_spotlight: species.summary,
        signature_traits: species.identification,
        interesting_facts: species.interestingFacts,
        typical_habitat: species.habitat,
        sleep_pattern: species.sleepPattern,
        predators_summary: species.predators,
        lifespan_estimate: species.lifespan,
        diet_summary: species.diet
    };
}

export async function loadAskGroupMembers(params: {
    userId: string;
    captureIds: string[];
    quantiles: AskStatQuantiles | null;
}): Promise<AskGroupMembersResult> {
    const service = createSupabaseServiceClient();
    if (!service) return {ok: false, error: "database_error"};

    // Groups are made of the reader's own animals only.
    const [capturesRes, analysesRes] = await Promise.all([
        service.from("captures").select("id, user_id, title").in("id", params.captureIds),
        service.from("analysis_results").select("capture_id, species_profile_id").in("capture_id", params.captureIds)
    ]);
    if (capturesRes.error) return {ok: false, error: "database_error"};
    const captures = (capturesRes.data ?? []) as Row[];
    if (captures.length !== params.captureIds.length || captures.some((row) => row.user_id !== params.userId)) {
        return {ok: false, error: "capture_not_owned"};
    }
    const speciesOf = new Map<string, string>();
    for (const row of (analysesRes.data ?? []) as Row[]) {
        const captureId = str(row.capture_id);
        const speciesId = str(row.species_profile_id);
        if (captureId && speciesId && !speciesOf.has(captureId)) speciesOf.set(captureId, speciesId);
    }

    // One canonical hop, as the apps resolve a card's species, and the slug it is filed under.
    const rawIds = Array.from(new Set(speciesOf.values()));
    const profileRows = rawIds.length > 0
        ? ((await service.from("species_profiles").select("id, canonical_species_profile_id").in("id", rawIds)).data ?? []) as Row[]
        : [];
    const canonicalOf = new Map(profileRows.map((row) => {
        const canonical = str(row.canonical_species_profile_id);
        return [String(row.id), canonical && canonical !== row.id ? canonical : String(row.id)] as [string, string];
    }));
    const canonicalIds = Array.from(new Set(canonicalOf.values()));
    const [canonicalRes, taxonomyRes, voiceRes] = canonicalIds.length > 0
        ? await Promise.all([
            service.from("species_profiles").select("id, normalized_identity_key").in("id", canonicalIds),
            service.from("species_taxonomy").select("species_profile_id, class_name, order_name, family_name").in("species_profile_id", canonicalIds),
            service.from("species_companion_voice").select("species_profile_id, voice").in("species_profile_id", canonicalIds)
        ])
        : [{data: []}, {data: []}, {data: []}];
    const slugOf = new Map(((canonicalRes.data ?? []) as Row[]).flatMap((row) => {
        const key = str(row.normalized_identity_key);
        return key ? [[String(row.id), key.replace(/_/g, "-")] as [string, string]] : [];
    }));
    const taxonomyOf = new Map(((taxonomyRes.data ?? []) as Row[]).map((row) => [String(row.species_profile_id), row as AskSpeciesTaxonomy]));
    // The voice card's own nature wins over what the record implies.
    const cardNatureOf = new Map(((voiceRes.data ?? []) as Row[]).map((row) => {
        const voice = row.voice && typeof row.voice === "object" ? row.voice as Row : null;
        return [String(row.species_profile_id), voice?.nature ?? null] as [string, unknown];
    }));

    const groundings = new Map<string, Promise<AskSpeciesGrounding | null>>();
    const groundingFor = (slug: string) => {
        if (!groundings.has(slug)) groundings.set(slug, buildAskSpeciesGrounding(slug).catch(() => null));
        return groundings.get(slug) as Promise<AskSpeciesGrounding | null>;
    };

    const loaded = await Promise.all(params.captureIds.map(async (captureId): Promise<AskGroupMember | null> => {
        const raw = speciesOf.get(captureId);
        const speciesProfileId = raw ? canonicalOf.get(raw) ?? raw : null;
        const slug = speciesProfileId ? slugOf.get(speciesProfileId) : null;
        if (!speciesProfileId || !slug) return null;
        const species = await groundingFor(slug);
        if (!species?.power) return null;
        const companion = await loadAskCompanion(species);
        const capture = captures.find((row) => row.id === captureId);
        const stats = companion.stats;
        return {
            captureId,
            speciesProfileId: companion.speciesProfileId ?? speciesProfileId,
            animalName: species.name,
            nickname: sanitizeAskNickname(capture?.title),
            powerName: species.power.principleName,
            voice: companion.voice,
            slug,
            species,
            stats,
            nature: askAnimalNatureFor({
                animalName: species.name,
                taxonomy: taxonomyOf.get(speciesProfileId) ?? null,
                stats,
                fieldGuide: fieldGuideFor(species),
                intellect: askPersonaDials({stats, dynamics: null, voice: null, quantiles: params.quantiles}).intellect,
                card: cardNatureOf.get(speciesProfileId) ?? null
            })
        };
    }));
    return {ok: true, members: loaded.filter((member): member is AskGroupMember => member !== null)};
}
