/**
 * Where the town's kept water animals and indoor pets live, and how they move there (lane TB: "aquarium animals can't be
 * seen", "domestic animals not showing in people's homes"). Pure and shared, in the town's local frame: the same for
 * every viewer, from the plan, the animal and the island clock alone.
 *
 * - **The zoo's houses** (`zooHouseFrame`): the aquarium, the reptile, insect and nocturnal houses and the primate
 *   house stand on a floor 0.25 m over the highest ground under them; their walls, a glass front and a roof that is cut
 *   away when the camera comes close are `render/zoo-houses.ts`.
 * - **The aquarium's tanks** (`aquariumTanks`): an ocean tank and a river tank across the back, three fresh and three
 *   reef tanks down the sides, a jellyfish column in the middle. Every aquarium resident has its tank (`aquariumTankOf`:
 *   jellyfish to the column, the big to the back by their water, the rest by their water to a side tank), and swims in
 *   it at its own depth band (`tankPose`), never through the glass.
 * - **Pets kept indoors at home** (`homeKeeping`): water pets in a tank, caged birds and small rodents in a cage,
 *   reptiles, amphibians and kept invertebrates in a vivarium, each household's on a stand in a glass garden room on
 *   the back of its house or terrace home, or on its flat's balcony (or patio on the ground floor): `homeSite`. Koi,
 *   goldfish, terrapins and pond frogs at a house live in a raised garden pond. Every site is the plan's alone (drawn
 *   only where someone lives in it), so nobody's spot moves when a pet arrives.
 * - **Big livestock routed to a home** (horses, cattle, donkeys, pigs, llamas) is kept at a farm's paddock (livery).
 */

import {corners, hashText, inBox, local, sub, toLocal, type Box, type Pt} from "@/ark-scene/islands/town/geom";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {townPlan, type Building, type Parcel, type TownPlan} from "@/ark-scene/islands/town/plan";
import {townHouseholds, type Household, type ZooEnclosure} from "@/ark-scene/islands/town/areas";
import {fitInWater, speciesDepth, swimRange, bandCycle, breathAt, waterMotion, type DepthBand, type SpeciesDepth, type WaterSpec} from "@/ark-scene/sea-depth";

// MARK: - Tanks

export type TankKind = "salt" | "fresh";
export type TankForm = "ocean" | "river" | "reef" | "fresh" | "jelly" | "home" | "pond";

/** A body of water a kept animal swims in: its inner box (the water's), turned `rot` like a town box. */
export type Tank = {
    id: string;
    kind: TankKind;
    form: TankForm;
    x: number;
    z: number;
    rot: number;
    /** Inner water extent across (its local x) and along (its local z), m. */
    w: number;
    d: number;
    /** The sand's or gravel's top (m), and the water's surface. */
    floor: number;
    top: number;
};

export function tankBox(t: Tank): Box {
    return {x: t.x, z: t.z, w: t.w, d: t.d, rot: t.rot};
}

// MARK: - The zoo's houses

export const ZOO_HOUSE_TYPES = new Set(["aquarium", "reptile_house", "insect_house", "nocturnal_house", "primate_house"]);

/** A zoo house's frame: its footprint (the slot less 0.2 m a side), its floor's height, its walls' height. */
export type ZooHouseFrame = {box: Box; floor: number; height: number; /** Inside the walls (the front glass at the box's +z less `PORCH`). */ inner: Box};

/** The covered strip in front of the glass (m): the visitors' porch under the canopy. */
export const ZOO_HOUSE_PORCH = 1.2;
/** The walls' thickness (m). */
export const ZOO_HOUSE_WALL = 0.3;

export function zooHouseFrame(e: Pick<ZooEnclosure, "slot" | "type">): ZooHouseFrame {
    const s = e.slot.at;
    const box: Box = {x: s.x, z: s.z, w: s.w - 0.4, d: s.d - 0.4, rot: s.rot};
    let high = townHeight(s.x, s.z);
    for (const c of corners(s)) high = Math.max(high, townHeight(c.x, c.z));
    const floor = high + 0.25;
    const height = e.type === "primate_house" ? 7 : 5.2;
    const inside = box.d - ZOO_HOUSE_PORCH - ZOO_HOUSE_WALL * 2;
    const inner = sub(box, 0, -ZOO_HOUSE_PORCH / 2, box.w - ZOO_HOUSE_WALL * 2, inside);
    return {box, floor, height, inner};
}

