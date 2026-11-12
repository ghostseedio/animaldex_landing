/**
 * The collision checks' synthetic Ark for CI (no real data, no names): every catalogue species in its zone (the
 * behaviour audit's fixture: `ark-audit/fixture.ts`, one to four of each by how social it is, predators next to their
 * prey), and the hamlet's house and farm residents at the captures dry run's 1× (`fixtures/hamlet-population.json`),
 * so the plots, their fences, houses, barns and props are all there. Pure: the same files give the same Ark.
 */

import {readFileSync} from "node:fs";
import path from "node:path";
import population from "@/ark-scene/fixtures/hamlet-population.json";
import {auditAnimalId, auditFixture, decodePreyTable, type AuditProfile} from "@/lib/ark-audit/fixture";
import type {ArkAnimal} from "@/ark-scene/types";

export function collideFixture(root: string, options: {limit?: number | null; residents?: number} = {}): ArkAnimal[] {
    const profilesFile = path.join(root, "data/ark/behaviour-profiles.json");
    const preyFile = path.join(root, "data/ark/audit-predator-prey.json");
    const all = (JSON.parse(readFileSync(profilesFile, "utf8")) as {profiles: AuditProfile[]}).profiles;
    const profiles = options.limit ? all.filter((p) => !p.excluded).slice(0, options.limit) : all;
    const preyOf = decodePreyTable(JSON.parse(readFileSync(preyFile, "utf8")), all);
    const wild = auditFixture(profiles, preyOf, "adjacent").animals;
    const scale = options.residents ?? 1;
    const residents: ArkAnimal[] = [];
    const rows = (population as unknown as {residents: Array<[string, string, string | null, number]>}).residents;
    let index = 0;
    for (const [slug, area, activity, count] of rows) {
        for (let n = 0; n < Math.round(count * scale); n++) {
            residents.push({
                id: auditAnimalId(`${slug}@${area}`, n),
                species_profile_id: slug,
                name: slug,
                scientific_name: null,
                model_slug: slug,
                zone: "farm_garden",
                area,
                arrived_at: new Date(Date.UTC(2026, 10, 1) + index++ * 1000).toISOString(),
                brought_by: {label: "A voyager", named: false},
                mine: false,
                activity: activity as ArkAnimal["activity"]
            } as ArkAnimal);
        }
    }
    return [...wild, ...residents];
}
