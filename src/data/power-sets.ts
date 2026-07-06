import "server-only";

import {cache} from "react";
import type {AppCapture} from "@/data/authenticated-app";
import {decorateCapture} from "@/data/authenticated-app";
import {getUserCaptures} from "@/data/user-captures";
import {getUnifiedSpeciesEntries} from "@/data/database-species-pages";
import {powerSetTierRewardBreakdown, type PowerSetRewardBreakdown} from "@/data/power-set-rewards";
import type {SpeciesEntry} from "@/data/species";
import {getSpeciesImageRoute} from "@/data/species-images";
import {getSupabaseHeaders, getSupabaseServerReadKey, getSupabaseUrl} from "@/lib/supabase-http";
import {
    catalogLookupToken,
    collectionIdentityKey
} from "@/lib/collection-discovery";
import {resolveCollectionIdentityToken, COLLECTION_IDENTITY_ALIASES} from "@/lib/collection-identity-aliases";
import {canonicalPowerKey, displayPowerLabel} from "@/lib/power-set-tags";
import {createSupabaseServerClient} from "@/lib/supabase/server";

const POWER_SET_SUBTITLE_OVERRIDES: Record<string, string> = {
    protection: "Collect distinct animals whose power helps you guard what matters.",
    courage: "Collect distinct animals that model bravery under pressure.",
    focus: "Collect distinct animals that sharpen attention and follow-through.",
    discipline: "Collect distinct animals that reinforce steady habits.",
    "self-regulation": "Collect distinct animals that help you stay calm and composed.",
    observation: "Collect distinct animals that train awareness and reading the room.",
    recovery: "Collect distinct animals that model rest, repair, and bounce-back.",
    teamwork: "Collect distinct animals that show coordination and trust.",
    adaptability: "Collect distinct animals that thrive when conditions shift.",
    resilience: "Collect distinct animals that keep going after setbacks.",
    patience: "Collect distinct animals that reward waiting for the right moment.",
    curiosity: "Collect distinct animals that model exploration and learning.",
    leadership: "Collect distinct animals that set direction for the group.",
    communication: "Collect distinct animals that signal clearly and connect.",
    creativity: "Collect distinct animals that solve problems in unexpected ways.",
    grounding: "Collect distinct animals that help you feel steady and present.",
    playfulness: "Collect distinct animals that keep joy and experimentation alive.",
    endurance: "Collect distinct animals that model stamina over the long haul.",
    independence: "Collect distinct animals that model self-reliance and agency.",
    empathy: "Collect distinct animals that tune into others and respond with care."
};

export type PowerSetTierName = "bronze" | "silver" | "gold";

export type PowerSetTierStatus = {
    tier: PowerSetTierName;
    targetCount: number;
    progressCount: number;
    isCompleted: boolean;
    remainingCount: number;
    completionReward: number | null;
    completionRewardBreakdown: PowerSetRewardBreakdown | null;
};

export type PowerSetMatchedItem = {
    label: string;
    captureId: string;
    animalName: string;
    imageSrc: string;
    href: string;
};

export type PowerSetCatalogSuggestion = {
    speciesProfileId: string;
    slug: string;
    name: string;
    animalDexNumber: number;
    imageSrc: string;
    href: string;
};

export type PowerSetAlbum = {
    key: string;
    title: string;
    subtitle: string;
    catalogLinkedCount: number;
    found: number;
    captureIds: string[];
    matchedItems: PowerSetMatchedItem[];
    tierStatuses: PowerSetTierStatus[];
    activeTier: PowerSetTierStatus | null;
    progressPercent: number;
    progressLabel: string;
    remainingCount: number;
    completionReward: number | null;
    completionRewardBreakdown: PowerSetRewardBreakdown | null;
    isCompleted: boolean;
    isGoldMastered: boolean;
    isNearComplete: boolean;
    curationReason: string | null;
    coverCaptureId: string | null;
};

type CatalogPowerSpecies = {
    speciesProfileId: string | null;
    normalizedIdentityKey: string;
    slug: string;
    name: string;
    identityKind: string | null;
    animalDexNumber: number;
    bestUseCases: string[];
};

type BestForTagScore = {
    tagKey: string;
    tagLabel: string;
    score: number;
};

type PowerSetCurationContext = {
    apexGapPowerKeys: string[];
    weakBestForPowerKeys: string[];
    starterPowerKeys: string[];
};