/** The aquarium's tanks for one open aquarium enclosure (local frame of the town). */
export function aquariumTanks(e: Pick<ZooEnclosure, "slot" | "type" | "id">): Tank[] {
    const f = zooHouseFrame(e);
    const b = f.inner;
    const w = b.w;
    const d = b.d;
    const out: Tank[] = [];
    const add = (id: string, kind: TankKind, form: TankForm, lx: number, lz: number, tw: number, td: number, floor: number, top: number) => {
        const p = local(b, lx, lz);
        out.push({id: `${e.id}:${id}`, kind, form, x: p.x, z: p.z, rot: b.rot, w: tw, d: td, floor: f.floor + floor, top: f.floor + top});
    };
    // Across the back: the ocean tank and the river tank, deep and tall.
    const backD = Math.min(7.2, d * 0.36);
    const backZ = -d / 2 + 0.25 + backD / 2;
    const usable = w - 0.5;
    const oceanW = usable * 0.6 - 0.25;
    const riverW = usable * 0.4 - 0.25;
    add("ocean", "salt", "ocean", -usable / 2 + oceanW / 2, backZ, oceanW, backD, 0.35, Math.min(f.height - 1.0, 4.1));
    add("river", "fresh", "river", usable / 2 - riverW / 2, backZ, riverW, backD, 0.35, Math.min(f.height - 1.2, 3.6));
    // Down the sides: three fresh tanks on the left, three reef tanks on the right, on stands.
    const sideW = Math.min(3.0, w * 0.2);
    const sideFrom = backZ + backD / 2 + 1.4;
    const sideTo = d / 2 - 0.6;
    const n = 3;
    const each = (sideTo - sideFrom - 0.6 * (n - 1)) / n;
    for (let k = 0; k < n; k++) {
        const z = sideFrom + each / 2 + k * (each + 0.6);
        add(`fresh${k}`, "fresh", "fresh", -w / 2 + 0.25 + sideW / 2, z, sideW, each, 0.75, 2.3);
        add(`reef${k}`, "salt", "reef", w / 2 - 0.25 - sideW / 2, z, sideW, each, 0.75, 2.3);
    }
    // The jellyfish column in the middle of the hall.
    add("jelly", "salt", "jelly", 0, (sideFrom + sideTo) / 2, 1.6, 1.6, 0.6, 3.4);
    return out;
}

/** A water species' water: its band's, else by its kind (marine plans and words salt, the rest fresh). */
export function waterOf(slug: string, zone: string): TankKind {
    const depth = speciesDepth(slug, zone);
    if (depth) return depth.water;
    return /shark|ray|sawfish|dugong|manatee|sea-|reef|coral|horseshoe|octopus|squid|jelly|lobster|wrasse|tang|grouper|snapper|puffer|eel/.test(slug) ? "salt" : "fresh";
}

const JELLY = /jelly|(^|-)medusa/;

/** An aquarium resident's tank: rendezvous among the tanks that suit it (the same for every viewer, never moved by others). */
export function aquariumTankOf(animal: {id: string; model_slug: string; zone: string}, length: number, tanks: readonly Tank[]): Tank | null {
    if (!tanks.length) return null;
    const slug = animal.model_slug;
    const kind = waterOf(slug, animal.zone);
    const fits = (t: Tank) => length + 0.3 < Math.min(t.w, t.d) * 1.6 && length * 0.4 < t.top - t.floor;
    let list: Tank[];
    if (JELLY.test(slug)) list = tanks.filter((t) => t.form === "jelly");
    else if (length >= 0.95) list = tanks.filter((t) => (t.form === "ocean" || t.form === "river") && t.kind === kind);
    else list = tanks.filter((t) => (t.form === "reef" || t.form === "fresh") && t.kind === kind && fits(t));
    if (!list.length) list = tanks.filter((t) => t.kind === kind && fits(t));
    if (!list.length) list = tanks.filter((t) => t.form === "ocean" || t.form === "river");
    let best: Tank | null = null;
    let score = -1;
    for (const t of list) {
        const s = hashText(`${animal.id}|${t.form}|${t.id.slice(t.id.indexOf(":") + 1)}`);
        if (s > score) {
            score = s;
            best = t;
        }
    }
    return best;
}

