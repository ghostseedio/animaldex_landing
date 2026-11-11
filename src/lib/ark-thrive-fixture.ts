/**
 * Development's captures + thrive (`/ark?fixture=1` and the other fixture
 * modes): the fixture Ark as the server answers it under the frozen read
 * contract (AnimalDex `docs/ark/captures-thrive-design.md` section 0), so the
 * tap card's condition, family line and "Came aboard with a capture" can be
 * seen without a server change. Made up, deterministic by animal id; no
 * production data.
 *
 * - every animal: `thrive` (about 1 in 8 prime, 1 in 4 good, the rest
 *   ordinary; the born at most good, as inheritance allows), `area` (pets of
 *   the home region in the house, livestock on the farm), and `source` (the
 *   fixture's two earliest arrivals a step's, as the real first two were;
 *   every later one a capture's; the born none);
 * - every life story: the same `thrive` (none once it has died), `area`,
 *   `origin.source`, and `lineage` counted from the fixture's own parent
 *   links, plus one showcase line ("2 young, 1 grandchild · 2 alive now") on
 *   the African Lion that Voyager 1 brought.
 */

import type {ArkThrive} from "@/ark-scene/types";
import {ARK_FIXTURE_STORY_ANIMAL} from "@/lib/ark-founders-fixture";

type Raw = Record<string, unknown>;

/** A stable 0–1 from an id (FNV-1a), so every refresh draws the same bands. */
function unit(id: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < id.length; i++) {
        hash ^= id.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash / 0x100000000;
}

const HOUSE = /(^|-)(cat|dog|budgerigar|budgie|parakeet|canary|goldfish|betta|hamster|guinea-pig|rabbit|cockatiel|gecko)(-|$)/;
const FARM = /(^|-)(goat|chicken|cow|cattle|sheep|pig|duck|goose|horse|donkey|turkey|alpaca|llama|koi)(-|$)/;

function thriveFor(id: string, born: boolean): ArkThrive {
    const at = unit(`thrive:${id}`);
    if (born) return at < 0.3 ? "good" : "ordinary";
    return at < 0.12 ? "prime" : at < 0.37 ? "good" : "ordinary";
}

function areaFor(zone: unknown, slug: unknown): "house" | "farm" | null {
    if (zone !== "farm_garden" || typeof slug !== "string") return null;
    return HOUSE.test(slug) ? "house" : FARM.test(slug) ? "farm" : null;
}

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

/** The two earliest arrivals (by `arrived_at`, then id): a step's. */
function stepArrivals(animals: Raw[]): Set<string> {
    return new Set(animals
        .filter((animal) => animal.origin !== "born")
        .sort((a, b) => String(a.arrived_at).localeCompare(String(b.arrived_at)) || String(a.id).localeCompare(String(b.id)))
        .slice(0, 2)
        .map((animal) => String(animal.id)));
}

/** A `voyage_public_v2` fixture answer with the contract's `thrive`, `area` and `source` on every animal. */
export function withArkThriveFixture<T>(raw: T): T {
    const copy = clone(raw) as unknown as Raw;
    const animals = Array.isArray(copy.animals) ? copy.animals as Raw[] : [];
    const steps = stepArrivals(animals);
    for (const animal of animals) {
        const id = String(animal.id);
        const born = animal.origin === "born";
        animal.thrive = thriveFor(id, born);
        animal.area = areaFor(animal.zone, animal.model_slug);
        animal.source = born ? null : steps.has(id) ? "step" : "capture";
    }
    return copy as unknown as T;
}

type Lineage = {young: number; grandchildren: number; later: number; living: number};

/** Every animal's descendants from the fixture's parent links (the life stories' `origin.parents`), by generation. */
function lineageTree(lives: Record<string, Raw>): Map<string, Lineage> {
    const children = new Map<string, string[]>();
    for (const [id, life] of Object.entries(lives)) {
        const origin = life.origin as Raw | undefined;
        const parents = origin?.kind === "born" && Array.isArray(origin.parents) ? origin.parents as string[] : [];
        for (const parent of parents) children.set(parent, [...(children.get(parent) ?? []), id]);
    }
    const out = new Map<string, Lineage>();
    for (const id of Object.keys(lives)) {
        const line: Lineage = {young: 0, grandchildren: 0, later: 0, living: 0};
        const seen = new Set<string>();
        let generation = [id];
        for (let depth = 1; generation.length && depth < 12; depth++) {
            const next = generation.flatMap((parent) => children.get(parent) ?? []).filter((child) => !seen.has(child));
            next.forEach((child) => seen.add(child));
            if (depth === 1) line.young += next.length;
            else if (depth === 2) line.grandchildren += next.length;
            else line.later += next.length;
            line.living += next.filter((child) => lives[child]?.status === "present").length;
            generation = next;
        }
        out.set(id, line);
    }
    return out;
}

/** The fixture's life stories (`voyage_animal_life_v1` by id) with the contract's `thrive`, `area`, `origin.source` and `lineage`. */
export function withArkThriveFixtureLives(lives: Record<string, unknown>, snapshot: unknown): Record<string, unknown> {
    const copy = clone(lives) as Record<string, Raw>;
    const animals = new Map(((snapshot as Raw | null)?.animals as Raw[] | undefined ?? []).map((animal) => [String(animal.id), animal]));
    const steps = stepArrivals(Array.from(animals.values()));
    const tree = lineageTree(copy);
    for (const [id, life] of Object.entries(copy)) {
        const origin = (life.origin ?? {}) as Raw;
        const born = origin.kind === "born";
        const animal = animals.get(id);
        life.thrive = life.died ? null : (animal?.thrive as ArkThrive | undefined) ?? thriveFor(id, born);
        life.area = animal?.area ?? areaFor(animal?.zone, life.model_slug);
        if (!born) life.origin = {...origin, source: steps.has(id) ? "step" : "capture"};
        life.lineage = id === ARK_FIXTURE_STORY_ANIMAL ? {young: 2, grandchildren: 1, later: 0, living: 2} : tree.get(id) ?? {young: 0, grandchildren: 0, later: 0, living: 0};
    }
    return copy;
}