type CatalogRow = {
    species_profile_id: string;
    normalized_identity_key: string;
    identity_kind: string | null;
    animaldex_number: number;
    best_use_cases: unknown;
    display_name: string | null;
    scientific_name: string | null;
};

function clean(value: string | null | undefined) {
    const trimmed = value?.trim();
    return trimmed || null;
}

function parseBestUseCases(value: unknown) {
    if (!Array.isArray(value)) {
        return [] as string[];
    }

    return value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
}

export {canonicalPowerKey} from "@/lib/power-set-tags";

function powerSetSubtitle(key: string) {
    return POWER_SET_SUBTITLE_OVERRIDES[key]
        ?? `Collect distinct animals that model ${displayPowerLabel(key).toLowerCase()}.`;
}

function tierTargets(catalogLinkedCount: number) {
    if (catalogLinkedCount <= 0) {
        return {bronze: 3, silver: 7, gold: null as number | null};
    }

    let bronze = Math.max(1, Math.ceil(catalogLinkedCount * 0.15));
    let silver = Math.max(3, Math.ceil(catalogLinkedCount * 0.5));
    bronze = Math.min(bronze, catalogLinkedCount);
    silver = Math.min(Math.max(silver, bronze + 1), catalogLinkedCount);
    const gold = catalogLinkedCount > silver ? catalogLinkedCount : null;

    return {bronze, silver, gold};
}

function buildTierStatuses(
    progressCount: number,
    catalogLinkedCount: number,
    matchedCaptures: AppCapture[]
): PowerSetTierStatus[] {
    const targets = tierTargets(catalogLinkedCount);
    const tiers: Array<{tier: PowerSetTierName; target: number | null}> = [
        {tier: "bronze", target: targets.bronze},
        {tier: "silver", target: targets.silver},
        {tier: "gold", target: targets.gold}
    ];

    return tiers
        .filter((entry): entry is {tier: PowerSetTierName; target: number} => entry.target != null)
        .map(({tier, target}) => {
            const isCompleted = progressCount >= target;
            const tierCaptures = matchedCaptures.slice(0, target);
            const breakdown = isCompleted
                ? powerSetTierRewardBreakdown(tier, tierCaptures, target, catalogLinkedCount)
                : null;

            return {
                tier,
                targetCount: target,
                progressCount: Math.min(progressCount, target),
                isCompleted,
                remainingCount: Math.max(0, target - progressCount),
                completionReward: breakdown?.totalPoints ?? null,
                completionRewardBreakdown: breakdown
            };
        });
}

function matchedItemPresentation(captures: AppCapture[]) {
    const duplicateNames = new Set(
        Object.entries(
            captures.reduce<Record<string, number>>((counts, capture) => {
                const name = capture.animalName.trim().toLowerCase();
                counts[name] = (counts[name] ?? 0) + 1;
                return counts;
            }, {})
        )
            .filter(([, count]) => count > 1)
            .map(([name]) => name)
    );
    const usedLabels = new Set<string>();
    const items: PowerSetMatchedItem[] = [];

    for (const capture of captures) {
        const needsDisambiguation = duplicateNames.has(capture.animalName.trim().toLowerCase());
        let label = capture.animalName.trim();

        if (needsDisambiguation && capture.contextLabel) {
            label = `${label} · ${capture.contextLabel}`;
        }

        let suffix = 2;

        while (usedLabels.has(label)) {
            label = `${capture.animalName.trim()} ${suffix}`;
            suffix += 1;
        }

        usedLabels.add(label);
        items.push({
            label,
            captureId: capture.captureId,
            animalName: capture.animalName,
            imageSrc: capture.imageSrc,
            href: `/app/capture/${capture.captureId}`
        });
    }

    return items;
}

function ownedSpeciesProfileIds(
    captures: AppCapture[],
    speciesIndex: ReturnType<typeof buildSpeciesIndex>
) {
    const owned = new Set<string>();

    for (const capture of captures) {
        if (!isEligibleCapture(capture)) {
            continue;
        }

        if (capture.speciesProfileId) {
            owned.add(capture.speciesProfileId);
        }

        const species = lookupSpeciesForCapture(capture, speciesIndex);

        if (species?.speciesProfileId) {
            owned.add(species.speciesProfileId);
        }
    }

    return owned;
}