// MARK: - Swimming in a tank

/** How a kept water animal moves in its tank: a swimmer's loop, a bottom-walker's slow round, a hole-dweller still. */
export type TankMotion = "swim" | "walk" | "hole" | "float";

/** Its band in a tank: its species' own, else by its body (turtles swim mid-water, crabs and axolotls walk the floor). */
export function tankDepth(slug: string, zone: string, plan: string | null): SpeciesDepth {
    const own = speciesDepth(slug, zone);
    if (own) return own;
    const band: DepthBand = plan === "frog" ? "pond_surface" : plan === "arthropod" || plan === "slow_invertebrate" || /axolotl|salamander|newt/.test(slug) ? "pond_bed" : plan === "turtle" ? "pond_mid" : "pond_mid";
    return {band, water: waterOf(slug, zone), home: "zone", breathes: plan === "turtle" || plan === "frog", crevice: false, deepFloor: false, glow: false, reason: "a kept animal in its tank (lane TB)", source: "default"};
}

export type TankPose = {x: number; z: number; yaw: number; pitch: number; base: number; spec: WaterSpec; motion: TankMotion};

const FISHLIKE = new Set(["fish", "ray", "eel", "flatfish", "cetacean", "jellyfish", "cephalopod", "turtle"]);

function unit(id: string, salt: string): number {
    return (hashText(`${id}#${salt}`) % 100000) / 100000;
}

/**
 * Its pose in its tank at a clock (s): a loop inside the tank's water (kept a body length's margin from the glass),
 * at its band's depth in the tank's own column (`fitInWater` with the tank's surface), up for air on a breath.
 * `height`: its drawn body height (m), `length` its drawn length (m), `plan` its body plan.
 */
