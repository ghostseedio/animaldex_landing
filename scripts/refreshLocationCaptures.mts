/**
 * Snapshot the public captures that sit inside each /locations page's area, so
 * the static page can show real field proof ("found here by AnimalDex users")
 * without a database call during SSG.
 *
 * Operator-run; part of `yarn refresh:published-seo`. A capture only appears if
 * its collector shares it on Discover, keeps location visibility at everyone,
 * the animal has a published species page, and it is not a pet. Coordinates are
 * rounded to two decimals (about a kilometre) and the place label is cut back
 * to region and country.
 *
 *   npx tsx scripts/refreshLocationCaptures.mts [--report]
 */
import {existsSync, readFileSync, writeFileSync} from "node:fs";
import {createRequire} from "node:module";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const require = createRequire(import.meta.url);
require.cache[require.resolve("server-only")] = {id: "server-only", filename: "server-only", loaded: true, exports: {}} as never;

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const OUTPUT = join(root, "src/data/published-location-captures.json");
const FEATURED_PER_LOCATION = 12;
const SPECIES_PER_LOCATION = 40;
const MAX_PER_COLLECTOR = 3;

for (const file of [".env.local", ".env"]) {
    const filePath = join(root, file);
    if (!existsSync(filePath)) continue;
    for (const line of readFileSync(filePath, "utf8").split("\n")) {
        const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (!match) continue;
        let value = match[2] ?? "";
        if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
        if (!process.env[match[1]]) process.env[match[1]] = value;
    }
}

function supabaseUrl() {
    const raw = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
    if (!raw) return null;
    return raw.startsWith("http") ? raw : `https://${raw}`;
}

const url = supabaseUrl();
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "").trim();
if (!url || !key) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    process.exit(1);
}

async function fetchAll<T>(table: string, select: string, filter = ""): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += 1000) {
        const response = await fetch(`${url}/rest/v1/${table}?select=${select}${filter}`, {
            headers: {apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json", Range: `${from}-${from + 999}`, "Range-Unit": "items"}
        });
        if (!response.ok) throw new Error(`${table} ${response.status} ${await response.text()}`);
        const rows = (await response.json()) as T[];
        out.push(...rows);
        if (rows.length < 1000) break;
    }
    return out;
}

type FeedRow = {
    capture_id: string; user_id: string; capture_created_at: string; animal_name: string | null;
    species_profile_id: string | null; identity_kind: string | null; zoo_or_wild: string | null;
    location_lat: number; location_lng: number; location_display_label: string | null;
    capture_grade: number | null; confidence: number | null; profile_display_name: string | null;
    profile_username: string | null; image_media_kind: string | null; raw_json: {model?: {capture_validity?: string; authenticity_status?: string}} | null;
};
type CaptureRow = {id: string; location_country_code: string | null};
type ProfileRow = {id: string; location_visibility: string | null};
type CatalogRow = {species_profile_id: string; landing_page_slug: string | null; canonical_species_profile_id: string | null; display_name: string | null; animal_name: string | null};

const [feed, captures, profiles, catalog] = await Promise.all([
    fetchAll<FeedRow>("discover_feed_v1", "capture_id,user_id,capture_created_at,animal_name,species_profile_id,identity_kind,zoo_or_wild,location_lat,location_lng,location_display_label,capture_grade,confidence,profile_display_name,profile_username,image_media_kind,raw_json", "&location_lat=not.is.null&location_lng=not.is.null"),
    fetchAll<CaptureRow>("captures", "id,location_country_code", "&is_discoverable=is.true"),
    fetchAll<ProfileRow>("profiles", "id,location_visibility"),
    fetchAll<CatalogRow>("species_catalog_v1", "species_profile_id,landing_page_slug,canonical_species_profile_id,display_name,animal_name")
]);

const {locationPages} = await import("../src/data/locations");
const {legacyLocationCaptureAreas} = await import("../src/data/location-capture-areas");
const {speciesEntries} = await import("../src/data/species");
const publishedSlugs = (await import("../src/data/published-seo-slugs.json", {with: {type: "json"}})).default as {animals: string[]};
const dbPages = (await import("../src/data/published-seo-animal-pages.json", {with: {type: "json"}})).default as {entries: Array<{slug: string; name: string}>};

