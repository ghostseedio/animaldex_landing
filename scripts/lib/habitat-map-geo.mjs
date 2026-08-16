/**
 * Geometry helpers for the location habitat maps.
 *
 * Outlines come from Natural Earth (public domain) and are simplified hard enough that
 * they read at 1000x620 without carrying survey detail — the same "stylised, not
 * navigational" contract the hand-drawn Bali map states in its footnote.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const CACHE_DIR = path.join(os.tmpdir(), "animaldex-geo");
const NATURAL_EARTH_BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson";

const datasetCache = new Map();

export async function loadNaturalEarth(dataset) {
    if (datasetCache.has(dataset)) {
        return datasetCache.get(dataset);
    }

    fs.mkdirSync(CACHE_DIR, {recursive: true});
    const filePath = path.join(CACHE_DIR, `${dataset}.geojson`);

    if (!fs.existsSync(filePath)) {
        const response = await fetch(`${NATURAL_EARTH_BASE}/${dataset}.geojson`);
        if (!response.ok) {
            throw new Error(`Failed to download ${dataset}: ${response.status}`);
        }
        fs.writeFileSync(filePath, Buffer.from(await response.arrayBuffer()));
    }

    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    datasetCache.set(dataset, parsed);
    return parsed;
}

/** Every outer ring of every polygon in a feature collection, as [lng, lat] arrays. */
export function collectRings(features) {
    const rings = [];

    for (const feature of features) {
        const geometry = feature.geometry;
        if (!geometry) continue;
        const polygons = geometry.type === "Polygon"
            ? [geometry.coordinates]
            : geometry.type === "MultiPolygon" ? geometry.coordinates : [];

        for (const polygon of polygons) {
            if (polygon[0]?.length >= 4) {
                rings.push(polygon[0]);
            }
        }
    }

    return rings;
}

/**
 * Five decimals (about a metre). Zones and pins are rounded at this precision because a
 * zoo's whole site spans only a few thousandths of a degree.
 */
export function roundCoordinate(value) {
    return Number(value.toFixed(5));
}

export function ringArea(ring) {
    let area = 0;
    for (let index = 0; index < ring.length; index += 1) {
        const [x1, y1] = ring[index];
        const [x2, y2] = ring[(index + 1) % ring.length];
        area += x1 * y2 - x2 * y1;
    }
    return Math.abs(area / 2);
}

export function pointInRing(point, ring) {
    const [x, y] = point;
    let inside = false;

    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
        const [xi, yi] = ring[index];
        const [xj, yj] = ring[previous];
        const intersects = (yi > y) !== (yj > y)
            && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
        if (intersects) inside = !inside;
    }

    return inside;
}

/** Sutherland–Hodgman clip against an axis-aligned box, so a map can focus on one region. */
export function clipRingToBox(ring, box) {
    const edges = [
        {inside: (p) => p[0] >= box.west, intersect: (a, b) => interpolateX(a, b, box.west)},
        {inside: (p) => p[0] <= box.east, intersect: (a, b) => interpolateX(a, b, box.east)},
        {inside: (p) => p[1] >= box.south, intersect: (a, b) => interpolateY(a, b, box.south)},
        {inside: (p) => p[1] <= box.north, intersect: (a, b) => interpolateY(a, b, box.north)}
    ];

    let output = ring;

    for (const edge of edges) {
        const input = output;
        output = [];

        for (let index = 0; index < input.length; index += 1) {
            const current = input[index];
            const previous = input[(index + input.length - 1) % input.length];
            const currentInside = edge.inside(current);
            const previousInside = edge.inside(previous);

            if (currentInside) {
                if (!previousInside) output.push(edge.intersect(previous, current));
                output.push(current);
            } else if (previousInside) {
                output.push(edge.intersect(previous, current));
            }
        }

        if (!output.length) return [];
    }

    return output;
}

function interpolateX(a, b, x) {
    const t = (x - a[0]) / (b[0] - a[0]);
    return [x, a[1] + t * (b[1] - a[1])];
}

function interpolateY(a, b, y) {
    const t = (y - a[1]) / (b[1] - a[1]);
    return [a[0] + t * (b[0] - a[0]), y];
}

function perpendicularDistance(point, start, end) {
    const [x, y] = point;
    const [x1, y1] = start;
    const [x2, y2] = end;
    const dx = x2 - x1;
    const dy = y2 - y1;

    if (dx === 0 && dy === 0) {
        return Math.hypot(x - x1, y - y1);
    }

    const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
    const clamped = Math.max(0, Math.min(1, t));
    return Math.hypot(x - (x1 + clamped * dx), y - (y1 + clamped * dy));
}

