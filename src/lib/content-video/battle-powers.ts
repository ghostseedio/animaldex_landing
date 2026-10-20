import {getEnhancedAnimalPowerProfile} from "@/data/species-animal-power";
import type {BattlePower} from "@/lib/content-video/plan";
import {getStaticSpeciesProfileId} from "@/lib/static-species-profiles";
import {getSupabaseHeaders, getSupabaseServerReadKey, getSupabaseUrl} from "@/lib/supabase-http";

// A fighter's AnimalDex Animal Power (species_behavior_principles, the
// /animal-powers pages), so a battle can show it winning or losing with the
// power it is known for. Many species have none yet; the director then picks
// signature abilities from the page and real biology alone.

async function profileIdForSlug(slug: string) {
    const known = getStaticSpeciesProfileId(slug);
    if (known) return known;
    const url = getSupabaseUrl();
    const key = getSupabaseServerReadKey();
    if (!url || !key) return null;
    try {
        const response = await fetch(`${url}/rest/v1/species_profiles?landing_page_slug=eq.${encodeURIComponent(slug)}&select=id&limit=1`, {headers: getSupabaseHeaders(key), next: {revalidate: 3600}});
        if (!response.ok) return null;
        const [row] = await response.json() as Array<{id?: string}>;
        return row?.id ?? null;
    } catch {
        return null;
    }
}

export async function battlePowerFor(slug: string): Promise<BattlePower | null> {
    const profile = await getEnhancedAnimalPowerProfile(await profileIdForSlug(slug));
    if (!profile) return null;
    const evidence = profile.behavioralEvidence.slice(0, 2).map((item) => item.observation).filter(Boolean);
    return {
        name: profile.principleName,
        basis: [profile.biologicalBasis, ...evidence].filter(Boolean).join(" ").slice(0, 600)
    };
}