export function getCatalogSuggestionsForPowerSet(
    powerKey: string,
    captures: AppCapture[],
    species: CatalogPowerSpecies[],
    limit = 8
): PowerSetCatalogSuggestion[] {
    const normalized = canonicalPowerKey(powerKey);
    const ownedProfileIds = ownedSpeciesProfileIds(captures, buildSpeciesIndex(species));

    return species
        .filter((entry) => canonicalPowerKeysForSpecies(entry).includes(normalized))
        .filter((entry) => entry.speciesProfileId && !ownedProfileIds.has(entry.speciesProfileId))
        .sort((left, right) => {
            if (left.animalDexNumber !== right.animalDexNumber) {
                return left.animalDexNumber - right.animalDexNumber;
            }

            return left.name.localeCompare(right.name);
        })
        .slice(0, limit)
        .map((entry) => ({
            speciesProfileId: entry.speciesProfileId!,
            slug: entry.slug,
            name: entry.name,
            animalDexNumber: entry.animalDexNumber,
            imageSrc: getSpeciesImageRoute(entry.slug),
            href: `/animals/${entry.slug}`
        }));
}

function tierSubtitle(tier: PowerSetTierName, targetCount: number) {
    switch (tier) {
        case "bronze":
            return `Clear ${targetCount} species · 15% of this set's catalog animals.`;
        case "silver":
            return `Reach ${targetCount} species · 50% of the linked catalog.`;
        case "gold":
            return `Master all ${targetCount} catalog-linked species for this quality.`;
    }
}

export {tierSubtitle as powerSetTierSubtitle};

function activeTier(statuses: PowerSetTierStatus[]) {
    return statuses.find((status) => !status.isCompleted) ?? statuses.at(-1) ?? null;
}

function contextWeight(capture: AppCapture) {
    switch (capture.contextLabel) {
        case "Wild":
            return 3;
        case "Zoo":
            return 2;
        case "Domestic":
        case "Farm":
            return 1;
        default:
            return 2;
    }
}

function isEligibleCapture(capture: AppCapture) {
    if (capture.captureValidity) {
        return capture.captureValidity === "valid_live_capture" || capture.captureValidity === "unclear_capture";
    }

    const name = capture.animalName.trim().toLowerCase();

    if (!name || name === "unknown animal") {
        return false;
    }

    if (capture.confidence != null && capture.confidence < 0.4) {
        return false;
    }

    return true;
}

function shouldShowUncertaintyFallback(capture: AppCapture) {
    const name = capture.animalName.trim().toLowerCase();

    if (!name || name === "unknown animal") {
        return true;
    }

    if (capture.confidence != null && capture.confidence < 0.4) {
        return true;
    }

    return false;
}

function shouldExcludeFromPowerSetMatching(capture: AppCapture) {
    return !isEligibleCapture(capture) || shouldShowUncertaintyFallback(capture);
}

function buildCatalogProfileIndex(catalogRows: Map<string, CatalogRow>) {
    const profileByToken = new Map<string, string>();

    for (const row of Array.from(catalogRows.values())) {
        const profileId = row.species_profile_id.trim().toLowerCase();
        const identityKey = row.normalized_identity_key.trim().toLowerCase();

        profileByToken.set(profileId, profileId);
        profileByToken.set(identityKey, profileId);

        const displayToken = catalogLookupToken(row.display_name);
        if (displayToken) {
            profileByToken.set(resolveCollectionIdentityToken(displayToken), profileId);
        }

        const scientificToken = catalogLookupToken(row.scientific_name);
        if (scientificToken) {
            profileByToken.set(resolveCollectionIdentityToken(scientificToken), profileId);
        }
    }

    for (const [alias, canonicalKey] of Object.entries(COLLECTION_IDENTITY_ALIASES)) {
        const profileId = profileByToken.get(canonicalKey);

        if (profileId) {
            profileByToken.set(alias, profileId);
        }
    }

    return profileByToken;
}

function catalogProfileIdForCapture(capture: AppCapture, profileByToken: Map<string, string>) {
    const directProfileId = capture.speciesProfileId?.trim().toLowerCase();

    if (directProfileId) {
        return directProfileId;
    }

    for (const raw of [
        capture.speciesSlug,
        catalogLookupToken(capture.speciesSlug),
        catalogLookupToken(capture.scientificName),
        catalogLookupToken(capture.animalName)
    ]) {
        const token = catalogLookupToken(raw) ?? raw?.trim().toLowerCase().replace(/-/g, "_");

        if (!token) {
            continue;
        }

        const resolved = resolveCollectionIdentityToken(token);
        const profileId = profileByToken.get(resolved) ?? profileByToken.get(token);

        if (profileId) {
            return profileId;
        }
    }

    return null;
}