function douglasPeucker(points, tolerance) {
    if (points.length < 3) return points;

    let maxDistance = 0;
    let index = 0;

    for (let i = 1; i < points.length - 1; i += 1) {
        const distance = perpendicularDistance(points[i], points[0], points[points.length - 1]);
        if (distance > maxDistance) {
            maxDistance = distance;
            index = i;
        }
    }

    if (maxDistance <= tolerance) {
        return [points[0], points[points.length - 1]];
    }

    const left = douglasPeucker(points.slice(0, index + 1), tolerance);
    const right = douglasPeucker(points.slice(index), tolerance);
    return [...left.slice(0, -1), ...right];
}

/** Simplifies a closed ring down to roughly `targetPoints` vertices. */
export function simplifyRing(ring, targetPoints) {
    const open = ring.slice(0, -1);
    if (open.length <= targetPoints) return open;

    const span = Math.max(
        Math.max(...open.map((p) => p[0])) - Math.min(...open.map((p) => p[0])),
        Math.max(...open.map((p) => p[1])) - Math.min(...open.map((p) => p[1]))
    );

    let low = 0;
    let high = span;
    let best = open;

    for (let iteration = 0; iteration < 24; iteration += 1) {
        const tolerance = (low + high) / 2;
        const simplified = douglasPeucker(open, tolerance);

        if (simplified.length > targetPoints) {
            low = tolerance;
        } else {
            best = simplified;
            high = tolerance;
        }
    }

    return best.length >= 4 ? best : open;
}

export function toGeoPoints(ring) {
    return ring.map(([lng, lat]) => ({
        lat: Number(lat.toFixed(3)),
        lng: Number(lng.toFixed(3))
    }));
}

/**
 * Builds the drawable land for one location: the biggest landmass plus the largest
 * offshore islands, all clipped to the region the map should frame.
 */
export function buildOutline(rings, {box, mainlandPoints = 60, islandPoints = 14, maxIslands = 0, minIslandRatio = 0.004}) {
    const clipped = (box ? rings.map((ring) => clipRingToBox(ring, box)) : rings)
        .filter((ring) => ring.length >= 4)
        .map((ring) => ({ring, area: ringArea(ring)}))
        .filter((entry) => entry.area > 0)
        .sort((a, b) => b.area - a.area);

    if (!clipped.length) {
        throw new Error("No land rings survived clipping");
    }

    const mainland = clipped[0];
    const islands = clipped
        .slice(1, 1 + maxIslands)
        .filter((entry) => entry.area >= mainland.area * minIslandRatio);

    return {
        outline: toGeoPoints(simplifyRing([...mainland.ring, mainland.ring[0]], mainlandPoints)),
        islands: islands.map((entry, index) => ({
            name: `Offshore island ${index + 1}`,
            outline: toGeoPoints(simplifyRing([...entry.ring, entry.ring[0]], islandPoints))
        }))
    };
}

/**
 * Grows a zone catchment until it has room for its pins.
 *
 * Zone polygons are authored by hand for position, not for size, so a zone that ends up
 * holding fifteen animals would otherwise stack them on top of each other. Zones are only
 * ever grown, never shrunk, and never past `maxScale` — the shape stays where it was put.
 */
export function fitZoneArea(area, pinCount, bounds, {areaPerPin = 1 / 110, maxScale} = {}) {
    const cap = maxScale ?? 1.9;
    const mapArea = (bounds.north - bounds.south) * (bounds.east - bounds.west);
    if (pinCount <= 0 || mapArea <= 0) return area;

    const ring = area.map((point) => [point.lng, point.lat]);
    const current = ringArea(ring);
    const target = pinCount * mapArea * areaPerPin;

    if (current <= 0 || target <= current) return area;

    const centreLng = ring.reduce((total, point) => total + point[0], 0) / ring.length;
    const centreLat = ring.reduce((total, point) => total + point[1], 0) / ring.length;

    // Never grow a zone past the frame — on a small map (a zoo's grounds) that would
    // push pins off the land entirely.
    const halfLat = Math.max(...area.map((point) => Math.abs(point.lat - centreLat)));
    const halfLng = Math.max(...area.map((point) => Math.abs(point.lng - centreLng)));
    const roomLat = Math.min(bounds.north - centreLat, centreLat - bounds.south);
    const roomLng = Math.min(bounds.east - centreLng, centreLng - bounds.west);
    const scale = Math.max(1, Math.min(
        Math.sqrt(target / current),
        cap,
        halfLat > 0 ? roomLat / halfLat : cap,
        halfLng > 0 ? roomLng / halfLng : cap
    ));

    if (scale <= 1) return area;

    return area.map((point) => ({
        lat: roundCoordinate(centreLat + (point.lat - centreLat) * scale),
        lng: roundCoordinate(centreLng + (point.lng - centreLng) * scale)
    }));
}

/** Bounding box of the drawn map, used to size and clamp zones against the frame. */
export function boundingBox(points) {
    const lats = points.map((point) => point.lat);
    const lngs = points.map((point) => point.lng);
    return {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lngs),
        west: Math.min(...lngs)
    };
}

