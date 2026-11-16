/**
 * Climbing a wall or a trunk the way a lizard does (the owner, 2026-11-16, on the live Ark: "can you check lizards
 * that climb up walls, they're not climbing flat on the wall instead they're angled like they're walking on the
 * ground not the wall").
 *
 * Two things drew a wall climber upright, belly to the world's floor, out in the air beside its wall:
 * - the town's wall places (`islands/town/areas.ts` lamp_wall: "house geckos hunt moths there at night", the home of
 *   every town gecko, wall lizard and garden lizard) carried the ground's normal (up), so the schedule's spot, its
 *   climb and its stay there said "on flat ground" 2.4 m up a house wall, 5 cm out from it;
 * - a climb leg (`behaviour-schedule.ts` legPose "surface") was one straight line from its foot on the ground to the
 *   spot on the wall, its normal blended from up to the wall's along it: a diagonal ramp through the air, the body
 *   pitched half way between the ground and the wall.
 *
 * Here: the wall places' outward normal (`wallNormal`), and a climb between the ground and a steep surface as the
 * animal does it (`wallClimbAt`): along the ground to the foot of the wall, then up the wall itself with its belly to
 * it, the turn from one to the other over a short corner. Down the same the other way, head first. Pure in its inputs:
 * the same for every viewer.
 */

export type ClimbEnd = {x: number; y: number; z: number; nx: number; ny: number; nz: number};

export type ClimbPose = {
    x: number;
    y: number;
    z: number;
    /** The surface's normal now (the body's up). */
    nx: number;
    ny: number;
    nz: number;
    /** Its heading on the ground part (radians, the scene's yaw: atan2(dx, dz)). */
    yaw: number;
    /** On the wall part (the normal more across than up). */
    onWall: boolean;
    /** Going down: on the wall it heads down it (head first), not up. */
    down: boolean;
};

/** A surface this steep or steeper (its normal's up part under this) is climbed as a wall: a house wall, a trunk, a rock face. */
export const STEEP_NY = 0.5;
/** A surface this flat or flatter is walked as ground. */
export const FLAT_NY = 0.9;
/** The most of the corner from the ground onto the wall (m) the body turns over, each side of the corner. */
export const CORNER = 0.12;
/** How far out of a house wall's face a place on it is (m): the boards' skin, so the body is on it, not in it (as `micro.ts` WALL_SKIN). */
export const WALL_SKIN = 0.012;

const smooth = (t: number) => {
    const k = Math.min(Math.max(t, 0), 1);
    return k * k * (3 - 2 * k);
};

/**
 * A surface this near upright (its normal's up part under this) is climbed straight up from its foot: a house wall, a
 * trunk, a sheer face. A sloping rock face (up to STEEP_NY) keeps its straight climb from a foot out from it: straight
 * up from under its spot would go into the rock bulging below it.
 */
export const UPRIGHT_NY = 0.2;

/** Whether a climb leg is between the ground and a wall (or a trunk, a sheer face): the one `wallClimbAt` draws. */
export function wallClimb(from: {ny: number}, to: {ny: number}): boolean {
    return (Math.abs(to.ny) < UPRIGHT_NY && from.ny > FLAT_NY) || (Math.abs(from.ny) < UPRIGHT_NY && to.ny > FLAT_NY);
}

/** The outward normal (unit, level) of a building's wall that faces local +z, for a building turned by `rot` (`town/geom.ts` local). */
export function wallNormal(rot: number): {x: number; z: number} {
    return {x: -Math.sin(rot), z: Math.cos(rot)};
}

/**
 * Where a climber is at `u` (0..1) of its climb between a ground spot and a wall spot (either way round): along the
 * ground from its ground end to the foot of the wall under the wall spot, then straight up (or down) the wall, its body's
 * up the wall's normal there, turning from one to the other over CORNER each side of the corner. `groundAtWall` is the
 * ground's height at the wall's foot. The path's length is the leg's own (`hypot(dx, dz) + |dy|`), so its time is unchanged.
 */
export function wallClimbAt(from: ClimbEnd, to: ClimbEnd, u: number, groundAtWall: number): ClimbPose {
    const down = Math.abs(from.ny) < STEEP_NY;
    const wall = down ? from : to;
    const ground = down ? to : from;
    const wl = Math.hypot(wall.nx, wall.ny, wall.nz) || 1;
    const wn = {x: wall.nx / wl, y: wall.ny / wl, z: wall.nz / wl};
    // The corner: under the wall spot, at the ground's height there (never above the spot itself).
    const corner = {x: wall.x, y: Math.min(groundAtWall, wall.y), z: wall.z};
    const h = Math.hypot(corner.x - ground.x, corner.z - ground.z);
    const v = Math.abs(wall.y - corner.y);
    const total = h + v;
    // Distance travelled from the ground end (a climb down runs the same path backwards).
    const k = Math.min(Math.max(u, 0), 1);
    const s = (down ? 1 - k : k) * total;
    // The ground part faces the wall (up) or away from it (down); straight at the wall when it starts at its foot.
    const toward = h > 0.01 ? Math.atan2(corner.x - ground.x, corner.z - ground.z) : Math.atan2(-wn.x, -wn.z);
    const yaw = down ? toward + Math.PI : toward;
    let x: number;
    let y: number;
    let z: number;
    if (s < h) {
        const t = h > 0 ? s / h : 1;
        x = ground.x + (corner.x - ground.x) * t;
        y = ground.y + (corner.y - ground.y) * t;
        z = ground.z + (corner.z - ground.z) * t;
    } else {
        x = wall.x;
        z = wall.z;
        y = corner.y + Math.sign(wall.y - corner.y) * (s - h);
    }
    // The turn at the corner, over at most CORNER either side of it (and never more than half of either part).
    const b = Math.max(Math.min(CORNER, h / 2, v / 2), 1e-4);
    const w = smooth((s - h + b) / (2 * b));
    let nx = wn.x * w;
    let ny = (1 - w) + wn.y * w;
    let nz = wn.z * w;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl;
    ny /= nl;
    nz /= nl;
    return {x, y, z, nx, ny, nz, yaw, onWall: Math.abs(ny) < STEEP_NY, down};
}

/** The id suffix of a town eave's second place, on the wall's face under it (`islands/town/sampler.ts`). */
export const WALL_FACE = ":face";

/**
 * Whether a place suits a climber or a flyer where an eave offers two (a goal's pick, `behaviour-schedule.ts`): a
 * climber (a gecko, a wall lizard, a spider) goes up the wall to the face under the eave, never straight up through the
 * air onto the roof's edge; a flyer keeps the eave's own place on the roof, never the face (so a bird's goals are the
 * ones they were). Every other place suits both.
 */
export function wallPlaceSuits(point: {id: string; tag: string; ny: number}, climber: boolean): boolean {
    if (point.id.endsWith(WALL_FACE)) return climber;
    if (climber && point.tag === "house_wall" && point.ny > FLAT_NY && point.id.startsWith("town:eave:")) return false;
    return true;
}

/** The way a climber heads on a wall: up it, or down it head first. */
export function wallHeading(down: boolean): {x: number; y: number; z: number} {
    return {x: 0, y: down ? -1 : 1, z: 0};
}