export function tankPose(tank: Tank, animal: {id: string; model_slug: string; zone: string}, length: number, height: number, plan: string | null, clock: number): TankPose {
    const id = animal.id;
    const depth = tankDepth(animal.model_slug, animal.zone, plan);
    let motion: TankMotion = waterMotion(depth);
    // (A fish of the floor, a sturgeon or a sawfish, swims along the sand rather than walking it.)
    if (motion === "walk" && FISHLIKE.has(plan ?? "")) motion = "swim";
    const seed = unit(id, "seed");
    const c = Math.cos(tank.rot);
    const s = Math.sin(tank.rot);
    const toWorld = (lx: number, lz: number): Pt => ({x: tank.x + lx * c - lz * s, z: tank.z + lx * s + lz * c});
    // The loop: inside the water less a margin (half a body and a little), each animal its own size and centre.
    const margin = Math.min(0.08 + length * 0.55, Math.min(tank.w, tank.d) / 2 - 0.02);
    const roomX = Math.max(tank.w / 2 - margin, 0.01);
    const roomZ = Math.max(tank.d / 2 - margin, 0.01);
    const share = motion === "swim" ? 0.55 + 0.45 * unit(id, "loop") : motion === "float" ? 0.3 + 0.4 * unit(id, "loop") : 0.15 + 0.35 * unit(id, "loop");
    // (A body as long as the tank is wide keeps to its long axis, up and back along it, turning at the ends.)
    const long = length > Math.min(tank.w, tank.d) - 0.12;
    const a = long ? (tank.w >= tank.d ? Math.max(tank.w / 2 - length / 2 - 0.04, 0) : 0) : roomX * share;
    const b = long ? (tank.w >= tank.d ? 0 : Math.max(tank.d / 2 - length / 2 - 0.04, 0)) : roomZ * share;
    const ox = long ? 0 : (roomX - a) * (unit(id, "ox") * 2 - 1);
    const oz = long ? 0 : (roomZ - b) * (unit(id, "oz") * 2 - 1);
    const pace = motion === "swim" ? Math.min(Math.max(0.08 + 0.28 * length, 0.05), 0.55) * (0.7 + 0.6 * unit(id, "pace")) : motion === "float" ? 0.04 : motion === "walk" ? 0.025 : 0;
    const radius = Math.max((a + b) / 2, 0.02);
    const dir = unit(id, "dir") < 0.5 ? -1 : 1;
    const angle = seed * Math.PI * 2 + (dir * pace * clock) / radius;
    let lx = ox + Math.cos(angle) * a;
    let lz = oz + Math.sin(angle) * b;
    // Heading along the loop (models face +z: forward is (sin yaw, cos yaw)).
    let tx = -Math.sin(angle) * a * dir;
    let tz = Math.cos(angle) * b * dir;
    if (long) {
        // Along the long axis, facing the way it goes (it turns where it stops, at the ends).
        const along = Math.sin(angle) * dir;
        lx = tank.w >= tank.d ? Math.cos(angle) * a : 0;
        lz = tank.w >= tank.d ? 0 : Math.cos(angle) * b;
        tx = tank.w >= tank.d ? -along || 1 : 0;
        tz = tank.w >= tank.d ? 0 : -along || 1;
    }
    if (motion === "hole") {
        // In its corner on the sand, its head turning slowly.
        lx = (tank.w / 2 - margin) * (unit(id, "cx") < 0.5 ? -1 : 1);
        lz = -(tank.d / 2 - margin);
        const look = Math.sin(clock * 0.2 + seed * 9) * 0.6;
        tx = Math.sin(look);
        tz = Math.cos(look);
    }
    const p = toWorld(lx, lz);
    const fx = tx * c - tz * s;
    const fz = tx * s + tz * c;
    const yaw = Math.atan2(fx, fz);
    // How deep: its band in this tank's column, its slow swim up and down it, a breath to the surface.
    const water = Math.max(tank.top - tank.floor, 0.05);
    const breath = depth.breathes ? breathAt(seed, clock) : 0;
    let spec: WaterSpec;
    if (motion === "swim") {
        const range = depth.band === "seabed" || depth.band === "pond_bed" ? {from: 0.04, to: Math.min(0.25, water * 0.25), aboveFloor: true} : swimRange(depth.band, water);
        const u = bandCycle(seed, clock);
        spec = {motion: "swim", floorY: tank.floor, depth: range.from + (range.to - range.from) * u, aboveFloor: Boolean(range.aboveFloor), breath, surface: tank.top};
    } else {
        spec = {motion: motion === "hole" ? "hole" : motion, floorY: tank.floor, depth: 0, aboveFloor: false, breath, surface: tank.top};
    }
    const fitted = fitInWater(spec, height);
    // (A gentle pitch only while it changes depth; level otherwise.)
    return {x: p.x, z: p.z, yaw, pitch: 0, base: fitted.base, spec, motion};
}

// MARK: - Pets kept at home

/** How a pet routed to a home is kept: outdoors, in a tank, a pond, a cage or a vivarium, or at a farm (livery). */
export type HomeKeeping = "outdoors" | "tank" | "pond" | "cage" | "vivarium" | "livery";

const POND = /(^|-)koi(-|$)|goldfish|golden-orfe|(^|-)tench|shubunkin|red-eared-slider|terrapin|pond-slider|cooter|marsh-frog|pond-frog|edible-frog|common-frog/;
const CAGE = /budgerigar|budgie|canary|cockatiel|lovebird|conure|parakeet|parrot|amazon|macaw|cockatoo|(^|-)finch|serin|mannikin|munia|shama|magpie-robin|white-eye|bulbul|laughingthrush|hwamei|myna|hamster|gerbil|(^|-)mouse|(^|-)rat(-|$)|chinchilla|degu|sugar-glider/;
const VIVARIUM = /snake|python|(^|-)boa(-|$)|gecko|dragon|chameleon|iguana|anole|skink|monitor|tegu|(^|-)uromastyx|lizard|salamander|(^|-)toad|tree-frog|dart-frog|tarantula|scorpion|mantis|stick-insect|leaf-insect|millipede|land-snail|hermit|vinegaroon|rainbow-crab|cockroach/;
const WATER_WORDS = /fish|shark|(^|-)ray(-|$)|eel|axolotl|newt|shrimp|prawn|crayfish|lobster|(^|-)crab|turtle|terrapin|slider|tetra|guppy|molly|platy|danio|barb|gourami|pleco|loach|cichlid|discus|oscar|arowana|corydoras|catfish|algae-eater|acara|rainbowfish|betta|angelfish/;
const LIVESTOCK = /(^|-)cow(-|$)|cattle|horse|pony|donkey|(^|-)pig(-|$)|llama|buffalo|(^|-)yak(-|$)|camel|zebu/;