const speciesName = new Map<string, string>();
const speciesRarity = new Map<string, number>();
for (const entry of speciesEntries as Array<{slug: string; name: string; analysis?: {rarityScore?: number}}>) {
    speciesName.set(entry.slug, entry.name);
    speciesRarity.set(entry.slug, entry.analysis?.rarityScore ?? 0);
}
for (const entry of dbPages.entries as Array<{slug: string; name: string; analysis?: {rarityScore?: number}}>) {
    if (!speciesName.has(entry.slug)) speciesName.set(entry.slug, entry.name);
    if (!speciesRarity.has(entry.slug)) speciesRarity.set(entry.slug, entry.analysis?.rarityScore ?? 0);
}
const published = new Set([...publishedSlugs.animals, ...speciesName.keys()]);

const countryOf = new Map(captures.map((row) => [row.id, row.location_country_code?.toUpperCase() ?? null]));
const visibilityOf = new Map(profiles.map((row) => [row.id, (row.location_visibility ?? "everyone").trim().toLowerCase()]));
const catalogById = new Map(catalog.map((row) => [row.species_profile_id, row]));
const regionNames = new Intl.DisplayNames(["en"], {type: "region"});

const EXCLUDED_SLUGS = new Set(["human"]);

// Captures logged before the country code column existed only carry a label;
// its last segment is the country, sometimes in the local language.
const LOCAL_COUNTRY_NAMES: Record<string, string> = {
    "brasil": "BR", "việt nam": "VN", "deutschland": "DE", "españa": "ES", "polska": "PL", "nederland": "NL", "belgië": "BE", "belgique": "BE",
    "magyarország": "HU", "italia": "IT", "la réunion": "RE", "algérie": "DZ", "perú": "PE", "méxico": "MX", "österreich": "AT", "schweiz": "CH",
    "suisse": "CH", "česko": "CZ", "ελλάδα": "GR", "türkiye": "TR", "românia": "RO", "eesti": "EE", "lietuva": "LT", "danmark": "DK", "sverige": "SE",
    "suomi": "FI", "norge": "NO", "ísland": "IS", "hrvatska": "HR", "българия": "BG", "slovensko": "SK", "éire": "IE", "ประเทศไทย": "TH", "日本": "JP",
    "대한민국": "KR", "中国": "CN", "sri lanka": "LK", "cejlon": "LK", "uruguay": "UY", "argentina": "AR", "chile": "CL", "colombia": "CO", "ecuador": "EC"
};
const countryByName = new Map<string, string>(Object.entries(LOCAL_COUNTRY_NAMES));
for (const code of ["ID", "US", "FR", "MY", "PH", "BR", "CA", "VN", "GB", "IT", "TH", "DE", "ES", "PT", "AU", "NL", "PL", "LK", "MX", "BE", "DZ", "EC", "HU", "RE", "GR", "PE", "EE", "CL", "TR", "RO", "TT", "LA", "TZ", "AT", "IE", "CO", "AR", "CH", "SK", "NZ", "GF", "IL", "JP", "KR", "HR", "NO", "DK", "SV", "BG", "UY", "UZ", "CZ", "GY", "MA", "LT", "IN", "ZA", "RU", "BY", "SG", "KE", "EG", "JO", "SA", "OM", "AE", "HK", "KH", "NP", "MU", "ET", "NA", "BW", "UG", "RW", "SE", "FI", "UA", "CR", "JM", "AF", "PK", "MG", "IS", "CN"]) {
    const name = regionNames.of(code);
    if (name) countryByName.set(name.toLowerCase(), code);
}
function countryFromLabel(label: string | null) {
    const tail = (label ?? "").split(/ · |, /).map((part) => part.trim()).filter(Boolean).at(-1)?.toLowerCase();
    if (!tail) return null;
    return countryByName.get(tail) ?? countryByName.get(tail.replace(/\s*\(.*\)$/, "")) ?? null;
}
const PET_KINDS = new Set(["breed", "cross_breed", "domestic_parent"]);

type Clean = {
    captureId: string; userId: string; capturedAt: string; speciesSlug: string; animalName: string;
    setting: "wild" | "zoo" | "farm" | "unknown"; identityKind: string; validity: string;
    grade: number; lat: number; lng: number; countryCode: string | null; area: string;
    collectorName: string; collectorHandle: string | null;
};