/** Matches iOS PowerSetMatcher.speciesIdentityKey, with catalog profile dedupe. */
function speciesIdentityKey(capture: AppCapture, profileByToken: Map<string, string>) {
    const catalogProfileId = catalogProfileIdForCapture(capture, profileByToken);

    if (catalogProfileId) {
        return `spid:${catalogProfileId}`;
    }

    const collectionKey = collectionIdentityKey(capture);

    if (collectionKey) {
        return collectionKey;
    }

    const profileId = capture.speciesProfileId?.trim().toLowerCase();

    if (profileId) {
        return `spid:${profileId}`;
    }

    const name = capture.animalName.trim().toLowerCase();

    if (name && name !== "unknown animal") {
        return `name:${name}`;
    }

    return `capture:${capture.captureId}`;
}

function canonicalPowerKeysForSpecies(species: CatalogPowerSpecies): string[] {
    const keys: string[] = [];
    const seen = new Set<string>();

    for (const useCase of species.bestUseCases) {
        const key = canonicalPowerKey(useCase);

        if (key && !seen.has(key)) {
            seen.add(key);
            keys.push(key);
        }
    }

    return keys;
}

function buildSpeciesIndex(species: CatalogPowerSpecies[]) {
    const byIdentity = new Map<string, CatalogPowerSpecies>();
    const bySlug = new Map<string, CatalogPowerSpecies>();
    const byProfileId = new Map<string, CatalogPowerSpecies>();
    const byName = new Map<string, CatalogPowerSpecies>();

    for (const entry of species) {
        byIdentity.set(entry.normalizedIdentityKey.toLowerCase(), entry);
        bySlug.set(entry.slug, entry);

        if (entry.speciesProfileId) {
            byProfileId.set(entry.speciesProfileId, entry);
        }

        byName.set(entry.name.trim().toLowerCase(), entry);
    }

    return {byIdentity, bySlug, byProfileId, byName, all: species};
}

function resolveCatalogSpecies(
    entry: SpeciesEntry,
    catalogRows: Map<string, CatalogRow>
): CatalogPowerSpecies | null {
    const animalDexNumber = entry.databaseSource?.animalDexNumber;

    if (typeof animalDexNumber !== "number" || animalDexNumber < 1) {
        return null;
    }

    const catalogRow = entry.speciesProfileId
        ? catalogRows.get(entry.speciesProfileId)
        : entry.normalizedIdentityKey
            ? catalogRows.get(entry.normalizedIdentityKey.toLowerCase())
            : undefined;
    const identityKind = clean(catalogRow?.identity_kind)?.toLowerCase() ?? null;

    if (identityKind === "breed") {
        return null;
    }

    const bestUseCases = parseBestUseCases(catalogRow?.best_use_cases);

    if (bestUseCases.length === 0) {
        return null;
    }

    return {
        speciesProfileId: entry.speciesProfileId ?? catalogRow?.species_profile_id ?? null,
        normalizedIdentityKey: entry.normalizedIdentityKey ?? entry.slug.replace(/-/g, "_"),
        slug: entry.slug,
        name: entry.name,
        identityKind,
        animalDexNumber,
        bestUseCases
    };
}

async function fetchCatalogRows() {
    const supabaseUrl = getSupabaseUrl();
    const key = getSupabaseServerReadKey();

    if (!supabaseUrl || !key) {
        return new Map<string, CatalogRow>();
    }

    const rows: CatalogRow[] = [];
    const pageSize = 250;

    for (let offset = 0; ; offset += pageSize) {
        const params = new URLSearchParams({
            select: "species_profile_id,normalized_identity_key,identity_kind,animaldex_number,best_use_cases,display_name,scientific_name",
            animaldex_number: "not.is.null",
            order: "animaldex_number.asc",
            limit: String(pageSize),
            offset: String(offset)
        });
        const response = await fetch(`${supabaseUrl}/rest/v1/species_catalog_v1?${params}`, {
            headers: getSupabaseHeaders(key),
            cache: "no-store"
        });

        if (!response.ok) {
            break;
        }

        const batch = await response.json() as CatalogRow[];
        rows.push(...batch);

        if (batch.length < pageSize) {
            break;
        }
    }

    const map = new Map<string, CatalogRow>();

    for (const row of rows) {
        map.set(row.species_profile_id, row);
        map.set(row.normalized_identity_key.toLowerCase(), row);
    }

    return map;
}