/**
 * How a home's pet is kept (from its kind and size): koi, goldfish, terrapins and pond frogs in the garden pond; other
 * water animals in a tank; cage birds and small rodents in a cage; reptiles, amphibians and kept invertebrates in a
 * vivarium; big livestock at a farm (livery); everyone else outdoors (dogs, cats, rabbits, guinea pigs, hens, ducks,
 * tortoises, ferrets, and the small household invertebrates on the lawn and walls).
 */
export function homeKeeping(slug: string, zone: string, length: number, plan: string | null): HomeKeeping {
    if (LIVESTOCK.test(slug) && length >= 1.3) return "livery";
    if (/tortoise/.test(slug)) return "outdoors";
    const watery = Boolean(speciesDepth(slug, zone)) || WATER_WORDS.test(slug) || plan === "fish" || plan === "eel" || plan === "ray" || plan === "jellyfish" || plan === "cephalopod";
    // (A box turtle, a land crab, a wading or swimming bird is not a tank animal.)
    if (watery && plan !== "bird" && !/box-turtle|rainbow-crab|hermit|land-crab|vampire-crab/.test(slug)) return POND.test(slug) ? "pond" : "tank";
    if (POND.test(slug)) return "pond";
    if (CAGE.test(slug)) return "cage";
    if (VIVARIUM.test(slug) || plan === "snake" || (plan === "reptile" && length < 2) || plan === "frog") return "vivarium";
    if (/box-turtle/.test(slug)) return "outdoors";
    return "outdoors";
}

/** A home's display: a tank, a cage, a vivarium or the garden pond (inner box, floor and top), on its site. */
export type HomeDisplay = {
    id: string;
    household: string;
    form: "tank" | "cage" | "vivarium" | "pond";
    x: number;
    z: number;
    rot: number;
    w: number;
    d: number;
    /** Its floor (the gravel, the cage's tray, the vivarium's substrate; the pond's bed) and its top (the water's, the lid's). */
    floor: number;
    top: number;
};

/** Where a household's displays stand: a glass garden room on its house's or terrace home's back, its flat's balcony or patio. */
export type HomeSite = {
    household: string;
    kind: "garden_room" | "balcony" | "patio";
    /** The room's (or balcony display's) footprint, its floor's height and, for a room, its walls' height. */
    box: Box;
    floor: number;
    height: number;
    /** The garden pond's footprint (houses only): a raised pond in the back garden. */
    pond: Box | null;
    /** The displays' slots along the back (house) wall: tank, cage, vivarium; and the pond. */
    displays: Record<"tank" | "cage" | "vivarium", HomeDisplay> & {pond: HomeDisplay | null};
};

/** The floor of a building (`render/buildings.ts` buildingFrame's): the highest ground under its corners and middle, plus 0.15 m. */
function buildingFloor(b: Box): number {
    let high = townHeight(b.x, b.z);
    for (const c of corners(b)) high = Math.max(high, townHeight(c.x, c.z));
    return high + 0.15;
}

/** The garden room's size (m) at a house and at a terrace home. */
const ROOM = {house: {w: 3.4, d: 2.6, h: 2.5}, terrace_home: {w: 2.6, d: 2.2, h: 2.4}};
/** The raised garden pond's footprint, its walls' height, its water a little below their top. */
export const POND_SIZE = {w: 2.2, d: 1.5, wall: 0.5, water: 0.44};

