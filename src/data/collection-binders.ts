import "server-only";

import {getAppCaptures, type AppCapture} from "@/data/authenticated-app";
import {
    type BinderDefinition,
    type BinderIndexSummary,
    type BinderProgress,
    type BinderSlot
} from "@/data/collection-binder-types";
import {getUnifiedSpeciesEntries} from "@/data/database-species-pages";
import {getCaptureImageRoute} from "@/lib/capture-storage-image";
import {
    buildBinderMembershipMap,
    type BinderMembershipCatalogEntry
} from "@/lib/collection-binder-membership";
import {getSpeciesImageRoute} from "@/data/species-images";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {getSupabaseUrl} from "@/lib/supabase-http";
import type {SpeciesEntry} from "@/data/species";

export type {
    BinderDefinition,
    BinderIndexSummary,
    BinderProgress,
    BinderShelfGroup,
    BinderSlot
} from "@/data/collection-binder-types";
export {BINDER_SHELF_GROUPS} from "@/data/collection-binder-types";

const LAUNCH_BINDERS: BinderDefinition[] = [
    {
        id: "birds",
        title: "Birds of the World",
        shortTitle: "Birds",
        spineLabel: "BIRDS",
        blurb: "Fill every page with the birds you've met in the wild, garden, farm, and sky.",
        shelfGroup: "wildlife",
        sortOrder: 10,
        primaryHex: "3B82C4",
        accentHex: "D4A84B",
        secondaryHex: "0F2740",
        coverArtworkKey: "bald-eagle"
    },
    {
        id: "insects",
        title: "Bugs & Insects",
        shortTitle: "Insects",
        spineLabel: "INSECTS",
        blurb: "A binder for the six-legged world — beetles, bees, butterflies, and beyond.",
        shelfGroup: "wildlife",
        sortOrder: 20,
        primaryHex: "4F7A3E",
        accentHex: "D9A441",
        secondaryHex: "1C2A14",
        coverArtworkKey: "hercules-beetle"
    },
    {
        id: "arachnids",
        title: "Spiders & Arachnids",
        shortTitle: "Arachnids",
        spineLabel: "ARACHNIDS",
        blurb: "Eight legs, silk, venom, and armor — arachnids in one collector book.",
        shelfGroup: "wildlife",
        sortOrder: 30,
        primaryHex: "2A2433",
        accentHex: "A78BFA",
        secondaryHex: "120E18",
        coverArtworkKey: "jumping-spider"
    },
    {
        id: "fish",
        title: "Fish & Sharks",
        shortTitle: "Aquatic",
        spineLabel: "AQUATIC",
        blurb: "From garden ponds to open ocean — fins, gills, and cartilaginous hunters.",
        shelfGroup: "wildlife",
        sortOrder: 40,
        primaryHex: "1D6F9A",
        accentHex: "C9D6E0",
        secondaryHex: "071825",
        coverArtworkKey: "great-white-shark"
    },
    {
        id: "birds_of_prey",
        title: "Birds of Prey",
        shortTitle: "Raptors",
        spineLabel: "RAPTORS",
        blurb: "Raptors only — eagles, hawks, falcons, owls, and their hunting kin.",
        shelfGroup: "specialists",
        sortOrder: 50,
        primaryHex: "8B6A3A",
        accentHex: "C9A227",
        secondaryHex: "24180C",
        coverArtworkKey: "golden-eagle"
    },
    {
        id: "venomous",
        title: "Venom Masters",
        shortTitle: "Venom",
        spineLabel: "VENOM",
        blurb: "Species that hunt or defend with venom. Handle with respect.",
        shelfGroup: "specialists",
        sortOrder: 60,
        primaryHex: "121212",
        accentHex: "7CFF3A",
        secondaryHex: "050805",
        coverArtworkKey: "king-cobra"
    },
    {
        id: "predators",
        title: "Apex Predators",
        shortTitle: "Predators",
        spineLabel: "PREDATORS",
        blurb: "Top-of-chain hunters curated for the binder shelf.",
        shelfGroup: "specialists",
        sortOrder: 70,
        primaryHex: "140808",
        accentHex: "DC2626",
        secondaryHex: "050202",
        coverArtworkKey: "lion"
    },
    {
        id: "zoo",
        title: "Zoo Favorites",
        shortTitle: "Zoo",
        spineLabel: "ZOO",
        blurb: "Species AnimalDex has actually tagged from zoo and captive encounters.",
        shelfGroup: "companions_and_places",
        sortOrder: 80,
        primaryHex: "C4A86A",
        accentHex: "4F7A3E",
        secondaryHex: "2A2112",
        coverArtworkKey: "giraffe"
    },
    {
        id: "farm",
        title: "Farmyard Friends",
        shortTitle: "Farm",
        spineLabel: "FARM",
        blurb: "Domestic farm animals that share fences, fields, and barns with people.",
        shelfGroup: "companions_and_places",
        sortOrder: 90,
        primaryHex: "B84A3A",
        accentHex: "F3E7D3",
        secondaryHex: "2A1210",
        coverArtworkKey: "domestic-cattle"
    },
    {
        id: "lizards",
        title: "Lizards",
        shortTitle: "Lizards",
        spineLabel: "LIZARDS",
        blurb: "Geckos, monitors, skinks, dragons, and the rest of the lizard page.",
        shelfGroup: "wildlife",
        sortOrder: 120,
        primaryHex: "2F6B3A",
        accentHex: "A3E635",
        secondaryHex: "0F2014",
        coverArtworkKey: "komodo-dragon"
    },
    {
        id: "frogs",
        title: "Frogs & Toads",
        shortTitle: "Amphibians",
        spineLabel: "AMPHIBIANS",
        blurb: "Amphibian jumpers — frogs, toads, and their close wet-skinned cousins.",
        shelfGroup: "wildlife",
        sortOrder: 130,
        primaryHex: "1F9B5A",
        accentHex: "FACC15",
        secondaryHex: "0A2416",
        coverArtworkKey: "poison-dart-frog"
    },
    {
        id: "snakes",
        title: "Snakes",
        shortTitle: "Snakes",
        spineLabel: "SNAKES",
        blurb: "Serpents of every size — from garden grass snakes to legendary vipers.",
        shelfGroup: "wildlife",
        sortOrder: 140,
        primaryHex: "4A5C2E",
        accentHex: "B87333",
        secondaryHex: "161A0C",
        coverArtworkKey: "reticulated-python"
    },
    {
        id: "giant_bugs",
        title: "Giant Bugs",
        shortTitle: "Giant Bugs",
        spineLabel: "GIANT BUGS",
        blurb: "Genuinely huge terrestrial arthropods — beetles, wetas, stick insects, and more.",
        shelfGroup: "specialists",
        sortOrder: 150,
        primaryHex: "4A2F1A",
        accentHex: "FFB020",
        secondaryHex: "180E06",
        coverArtworkKey: "goliath-beetle"
    }
];