function catalogRowToPowerSpecies(row: CatalogRow): CatalogPowerSpecies | null {
    if (!row.species_profile_id) {
        return null;
    }

    if (typeof row.animaldex_number !== "number" || row.animaldex_number < 1) {
        return null;
    }

    if (clean(row.identity_kind)?.toLowerCase() === "breed") {
        return null;
    }

    const bestUseCases = parseBestUseCases(row.best_use_cases);

    if (bestUseCases.length === 0) {
        return null;
    }

    const slug = row.normalized_identity_key.replace(/_/g, "-");

    return {
        speciesProfileId: row.species_profile_id,
        normalizedIdentityKey: row.normalized_identity_key,
        slug,
        name: clean(row.display_name) ?? displayPowerLabel(slug),
        identityKind: clean(row.identity_kind),
        animalDexNumber: row.animaldex_number,
        bestUseCases
    };
}

function mergeCatalogPowerSpecies(unifiedEntries: Awaited<ReturnType<typeof getUnifiedSpeciesEntries>>, catalogRows: Map<string, CatalogRow>) {
    const merged = new Map<string, CatalogPowerSpecies>();

    for (const entry of unifiedEntries) {
        const resolved = resolveCatalogSpecies(entry, catalogRows);

        if (resolved?.speciesProfileId) {
            merged.set(resolved.speciesProfileId, resolved);
        }
    }

    for (const row of Array.from(catalogRows.values())) {
        if (!row.species_profile_id || merged.has(row.species_profile_id)) {
            continue;
        }

        const supplemental = catalogRowToPowerSpecies(row);

        if (supplemental) {
            merged.set(row.species_profile_id, supplemental);
        }
    }

    return Array.from(merged.values());
}

const getCatalogPowerContext = cache(async function getCatalogPowerContext() {
    const [unifiedEntries, catalogRows] = await Promise.all([
        getUnifiedSpeciesEntries(),
        fetchCatalogRows()
    ]);

    return {
        catalogRows,
        species: mergeCatalogPowerSpecies(unifiedEntries, catalogRows)
    };
});

const buildCatalogPowerSpecies = cache(async function buildCatalogPowerSpecies() {
    const context = await getCatalogPowerContext();
    return context.species;
});

