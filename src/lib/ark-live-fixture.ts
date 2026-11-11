/**
 * Development's live feed: what a running server tick would send, made up from the fixture so the live HUD can
 * be seen working while production's tick is off. `/ark?fixture=1&feed=1` (or `?fixture=live`), `?fixture=grow`
 * (its arrivals from the rest of the fixture), `/ark/embed.html?fixture=1` (or `&feed=1` with any `?snapshot=`).
 *
 * Every beat (a few seconds apart in the page) is one thing the server does: arrivals (one more of a lone kind,
 * so it gets its pair; a few of one kind at once; a kind new to the Ark), a pair mating and its litter born, a
 * pair mating and its clutch laid and later hatched, a predator's meal (from the catalogue's food links, never the last of a kind), a death of old age,
 * a predator starved. Each beat gives the next snapshot and the event rows exactly as `voyage_events_since_v1`
 * writes them, so the page decodes them as the live ones. Deterministic: the same beats from the same snapshot.
 *
 * Never in production: the page and the embed only start it in development.
 */

import {eats} from "@/ark-scene/food-links";
import {ZONE_REGION, type ArkAnimal, type ArkSnapshot, type ArkZone} from "@/ark-scene/types";
import {hashString} from "@/ark-scene/world";

type Beat = "pair" | "birth" | "meal" | "laid" | "group" | "death" | "newKind" | "hatch" | "starved";

/** The order the beats come in (about four minutes at the page's pace before it goes round again). */
const BEATS: Beat[] = ["pair", "birth", "meal", "laid", "group", "death", "newKind", "birth", "hatch", "meal", "pair", "starved", "birth", "laid", "group", "meal", "newKind", "hatch", "death", "birth", "pair", "meal", "group", "hatch"];

/** Egg-layers of the fixtures (the server knows from traits; this only needs believable ones). */
const EGG_LAYERS = new Set([
    "mallard", "house-sparrow", "atlantic-puffin", "grey-heron", "scarlet-macaw", "emperor-penguin", "green-sea-turtle", "greater-flamingo", "american-alligator",
    "barn-owl", "golden-eagle", "african-fish-eagle", "red-tailed-hawk", "komodo-dragon", "african-rock-python", "american-bullfrog", "african-clawed-frog", "chicken", "mute-swan", "common-ostrich",
    "house-cricket", "atlantic-herring", "bluefin-tuna", "american-lobster", "acorn-barnacle", "atlantic-trumpetfish"
]);

/** Kinds new to the Ark that the feed brings, when the local model set has them (the fixture's size line-up's). */
const NEW_KINDS: Array<{slug: string; name: string; zone: ArkZone}> = [
    {slug: "giraffe", name: "Giraffe", zone: "grassland"},
    {slug: "greater-flamingo", name: "Greater Flamingo", zone: "wetland"},
    {slug: "red-deer", name: "Red Deer", zone: "woodland"}
];

/** Hunters the feed shows first, in turn (the owner's "a lion caught a zebra"); any other predator after them. */
const HUNTERS = ["african-lion", "eurasian-wolf", "great-white-shark", "snow-leopard", "red-fox", "american-alligator", "barn-owl", "golden-eagle", "cheetah", "polar-bear"];

export type ArkLiveFeedStep = {beat: Beat; snapshot: ArkSnapshot; events: unknown[]};

function speciesKey(animal: ArkAnimal): string {
    return animal.kind_species_profile_id || animal.species_profile_id || `slug:${animal.model_slug}`;
}

function eventAnimal(animal: ArkAnimal, status: "present" | "eaten" | "died_old" | "starved" = "present") {
    return {
        id: animal.id,
        species_profile_id: animal.species_profile_id,
        name: animal.name,
        model_slug: animal.model_slug,
        zone: animal.zone,
        arrived_at: animal.arrived_at,
        origin: animal.origin ?? "arrived",
        generation: animal.generation ?? 0,
        slot: animal.slot ?? null,
        slot_rank: animal.slot_rank ?? null,
        activity: animal.activity ?? null,
        sociality: animal.sociality ?? null,
        status
    };
}

