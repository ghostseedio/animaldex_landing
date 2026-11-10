/**
 * Development fixtures for the Ark's edge cases (docs/ark-next.md, part 8),
 * built from the v2 fixture (the server's own answer) so they decode as a
 * live answer would:
 *
 * - `herd1000`: 1,000 Plains Zebras aboard (A14), in the server's clusters of
 *   12 (slot, slot_rank), a few of them the reader's;
 * - `herd5`: 1,000 split over five species (zebra, mallard, herring, goat,
 *   puffin), 200 each;
 * - `placeholder`: species with no Ark model (A13): two with `model_slug:
 *   null, placeholder: true` (a pair) and one whose slug the model set
 *   doesn't list;
 * - `eggs`: egg-layers (A9): `laid` rows, then `birth` rows with
 *   `payload.from_egg`, and the hatched young aboard.
 */

type Row = Record<string, unknown> & {id: string; model_slug: string | null; zone: string; slot?: number | null; slot_rank?: number | null; species_profile_id: string; arrived_at: string};
type Raw = {voyage: Record<string, unknown>; counts: Record<string, number>; zones: Array<{key: string; animals: number}>; animals: Row[]; as_of: string | null};

function uuid(seed: string, n: number): string {
    let h = 2166136261;
    const text = `${seed}#${n}`;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    const hex = (h >>> 0).toString(16).padStart(8, "0");
    const tail = n.toString(16).padStart(12, "0");
    return `${hex}-${hex.slice(0, 4)}-4${hex.slice(5, 8)}-8${hex.slice(1, 4)}-${tail}`;
}

function withCounts(raw: Raw, animals: Row[]): Raw {
    const zones = new Map<string, number>();
    for (const animal of animals) zones.set(animal.zone, (zones.get(animal.zone) ?? 0) + 1);
    return {
        ...raw,
        animals,
        counts: {
            animals: animals.length,
            species: new Set(animals.map((a) => a.species_profile_id || a.model_slug)).size,
            founders: raw.counts.founders ?? 0
        },
        zones: Array.from(zones.entries()).map(([key, count]) => ({key, animals: count}))
    };
}

/** `count` more of a species, in clusters of 12 after the zone's highest slot, the newest last. */
function more(raw: Raw, slug: string, count: number, seed: string, mineEvery = 0): Row[] {
    const template = raw.animals.find((a) => a.model_slug === slug);
    if (!template) return [];
    const top = Math.max(-1, ...raw.animals.filter((a) => a.zone === template.zone).map((a) => a.slot ?? -1));
    const start = Date.parse("2026-09-01T08:00:00Z");
    return Array.from({length: count}, (_, i) => ({
        ...template,
        id: uuid(seed, i),
        arrived_at: new Date(start + i * 3_600_000 * 1.7).toISOString(),
        brought_by: {label: `Voyager ${100 + (i % 400)}`, named: false},
        bringers: [{label: `Voyager ${100 + (i % 400)}`, named: false}],
        mine: mineEvery > 0 && i % mineEvery === 0,
        origin: "arrived",
        generation: 0,
        slot: top + 1 + Math.floor(i / 12),
        slot_rank: i % 12
    }));
}

export function herdFixture(raw: Raw, mode: "herd1000" | "herd5"): Raw {
    const extra = mode === "herd1000"
        ? more(raw, "plains-zebra", 1000 - raw.animals.filter((a) => a.model_slug === "plains-zebra").length, "zebra", 333)
        : ["plains-zebra", "mallard", "atlantic-herring", "domestic-goat", "atlantic-puffin"].flatMap((slug) => more(raw, slug, 200 - raw.animals.filter((a) => a.model_slug === slug).length, slug, 97));
    return withCounts(raw, [...raw.animals, ...extra]);
}

export function placeholderFixture(raw: Raw): Raw {
    const rainforestTop = Math.max(-1, ...raw.animals.filter((a) => a.zone === "rainforest").map((a) => a.slot ?? -1));
    const grassTop = Math.max(-1, ...raw.animals.filter((a) => a.zone === "grassland").map((a) => a.slot ?? -1));
    const base = {
        scientific_name: null,
        brought_by: {label: "Voyager 7", named: false},
        bringers: [{label: "Voyager 7", named: false}],
        mine: false,
        origin: "arrived",
        generation: 0,
        condition: "well_fed",
        born_ark_day: 4,
        activity: "diurnal"
    };
    const extra: Row[] = [
        {...base, id: uuid("saola", 1), species_profile_id: "00000000-0000-4000-8000-0000000a13a1", name: "Saola", model_slug: null, placeholder: true, zone: "rainforest", arrived_at: "2026-11-02T10:00:00Z", sociality: "pair", slot: rainforestTop + 1, slot_rank: 0},
        {...base, id: uuid("saola", 2), species_profile_id: "00000000-0000-4000-8000-0000000a13a1", name: "Saola", model_slug: null, placeholder: true, zone: "rainforest", arrived_at: "2026-11-03T10:00:00Z", sociality: "pair", slot: rainforestTop + 1, slot_rank: 1},
        {...base, id: uuid("missing", 1), species_profile_id: "00000000-0000-4000-8000-0000000a13a2", name: "Test Missing-model Antelope", model_slug: "zz-ark-missing-model-test", zone: "grassland", arrived_at: "2026-11-04T10:00:00Z", sociality: "solitary", slot: grassTop + 1, slot_rank: 0}
    ];
    return withCounts(raw, [...raw.animals, ...extra]);
}

