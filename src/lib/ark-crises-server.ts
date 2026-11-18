/**
 * The server side of `/api/ark/crises` (contract: AnimalDex docs/ark/audits/ecosystem/crises-api-contract.md; built by
 * E4, AnimalDex migration 20261203160000): `voyage_crises_v1` answers the crises as the engine's database committed
 * them, with the kind's stored field-guide habitat text; here that text becomes the contract's two fields:
 *
 *   habitat    one short sentence (<= 160 characters), no markup;
 *   countries  ISO 3166-1 alpha-2 codes of the countries that text NAMES, at most 8. Country level and nowhere finer
 *              (owner decision 389): nothing from a person's sightings, no region, no place. A kind whose text names
 *              no country has none.
 *
 * Nothing here predicts and nothing here knows a person: the rows hold kinds, counts, days and animal ids only.
 * Plain functions, no I/O: the route and its tests share them.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `?crisis=<id>`, when it is a crisis id. */
export function arkCrisisIdParam(value: string | null | undefined): string | null {
    const said = typeof value === "string" ? value.trim() : "";
    return UUID.test(said) ? said.toLowerCase() : null;
}

/** The field guide's text without its leading "Native range keys: europe, east_asia." line (region keys, not words). */
function habitatProse(raw: unknown): string {
    if (typeof raw !== "string") return "";
    return raw
        .replace(/<[^>]*>/g, " ")
        .replace(/^\s*Native range keys:[^.]*\.\s*/i, "")
        .replace(/\s+/g, " ")
        .trim();
}

/** One short habitat sentence: the text's first sentence, cut at a word when it is longer than 160 characters. */
export function arkCrisisHabitat(raw: unknown, max = 160): string | null {
    const prose = habitatProse(raw);
    if (!prose) return null;
    const end = prose.search(/[.!?](\s|$)/);
    const sentence = end >= 0 ? prose.slice(0, end + 1) : prose;
    if (sentence.length <= max) return sentence;
    const cut = sentence.slice(0, max - 1);
    const space = cut.lastIndexOf(" ");
    return `${(space > max * 0.5 ? cut.slice(0, space) : cut).replace(/[,;:\s]+$/, "")}…`;
}

/**
 * Country names as English prose writes them, longest first, to their code: the runtime's own English name of every
 * assigned ISO 3166-1 alpha-2 code, plus the everyday names it lacks.
 */
/** ISO 3166-1 alpha-2, the officially assigned codes (no withdrawn or reserved code: the runtime also names "DD" Germany). */
const ISO_CODES =
    "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ " +
    "DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT " +
    "JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ " +
    "OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ " +
    "UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW";
/** Names that are far more often something else in a habitat text: Georgia (the US state), Jersey, Chad, Antarctica (not a country). */
const NOT_COUNTRIES = new Set(["GE", "JE", "TD", "AQ"]);
const ALIASES: Record<string, string> = {
    "United States": "US",
    "United States of America": "US",
    "USA": "US",
    "United Kingdom": "GB",
    "Great Britain": "GB",
    "Britain": "GB",
    "England": "GB",
    "Scotland": "GB",
    "Wales": "GB",
    "Czech Republic": "CZ",
    "Ivory Coast": "CI",
    "Democratic Republic of the Congo": "CD",
    "Republic of the Congo": "CG",
    "Burma": "MM",
    "Myanmar": "MM",
    "Türkiye": "TR",
    "Vietnam": "VN",
    "Laos": "LA",
    "Russia": "RU",
    "South Korea": "KR",
    "North Korea": "KP",
    "Tanzania": "TZ",
    "Bolivia": "BO",
    "Venezuela": "VE",
    "Iran": "IR",
    "Syria": "SY",
    "Brunei": "BN",
    "East Timor": "TL",
    "Timor-Leste": "TL",
    "Cape Verde": "CV",
    "Eswatini": "SZ",
    "Swaziland": "SZ",
    "The Gambia": "GM",
    "Gambia": "GM",
    "Bahamas": "BS",
    "Philippines": "PH",
    "Netherlands": "NL"
};
/** Places whose name holds a country's name and is not that country: blanked before the countries are read. */
const NOT_THAT_COUNTRY = /\b(?:(?<!Papua )New Guinea|New Mexico|Gulf of Mexico|Gulf of Guinea|Guinea[- ]?(?:fowl|pig|worm)s?|South China Sea|East China Sea|Sea of Japan|Niger (?:Delta|River|Basin)|River Niger|Congo (?:Basin|River)|Indian Ocean|New South Wales|Western Australia|South Australia|Northern Ireland|New England|Baja California|South Georgia|Jordan (?:River|Valley)|Lake Malawi|Lake Chad|Panama Canal|Turkey (?:Vulture|Creek)|Mongolian Plateau)\b/g;

