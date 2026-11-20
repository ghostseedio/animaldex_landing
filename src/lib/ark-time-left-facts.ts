/**
 * The species facts "Estimated time left" needs and the snapshot does not carry: does its kind eat catalogue animals
 * (only such a kind can starve), what may eat it aboard, and which animals each of those predators may take. All three
 * are one species' place in the food chain, read from `/api/ark/food-chain?species=<slug>` (public species facts, the
 * same for everyone, cached by the CDN for an hour): never anything about one animal, never a user, never a draw.
 *
 * Read lazily, only for an animal whose estimate could depend on them (`arkNeedsFacts`: a wild one while the hunting
 * protection is known, or a hungry one), in one request for its own species and one for each of at most
 * `PREDATORS_READ` predators that live in its region. Any read that fails leaves
 * that fact unknown (the model then skips the factor); nothing is guessed.
 */

import {isArkFoodChainSlug} from "@/lib/ark-food-chain";
import {
    ARK_TIME_LEFT_HOOKS,
    arkLifeOutlook,
    arkNeedsFacts,
    arkTimeLeft,
    arkTimeLeftKind,
    arkTimeLeftRegion,
    type ArkLifeOutlook,
    type ArkTimeLeft,
    type ArkTimeLeftAnimal,
    type ArkTimeLeftFacts,
    type ArkTimeLeftPredator,
    type ArkTimeLeftWorld
} from "@/lib/ark-time-left";

/** Predators whose prey kinds are read (the biggest presence in the animal's region first). */
export const PREDATORS_READ = 4;

export type ArkTimeLeftFetch = (url: string) => Promise<unknown | null>;

type Species = {id?: unknown; slug?: unknown; name?: unknown};
type EntryBody = {
    entry?: {
        species?: Species;
        eats?: Array<{prey?: Species[]}>;
        eatenBy?: Array<{predator?: Species}>;
    };
};

const memo = new Map<string, Promise<unknown | null>>();

/** The browser's fetch, once per URL for the page's life (a failure is not kept). */
export const arkTimeLeftFetch: ArkTimeLeftFetch = (url) => {
    const hit = memo.get(url);
    if (hit) return hit;
    const read = fetch(url)
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null)
        .then((body) => {
            if (body === null) memo.delete(url);
            return body;
        });
    memo.set(url, read);
    return read;
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function entryOf(body: unknown): EntryBody["entry"] | null {
    const entry = (body as EntryBody | null)?.entry;
    return entry && typeof entry === "object" ? entry : null;
}

async function readEntry(slug: string, fetchJson: ArkTimeLeftFetch) {
    if (!isArkFoodChainSlug(slug)) return null;
    return entryOf(await fetchJson(`/api/ark/food-chain?species=${encodeURIComponent(slug)}`));
}

/** The facts for one animal, or null when its own species cannot be read. */
export async function readArkTimeLeftFacts(animal: ArkTimeLeftAnimal, world: ArkTimeLeftWorld, fetchJson: ArkTimeLeftFetch = arkTimeLeftFetch): Promise<ArkTimeLeftFacts | null> {
    const own = await readEntry(animal.model_slug, fetchJson);
    if (!own) return null;
    const eatsAnimals = (own.eats ?? []).some((rule) => (rule.prey ?? []).length > 0);
    const region = arkTimeLeftRegion(animal);
    // The predators aboard that live in its region, with how many of them (a presence is needed for a hazard).
    const present = new Map<string, number>();
    if (region !== null) {
        for (const other of world.animals) if (arkTimeLeftRegion(other) === region) present.set(arkTimeLeftKind(other), (present.get(arkTimeLeftKind(other)) ?? 0) + 1);
    }
    const listed = (own.eatenBy ?? [])
        .map((item) => item.predator)
        .filter((p): p is Species => Boolean(p))
        .map((p) => ({id: str(p.id)?.toLowerCase() ?? null, slug: str(p.slug), name: str(p.name)}))
        .filter((p): p is {id: string; slug: string; name: string} => p.id !== null && p.slug !== null && p.name !== null && (present.get(p.id) ?? 0) > 0)
        .sort((a, b) => (present.get(b.id) ?? 0) - (present.get(a.id) ?? 0) || a.name.localeCompare(b.name))
        .slice(0, PREDATORS_READ);
    const predators: ArkTimeLeftPredator[] = await Promise.all(
        listed.map(async (p): Promise<ArkTimeLeftPredator> => {
            const entry = await readEntry(p.slug, fetchJson);
            const kinds = entry
                ? Array.from(new Set((entry.eats ?? []).flatMap((rule) => (rule.prey ?? []).map((prey) => str(prey.id)?.toLowerCase() ?? "")).filter(Boolean)))
                : null;
            return {id: p.id, slug: p.slug, name: p.name, preyKinds: kinds};
        })
    );
    return {eatsAnimals, predators};
}

/**
 * The estimate for one animal in one go (the Lite page's way, and any caller without React): the facts are read only
 * when the animal's risk could depend on them, and a failed read leaves them out.
 */
export async function arkTimeLeftFor(animal: ArkTimeLeftAnimal, world: ArkTimeLeftWorld, fetchJson: ArkTimeLeftFetch = arkTimeLeftFetch): Promise<ArkTimeLeft | null> {
    const facts = arkNeedsFacts(animal, world) ? await readArkTimeLeftFacts(animal, world, fetchJson).catch(() => null) : null;
    return arkTimeLeft(animal, world, facts, ARK_TIME_LEFT_HOOKS);
}

/** The whole block for one animal (its age, life stage and time left, for any animal), as `arkTimeLeftFor` reads the facts. */
export async function arkLifeOutlookFor(animal: ArkTimeLeftAnimal, world: ArkTimeLeftWorld, fetchJson: ArkTimeLeftFetch = arkTimeLeftFetch): Promise<ArkLifeOutlook | null> {
    const facts = arkNeedsFacts(animal, world) ? await readArkTimeLeftFacts(animal, world, fetchJson).catch(() => null) : null;
    return arkLifeOutlook(animal, world, facts, ARK_TIME_LEFT_HOOKS);
}