function withCounts(snapshot: ArkSnapshot, animals: ArkAnimal[], at: string): ArkSnapshot {
    const zones = new Map<ArkZone, number>();
    for (const animal of animals) zones.set(animal.zone, (zones.get(animal.zone) ?? 0) + 1);
    return {
        ...snapshot,
        animals,
        as_of: at,
        counts: {animals: animals.length, species: new Set(animals.map(speciesKey)).size, founders: new Set(animals.map((a) => a.brought_by.label)).size},
        zones: Array.from(zones, ([key, count]) => ({key, animals: count}))
    };
}

/**
 * The feed: `next()` is the next beat from the snapshot it was given (or the one passed in, when the page's own
 * snapshot moved on). `pool`: animals still to come aboard (`?fixture=grow`): arrivals take them first.
 */
export class ArkLiveFixtureFeed {
    private step = 0;
    private serial = 900_000;
    private made = 0;
    private meals = 0;
    private readonly clutches: Array<{parents: [ArkAnimal, ArkAnimal]; eggs: number; laidAt: string}> = [];
    private readonly pool: ArkAnimal[];
    private readonly seed: string;

    constructor(private current: ArkSnapshot, options: {pool?: ArkAnimal[] | null; seed?: string} = {}) {
        this.pool = [...(options.pool ?? [])].filter((animal) => !current.animals.some((a) => a.id === animal.id));
        this.seed = options.seed ?? "ark-live-feed";
    }

    get snapshot(): ArkSnapshot {
        return this.current;
    }

    private pick<T>(list: T[], salt: string): T | null {
        if (!list.length) return null;
        return list[hashString(`${this.seed}#${this.step}#${salt}`) % list.length];
    }

    private newId(): string {
        this.made++;
        return `00000000-0000-4000-b000-${String(this.made).padStart(12, "0")}`;
    }

    private row(kind: string, at: string, animal: ArkAnimal | null, extra: Record<string, unknown> = {}): Record<string, unknown> {
        return {id: ++this.serial, kind, at, ark_day: this.current.ark_day ?? null, species_profile_id: animal?.species_profile_id ?? null, species: animal?.name ?? null, animal: animal ? eventAnimal(animal) : null, other: null, phrase: null, parents: [], bringers: [], ...extra};
    }

    /**
     * A pair bred (`mated`, the server's shape: AnimalDex `captures-thrive-design.md` §0), written before its
     * litter or clutch: the first parent as `animal`, the second as `other`, `parents` [both], the pair's `bringers`.
     */
    private mated(at: string, pa: ArkAnimal, pb: ArkAnimal): Record<string, unknown> {
        return {...this.row("mated", at, pa, {parents: [pa.id, pb.id], bringers: [pa.brought_by, pb.brought_by]}), other: eventAnimal(pb)};
    }

    /** One more of a kind already aboard (or a new kind): at its kin's place, the next rank. */
    private another(like: Pick<ArkAnimal, "species_profile_id" | "name" | "model_slug" | "zone"> & Partial<ArkAnimal>, animals: ArkAnimal[], at: string, origin: "arrived" | "born"): ArkAnimal {
        const kin = animals.filter((a) => a.species_profile_id === like.species_profile_id);
        const slot = kin.length ? kin[0].slot ?? 0 : Math.max(-1, ...animals.filter((a) => a.zone === like.zone).map((a) => a.slot ?? -1)) + 1;
        const rank = Math.max(-1, ...kin.filter((a) => (a.slot ?? 0) === slot).map((a) => a.slot_rank ?? 0)) + 1;
        const voyager = {label: `Voyager ${40 + (this.made % 9)}`, named: false};
        return {
            id: this.newId(),
            species_profile_id: like.species_profile_id,
            name: like.name,
            scientific_name: like.scientific_name ?? null,
            model_slug: like.model_slug,
            zone: like.zone,
            arrived_at: at,
            brought_by: voyager,
            mine: false,
            origin,
            generation: origin === "born" ? (like.generation ?? 0) + 1 : 0,
            condition: "well_fed",
            born_ark_day: this.current.ark_day ?? 0,
            activity: like.activity ?? "any",
            sociality: like.sociality ?? "group",
            bringers: [voyager],
            slot,
            slot_rank: rank
        } as ArkAnimal;
    }

