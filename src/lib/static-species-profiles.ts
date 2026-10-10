import profileSnapshot from "@/data/published-seo-static-species-profiles.json";

// Hand-coded /animals pages linked to the catalog at build time
// (scripts/refreshStaticSpeciesProfiles.mts): their own indexed
// species_profile_id, or, for a group page with no indexed group profile
// (octopus, fox, owl…), the indexed species it covers.

export type StaticSpeciesGroupMember = {slug: string; name: string; animalDexNumber: number};

type ProfileEntry =
    | {speciesProfileId: string; source: "own" | "canonical"}
    | {members: StaticSpeciesGroupMember[]};

const entries = (profileSnapshot as unknown as {entries: Record<string, ProfileEntry>}).entries;

export function getStaticSpeciesProfileId(slug: string): string | null {
    const entry = entries[slug];
    return entry && "speciesProfileId" in entry ? entry.speciesProfileId : null;
}

/** The indexed species a group page covers; empty when the page has its own profile. */
export function getStaticSpeciesGroupMembers(slug: string): StaticSpeciesGroupMember[] {
    const entry = entries[slug];
    return entry && "members" in entry ? entry.members : [];
}
