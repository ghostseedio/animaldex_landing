/**
 * Development's two islands (`/ark?fixture=islands`, the islands tests): the v2 fixture Ark as the server answers it
 * with `voyage_config.islands` on (AnimalDex `ark-islands-server`, `20261117120000`). Made up, deterministic by id; no
 * production data.
 *
 * - `withArkIslandsFixture(raw)`: every animal gains `island` and, in the zoo, `area: 'zoo'` and `enclosure`, by the
 *   plan's routing (§4.1): house and farm animals to the town; about one in five of the rest a zoo capture (its
 *   enclosure by type, numbered as `voyage_zoo_enclosure_pick` numbers them); the garden zone and the urban kinds to
 *   the town's wildlife; everyone else to the wild island. The Ark-born follow a parent's kind's first home.
 * - `arkIslandsV3(raw, island)`: `voyage_public_v3(voyage, island)`'s answer from it: that island's animals and nests,
 *   its zones and counts, `island`, and both islands' `islands` counts.
 */

import {assignEnclosures, unitOf, urbanSlug, zooTypeOfSlug, type RoutedAnimal} from "@/ark-scene/islands/routing";
import {withArkThriveFixture} from "@/lib/ark-thrive-fixture";

type Raw = Record<string, unknown>;

/** About this share of the fixture's wild-setting animals are zoo captures (the real Ark: 499 of 1,945 outside houses and farms). */
const ZOO_SHARE = 0.22;

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

/** The fixture with the contract's thrive fields and the islands fields on every animal. */
export function withArkIslandsFixture<T>(raw: T): T {
    const copy = withArkThriveFixture(clone(raw)) as unknown as Raw;
    const animals = (Array.isArray(copy.animals) ? copy.animals : []) as Raw[];
    const zoo: RoutedAnimal[] = [];
    const firstHome = new Map<string, {island: string; area: string | null}>();
    const ordered = animals.slice().sort((a, b) => String(a.arrived_at).localeCompare(String(b.arrived_at)) || String(a.id).localeCompare(String(b.id)));
    for (const animal of ordered) {
        const id = String(animal.id);
        const slug = String(animal.model_slug ?? "");
        const kind = String(animal.kind_species_profile_id ?? animal.species_profile_id ?? slug);
        const born = animal.origin === "born" && firstHome.get(kind);
        let island = "wild";
        let area = (animal.area as string | null | undefined) ?? null;
        if (born) {
            island = born.island;
            area = born.area;
        } else if (area === "house" || area === "farm") {
            island = "town";
        } else if (unitOf(`zoo:${id}`) < ZOO_SHARE) {
            island = "town";
            area = "zoo";
        } else if (animal.zone === "farm_garden" || urbanSlug(slug)) {
            island = "town";
        }
        if (!firstHome.has(kind)) firstHome.set(kind, {island, area});
        animal.island = island;
        animal.area = area;
        animal.enclosure = null;
        if (area === "zoo") zoo.push({id, slug, kind, arrivedAt: String(animal.arrived_at), type: zooTypeOfSlug(slug)});
    }
    const enclosures = assignEnclosures(zoo);
    for (const animal of animals) {
        const enclosure = enclosures.get(String(animal.id));
        if (enclosure) animal.enclosure = enclosure;
    }
    return copy as unknown as T;
}

/** `voyage_public_v3(voyage, island)`'s answer from a two-island fixture (as the server's filter of the cached read). */
export function arkIslandsV3(raw: unknown, island: "wild" | "town"): Raw {
    const body = raw as Raw;
    const all = ((body.animals as Raw[] | undefined) ?? []);
    const living = all.filter((animal) => animal.status === undefined || animal.status === "present");
    const islands = {
        wild: living.filter((animal) => (animal.island ?? "wild") === "wild").length,
        town: living.filter((animal) => animal.island === "town").length,
        zoo: living.filter((animal) => animal.area === "zoo").length
    };
    const animals = all.filter((animal) => (animal.island ?? "wild") === island);
    const kinds = new Set(animals.map((animal) => `${animal.species_profile_id}|${animal.zone}`));
    const nests = ((body.nests as Raw[] | undefined) ?? []).filter((nest) => kinds.has(`${nest.species_profile_id}|${nest.zone}`));
    const zones = new Map<string, number>();
    for (const animal of animals) zones.set(String(animal.zone), (zones.get(String(animal.zone)) ?? 0) + 1);
    return {
        ...body,
        island,
        islands,
        animals,
        nests,
        zones: Array.from(zones, ([key, n]) => ({key, animals: n})).sort((a, b) => b.animals - a.animals || a.key.localeCompare(b.key)),
        counts: {
            animals: animals.length,
            species: new Set(animals.map((animal) => animal.species_profile_id)).size,
            founders: new Set(animals.map((animal) => (animal.brought_by as Raw | undefined)?.label).filter(Boolean)).size
        }
    };
}

/** `voyage_animal_where_v1(animal)`'s answer from a two-island fixture, or null when the id is not aboard. */
export function arkIslandsWhere(raw: unknown, id: string): Raw | null {
    const animal = (((raw as Raw).animals as Raw[] | undefined) ?? []).find((a) => a.id === id);
    if (!animal) return null;
    return {id, status: "present", island: animal.island ?? "wild", area: animal.area ?? null, zone: animal.zone ?? null, enclosure: animal.enclosure ?? null};
}
