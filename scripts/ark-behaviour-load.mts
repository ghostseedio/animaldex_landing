/**
 * Loads the read-only catalogue exports into one stored-text record per Ark species
 * (`SpeciesText`, `ark-behaviour-text.mts`), for the recipe generator.
 *
 * Inputs, all read-only exports of the live catalogue (run from the AnimalDex repo, SELECT only):
 *   1. species.json: the behaviour lane's export (`scripts/ark-behaviour-profiles.mts` header has its query);
 *      breeds already carry their parent species' text there (`text_from_parent`).
 *   2. extra.json: the fields that export lacks, in pages of 400:
 *        select vs.species_profile_id id, vs.model_slug slug, vs.parent_species_profile_id parent_id,
 *          fg.sex_difference_notes, fg.lifespan_estimate, fg.best_months, fg.best_weather,
 *          bp.principle_name, bp.biological_basis,
 *          (select jsonb_agg(jsonb_build_object('title', e->>'title', 'observation', e->>'observation',
 *             'function', e->>'biological_function')) from jsonb_array_elements(bp.behavioral_evidence) e) evidence,
 *          sd.signature_explanation, sd.archetype->>'name' archetype,
 *          t.season, t.season_phrase, t.sociality, t.sociality_phrase, t.litter_phrase, t.hosts, t.period_phrase
 *        from voyage_species vs
 *        left join species_field_guide fg using (species_profile_id) -- (on fg.species_profile_id = vs.species_profile_id)
 *        left join species_behavior_principles bp ... left join species_system_dynamics sd ... left join voyage_species_traits t ...
 *        order by vs.model_slug limit 400 offset N
 *      (the Power's "interpretation" lines are left out: they are lessons for people, not the animal's biology);
 *   3. intel.json: the intelligence lane's export (predators_summary, female_offspring_notes, species_subtitle_story);
 *   4. this repo's data/ark/behaviour-profiles.json (body plan, movement, social, diet, roost: the behaviour lane's).
 */

import fs from "node:fs";
import path from "node:path";
import type {SpeciesText, TextField} from "./ark-behaviour-text.mts";

type Json = Record<string, unknown>;
const str = (v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    if (Array.isArray(v)) return v.filter((x) => typeof x === "string").join(" ") || null;
    const s = String(v).trim();
    return s && s !== "None" && s !== "null" ? s : null;
};
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export function loadSpecies(speciesPath: string, extraPath: string, intelPath: string, root: string): SpeciesText[] {
    const rows = (JSON.parse(fs.readFileSync(speciesPath, "utf8")).rows as Json[]).filter((r) => r.slug);
    const extra = new Map((JSON.parse(fs.readFileSync(extraPath, "utf8")).rows as Json[]).map((r) => [r.id as string, r]));
    const intel = new Map((JSON.parse(fs.readFileSync(intelPath, "utf8")).rows as Json[]).map((r) => [r.id as string, r]));
    const profiles = new Map((JSON.parse(fs.readFileSync(path.join(root, "data/ark/behaviour-profiles.json"), "utf8")).profiles as Json[]).map((p) => [p.slug as string, p]));
    const out: SpeciesText[] = [];
    for (const r of rows) {
        const id = r.id as string;
        // A breed's own fields, else its parent species' (the behaviour lane's export already did this for its fields).
        const own = extra.get(id) ?? {};
        const parent = r.parent_id ? extra.get(r.parent_id as string) ?? {} : {};
        const pick = (key: string) => str(own[key]) ?? str(parent[key]);
        const intelOwn = intel.get(id) ?? {};
        const intelParent = r.parent_id ? intel.get(r.parent_id as string) ?? {} : {};
        const pickIntel = (key: string) => str(intelOwn[key]) ?? str(intelParent[key]);
        const evidenceRows = ((own.evidence as Json[] | null) ?? (parent.evidence as Json[] | null) ?? []) as Json[];
        const evidence = evidenceRows.map((e) => [str(e.observation), str(e.function)].filter(Boolean).join(" ")).filter(Boolean).join(" ");
        const profile = profiles.get(r.slug as string) ?? {};
        const text: Partial<Record<TextField, string>> = {};
        const set = (field: TextField, value: string | null) => {
            if (value) text[field] = value;
        };
        set("sleep", str(r.sleep_pattern));
        set("time", str(r.best_time_of_day));
        set("months", pick("best_months"));
        set("habitat", str(r.typical_habitat)?.replace(/^Native range keys:[^.]*\.\s*/, "") ?? null);
        set("look", str(r.where_to_look));
        set("diet", str(r.diet_summary));
        set("predators", pickIntel("predators_summary"));
        set("offspring", pickIntel("female_offspring_notes"));
        set("sexdiff", pick("sex_difference_notes"));
        set("traits", list(r.signature_traits).join(". ").replace(/\.\./g, "."));
        set("facts", list(r.interesting_facts).join(" "));
        set("spotlight", str(r.species_spotlight));
        set("story", pickIntel("species_subtitle_story"));
        set("basis", pick("biological_basis"));
        set("evidence", evidence || null);
        set("sd", pick("signature_explanation"));
        set("activity", str(r.activity_phrase));
        set("sociality", str(r.sociality_phrase) ?? pick("sociality_phrase"));
        set("season", pick("season_phrase"));
        const seasonValue = (own.season ?? parent.season ?? null) as string[] | null;
        out.push({
            id,
            slug: r.slug as string,
            name: str(r.name) ?? (r.slug as string),
            zone: str(r.zone),
            excluded: str(r.excluded_reason),
            parentSlug: str(r.parent_slug),
            fromParent: Boolean(r.text_from_parent),
            className: str(r.class_name),
            order: str(r.order_name),
            family: str(r.family_name),
            plan: (profile.plan as string) ?? "other",
            move: (profile.move as string) ?? null,
            moves: (profile.moves as string[]) ?? [],
            social: (profile.social as string) ?? null,
            diet: (profile.diet as string) ?? null,
            roost: (profile.roost as string) ?? null,
            activityValue: (profile.activity as string) ?? null,
            size: (profile.size as number) ?? null,
            interactions: (profile.interactions as string[]) ?? [],
            seasonValue: Array.isArray(seasonValue) ? seasonValue : null,
            text
        });
    }
    return out.sort((a, b) => a.slug.localeCompare(b.slug));
}