type MembershipStub = {
    set_id: string;
    set_position: number;
    species_profile_id: string;
};

function identityToSlug(identityKey: string) {
    return identityKey.trim().toLowerCase().replace(/_/g, "-");
}

function coverArtworkUrl(coverArtworkKey: string) {
    const supabaseUrl = getSupabaseUrl() ?? "https://wwhsdzpczekgdlobwaej.supabase.co";
    return `${supabaseUrl}/storage/v1/object/public/animals/${encodeURIComponent(coverArtworkKey)}.webp`;
}

function collectedByProfile(captures: AppCapture[]) {
    const map = new Map<string, AppCapture>();

    for (const capture of captures) {
        const profileId = capture.speciesProfileId?.trim().toLowerCase();
        if (!profileId) continue;
        const existing = map.get(profileId);
        if (!existing || (capture.score ?? 0) > (existing.score ?? 0)) {
            map.set(profileId, capture);
        }
    }

    return map;
}

async function fetchMembershipStubs(setIds: string[]) {
    const supabase = createSupabaseServerClient();
    if (!supabase || setIds.length === 0) return [] as MembershipStub[];

    const {data, error} = await supabase
        .from("animal_collection_set_memberships")
        .select("set_id,set_position,species_profile_id")
        .in("set_id", setIds)
        .order("set_id", {ascending: true})
        .order("set_position", {ascending: true});

    if (error || !data) return [];
    return data as MembershipStub[];
}

function toMembershipCatalogEntry(entry: SpeciesEntry): BinderMembershipCatalogEntry | null {
    const profileId = entry.speciesProfileId?.trim();
    if (!profileId) return null;

    return {
        speciesProfileId: profileId,
        normalizedIdentityKey: entry.normalizedIdentityKey ?? entry.slug.replace(/-/g, "_"),
        displayName: entry.name,
        animalName: entry.name,
        scientificName: entry.analysis.scientificName ?? null,
        animalDexNumber: entry.databaseSource?.animalDexNumber ?? null,
        identityKind: entry.databaseSource?.identityKind ?? null,
        catalogStatus: entry.databaseSource?.seoIndexable === false ? "hidden" : "active",
        category: entry.analysis.category ?? null
    };
}

function clientMembershipStubs(
    catalogEntries: SpeciesEntry[],
    captures: AppCapture[]
): MembershipStub[] {
    const membershipEntries = catalogEntries
        .map(toMembershipCatalogEntry)
        .filter((entry): entry is BinderMembershipCatalogEntry => Boolean(entry));

    const zooSpeciesProfileIds = new Set<string>();
    for (const capture of captures) {
        const profileId = capture.speciesProfileId?.trim().toLowerCase();
        if (profileId && capture.contextLabel?.toLowerCase() === "zoo") {
            zooSpeciesProfileIds.add(profileId);
        }
    }

    const membership = buildBinderMembershipMap(membershipEntries, {zooSpeciesProfileIds});

    const stubs: MembershipStub[] = [];
    for (const [setId, members] of Array.from(membership.entries())) {
        members.forEach((member: BinderMembershipCatalogEntry, index: number) => {
            stubs.push({
                set_id: setId,
                set_position: index + 1,
                species_profile_id: member.speciesProfileId
            });
        });
    }
    return stubs;
}