function powerLinkedCounts(species: CatalogPowerSpecies[]) {
    const counts = new Map<string, number>();

    for (const entry of species) {
        for (const key of canonicalPowerKeysForSpecies(entry)) {
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
    }

    return counts;
}

function discoverPowerKeys(
    catalogCounts: Map<string, number>,
    captures: AppCapture[],
    catalogRows: Map<string, CatalogRow>
) {
    const keys = new Set<string>();

    catalogCounts.forEach((count, key) => {
        if (count > 0) {
            keys.add(key);
        }
    });

    for (const capture of captures) {
        if (shouldExcludeFromPowerSetMatching(capture)) {
            continue;
        }

        for (const key of canonicalPowerKeysForCapture(capture, catalogRows)) {
            keys.add(key);
        }
    }

    return Array.from(keys).sort((left, right) => {
        const leftCount = catalogCounts.get(left) ?? 0;
        const rightCount = catalogCounts.get(right) ?? 0;

        if (leftCount !== rightCount) {
            return rightCount - leftCount;
        }

        return left.localeCompare(right);
    });
}

function lookupSpeciesForCapture(capture: AppCapture, speciesIndex: ReturnType<typeof buildSpeciesIndex>) {
    const profileId = capture.speciesProfileId?.trim();

    if (profileId) {
        const byProfile = speciesIndex.byProfileId.get(profileId);

        if (byProfile) {
            return byProfile;
        }
    }

    const identity = capture.speciesSlug?.trim().toLowerCase();

    if (identity) {
        return speciesIndex.byIdentity.get(identity)
            ?? speciesIndex.bySlug.get(identity.replace(/_/g, "-"))
            ?? speciesIndex.byProfileId.get(identity);
    }

    const name = capture.animalName.trim().toLowerCase();

    return name ? speciesIndex.byName.get(name) ?? null : null;
}

function catalogBestUseCasesForCapture(capture: AppCapture, catalogRows: Map<string, CatalogRow>) {
    const profileId = capture.speciesProfileId?.trim();

    if (profileId) {
        const row = catalogRows.get(profileId);

        if (row) {
            return parseBestUseCases(row.best_use_cases);
        }
    }

    const identity = capture.speciesSlug?.trim().toLowerCase();

    if (identity) {
        const normalized = identity.replace(/-/g, "_");
        const row = catalogRows.get(identity) ?? catalogRows.get(normalized);

        if (row) {
            return parseBestUseCases(row.best_use_cases);
        }
    }

    return [] as string[];
}

function canonicalPowerKeysForCapture(capture: AppCapture, catalogRows: Map<string, CatalogRow>) {
    const keys = new Set<string>();

    for (const tag of capture.learnedScenarioTags ?? []) {
        const key = canonicalPowerKey(tag);

        if (key) {
            keys.add(key);
        }
    }

    for (const useCase of catalogBestUseCasesForCapture(capture, catalogRows)) {
        const key = canonicalPowerKey(useCase);

        if (key) {
            keys.add(key);
        }
    }

    return Array.from(keys);
}

function distinctSpeciesMatches(
    powerKey: string,
    captures: AppCapture[],
    speciesIndex: ReturnType<typeof buildSpeciesIndex>,
    catalogRows: Map<string, CatalogRow>
) {
    const normalized = canonicalPowerKey(powerKey);
    const matches = new Map<string, AppCapture>();
    const profileByToken = buildCatalogProfileIndex(catalogRows);

    for (const capture of captures) {
        if (shouldExcludeFromPowerSetMatching(capture)) {
            continue;
        }

        if (!canonicalPowerKeysForCapture(capture, catalogRows).includes(normalized)) {
            continue;
        }

        const identity = speciesIdentityKey(capture, profileByToken);
        const existing = matches.get(identity);

        if (!existing) {
            matches.set(identity, capture);
            continue;
        }

        const existingTime = existing.capturedAt ? Date.parse(existing.capturedAt) : 0;
        const candidateTime = capture.capturedAt ? Date.parse(capture.capturedAt) : 0;

        if (candidateTime > existingTime || (candidateTime === existingTime && capture.captureId > existing.captureId)) {
            matches.set(identity, capture);
        }
    }

    return matches;
}

function scoresFromCaptures(
    captures: AppCapture[],
    speciesIndex: ReturnType<typeof buildSpeciesIndex>,
    catalogRows: Map<string, CatalogRow>
) {
    const grouped = new Map<string, {label: string; score: number; captureIds: Set<string>}>();

    for (const capture of captures) {
        if (shouldExcludeFromPowerSetMatching(capture)) {
            continue;
        }

        const tags = canonicalPowerKeysForCapture(capture, catalogRows);
        const weight = contextWeight(capture);

        for (const key of tags) {
            const existing = grouped.get(key);

            if (existing) {
                existing.score += weight;
                existing.captureIds.add(capture.captureId);
                continue;
            }

            grouped.set(key, {
                label: displayPowerLabel(key),
                score: weight,
                captureIds: new Set([capture.captureId])
            });
        }
    }

    return Array.from(grouped, ([tagKey, value]) => ({
        tagKey,
        tagLabel: value.label,
        score: value.score
    }));
}

function weakBestForPowerKeys(scores: BestForTagScore[]) {
    return scores
        .filter((score) => score.score >= 0 && score.tagLabel.trim())
        .sort((left, right) => left.score - right.score || left.tagLabel.localeCompare(right.tagLabel))
        .slice(0, 5)
        .map((score) => canonicalPowerKey(score.tagKey || score.tagLabel))
        .filter(Boolean);
}

function starterPowerKeys(catalogCounts: Map<string, number>) {
    return Array.from(catalogCounts.entries())
        .filter(([, count]) => count > 0)
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, 3)
        .map(([key]) => key);
}