/** The displays' shares of the wall (tank, cage, vivarium): a vivarium holds the longest pets, a cage the smallest. */
const SHARES = {room: {tank: 0.32, cage: 0.18, vivarium: 0.5}, balcony: {tank: 0.36, cage: 0.3, vivarium: 0.34}};

function displaySlots(household: string, frame: Box, floor: number, usable: number, depth: number, stand: number, scale: number, shares: {tank: number; cage: number; vivarium: number} = SHARES.room): HomeSite["displays"] {
    const gap = 0.1;
    const widths = {tank: usable * shares.tank - gap, cage: usable * shares.cage - gap, vivarium: usable * shares.vivarium - gap};
    const heights = {tank: 0.46 * scale, cage: 0.62 * scale, vivarium: 0.46 * scale};
    const out = {} as HomeSite["displays"];
    let u = -usable / 2;
    for (const form of ["tank", "cage", "vivarium"] as const) {
        const w = widths[form];
        // (Against the house's wall: the site's +z side; their glass faces the garden.)
        const p = local(frame, u + gap / 2 + w / 2, frame.d / 2 - 0.12 - depth / 2);
        // (Glass, bars and lid are 2 cm; the gravel 4 cm, the tray 2 cm, the substrate 5 cm.)
        const base = floor + stand;
        out[form] = {id: `${household}:${form}`, household, form, x: p.x, z: p.z, rot: frame.rot, w: w - 0.04, d: depth - 0.04, floor: base + (form === "tank" ? 0.06 : form === "cage" ? 0.03 : 0.07), top: base + heights[form] - (form === "tank" ? 0.04 : 0.02)};
        u += w + gap;
    }
    out.pond = null;
    return out;
}

/**
 * A household's display site (the plan's alone, so it never moves): a house's garden room against the middle of its
 * back wall (and its raised pond in the far half of its back garden), a terrace home's against its own yard's share of
 * the back wall, a flat's displays against the back wall on its balcony (floors above the ground) or its patio.
 */
export function homeSite(home: Household, plan: TownPlan = townPlan()): HomeSite | null {
    const b = plan.buildings.find((q) => q.id === home.building);
    if (!b) return null;
    const parcel = plan.parcels.find((p) => p.id === home.parcel || p.building === b.id) ?? null;
    return siteFor(home, b, parcel);
}

function siteFor(home: Household, b: Building, parcel: Parcel | null): HomeSite | null {
    const f = buildingFloor(b.at);
    if (home.kind === "house" || home.kind === "terrace_home") {
        const size = home.kind === "house" ? ROOM.house : ROOM.terrace_home;
        let ux = 0;
        if (home.kind === "terrace_home") {
            // Its own yard's share of the back (areas.ts: yard k of four along the back garden).
            const back = parcel?.back;
            if (!back) return null;
            const yard = local(back, -back.w / 2 + (back.w * (home.index + 0.5)) / 4, 0);
            ux = toLocal(b.at, yard.x, yard.z).x;
        }
        const box = sub(b.at, ux, -b.at.d / 2 - size.d / 2, Math.min(size.w, b.at.w * (home.kind === "house" ? 0.6 : 0.24)), size.d);
        const floor = f;
        const displays = displaySlots(home.id, box, floor, box.w - 0.3, 0.5, 0.72, 1);
        let pond: Box | null = null;
        const back = parcel?.back;
        if (home.kind === "house" && back) {
            // In the far half of the back garden, to one side.
            const gl = toLocal(b.at, back.x, back.z);
            const depthFrom = -b.at.d / 2;
            const far = Math.min(depthFrom - back.d * 0.62, depthFrom - size.d - POND_SIZE.d / 2 - 1.2);
            const side = gl.x >= 0 ? 1 : -1;
            const px = gl.x + side * Math.max(back.w / 2 - POND_SIZE.w / 2 - 0.9, 0);
            pond = sub(b.at, px, far, POND_SIZE.w, POND_SIZE.d);
            const ground = Math.max(...corners(pond).map((c) => townHeight(c.x, c.z)));
            displays.pond = {id: `${home.id}:pond`, household: home.id, form: "pond", x: pond.x, z: pond.z, rot: pond.rot, w: pond.w - 0.36, d: pond.d - 0.36, floor: ground + 0.06, top: ground + POND_SIZE.water};
        }
        return {household: home.id, kind: "garden_room", box, floor, height: size.h, pond, displays};
    }
    // A flat: its balcony (its floor above the ground) or its patio, as `areas.ts` numbers them (two a floor, left and right).
    const floorIndex = Math.floor(home.index / 2);
    const side = home.index % 2 ? 1 : -1;
    const storey = b.eaves / Math.max(b.floors, 1);
    const balcony = floorIndex >= 1 && floorIndex < b.floors;
    const box = sub(b.at, (side * b.at.w) / 4, -b.at.d / 2 - 0.36, 1.5, 0.6);
    const floor = balcony ? f + floorIndex * storey + 0.08 : Math.max(...corners(box).map((c) => townHeight(c.x, c.z))) + 0.02;
    const displays = displaySlots(home.id, box, floor, box.w - 0.1, 0.42, 0.42, 0.85, SHARES.balcony);
    return {household: home.id, kind: balcony ? "balcony" : "patio", box, floor, height: 1.0, pond: null, displays};
}