let lexicon: Array<[RegExp, string]> | null = null;

function countryLexicon(): Array<[RegExp, string]> {
    if (lexicon) return lexicon;
    const names = new Map<string, string>(Object.entries(ALIASES));
    try {
        const display = new Intl.DisplayNames(["en"], {type: "region"});
        const unknown = display.of("ZZ");
        for (const code of ISO_CODES.split(" ")) {
            if (NOT_COUNTRIES.has(code)) continue;
            let name: string | undefined;
            try {
                name = display.of(code);
            } catch {
                name = undefined;
            }
            if (!name || name === code || name === unknown || name.length < 4) continue;
            if (!names.has(name)) names.set(name, code);
        }
    } catch {
        // No region names in this runtime: the everyday names above still read.
    }
    const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    lexicon = [...names.entries()]
        .sort((x, y) => y[0].length - x[0].length || x[0].localeCompare(y[0]))
        .map(([name, code]) => [new RegExp(`(?<![\\p{L}-])${escape(name)}(?![\\p{L}-])`, "u"), code]);
    return lexicon;
}

/**
 * The countries a field-guide text names, in the order it names them, at most `max`. Case-sensitive whole names only
 * (a "turkey" or a "guinea fowl" is not a country); a longer name is read before a shorter one inside it ("Papua New
 * Guinea" is not Guinea, "South Sudan" is not Sudan).
 */
export function arkCrisisCountriesFrom(raw: unknown, max = 8): string[] {
    let prose = habitatProse(raw).replace(NOT_THAT_COUNTRY, (hit) => " ".repeat(hit.length));
    if (!prose) return [];
    const found: Array<{at: number; code: string}> = [];
    for (const [pattern, code] of countryLexicon()) {
        for (;;) {
            const hit = pattern.exec(prose);
            if (!hit) break;
            found.push({at: hit.index, code});
            prose = prose.slice(0, hit.index) + " ".repeat(hit[0].length) + prose.slice(hit.index + hit[0].length);
        }
    }
    const out: string[] = [];
    for (const one of found.sort((a, b) => a.at - b.at)) {
        if (!out.includes(one.code)) out.push(one.code);
        if (out.length >= max) break;
    }
    return out;
}

export type ArkCrisesBody = {available: boolean; ark_day?: number; as_of?: string; crises: Array<Record<string, unknown>>};

/**
 * `voyage_crises_v1`'s answer as the route sends it: each row with its one habitat sentence and its countries, a page
 * slug only for a species page that exists, and nothing the contract does not name. Null when it is not an answer.
 */
export function shapeArkCrises(raw: unknown, pageExists: (slug: string) => boolean): ArkCrisesBody | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const body = raw as Record<string, unknown>;
    if (body.available === false) return {available: false, crises: []};
    if (!Array.isArray(body.crises)) return null;
    const crises: Array<Record<string, unknown>> = [];
    for (const item of body.crises) {
        if (!item || typeof item !== "object") continue;
        const row = item as Record<string, unknown>;
        const page = typeof row.page_slug === "string" && row.page_slug && pageExists(row.page_slug) ? row.page_slug : null;
        crises.push({
            id: row.id,
            species_profile_id: row.species_profile_id,
            name: row.name,
            scientific_name: row.scientific_name ?? null,
            model_slug: row.model_slug ?? null,
            page_slug: page,
            band: row.band,
            status: row.status,
            wild_count: row.wild_count,
            opened_ark_day: row.opened_ark_day ?? null,
            opened_at: row.opened_at,
            ended_ark_day: row.ended_ark_day ?? null,
            ended_at: row.ended_at ?? null,
            last_animal_ids: Array.isArray(row.last_animal_ids) ? row.last_animal_ids.slice(0, 2) : [],
            habitat: arkCrisisHabitat(row.habitat),
            countries: arkCrisisCountriesFrom(row.habitat)
        });
    }
    return {
        available: true,
        ...(typeof body.ark_day === "number" ? {ark_day: body.ark_day} : {}),
        ...(typeof body.as_of === "string" ? {as_of: body.as_of} : {}),
        crises
    };
}