    /** The next beat, from `from` (the page's snapshot now) or the feed's own. Null when nothing fits. */
    next(at: Date = new Date(), from?: ArkSnapshot): ArkLiveFeedStep | null {
        if (from) this.current = from;
        for (let tries = 0; tries < BEATS.length; tries++) {
            const beat = BEATS[this.step % BEATS.length];
            const made = this.beat(beat, at.toISOString().replace(/\.\d{3}Z$/, "Z"));
            this.step++;
            if (made) {
                this.current = made.snapshot;
                return {beat, ...made};
            }
        }
        return null;
    }

    private beat(beat: Beat, at: string): {snapshot: ArkSnapshot; events: unknown[]} | null {
        const animals = [...this.current.animals];
        const bySpecies = new Map<string, ArkAnimal[]>();
        for (const animal of animals) {
            const list = bySpecies.get(speciesKey(animal)) ?? [];
            list.push(animal);
            bySpecies.set(speciesKey(animal), list);
        }
        const kinds = Array.from(bySpecies.values()).sort((a, b) => a[0].name.localeCompare(b[0].name));
        const done = (list: ArkAnimal[], events: unknown[]) => ({snapshot: withCounts(this.current, list, at), events});
        switch (beat) {
            case "pair":
            case "group": {
                const many = beat === "group" ? 3 : 1;
                // From the pool first (`?fixture=grow`): the next few, as the server would add them.
                if (this.pool.length) {
                    const coming = this.pool.splice(0, beat === "group" ? 4 : 2).map((animal) => ({...animal, arrived_at: at}));
                    return done([...animals, ...coming], coming.map((animal) => this.row("arrival", at, animal)));
                }
                const lone = kinds.filter((list) => list.length === 1 && !list[0].placeholder);
                const target = beat === "pair" ? this.pick(lone, "pair") ?? this.pick(kinds, "pair") : this.pick(kinds.filter((list) => list.length >= 2 && list.length < 8), "group");
                if (!target) return null;
                const added: ArkAnimal[] = [];
                for (let i = 0; i < many; i++) added.push(this.another(target[0], [...animals, ...added], at, "arrived"));
                return done([...animals, ...added], added.map((animal) => this.row("arrival", at, animal)));
            }
            case "newKind": {
                const fresh = NEW_KINDS.filter((kind) => !animals.some((a) => a.model_slug === kind.slug));
                const kind = fresh[0];
                if (!kind) return null;
                const like = {species_profile_id: `live-${kind.slug}`, name: kind.name, model_slug: kind.slug, zone: kind.zone};
                const animal = this.another(like, animals, at, "arrived");
                return done([...animals, animal], [this.row("arrival", at, animal)]);
            }
            case "birth": {
                const parents = kinds.filter((list) => list.length >= 2 && !EGG_LAYERS.has(list[0].model_slug) && list.length < 10);
                const list = this.pick(parents, "birth");
                if (!list) return null;
                const [pa, pb] = list;
                const litter = 1 + (hashString(`${this.seed}#${this.step}#litter`) % 2);
                const young: ArkAnimal[] = [];
                for (let i = 0; i < litter; i++) young.push(this.another({...pa, generation: Math.max(pa.generation ?? 0, pb.generation ?? 0)}, [...animals, ...young], at, "born"));
                return done([...animals, ...young], [this.mated(at, pa, pb), ...young.map((animal) => this.row("birth", at, animal, {parents: [pa.id, pb.id], bringers: [pa.brought_by, pb.brought_by]}))]);
            }
            case "laid": {
                const layers = kinds.filter((list) => list.length >= 2 && EGG_LAYERS.has(list[0].model_slug) && !this.clutches.some((c) => c.parents[0].id === list[0].id));
                const list = this.pick(layers, "laid");
                if (!list) return null;
                const eggs = 2 + (hashString(`${this.seed}#${this.step}#eggs`) % 3);
                this.clutches.push({parents: [list[0], list[1]], eggs, laidAt: at});
                // The clutch is in the nests (A9), not among the animals: the animals stay as they are.
                return done(animals, [this.mated(at, list[0], list[1]), this.row("laid", at, list[0], {parents: [list[0].id, list[1].id], payload: {eggs, parents: [list[0].id, list[1].id]}})]);
            }
            case "hatch": {
                const clutch = this.clutches.shift();
                if (!clutch) return null;
                const [pa, pb] = clutch.parents;
                if (!animals.some((a) => a.id === pa.id)) return null;
                const young: ArkAnimal[] = [];
                const hatching = Math.max(1, clutch.eggs - 1);
                for (let i = 0; i < hatching; i++) young.push(this.another(pa, [...animals, ...young], at, "born"));
                return done([...animals, ...young], young.map((animal) => this.row("birth", at, animal, {parents: [pa.id, pb.id], payload: {from_egg: true, parents: [pa.id, pb.id]}})));
            }
            case "meal": {
                // A predator aboard and a prey of it in the same region with more than two of its kind (the feed never ends a kind).
                const pairs: Array<[ArkAnimal, ArkAnimal]> = [];
                for (const hunters of kinds) {
                    for (const prey of kinds) {
                        if (prey === hunters || prey.length < 3 || ZONE_REGION[prey[0].zone] !== ZONE_REGION[hunters[0].zone]) continue;
                        if (eats(hunters[0].model_slug, prey[0].model_slug)) pairs.push([hunters[0], prey[prey.length - 1]]);
                    }
                }
                const rank = (slug: string) => (HUNTERS.includes(slug) ? HUNTERS.indexOf(slug) : HUNTERS.length);
                pairs.sort((a, b) => rank(a[0].model_slug) - rank(b[0].model_slug) || a[0].name.localeCompare(b[0].name) || a[1].name.localeCompare(b[1].name));
                const pair = pairs.length ? pairs[this.meals++ % pairs.length] : null;
                if (!pair) return null;
                const [predator, prey] = pair;
                return done(animals.filter((a) => a.id !== prey.id), [
                    {...this.row("meal", at, predator), other: eventAnimal(prey, "eaten")},
                    {...this.row("eaten", at, prey), animal: eventAnimal(prey, "eaten"), other: eventAnimal(predator)}
                ]);
            }
            case "death":
            case "starved": {
                const candidates = kinds.filter((list) => list.length >= 3 && (beat === "death" || pairsWithPrey(list[0].model_slug, kinds)));
                const list = this.pick(candidates, beat);
                if (!list) return null;
                const oldest = [...list].sort((a, b) => a.arrived_at.localeCompare(b.arrived_at))[0];
                const status = beat === "death" ? "died_old" : "starved";
                return done(animals.filter((a) => a.id !== oldest.id), [{...this.row(beat === "death" ? "death_old" : "starved", at, oldest), animal: eventAnimal(oldest, status)}]);
            }
        }
    }
}

/** A predator: some kind aboard is its prey. */
function pairsWithPrey(slug: string, kinds: ArkAnimal[][]): boolean {
    return kinds.some((list) => list[0].model_slug !== slug && eats(slug, list[0].model_slug));
}