let sites: Map<string, HomeSite | null> | null = null;

/** Every household's site (the plan's), by household id. */
export function homeSites(households: readonly Household[], plan: TownPlan = townPlan()): Map<string, HomeSite | null> {
    if (sites && plan === townPlan()) return sites;
    const byId = new Map(plan.buildings.map((b) => [b.id, b] as [string, Building]));
    const parcels = new Map<string, Parcel>();
    for (const p of plan.parcels) parcels.set(p.building, p);
    const out = new Map<string, HomeSite | null>();
    for (const h of households) {
        const b = byId.get(h.building);
        out.set(h.id, b ? siteFor(h, b, parcels.get(b.id) ?? null) : null);
    }
    if (plan === townPlan()) sites = out;
    return out;
}

/** The footprints no outdoor pet stands in and no walk crosses: every garden room and garden pond (the plan's). */
export function homeSiteFootprints(households: readonly Household[], plan: TownPlan = townPlan()): Box[] {
    const out: Box[] = [];
    homeSites(households, plan).forEach((site) => {
        if (!site || site.kind !== "garden_room") return;
        out.push(site.box);
        if (site.pond) out.push(site.pond);
    });
    return out;
}

/** A kept pet's spot in its cage or vivarium: along it by its id, on the tray or substrate (a bird on its perch). */
export function displaySpot(display: HomeDisplay, animal: {id: string; model_slug: string}, length: number, perched: boolean): {x: number; z: number; y: number; yaw: number} {
    const u = unit(animal.id, "u") * 2 - 1;
    const v = unit(animal.id, "v") * 2 - 1;
    const half = Math.max(display.w / 2 - Math.min(length * 0.5, display.w / 2) - 0.02, 0);
    const depth = Math.max(display.d / 2 - Math.min(length * 0.3, display.d / 2) - 0.02, 0);
    const lx = u * half;
    // (A perched bird is on the bar down the cage's middle.)
    const lz = perched ? 0 : v * depth * 0.5;
    const c = Math.cos(display.rot);
    const s = Math.sin(display.rot);
    // Side on to the glass (seen whole from the room), facing one way or the other.
    // (A long body lies straight along it: no turn that would put its nose through the glass.)
    const turn = length < display.d * 0.7 ? (unit(animal.id, "turn") - 0.5) * 0.5 : 0;
    const yaw = display.rot + (unit(animal.id, "face") < 0.5 ? Math.PI / 2 : -Math.PI / 2) + turn;
    const y = perched ? perchHeight(display) : display.floor;
    return {x: display.x + lx * c - lz * s, z: display.z + lx * s + lz * c, y, yaw};
}

/** A cage bird perches on the bar; a rodent sits on the tray. */
export function perchesInCage(slug: string, plan: string | null): boolean {
    return plan === "bird" || /budgerigar|budgie|canary|cockatiel|lovebird|conure|parakeet|parrot|amazon|macaw|cockatoo|finch|serin|mannikin|munia|shama|robin|white-eye|bulbul|thrush|hwamei|myna/.test(slug);
}

