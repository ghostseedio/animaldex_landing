import "server-only";

import {type SpeciesSystemDynamics, decodeSpeciesSystemDynamics, optionalText} from "@/lib/system-dynamics";
import {getSupabaseHeaders, getSupabaseServerReadKey, getSupabaseUrl} from "@/lib/supabase-http";
import {assertNoRemoteDuringSeoSsg} from "@/lib/seo-ssg-remote-guard";

/**
 * Reads `species_system_dynamics` the way iOS does
 * (`SupabaseSpeciesSystemDynamicsService`): the row alone, then the canonical
 * species-level principle from `species_behavior_principles` for the SAME
 * `species_profile_id`. Deliberately not the capture / fused / ranking
 * principle, so one species always shows one identity whichever card opened it.
 *
 * Row decoding is pure and lives in `@/lib/system-dynamics`.
 */

async function readSupabase(path: string) {
    const url = getSupabaseUrl();
    const key = getSupabaseServerReadKey();
    if (!url || !key) return null;

    const response = await fetch(`${url}/rest/v1/${path}`, {
        headers: getSupabaseHeaders(key, {Accept: "application/json"}),
        cache: "no-store"
    });
    if (!response.ok) return null;
    return await response.json().catch(() => null);
}

/**
 * Fetches one species' System Dynamics, with the canonical principle attached.
 * Returns null when the species has no generated row yet — the card then simply
 * does not render, exactly as on iOS.
 */
export async function getSpeciesSystemDynamics(speciesProfileId: string | null | undefined) {
    const id = speciesProfileId?.trim();
    if (!id) return null;
    assertNoRemoteDuringSeoSsg(`species_system_dynamics ${id}`);

    const rows = await readSupabase(
        `species_system_dynamics?select=*&species_profile_id=eq.${encodeURIComponent(id)}&limit=1`
    );
    const dynamics = Array.isArray(rows) ? decodeSpeciesSystemDynamics(rows[0]) : null;
    if (!dynamics) return null;

    const principles = await readSupabase(
        `species_behavior_principles?select=principle_name,principle_expression`
        + `&species_profile_id=eq.${encodeURIComponent(id)}&limit=1`
    );
    const principle = Array.isArray(principles) ? principles[0] : null;
    if (principle) {
        dynamics.canonicalPrincipleName = optionalText(principle.principle_name);
        dynamics.canonicalPrincipleExpression = optionalText(principle.principle_expression);
    }

    return dynamics;
}