/**
 * Shrinks a polygon about its centre. Zone blobs are drawn as a smoothed curve that cuts
 * inside the polygon's corners, so pins are placed against this inset shape to keep them
 * visually inside the blob.
 */
export function shrinkPolygon(area, factor) {
    const centreLat = area.reduce((total, point) => total + point.lat, 0) / area.length;
    const centreLng = area.reduce((total, point) => total + point.lng, 0) / area.length;

    return area.map((point) => ({
        lat: centreLat + (point.lat - centreLat) * factor,
        lng: centreLng + (point.lng - centreLng) * factor
    }));
}

/** Deterministic 32-bit hash, so regenerating the maps never reshuffles pins. */
export function hashString(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export function createRandom(seed) {
    let state = hashString(seed) || 1;
    return () => {
        state ^= state << 13;
        state >>>= 0;
        state ^= state >> 17;
        state ^= state << 5;
        state >>>= 0;
        return state / 4294967296;
    };
}

/**
 * Picks `count` candidates that stay apart from each other, relaxing the spacing until
 * enough fit. Without this a zone's pins bunch into one corner of the blob and overlap.
 */
function spreadOut(candidates, count, {width, height}) {
    const normalise = ([lng, lat]) => [lng / (width || 1), lat / (height || 1)];
    // Start from the spacing an even layout would give, then relax.
    let spacing = Math.sqrt(1 / count) * 0.9;

    for (let pass = 0; pass < 10; pass += 1) {
        const chosen = [];

        for (const candidate of candidates) {
            const [x, y] = normalise(candidate);
            const clashes = chosen.some((picked) => {
                const [px, py] = normalise(picked);
                return Math.hypot(x - px, y - py) < spacing;
            });

            if (!clashes) chosen.push(candidate);
            if (chosen.length === count) return chosen;
        }

        spacing *= 0.75;
    }

    return candidates.slice(0, count);
}

/**
 * Scatters `count` pins inside a zone polygon on a jittered grid, keeping clear of the
 * band where the zone label is drawn. Deterministic for a given zone id.
 */
export function scatterPins(area, count, {seed, labelPoint, labelHalfWidth, labelHalfHeight}) {
    if (count <= 0) return [];

    const ring = area.map((point) => [point.lng, point.lat]);
    const lngs = ring.map((p) => p[0]);
    const lats = ring.map((p) => p[1]);
    const west = Math.min(...lngs);
    const east = Math.max(...lngs);
    const south = Math.min(...lats);
    const north = Math.max(...lats);
    const random = createRandom(seed);

    const blocked = (point) => labelPoint
        && Math.abs(point[0] - labelPoint.lng) < labelHalfWidth
        && Math.abs(point[1] - labelPoint.lat) < labelHalfHeight;

    // The map draws a zone as a smooth curve through its edge midpoints, which for the
    // usual quad catchment is the inscribed ellipse. Pins are held inside that ellipse so
    // none of them float outside the shape they belong to.
    const centreLng = (west + east) / 2;
    const centreLat = (south + north) / 2;
    const radiusLng = (east - west) / 2;
    const radiusLat = (north - south) / 2;
    const insideBlob = (point) => (
        ((point[0] - centreLng) / radiusLng) ** 2 + ((point[1] - centreLat) / radiusLat) ** 2
    ) <= 0.82;

    for (let attempt = 0; attempt < 6; attempt += 1) {
        const columns = Math.ceil(Math.sqrt(count * 2.2)) + attempt * 2;
        const rows = columns;
        const stepX = (east - west) / (columns + 1);
        const stepY = (north - south) / (rows + 1);
        const candidates = [];

        for (let row = 1; row <= rows; row += 1) {
            for (let column = 1; column <= columns; column += 1) {
                const point = [
                    west + stepX * (column + (random() - 0.5) * 0.5),
                    south + stepY * (row + (random() - 0.5) * 0.5)
                ];

                if (!pointInRing(point, ring)) continue;
                if (!insideBlob(point)) continue;
                if (blocked(point)) continue;
                candidates.push(point);
            }
        }

        if (candidates.length >= count) {
            const chosen = spreadOut(candidates, count, {
                width: east - west,
                height: north - south
            });

            if (chosen.length === count) {
                return chosen.map(([lng, lat]) => ({
                    lat: roundCoordinate(lat),
                    lng: roundCoordinate(lng)
                }));
            }
        }
    }

    // Fallback: ring of points around the zone centre, still inside the bounding box.
    return Array.from({length: count}, (_, index) => {
        const angle = (index / count) * Math.PI * 2;
        return {
            lat: roundCoordinate(centreLat + Math.sin(angle) * (north - south) * 0.3),
            lng: roundCoordinate(centreLng + Math.cos(angle) * (east - west) * 0.3)
        };
    });
}