/** A display as a tank (the tank pose's water): the home tank and the garden pond. */
export function displayTank(display: HomeDisplay): Tank {
    return {id: display.id, kind: "fresh", form: display.form === "pond" ? "pond" : "home", x: display.x, z: display.z, rot: display.rot, w: display.w, d: display.d, floor: display.floor, top: display.top};
}

// MARK: - Floors (walk surfaces: `drawn-ground.ts`)

/** A box's top at a height as two upward triangles (x y z, three vertices each). */
export function floorTriangles(b: Box, y: number, out: number[] = []): number[] {
    const c = corners(b);
    // corners: (-,-), (+,-), (+,+), (-,+) in the box's frame; counter-clockwise from above for an upward normal.
    const p = (i: number) => [c[i].x, y, c[i].z];
    out.push(...p(0), ...p(3), ...p(2), ...p(0), ...p(2), ...p(1));
    return out;
}

/** The zoo houses' floors (every open house enclosure's inside, at its floor's height). */
export function zooHouseFloors(enclosures: readonly ZooEnclosure[]): Float32Array {
    const out: number[] = [];
    for (const e of enclosures) {
        if (e.shared || !ZOO_HOUSE_TYPES.has(e.type)) continue;
        const f = zooHouseFrame(e);
        floorTriangles(f.inner, f.floor, out);
    }
    return new Float32Array(out);
}

/** The bar a cage's birds perch on (the cage's middle, along it): its height. */
export function perchHeight(display: HomeDisplay): number {
    return display.floor + (display.top - display.floor) * 0.55;
}

/** The floors of the drawn home sites: each garden room's, and its cages' trays and vivaria's substrate. */
export function homeDisplayFloors(sites: readonly HomeSite[], used: ReadonlySet<string>): Float32Array {
    const out: number[] = [];
    for (const site of sites) {
        if (site.kind === "garden_room") floorTriangles(site.box, site.floor, out);
        for (const form of ["cage", "vivarium"] as const) {
            const d = site.displays[form];
            if (!used.has(d.id)) continue;
            // (A perched bird stands at its perch's height, held there: the bar is not a floor.)
            floorTriangles({x: d.x, z: d.z, w: d.w, d: d.d, rot: d.rot}, d.floor, out);
        }
    }
    return new Float32Array(out);
}

// MARK: - The town's solids (buildings, garden rooms, ponds), for placement and the behaviour world

let solids: {boxes: Box[]; grid: Map<number, number[]>} | null = null;
const SOLID_CELL = 16;
/** Every building's footprint, and the garden rooms and ponds, on a coarse grid. */
function solidBoxes(): {boxes: Box[]; grid: Map<number, number[]>} {
    if (solids) return solids;
    const plan = townPlan();
    const boxes: Box[] = [...plan.buildings.map((b) => b.at), ...homeSiteFootprints(townHouseholds(plan), plan)];
    const grid = new Map<number, number[]>();
    boxes.forEach((b, i) => {
        const r = Math.hypot(b.w, b.d) / 2 + 2;
        for (let cx = Math.floor((b.x - r) / SOLID_CELL); cx <= Math.floor((b.x + r) / SOLID_CELL); cx++) {
            for (let cz = Math.floor((b.z - r) / SOLID_CELL); cz <= Math.floor((b.z + r) / SOLID_CELL); cz++) {
                const key = (cx + 512) * 1024 + cz + 512;
                (grid.get(key) ?? grid.set(key, []).get(key)!).push(i);
            }
        }
    });
    return (solids = {boxes, grid});
}

export function nearTownSolids(x: number, z: number): Box[] {
    const {boxes, grid} = solidBoxes();
    return (grid.get((Math.floor(x / SOLID_CELL) + 512) * 1024 + Math.floor(z / SOLID_CELL) + 512) ?? []).map((i) => boxes[i]);
}

/** Within `margin` of a building's footprint (or inside it). */
export function inTownSolid(x: number, z: number, margin: number): boolean {
    for (const b of nearTownSolids(x, z)) if (inBox(b, x, z, margin)) return true;
    return false;
}