function settingOf(value: string | null): Clean["setting"] {
    const v = (value ?? "").toLowerCase();
    if (v === "wild") return "wild";
    if (v === "zoo" || v === "captive") return "zoo";
    if (v === "farm") return "farm";
    return "unknown";
}

// Geocoder labels arrive in the local language and with postal state codes;
// the public page reads them in English.
const REGION_ENGLISH: Record<string, string> = {
    "Jawa Barat": "West Java", "Jawa Timur": "East Java", "Jawa Tengah": "Central Java", "Sumatera Utara": "North Sumatra",
    "Sumatera Selatan": "South Sumatra", "Sumatera Barat": "West Sumatra", "Daerah Khusus Ibukota Jakarta": "Jakarta",
    "Daerah Istimewa Yogyakarta": "Yogyakarta", "Jakarta Utara": "North Jakarta", "Jakarta Selatan": "South Jakarta", "Jakarta Barat": "West Jakarta", "Jakarta Timur": "East Jakarta", "Jakarta Pusat": "Central Jakarta", "Nusa Tenggara Barat": "West Nusa Tenggara", "Nusa Tenggara Timur": "East Nusa Tenggara",
    "Kalimantan Selatan": "South Kalimantan", "Kalimantan Timur": "East Kalimantan", "Kalimantan Barat": "West Kalimantan",
    "Sulawesi Utara": "North Sulawesi", "Sulawesi Selatan": "South Sulawesi", "Kepulauan Riau": "Riau Islands",
    "Kepulauan Bangka Belitung": "Bangka Belitung Islands", "Maluku Utara": "North Maluku", "Papua Barat": "West Papua",
    "Bayern": "Bavaria", "Niedersachsen": "Lower Saxony", "Zuid-Holland": "South Holland", "Noord-Brabant": "North Brabant",
    "Vlaanderen": "Flanders", "Région wallonne": "Wallonia", "Województwo pomorskie": "Pomerania", "Dolnośląskie": "Lower Silesia",
    "Województwo lubelskie": "Lublin", "Komárom-Esztergom vármegye": "Komárom-Esztergom", "Provincia de Lima": "Lima",
    "Dar es Salam": "Dar es Salaam", "Hà Nội": "Hanoi", "Thành Phố Hà Nội": "Hanoi", "Krung Thep Maha Nakhon": "Bangkok",
    "สมุทรปราการ": "Samut Prakan", "ร้อยเอ็ด": "Roi Et", "Amphoe Mueang Chiang Mai": "Chiang Mai", "Wilaya de Blida": "Blida",
    "Ηλεία": "Elis", "N.L.": "Nuevo León", "Q. Roo.": "Quintana Roo", "Qro.": "Querétaro", "Madri": "Madrid", "Balearen": "Balearic Islands",
    "Sicilia": "Sicily", "Piemonte": "Piedmont", "Lombardia": "Lombardy", "Toscana": "Tuscany", "Lazio": "Lazio", "Hiiu maakond": "Hiiumaa",
    "Județul Călărași": "Călărași", "Nitriansky kraj": "Nitra", "Región Metropolitana": "Santiago Metropolitan", "Western Visayas": "Western Visayas"
};
const STATE_CODES: Record<string, Record<string, string>> = {
    US: {AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "Washington, D.C."},
    CA: {AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick", NL: "Newfoundland and Labrador", NS: "Nova Scotia", NT: "Northwest Territories", NU: "Nunavut", ON: "Ontario", PE: "Prince Edward Island", QC: "Quebec", SK: "Saskatchewan", YT: "Yukon"},
    AU: {NSW: "New South Wales", VIC: "Victoria", QLD: "Queensland", WA: "Western Australia", SA: "South Australia", TAS: "Tasmania", NT: "Northern Territory", ACT: "Australian Capital Territory"}
};

function areaLabel(label: string | null, countryCode: string | null) {
    const parts = (label ?? "").split(/ · |, /).map((part) => part.trim()).filter(Boolean)
        .filter((part) => !/^near /i.test(part));
    const country = countryCode ? regionNames.of(countryCode) ?? null : null;
    if (parts.length >= 2) {
        let region = parts[parts.length - 2];
        region = STATE_CODES[countryCode ?? ""]?.[region] ?? REGION_ENGLISH[region] ?? region;
        // Labels like "Oliwa · Gdańsk · Pomorskie · Polska" put a city before the region; keep the region.
        if (/county$/i.test(region) && parts.length >= 3) region = STATE_CODES[countryCode ?? ""]?.[parts[parts.length - 3]] ?? region;
        return `${region}, ${country ?? parts[parts.length - 1]}`;
    }
    return country ?? parts[0] ?? "Location withheld";
}

const clean: Clean[] = [];
for (const row of feed) {
    if ((row.image_media_kind ?? "photo") !== "photo") continue;
    if (visibilityOf.get(row.user_id) !== "everyone") continue;
    const validity = row.raw_json?.model?.capture_validity ?? "unknown";
    if (validity === "likely_non_live_source" || validity === "no_animal_detected") continue;
    if (row.raw_json?.model?.authenticity_status === "likely_non_live_source") continue;
    const setting = settingOf(row.zoo_or_wild);
    if ((row.zoo_or_wild ?? "").toLowerCase() === "domestic") continue;
    const kind = row.identity_kind ?? "";
    if (PET_KINDS.has(kind)) continue;
    const entry = row.species_profile_id ? catalogById.get(row.species_profile_id) : null;
    const canonical = entry?.canonical_species_profile_id ? catalogById.get(entry.canonical_species_profile_id) : null;
    const slug = (canonical?.landing_page_slug ?? entry?.landing_page_slug ?? "").trim().toLowerCase();
    if (!slug || !published.has(slug) || EXCLUDED_SLUGS.has(slug)) continue;
    const countryCode = countryOf.get(row.capture_id) ?? countryFromLabel(row.location_display_label);
    clean.push({
        captureId: row.capture_id,
        userId: row.user_id,
        capturedAt: row.capture_created_at,
        speciesSlug: slug,
        animalName: speciesName.get(slug) ?? canonical?.display_name ?? entry?.display_name ?? row.animal_name ?? slug,
        setting,
        identityKind: kind,
        validity,
        grade: row.capture_grade ?? 0,
        lat: row.location_lat,
        lng: row.location_lng,
        countryCode,
        area: areaLabel(row.location_display_label, countryCode),
        collectorName: (row.profile_display_name ?? "").trim() || (row.profile_username ? `@${row.profile_username}` : "AnimalDex collector"),
        collectorHandle: row.profile_username?.trim() || null
    });
}

type Box = {north: number; south: number; east: number; west: number};
function inBox(capture: Clean, box: Box) {
    return capture.lat <= box.north && capture.lat >= box.south && capture.lng <= box.east && capture.lng >= box.west;
}
function inArea(capture: Clean, area: {countryCodes?: string[]; bbox?: Box; excludeBboxes?: Box[]; bboxCountryCodes?: string[]}, pageCountry: string | null) {
    if (area.countryCodes && capture.countryCode && area.countryCodes.includes(capture.countryCode)) return true;
    if (!area.bbox || !inBox(capture, area.bbox)) return false;
    const allowed = area.bboxCountryCodes ?? (pageCountry ? [pageCountry] : null);
    if (allowed && capture.countryCode && !allowed.includes(capture.countryCode)) return false;
    return !(area.excludeBboxes ?? []).some((box) => inBox(capture, box));
}

const SETTING_RANK: Record<Clean["setting"], number> = {wild: 0, zoo: 1, farm: 2, unknown: 3};
const KIND_RANK: Record<string, number> = {species: 0, subspecies: 0, variant: 1, genus: 2, family: 3, group: 4};

// Featured cards lead with the sightings a visitor would travel for: wild,
// confirmed live, identified to species, rarer animal first, then the best photo.
function rank(a: Clean, b: Clean) {
    return SETTING_RANK[a.setting] - SETTING_RANK[b.setting]
        || Number(b.validity === "valid_live_capture") - Number(a.validity === "valid_live_capture")
        || (KIND_RANK[a.identityKind] ?? 5) - (KIND_RANK[b.identityKind] ?? 5)
        || (speciesRarity.get(b.speciesSlug) ?? 0) - (speciesRarity.get(a.speciesSlug) ?? 0)
        || b.grade - a.grade
        || b.capturedAt.localeCompare(a.capturedAt);
}

type Snapshot = {
    generatedAt: string;
    source: string;
    note: string;
    locations: Record<string, {
        captureCount: number; speciesCount: number; collectorCount: number; wildCount: number; zooCount: number;
        latestCapturedAt: string;
        species: Array<{slug: string; name: string; count: number}>;
        featured: Array<{captureId: string; speciesSlug: string; animalName: string; capturedAt: string; setting: Clean["setting"]; area: string; collectorName: string; collectorHandle: string | null; lat: number; lng: number}>;
    }>;
};

const snapshot: Snapshot = {
    generatedAt: new Date().toISOString(),
    source: "discover_feed_v1 + captures.location_country_code + profiles.location_visibility + species_catalog_v1",
    note: "Public, non-pet captures with a published species page, grouped into each location page's captureArea. Refresh with `npx tsx scripts/refreshLocationCaptures.mts`.",
    locations: {}
};

const report = process.argv.includes("--report");
const matched = new Set<string>();
for (const page of locationPages) {
    const area = page.captureArea ?? legacyLocationCaptureAreas[page.slug];
    if (!area) {
        if (report) console.log(`${page.slug}: no captureArea`);
        continue;
    }
    const inside = clean.filter((capture) => inArea(capture, area, page.countryCode?.toUpperCase() ?? null)).sort(rank);
    if (inside.length === 0) continue;
    for (const capture of inside) matched.add(capture.captureId);
    const bySpecies = new Map<string, {slug: string; name: string; count: number}>();
    for (const capture of inside) {
        const entry = bySpecies.get(capture.speciesSlug) ?? {slug: capture.speciesSlug, name: capture.animalName, count: 0};
        entry.count++;
        bySpecies.set(capture.speciesSlug, entry);
    }
    const featured: Snapshot["locations"][string]["featured"] = [];
    const usedSpecies = new Set<string>();
    const perCollector = new Map<string, number>();
    for (const capture of inside) {
        if (featured.length >= FEATURED_PER_LOCATION) break;
        if (usedSpecies.has(capture.speciesSlug)) continue;
        if ((perCollector.get(capture.userId) ?? 0) >= MAX_PER_COLLECTOR) continue;
        usedSpecies.add(capture.speciesSlug);
        perCollector.set(capture.userId, (perCollector.get(capture.userId) ?? 0) + 1);
        featured.push({
            captureId: capture.captureId,
            speciesSlug: capture.speciesSlug,
            animalName: capture.animalName,
            capturedAt: capture.capturedAt,
            setting: capture.setting,
            area: capture.area,
            collectorName: capture.collectorName,
            collectorHandle: capture.collectorHandle,
            lat: Math.round(capture.lat * 100) / 100,
            lng: Math.round(capture.lng * 100) / 100
        });
    }
    snapshot.locations[page.slug] = {
        captureCount: inside.length,
        speciesCount: bySpecies.size,
        collectorCount: new Set(inside.map((capture) => capture.userId)).size,
        wildCount: inside.filter((capture) => capture.setting === "wild").length,
        zooCount: inside.filter((capture) => capture.setting === "zoo").length,
        latestCapturedAt: inside.map((capture) => capture.capturedAt).sort().at(-1)!,
        species: Array.from(bySpecies.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, SPECIES_PER_LOCATION),
        featured
    };
}

writeFileSync(OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`);

const unmatched = clean.filter((capture) => !matched.has(capture.captureId));
console.log(`feed=${feed.length} usable=${clean.length} matched=${matched.size} unmatched=${unmatched.length} locations=${Object.keys(snapshot.locations).length}`);
if (report) {
    const byCountry = new Map<string, number>();
    for (const capture of unmatched) byCountry.set(capture.countryCode ?? "??", (byCountry.get(capture.countryCode ?? "??") ?? 0) + 1);
    console.log("unmatched by country:", Array.from(byCountry.entries()).sort((a, b) => b[1] - a[1]).map(([code, count]) => `${code}:${count}`).join(" "));
    for (const [slug, entry] of Object.entries(snapshot.locations).sort((a, b) => b[1].captureCount - a[1].captureCount)) {
        console.log(`${slug.padEnd(28)} ${String(entry.captureCount).padStart(4)} captures ${String(entry.speciesCount).padStart(3)} species ${String(entry.collectorCount).padStart(3)} collectors  wild=${entry.wildCount} zoo=${entry.zooCount}`);
    }
}
