/**
 * Carers (AnimalDex decision 418, lane ARK-CARERS; the server's `docs/ark/carers.md`): a kept animal is fed only by a
 * carer aboard: a pet by its household's owner, a farm animal by a farmer, a zoo animal by a keeper. Carers come with the
 * place, so every home, pen and enclosure with a kept animal has one. They are GENERIC figures (owner's rule): a body
 * and clothes from a hash of the carer's own post (never anyone's photo, face or name), never a capture, never counted as
 * a human aboard, and drawn only while the server's `carers` switch is on (`/api/ark/carers`).
 *
 * This file is the per-frame part (the scene's own chunk): where each carer is at an island hour. The posts themselves (a
 * keeper's spot at each enclosure's hatch, a farmer's at each pen's trough, an owner's at each tank, cage or garden) are
 * the town's (`islands/town/carer-posts.ts`, loaded with the town). A pure function of the hour and the posts: every
 * viewer sees the same carer at the same moment.
 *
 * - Keepers: a feeding round at each of their enclosures' feeding times (the food goes down at the hatch then, and the
 *   residents come to it: `zoo-life.ts`), one enclosure after the next within the feed, and a morning round (mucking
 *   out) from 7:30.
 * - Farmers: the morning and evening feeds (7:00 and 16:30), pen after pen of their round at its trough.
 * - Owners: a morning and an evening feed at their own hour (from 7:00 and from 18:00), bowl, tank and cage in turn.
 * Each visit: a few steps in carrying the food (`carry`), bent to put it down (`plant`), then a moment watching (`stand`).
 */

import {humanLook, type HumanInstance, type HumanLook} from "@/ark-scene/humans/figures";

export type CarerKind = "owner" | "farmer" | "keeper";

/** One visit's place: town frame (x east, z south), the way the carer faces, and the floor's height near (null: ground). */
export type CarerPost = {
    /** The carer (a keeper's section, a farmer's round, a home): their look's seed. */
    carer: string;
    kind: CarerKind;
    x: number;
    z: number;
    yaw: number;
    /** A raised floor near this height (a balcony's display): the drawn floor nearest it. Null: the ground. */
    near: number | null;
    /** When the visit starts (island hours, 0–24) and how long it lasts (hours). */
    visits: ReadonlyArray<readonly [number, number]>;
};

/** A drawn carer (world frame). */
export type DrawnCarer = HumanInstance & {carer: string; kind: CarerKind};

/**
 * Of a visit: walking in with the food, then at the work. The rigged body follows the pose (people-rig `personFor`:
 * "carry" and "plant" are the work clothes, hi-vis and helmet; "carry" walks), so a keeper or farmer carries the food in
 * and stays bent at the hatch or trough (no pop to casual clothes); an owner walks in and stands by the pet in their own
 * clothes.
 */
const WALK_SHARE = 0.25;
/** How far back the carer starts the walk in (m). */
const WALK_IN = 3.2;

const looks = new Map<string, HumanLook>();
function lookOf(carer: string): HumanLook {
    let look = looks.get(carer);
    if (!look) looks.set(carer, (look = humanLook(`carer|${carer}`)));
    return look;
}

/**
 * The carers at work at island hour `hours` (0–24), in the world frame (`origin`: the town's), standing on `height`
 * (world x, z, and the floor near, or undefined). Written into `out` (cleared first); only the few at work are made (the
 * looks are kept per carer).
 */
export function carersAt(posts: readonly CarerPost[], hours: number, origin: {x: number; z: number}, height: (x: number, z: number, near?: number) => number, out: DrawnCarer[] = []): DrawnCarer[] {
    out.length = 0;
    const busy = new Set<string>();
    for (const post of posts) {
        if (busy.has(post.carer)) continue;
        for (const [start, span] of post.visits) {
            const k = (hours - start) / span;
            if (!(k >= 0 && k < 1)) continue;
            busy.add(post.carer);
            const walking = k < WALK_SHARE;
            const back = walking ? WALK_IN * (1 - k / WALK_SHARE) : 0;
            const x = post.x - Math.sin(post.yaw) * back + origin.x;
            const z = post.z - Math.cos(post.yaw) * back + origin.z;
            out.push({
                carer: post.carer,
                kind: post.kind,
                x,
                y: height(x, z, post.near ?? undefined),
                z,
                yaw: post.yaw,
                pose: post.kind === "owner" ? (walking ? "walk" : "stand") : walking ? "carry" : "plant",
                phase: (start * 997) % 7,
                look: lookOf(post.carer)
            });
            break;
        }
    }
    return out;
}

/**
 * A round's visits: `spots` visited in turn from `start`, the whole round taking `span` hours (each spot its share), at
 * every start in `starts`. Returns each spot's visits.
 */
export function roundVisits(spots: number, starts: readonly number[], span: number): Array<Array<readonly [number, number]>> {
    const each = span / Math.max(1, spots);
    return Array.from({length: spots}, (_, i) => starts.map((s) => [s + i * each, each] as const));
}
