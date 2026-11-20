// Ark town reach v1 (lane TOWN-REACH; owner rule, decision 416: "if animals can't reach eachother - no mating"; docs/ark/town-reach.md).
//
// The town's half of reach.ts: where the town's wildlife stands (its home) and the map to find which part of the town it can
// travel in. Both come from ONE generated file, `town-reach.json` (the web's `scripts/ark-town-reach.mts`, from the town's own
// plan: `islands/town/`), which the web and this server share byte for byte:
//
//   mask    the town's connectivity mask in the format of the atlas's (x0, z0, cell, nx, nz, a byte a cell: medium in the low
//           two bits), with the flags reach.ts reads above it (BAR, SMALL, CLIMB, DECK). Run-length coded here.
//   spots   every spot the town places wildlife on (garden, park, canal, roof...): x, z, where, place, sizes, ground, water,
//           in the order `areas.ts` lists them.
//   kinds   per species: its niche (which kinds of spot), size class, wetland, whether it flies, whether it climbs.
//
// `townHome` repeats the scene's own pick for town wildlife (`islands/town/placement.ts`): the spot of the cluster (its zone and
// the server's slot) by a rendezvous hash over the niche's spots of its size. A test in the web places animals by the scene and
// compares (src/lib/ark-town-reach.test.ts); `cases` in the file are that comparison, checked here too.
//
// Same rules as positions.ts: pure, import-free and ES5-safe at runtime (no Map/Set, no Math.imul, no `??`), so the web can take a
// byte-identical copy. It changes nothing positions.ts or reach.ts answers.

export const TOWN_REACH_VERSION = 1;

export interface TownMask {
  x0: number;
  z0: number;
  cell: number;
  nx: number;
  nz: number;
  data: number[];
}

/** A spot the scene places a town wildlife cluster on. */
export interface TownSpot {
  x: number;
  z: number;
  /** Index into `wheres`, and into `places`. */
  where: number;
  place: number;
  /** Which body sizes it takes: 1 small, 2 medium, 4 large. */
  sizes: number;
  /** Not under a building's footprint, or a high place (roof, eave, ledge, tall, belfry, lamp wall): `onGround`. */
  ground: boolean;
  /** In water (a pond's, the canal's surface at least 0.3 m over the bed). */
  water: boolean;
}

export interface TownKind {
  /** Index into `niches`, or -1: its zone's niche (`zoneNiche`). */
  niche: number;
  /** 0 small (under 0.35 m), 1 medium (under 1.5 m), 2 large. */
  size: number;
  /** 0 not a pond animal, 1 at the water's edge and on it, 2 in the water itself. */
  wet: number;
  flies: boolean;
  climbs: boolean;
}

export interface TownReach {
  v: number;
  mask: TownMask;
  wheres: string[];
  places: string[];
  spots: TownSpot[];
  /** Per where: its spots' indexes, in the order the scene lists them. */
  byWhere: number[][];
  niches: number[][];
  zoneNiche: { [zone: string]: number[] };
  /** The niche of a pond animal (millpond, farm pond, canal). */
  wetland: number[];
  /** Zones whose animals keep their own niche, never the pond's (the sea's). */
  seaZones: string[];
  kinds: { [slug: string]: TownKind };
  /** [slug, zone, slot, spot index]: what the scene picked (the web's test), for the contract. */
  cases: Array<[string, string, number, number]>;
}

// ---------------------------------------------------------------------------------------------------------------
// Decode

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function b64bytes(s: string): number[] {
  const out: number[] = [];
  let buf = 0, bits = 0;
  for (let i = 0; i < s.length; i++) {
    const c = B64.indexOf(s.charAt(i));
    if (c < 0) continue;
    buf = (buf << 6) | c;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 0xff);
    }
  }
  return out;
}

/** Run-length bytes: a value, then its run's length as a varint (7 bits at a time, low first, the top bit says more follows). */
export function unrle(bytes: number[], n: number): number[] {
  const out: number[] = new Array(n);
  let at = 0;
  for (let i = 0; i < bytes.length && at < n;) {
    const value = bytes[i++];
    let run = 0, shift = 0, b = 0;
    do {
      b = bytes[i++];
      run += (b & 0x7f) * (shift === 0 ? 1 : shift === 7 ? 128 : shift === 14 ? 16384 : 2097152);
      shift += 7;
    } while (b >= 128 && i < bytes.length);
    for (let k = 0; k < run && at < n; k++) out[at++] = value;
  }
  while (at < n) out[at++] = 0;
  return out;
}