async function getApexGapPowerKeys() {
    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return [] as string[];
    }

    const {data: {user}} = await supabase.auth.getUser();

    if (!user) {
        return [];
    }

    const {data} = await supabase
        .from("user_identity_profiles")
        .select("public_summary")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("generated_at", {ascending: false})
        .limit(1)
        .maybeSingle();

    const summary = data?.public_summary;

    if (!summary || typeof summary !== "object") {
        return [];
    }

    const reports = [
        (summary as Record<string, unknown>).active,
        (summary as Record<string, unknown>).apex
    ];

    for (const report of reports) {
        if (!report || typeof report !== "object") {
            continue;
        }

        const progress = (report as Record<string, unknown>).apex_quality_progress;

        if (!progress || typeof progress !== "object") {
            continue;
        }

        const targets = (progress as Record<string, unknown>).targets;

        if (!Array.isArray(targets)) {
            continue;
        }

        return targets
            .map((target) => {
                if (!target || typeof target !== "object") {
                    return "";
                }

                const record = target as Record<string, unknown>;
                const remaining = Number(record.remaining ?? 0);
                const raw = clean(typeof record.tag_key === "string" ? record.tag_key : null)
                    ?? clean(typeof record.quality === "string" ? record.quality : null)
                    ?? "";

                if (!raw || remaining <= 0) {
                    return "";
                }

                return canonicalPowerKey(raw);
            })
            .filter(Boolean);
    }

    return [];
}

async function buildCurationContext(
    captures: AppCapture[],
    catalogCounts: Map<string, number>,
    speciesIndex: ReturnType<typeof buildSpeciesIndex>,
    catalogRows: Map<string, CatalogRow>
) {
    const apexGapPowerKeys = await getApexGapPowerKeys();
    const weakKeys = weakBestForPowerKeys(scoresFromCaptures(captures, speciesIndex, catalogRows));
    const starterKeys = apexGapPowerKeys.length === 0 && weakKeys.length === 0
        ? starterPowerKeys(catalogCounts)
        : [];

    return {
        apexGapPowerKeys,
        weakBestForPowerKeys: weakKeys,
        starterPowerKeys: starterKeys
    } satisfies PowerSetCurationContext;
}

function curationReason(key: string, context: PowerSetCurationContext) {
    if (context.apexGapPowerKeys.includes(key)) {
        return "Needed for your Apex path";
    }

    if (context.weakBestForPowerKeys.includes(key)) {
        return "Build this Best For quality";
    }

    if (context.starterPowerKeys.includes(key)) {
        return "Popular starter power";
    }

    return null;
}

function isVisible(album: PowerSetAlbum, context: PowerSetCurationContext) {
    if (album.found > 0 || album.isCompleted) {
        return true;
    }

    if (context.apexGapPowerKeys.includes(album.key)) {
        return true;
    }

    if (context.weakBestForPowerKeys.includes(album.key)) {
        return true;
    }

    if (context.starterPowerKeys.includes(album.key)) {
        return true;
    }

    return false;
}

function buildAlbum(
    key: string,
    captures: AppCapture[],
    catalogCounts: Map<string, number>,
    speciesIndex: ReturnType<typeof buildSpeciesIndex>,
    context: PowerSetCurationContext,
    catalogRows: Map<string, CatalogRow>
): PowerSetAlbum | null {
    const catalogLinkedCount = catalogCounts.get(key) ?? 0;
    const matches = distinctSpeciesMatches(key, captures, speciesIndex, catalogRows);
    const matchedCaptures = Array.from(matches.values()).sort((left, right) => {
        const leftTime = left.capturedAt ? Date.parse(left.capturedAt) : 0;
        const rightTime = right.capturedAt ? Date.parse(right.capturedAt) : 0;

        if (leftTime !== rightTime) {
            return rightTime - leftTime;
        }

        return right.captureId.localeCompare(left.captureId);
    });
    const found = matchedCaptures.length;
    const matchedItems = matchedItemPresentation(matchedCaptures);
    const tierStatuses = buildTierStatuses(found, catalogLinkedCount, matchedCaptures);
    const active = activeTier(tierStatuses);
    const silverCompleted = tierStatuses.find((status) => status.tier === "silver")?.isCompleted ?? false;
    const goldCompleted = tierStatuses.find((status) => status.tier === "gold")?.isCompleted ?? false;
    const silverStatus = tierStatuses.find((status) => status.tier === "silver");
    const catalogSuffix = catalogLinkedCount > 0 ? ` · ${catalogLinkedCount} catalog animals` : "";
    const album: PowerSetAlbum = {
        key,
        title: displayPowerLabel(key),
        subtitle: `${powerSetSubtitle(key)}${catalogSuffix}`,
        catalogLinkedCount,
        found,
        captureIds: matchedCaptures.map((capture) => capture.captureId),
        matchedItems,
        tierStatuses,
        activeTier: active,
        progressPercent: active && active.targetCount > 0
            ? Math.round((active.progressCount / active.targetCount) * 100)
            : 0,
        progressLabel: active ? `${active.progressCount}/${active.targetCount}` : "0/0",
        remainingCount: active?.remainingCount ?? 0,
        completionReward: silverStatus?.completionReward ?? null,
        completionRewardBreakdown: silverStatus?.isCompleted
            ? silverStatus.completionRewardBreakdown
            : null,
        isCompleted: silverCompleted,
        isGoldMastered: goldCompleted,
        isNearComplete: Boolean(active && !active.isCompleted && active.remainingCount === 1),
        curationReason: curationReason(key, context),
        coverCaptureId: matchedCaptures[0]?.captureId ?? null
    };

    return isVisible(album, context) ? album : null;
}