function buildBinderProgress(input: {
    definition: BinderDefinition;
    stubs: MembershipStub[];
    entriesByProfileId: Map<string, {slug: string; name: string; scientificName: string | null; animalDexNumber: number | null; normalizedIdentityKey: string}>;
    collected: Map<string, AppCapture>;
}): BinderProgress | null {
    const {definition, stubs, entriesByProfileId, collected} = input;
    if (!stubs.length) return null;

    const slots: BinderSlot[] = stubs.flatMap((stub) => {
        const profileId = stub.species_profile_id.toLowerCase();
        const entry = entriesByProfileId.get(profileId);
        if (!entry) return [];

        const capture = collected.get(profileId) ?? null;
        const slug = entry.slug || identityToSlug(entry.normalizedIdentityKey);

        return [{
            speciesProfileId: stub.species_profile_id,
            identityKey: entry.normalizedIdentityKey,
            slug,
            displayName: entry.name,
            scientificName: entry.scientificName,
            animalDexNumber: entry.animalDexNumber,
            position: stub.set_position,
            isCollected: Boolean(capture),
            captureId: capture?.captureId ?? null,
            imageSrc: getSpeciesImageRoute(slug, capture?.captureId ?? null)
        }];
    });

    if (!slots.length) return null;

    const collectedCount = slots.filter((slot) => slot.isCollected).length;
    const totalCount = slots.length;
    const completionPercent = totalCount > 0 ? Math.round((collectedCount / totalCount) * 100) : 0;
    const coverCapture = slots.find((slot) => slot.isCollected);
    const coverImageSrc = coverCapture
        ? (coverCapture.captureId ? getCaptureImageRoute(coverCapture.captureId) : coverCapture.imageSrc)
        : coverArtworkUrl(definition.coverArtworkKey);

    return {
        definition,
        slots,
        collectedCount,
        totalCount,
        completionPercent,
        isComplete: totalCount > 0 && collectedCount >= totalCount,
        coverImageSrc,
        href: `/app/collection/binders/${encodeURIComponent(definition.id)}`
    };
}

export function getLaunchBinderDefinitions() {
    return LAUNCH_BINDERS;
}

export function getBinderDefinition(id: string) {
    return LAUNCH_BINDERS.find((binder) => binder.id === id) ?? null;
}

export async function getCollectionBinders(): Promise<{binders: BinderProgress[]; summary: BinderIndexSummary}> {
    const definitions = getLaunchBinderDefinitions();
    const [captures, catalogEntries, serverStubs] = await Promise.all([
        getAppCaptures(),
        getUnifiedSpeciesEntries(),
        fetchMembershipStubs(definitions.map((definition) => definition.id))
    ]);

    // Match iOS: prefer durable server memberships; fall back to client catalog rules.
    const stubs = serverStubs.length
        ? serverStubs
        : clientMembershipStubs(catalogEntries, captures);

    const entriesByProfileId = new Map<string, {
        slug: string;
        name: string;
        scientificName: string | null;
        animalDexNumber: number | null;
        normalizedIdentityKey: string;
    }>();

    for (const entry of catalogEntries) {
        const profileId = entry.speciesProfileId?.trim().toLowerCase();
        if (!profileId) continue;
        entriesByProfileId.set(profileId, {
            slug: entry.slug,
            name: entry.name,
            scientificName: entry.analysis.scientificName ?? null,
            animalDexNumber: entry.databaseSource?.animalDexNumber ?? null,
            normalizedIdentityKey: entry.normalizedIdentityKey ?? entry.slug.replace(/-/g, "_")
        });
    }

    const collected = collectedByProfile(captures);
    const stubsBySet = new Map<string, MembershipStub[]>();
    for (const stub of stubs) {
        const list = stubsBySet.get(stub.set_id) ?? [];
        list.push(stub);
        stubsBySet.set(stub.set_id, list);
    }

    const binders = definitions
        .map((definition) => buildBinderProgress({
            definition,
            stubs: stubsBySet.get(definition.id) ?? [],
            entriesByProfileId,
            collected
        }))
        .filter((binder): binder is BinderProgress => Boolean(binder));

    const summary: BinderIndexSummary = {
        binderCount: binders.length,
        collectedSlots: binders.reduce((sum, binder) => sum + binder.collectedCount, 0),
        totalSlots: binders.reduce((sum, binder) => sum + binder.totalCount, 0),
        completeCount: binders.filter((binder) => binder.isComplete).length
    };

    return {binders, summary};
}

export async function getCollectionBinderDetail(id: string): Promise<BinderProgress | null> {
    const definition = getBinderDefinition(id);
    if (!definition) return null;

    const {binders} = await getCollectionBinders();
    return binders.find((binder) => binder.definition.id === id) ?? null;
}