/** The file as stored -> ready to use. Decode once and keep it. */
export function decodeTownReach(raw: unknown): TownReach {
  const j = raw as {
    v: number;
    mask: { x0: number; z0: number; cell: number; nx: number; nz: number; data: string };
    wheres: string[];
    places: string[];
    spots: number[][];
    niches: number[][];
    zoneNiche: { [zone: string]: number[] };
    wetland: number[];
    seaZones: string[];
    kinds: { [slug: string]: number[] };
    cases: Array<[string, string, number, number]>;
  };
  if (!j || j.v !== 1) throw new Error("ark-town-reach: file version " + (j ? j.v : "missing") + " is not 1");
  const spots: TownSpot[] = [];
  const byWhere: number[][] = [];
  for (let w = 0; w < j.wheres.length; w++) byWhere.push([]);
  for (let i = 0; i < j.spots.length; i++) {
    const s = j.spots[i];
    // [x dm, z dm, where, place, flags]: flags 1 small, 2 medium, 4 large, 8 ground, 16 water
    spots.push({ x: s[0] / 10, z: s[1] / 10, where: s[2], place: s[3], sizes: s[4] & 7, ground: (s[4] & 8) !== 0, water: (s[4] & 16) !== 0 });
    byWhere[s[2]].push(i);
  }
  const kinds: { [slug: string]: TownKind } = {};
  for (const slug in j.kinds) {
    if (!Object.prototype.hasOwnProperty.call(j.kinds, slug)) continue;
    const k = j.kinds[slug];
    // [niche, size, wet, flags]: flags 1 flies, 2 climbs
    kinds[slug] = { niche: k[0], size: k[1], wet: k[2], flies: (k[3] & 1) !== 0, climbs: (k[3] & 2) !== 0 };
  }
  const m = j.mask;
  return {
    v: 1,
    mask: { x0: m.x0, z0: m.z0, cell: m.cell, nx: m.nx, nz: m.nz, data: unrle(b64bytes(m.data), m.nx * m.nz) },
    wheres: j.wheres,
    places: j.places,
    spots: spots,
    byWhere: byWhere,
    niches: j.niches,
    zoneNiche: j.zoneNiche,
    wetland: j.wetland,
    seaZones: j.seaZones,
    kinds: kinds,
    cases: j.cases,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The scene's hash (islands/town/geom.ts hashText: FNV-1a, 32 bit), with a 32-bit multiply that needs no Math.imul.

function mul32(a: number, b: number): number {
  const ah = (a >>> 16) & 0xffff, al = a & 0xffff;
  const bh = (b >>> 16) & 0xffff, bl = b & 0xffff;
  return (al * bl + (((ah * bl + al * bh) << 16) >>> 0)) | 0;
}

function hashOn(state: number, value: string): number {
  let h = state | 0;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = mul32(h, 0x01000193);
  }
  return h >>> 0;
}

const FNV_BASIS = 0x811c9dc5 | 0;

// ---------------------------------------------------------------------------------------------------------------
// Homes

/** The species' record, or null (a species the file does not know: it has no home in the town). */
export function townKindOf(t: TownReach, slug: string): TownKind | null {
  return Object.prototype.hasOwnProperty.call(t.kinds, slug) ? t.kinds[slug] : null;
}

/** The kinds of spot a species of this zone lives on (the scene's `townWetlandOf`, else `urbanNiche`). */
export function townWheres(t: TownReach, kind: TownKind, zone: string): number[] {
  let sea = false;
  for (let i = 0; i < t.seaZones.length; i++) if (t.seaZones[i] === zone) sea = true;
  if (kind.wet && !sea) return t.wetland;
  if (kind.niche >= 0) return t.niches[kind.niche];
  const z = Object.prototype.hasOwnProperty.call(t.zoneNiche, zone) ? t.zoneNiche[zone] : null;
  // (A zone with no habitat of its own: the scene's `["park"]`, the file's first niche.)
  return z ? z : t.niches[0];
}

export interface TownHome {
  /** The spot's index in `spots`, its place and where, and its position (m, the town's frame). */
  spot: number;
  x: number;
  z: number;
  where: string;
  place: string;
}

/**
 * Where cluster `slot` of a species stands in the town's wildlife, as the scene places it: the rendezvous pick over the spots of its
 * niche that take its size (else every one of them), not under a building, in the water for a swimmer. Null for a species the file
 * does not know, or when its niche has no spot.
 */
export function townHome(t: TownReach, slug: string, zone: string, slot: number): TownHome | null {
  const kind = townKindOf(t, slug);
  if (!kind) return null;
  const wheres = townWheres(t, kind, zone);
  const swims = kind.wet === 2 && !isSea(t, zone);
  const want = kind.size === 0 ? 1 : kind.size === 1 ? 2 : 4;
  const sized: number[] = [], any: number[] = [];
  for (let w = 0; w < wheres.length; w++) {
    const list = t.byWhere[wheres[w]];
    for (let i = 0; i < list.length; i++) {
      const s = t.spots[list[i]];
      if (!s.ground || (swims && !s.water)) continue;
      any.push(list[i]);
      if ((s.sizes & want) !== 0) sized.push(list[i]);
    }
  }
  const list = sized.length ? sized : any;
  if (!list.length) return null;
  // `pick(list, "<zone>#<slot>|<slug>", (s, i) => s.place + s.where + i)`: the highest hash, the first on a tie.
  const prefix = hashOn(FNV_BASIS, zone + "#" + slot + "|" + slug + "|");
  let best = -1, bestScore = -1;
  for (let i = 0; i < list.length; i++) {
    const s = t.spots[list[i]];
    const score = hashOn(prefix, t.places[s.place] + t.wheres[s.where] + i);
    if (score > bestScore) {
      bestScore = score;
      best = list[i];
    }
  }
  const s = t.spots[best];
  return { spot: best, x: s.x, z: s.z, where: t.wheres[s.where], place: t.places[s.place] };
}

function isSea(t: TownReach, zone: string): boolean {
  for (let i = 0; i < t.seaZones.length; i++) if (t.seaZones[i] === zone) return true;
  return false;
}