export async function buildPowerSetAlbums(captures: AppCapture[], species?: CatalogPowerSpecies[]) {
    const context = await getCatalogPowerContext();
    const catalogSpecies = species ?? context.species;
    const catalogRows = context.catalogRows;
    const speciesIndex = buildSpeciesIndex(catalogSpecies);
    const catalogCounts = powerLinkedCounts(catalogSpecies);
    const curation = await buildCurationContext(captures, catalogCounts, speciesIndex, catalogRows);
    const keys = discoverPowerKeys(catalogCounts, captures, catalogRows);

    return keys
        .map((key) => buildAlbum(key, captures, catalogCounts, speciesIndex, curation, catalogRows))
        .filter((album): album is PowerSetAlbum => Boolean(album));
}

export type PowerSetPageData = {
    powerSets: PowerSetAlbum[];
    summary: ReturnType<typeof summarizePowerSets>;
    catalogSetCount: number;
};

export async function getPowerSetPageData(): Promise<PowerSetPageData> {
    const rawCaptures = await getUserCaptures(2000);
    const captures = rawCaptures.map(decorateCapture).filter(isEligibleCapture);
    const {species} = await getCatalogPowerContext();
    const powerSets = await buildPowerSetAlbums(captures, species);
    const summary = summarizePowerSets(powerSets);

    void syncPowerSetCompletionsInBackground(powerSets);

    return {
        powerSets,
        summary,
        catalogSetCount: powerLinkedCounts(species).size
    };
}

async function syncPowerSetCompletionsInBackground(albums: PowerSetAlbum[]) {
    try {
        const {syncPowerSetCompletions} = await import("@/data/power-set-completions");
        await syncPowerSetCompletions(albums);
    } catch {
        // Best-effort sync should not block page render.
    }
}

function hasStartedPowerSetProgress(album: PowerSetAlbum) {
    return album.found > 0;
}

export function summarizePowerSets(albums: PowerSetAlbum[]) {
    const active = albums.filter((album) => !album.isCompleted && hasStartedPowerSetProgress(album));
    const completed = albums.filter((album) => album.isCompleted);
    const goldMastered = completed.filter((album) => album.isGoldMastered);

    return {
        active,
        completed,
        goldMastered,
        inProgressCount: active.length,
        silverCount: completed.length,
        goldCount: goldMastered.length
    };
}

export async function getCatalogPowerSetCount(species?: CatalogPowerSpecies[]) {
    const catalogSpecies = species ?? await buildCatalogPowerSpecies();
    return powerLinkedCounts(catalogSpecies).size;
}

export async function getPowerSetAlbumByKey(key: string, captures: AppCapture[]) {
    const normalized = canonicalPowerKey(key);
    const albums = await buildPowerSetAlbums(captures);

    return albums.find((album) => album.key === normalized) ?? null;
}

export async function getPowerSetDetail(key: string, captures: AppCapture[]) {
    const species = await buildCatalogPowerSpecies();
    const album = await getPowerSetAlbumByKey(key, captures);

    if (!album) {
        return null;
    }

    return {
        album,
        catalogSuggestions: getCatalogSuggestionsForPowerSet(album.key, captures, species)
    };
}

export async function getAppPowerSets(captures: AppCapture[]) {
    const albums = await buildPowerSetAlbums(captures);

    return albums.map((album) => ({
        key: album.key,
        title: album.title,
        total: album.catalogLinkedCount || album.activeTier?.targetCount || album.found,
        found: album.found,
        captureIds: album.captureIds
    }));
}