/**
 * Egg-layers: a mallard lays 6 and two hatch; a puffin lays 1 that hasn't
 * hatched yet; a green sea turtle's clutch (laid before the visit) hatches
 * three. The young are aboard (born, their parents' slot), the events are
 * the server's shapes (`laid`, `birth` + `payload.from_egg`).
 */
export function eggsFixture(raw: Raw): {snapshot: Raw; events: {events: unknown[]; next_since: null; more: false; as_of: string}} {
    const mallard = raw.animals.filter((a) => a.model_slug === "mallard").slice(0, 2);
    const puffin = raw.animals.find((a) => a.model_slug === "atlantic-puffin");
    const turtle = raw.animals.find((a) => a.model_slug === "green-sea-turtle");
    const young: Row[] = [];
    const rankAbove = (slot: number | null | undefined, zone: string) => Math.max(-1, ...raw.animals.filter((a) => a.zone === zone && a.slot === slot).map((a) => a.slot_rank ?? -1)) + 1;
    const born = (parent: Row, n: number, at: string, parents: string[]): Row[] => {
        const first = rankAbove(parent.slot, parent.zone);
        return Array.from({length: n}, (_, i) => ({
            ...parent,
            id: uuid(`young-${parent.id}`, i),
            arrived_at: at,
            origin: "born",
            generation: 1,
            mine: false,
            born_ark_day: 250,
            slot: parent.slot,
            slot_rank: first + i,
            bringers: parents.map((id) => (raw.animals.find((a) => a.id === id)?.brought_by ?? {label: "Voyager 1", named: false}))
        }));
    };
    const events: unknown[] = [];
    let serial = 9000;
    const ref = (a: Row, status = "present") => ({id: a.id, species_profile_id: a.species_profile_id, name: a.name, model_slug: a.model_slug, zone: a.zone, arrived_at: a.arrived_at, origin: a.origin, generation: a.generation, slot: a.slot, slot_rank: a.slot_rank, activity: a.activity, sociality: a.sociality, status});
    if (mallard.length === 2) {
        const parents = mallard.map((a) => a.id);
        events.push({id: serial++, kind: "laid", at: "2026-11-09T08:00:00Z", ark_day: 252, species_profile_id: mallard[0].species_profile_id, species: mallard[0].name, animal: ref(mallard[0]), other: ref(mallard[1]), phrase: null, parents, bringers: [], payload: {eggs: 6, parents}});
        const hatched = born(mallard[0], 2, "2026-11-09T20:00:00Z", parents);
        young.push(...hatched);
        for (const y of hatched) events.push({id: serial++, kind: "birth", at: "2026-11-09T20:00:00Z", ark_day: 253, species_profile_id: y.species_profile_id, species: y.name, animal: ref(y), other: null, phrase: null, parents, bringers: y.bringers, payload: {from_egg: true}});
    }
    if (puffin) events.push({id: serial++, kind: "laid", at: "2026-11-10T06:00:00Z", ark_day: 254, species_profile_id: puffin.species_profile_id, species: puffin.name, animal: ref(puffin), other: null, phrase: null, parents: [puffin.id], bringers: [], payload: {eggs: 1}});
    if (turtle) {
        const hatched = born(turtle, 3, "2026-11-10T09:00:00Z", [turtle.id]);
        young.push(...hatched);
        for (const y of hatched) events.push({id: serial++, kind: "birth", at: "2026-11-10T09:00:00Z", ark_day: 255, species_profile_id: y.species_profile_id, species: y.name, animal: ref(y), other: null, phrase: null, parents: [turtle.id], bringers: y.bringers, payload: {from_egg: true}});
    }
    return {snapshot: withCounts(raw, [...raw.animals, ...young]), events: {events, next_since: null, more: false, as_of: "2026-11-10T10:00:00Z"}};
}
