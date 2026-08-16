/**
 * Builds the "Where to find each animal in X" habitat maps for every location guide.
 *
 * Bali's map is hand-drawn and stays that way. Every other location is generated here:
 * coastlines come from Natural Earth, habitat zones are authored in
 * `scripts/location-habitat-map-specs.ts`, and each location's own `animalsToSpot` list is
 * sorted into those zones by habitat class, so a map can never promise an animal the page
 * does not list.
 *
 * Usage: npx tsx scripts/generateLocationHabitatMaps.ts [--only slug,slug] [--report]
 *   --only  dry run for the named locations, printing instead of writing
 *   --report  print the species that landed in each zone
 */
import "dotenv/config";
import dotenv from "dotenv";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {createRequire} from "node:module";

dotenv.config({path: ".env.local"});

// The species catalog loader is marked server-only; this script is the same trusted
// author-time context a server component is, so the guard is stubbed rather than
// duplicating the loader.
const require = createRequire(import.meta.url);
require.cache[require.resolve("server-only")] = {
    id: "server-only",
    filename: "server-only",
    loaded: true,
    exports: {}
} as never;

import {locationPages} from "../src/data/locations";
import {
    boundingBox,
    buildOutline,
    collectRings,
    fitZoneArea,
    loadNaturalEarth,
    scatterPins,
    shrinkPolygon
} from "./lib/habitat-map-geo.mjs";
import {
    locationHabitatMapSpecs,
    type LocationHabitatMapSpec
} from "./location-habitat-map-specs";
import {speciesHabitatClasses, type HabitatClass} from "./species-habitat-classes";

type GeoPoint = {lat: number; lng: number};

type GeneratedZone = {
    id: string;
    name: string;
    habitat: string;
    label: GeoPoint;
    area: GeoPoint[];
    pins: Array<{speciesSlug: string; at: GeoPoint}>;
};

type GeneratedMap = {
    locationSlug: string;
    title: string;
    description: string;
    outline: GeoPoint[];
    islands?: Array<{name: string; outline: GeoPoint[]}>;
    zones: GeneratedZone[];
    footnote: string;
};

const OUTPUT_PATH = path.resolve("src/data/location-maps.generated.ts");

/** Pins are scattered against a slightly smaller zone so none sit on the blob's edge. */
const PIN_INSET = 0.82;

const DEFAULT_FOOTNOTE = "Zones are habitat guidance, not guarantees. Pin positions mark the part of the region each animal is realistically worked for; the coastline is simplified for legibility.";

function parseArgs() {
    const args = process.argv.slice(2);
    const only = new Set<string>();
    let report = false;

    for (let index = 0; index < args.length; index += 1) {
        if (args[index] === "--only") {
            for (const slug of (args[index + 1] ?? "").split(",")) {
                if (slug.trim()) only.add(slug.trim());
            }
            index += 1;
        }
        if (args[index] === "--report") report = true;
    }

    return {only, report};
}

function normalise(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

/**
 * Picks the zone an animal belongs to: an explicit species list first, then the zone that
 * claims the animal's habitat class, then the location's catch-all zone.
 */
function resolveZoneId(spec: LocationHabitatMapSpec, speciesSlug: string) {
    for (const zone of spec.zones) {
        if (zone.species?.includes(speciesSlug)) {
            return zone.id;
        }
    }

    const habitatClass = speciesHabitatClasses[speciesSlug];

    if (!habitatClass) {
        throw new Error(`${speciesSlug} has no habitat class — add it to scripts/species-habitat-classes.ts`);
    }

    const zone = spec.zones.find((candidate) => candidate.classes?.includes(habitatClass));
    return zone?.id ?? spec.defaultZoneId;
}

async function buildLand(spec: LocationHabitatMapSpec) {
    const source = spec.source;

    if (source.kind === "manual") {
        return {outline: source.outline, islands: source.islands ?? []};
    }

    if (source.kind === "country") {
        const dataset = await loadNaturalEarth("ne_50m_admin_0_countries");
        const features = dataset.features.filter((feature: any) => (
            source.names.includes(feature.properties.NAME)
            || source.names.includes(feature.properties.NAME_LONG)
        ));

        if (!features.length) {
            throw new Error(`${spec.slug}: no admin-0 feature named ${source.names.join(", ")}`);
        }

        return buildOutline(collectRings(features), {
            box: source.box,
            mainlandPoints: source.mainlandPoints ?? 64,
            maxIslands: source.maxIslands ?? 4,
            minIslandRatio: source.minIslandRatio
        });
    }

    if (source.kind === "admin1") {
        const dataset = await loadNaturalEarth("ne_10m_admin_1_states_provinces");
        const features = dataset.features.filter((feature: any) => (
            feature.properties.admin === source.country
            && source.names.includes(feature.properties.name)
        ));

        if (!features.length) {
            throw new Error(`${spec.slug}: no admin-1 feature named ${source.names.join(", ")} in ${source.country}`);
        }

        return buildOutline(collectRings(features), {
            box: source.box,
            mainlandPoints: source.mainlandPoints ?? 56,
            maxIslands: source.maxIslands ?? 3,
            minIslandRatio: source.minIslandRatio
        });
    }

    const dataset = await loadNaturalEarth("ne_10m_land");
    return buildOutline(collectRings(dataset.features), {
        box: source.box,
        mainlandPoints: source.mainlandPoints ?? 60,
        maxIslands: source.maxIslands ?? 6,
        minIslandRatio: source.minIslandRatio ?? 0.004
    });
}

async function generateMap(spec: LocationHabitatMapSpec): Promise<{map: GeneratedMap; report: string[]}> {
    const location = locationPages.find((page) => page.slug === spec.slug);

    if (!location) {
        throw new Error(`${spec.slug}: no location page`);
    }

    const land = await buildLand(spec);
    const bySpecies = new Map<string, string>();

    for (const animal of location.animalsToSpot) {
        bySpecies.set(animal.speciesSlug, resolveZoneId(spec, animal.speciesSlug));
    }

    const report: string[] = [];
    // The map frames the land plus every zone, so zones are sized against that same extent.
    const mapBounds = boundingBox([
        ...land.outline,
        ...land.islands.flatMap((island: {outline: GeoPoint[]}) => island.outline),
        ...spec.zones.flatMap((zone) => zone.area)
    ]);

    const zones: GeneratedZone[] = spec.zones.map((zone) => {
        const speciesSlugs = location.animalsToSpot
            .map((animal) => animal.speciesSlug)
            .filter((slug) => bySpecies.get(slug) === zone.id);
        const area = fitZoneArea(zone.area, speciesSlugs.length, mapBounds, {
            maxScale: spec.maxZoneScale
        });

        const positions = scatterPins(shrinkPolygon(area, PIN_INSET), speciesSlugs.length, {
            seed: `${spec.slug}:${zone.id}`,
            labelPoint: zone.label,
            labelHalfWidth: zone.labelHalfWidth ?? spec.labelHalfWidth ?? 0,
            labelHalfHeight: zone.labelHalfHeight ?? spec.labelHalfHeight ?? 0
        });

        report.push(`  ${zone.id} (${speciesSlugs.length}): ${speciesSlugs.join(", ")}`);

        return {
            id: zone.id,
            name: zone.name,
            habitat: zone.habitat,
            label: zone.label,
            area,
            pins: speciesSlugs.map((speciesSlug, index) => ({
                speciesSlug,
                at: positions[index]
            }))
        };
    });

    const emptyZones = zones.filter((zone) => !zone.pins.length).map((zone) => zone.id);
    if (emptyZones.length) {
        report.push(`  ! empty zones (dropped): ${emptyZones.join(", ")}`);
    }

    // A class no zone claims quietly piles into the catch-all zone, which is how a map
    // ends up with sea creatures inland, so it is called out rather than swallowed.
    const claimed = new Set(spec.zones.flatMap((zone) => zone.classes ?? []));
    const unclaimed = new Map<HabitatClass, string[]>();

    for (const animal of location.animalsToSpot) {
        const habitatClass = speciesHabitatClasses[animal.speciesSlug];
        const pinnedExplicitly = spec.zones.some((zone) => zone.species?.includes(animal.speciesSlug));

        if (!pinnedExplicitly && !claimed.has(habitatClass)) {
            unclaimed.set(habitatClass, [...(unclaimed.get(habitatClass) ?? []), animal.speciesSlug]);
        }
    }

    for (const [habitatClass, slugs] of Array.from(unclaimed.entries())) {
        report.push(`  ! no zone claims "${habitatClass}" -> ${spec.defaultZoneId}: ${slugs.join(", ")}`);
    }

    return {
        map: {
            locationSlug: spec.slug,
            title: `Where to find each animal in ${spec.mapName ?? location.name}`,
            description: spec.description,
            outline: land.outline,
            islands: land.islands.length ? land.islands : undefined,
            zones: zones.filter((zone) => zone.pins.length > 0),
            footnote: spec.footnote ?? DEFAULT_FOOTNOTE
        },
        report
    };
}

function formatPoint(point: GeoPoint) {
    return `{lat: ${point.lat}, lng: ${point.lng}}`;
}

function formatPoints(points: GeoPoint[], indent: string) {
    return points.map((point) => `${indent}${formatPoint(point)}`).join(",\n");
}

function serialise(maps: GeneratedMap[]) {
    const body = maps.map((map) => {
        const islands = map.islands?.length
            ? `        islands: [\n${map.islands.map((island) => (
                `            {\n                name: ${JSON.stringify(island.name)},\n                outline: [\n${formatPoints(island.outline, "                    ")}\n                ]\n            }`
            )).join(",\n")}\n        ],\n`
            : "";

        const zones = map.zones.map((zone) => (
            `            {\n`
            + `                id: ${JSON.stringify(zone.id)},\n`
            + `                name: ${JSON.stringify(zone.name)},\n`
            + `                habitat: ${JSON.stringify(zone.habitat)},\n`
            + `                label: ${formatPoint(zone.label)},\n`
            + `                area: [\n${formatPoints(zone.area, "                    ")}\n                ],\n`
            + `                pins: [\n${zone.pins.map((pin) => (
                `                    {speciesSlug: ${JSON.stringify(pin.speciesSlug)}, at: ${formatPoint(pin.at)}}`
            )).join(",\n")}\n                ]\n`
            + `            }`
        )).join(",\n");

        return `    ${JSON.stringify(map.locationSlug)}: {\n`
            + `        locationSlug: ${JSON.stringify(map.locationSlug)},\n`
            + `        title: ${JSON.stringify(map.title)},\n`
            + `        description: ${JSON.stringify(map.description)},\n`
            + `        outline: [\n${formatPoints(map.outline, "            ")}\n        ],\n`
            + islands
            + `        zones: [\n${zones}\n        ],\n`
            + `        footnote: ${JSON.stringify(map.footnote)}\n`
            + `    }`;
    }).join(",\n");

    return `/**\n`
        + ` * GENERATED FILE — do not edit by hand.\n`
        + ` *\n`
        + ` * Run: npx tsx scripts/generateLocationHabitatMaps.ts\n`
        + ` *\n`
        + ` * Outlines are simplified from Natural Earth (public domain) and are stylised, not\n`
        + ` * survey-accurate. Habitat zones live in scripts/location-habitat-map-specs.ts; the\n`
        + ` * species in each zone come from the location page's own animalsToSpot list.\n`
        + ` */\n`
        + `import type {LocationMap} from "@/data/location-maps";\n\n`
        + `export const generatedLocationMaps: Record<string, LocationMap> = {\n${body}\n};\n`;
}

async function main() {
    const {only, report} = parseArgs();
    const specs = locationHabitatMapSpecs.filter((spec) => !only.size || only.has(spec.slug));
    const maps: GeneratedMap[] = [];

    for (const spec of specs) {
        const result = await generateMap(spec);
        maps.push(result.map);

        if (report) {
            console.log(`${spec.slug} — ${result.map.zones.length} zones, ${result.map.zones.reduce((total, zone) => total + zone.pins.length, 0)} pins`);
            console.log(result.report.join("\n"));
        }
    }

    if (only.size) {
        console.log(`Generated ${maps.length} map(s) for ${Array.from(only).join(", ")} (not written: --only is a dry run)`);
        return;
    }

    fs.writeFileSync(OUTPUT_PATH, serialise(maps));
    console.log(`Wrote ${maps.length} habitat maps to ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
