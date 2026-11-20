import assert from "node:assert/strict";
import {existsSync, readFileSync, readdirSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import {ARK_LANGUAGES} from "@/lib/ark-languages";
import {arkCompactHistory, decodeArkHistory} from "@/lib/ark-population-history";
import {
    ARK_BREEDER_MIN_ADULTS,
    ARK_PLACES,
    arkBirthTotals,
    arkBreeders,
    arkIsVertebrate,
    arkPlaceOf,
    arkReadEvents,
    arkRiskRanking,
    arkSurvivalByPlace,
    type ArkGroup
} from "@/lib/ark-rankings";
import {arkChancePercent, arkCauseBars, arkFocusPath, arkHuntingLine, arkPercent, arkPlaceCards, arkSafestPlace} from "@/lib/ark-rankings-text";
import type {ArkRankingsWords} from "@/lib/ark-rankings-words";

const DAY = 86_400_000;
const NOW = Date.parse("2026-11-20T06:00:00Z");

// MARK: Places

test("a place is the zoo, a farm, a home, the town's wildlife or the wild island", () => {
    assert.equal(arkPlaceOf({island: "town", area: "zoo"}), "zoo");
    assert.equal(arkPlaceOf({island: "town", area: "farm"}), "farm");
    assert.equal(arkPlaceOf({island: "town", area: "house"}), "house");
    assert.equal(arkPlaceOf({island: "town", area: null}), "town");
    assert.equal(arkPlaceOf({island: "wild", area: null}), "wild");
    // The one island of an older read (no island): the wild one.
    assert.equal(arkPlaceOf({}), "wild");
    assert.deepEqual([...ARK_PLACES], ["zoo", "farm", "house", "town", "wild"]);
});

// MARK: The event log

function event(id: number, kind: string, at: number, animalId: string, island: string, area: string | null, status: string) {
    return {id, kind, at: new Date(at).toISOString(), animal: {id: animalId, island, area, status}};
}

test("the log's rows become flows and deaths: each row once, other kinds and malformed rows left out", () => {
    const rows = [
        event(1, "arrival", NOW - 6 * DAY, "a", "wild", null, "present"),
        event(2, "birth", NOW - 5 * DAY, "b", "town", null, "present"),
        event(3, "revived", NOW - 4 * DAY, "c", "town", "house", "present"),
        event(4, "death_old", NOW - 3 * DAY, "d", "wild", null, "died_old"),
        event(5, "starved", NOW - 2 * DAY, "e", "town", "zoo", "starved"),
        event(6, "eaten", NOW - DAY, "f", "wild", null, "eaten"),
        event(6, "eaten", NOW - DAY, "f", "wild", null, "eaten"),
        event(7, "mated", NOW - DAY, "g", "wild", null, "present"),
        {id: 8, kind: "death_old", at: "not a time", animal: {id: "h"}},
        {id: 9, kind: "death_old", at: new Date(NOW).toISOString(), animal: null},
        "junk",
        null
    ];
    const {flows, falls} = arkReadEvents({events: rows});
    assert.equal(flows.length, 6);
    assert.deepEqual(flows.map((flow) => flow.delta), [1, 1, 1, -1, -1, -1]);
    assert.deepEqual(flows.map((flow) => flow.place), ["wild", "town", "house", "wild", "zoo", "wild"]);
    assert.deepEqual(falls.map((fall) => [fall.animalId, fall.cause, fall.status]), [["d", "old", "died_old"], ["e", "starved", "starved"], ["f", "eaten", "eaten"]]);
    assert.deepEqual(arkReadEvents([]), {flows: [], falls: []});
});

// MARK: Survival by place

type Pick3 = Pick<ArkAnimal, "id" | "island" | "area">;
const aboard = (n: number, island: string, area: string | null, prefix: string): Pick3[] => Array.from({length: n}, (_, i) => ({id: `${prefix}${i}`, island: island as Pick3["island"], area: area as Pick3["area"]}));

test("survival by place: alive, recovering and lost for good, with the share still alive", () => {
    const animals = [...aboard(8, "wild", null, "w"), ...aboard(10, "town", "zoo", "z")];
    const rows = [
        // Two wild animals lost for good (one died twice: only its last death counts), one recovering, one back (alive now).
        event(1, "death_old", NOW - DAY / 2, "lost1", "wild", null, "died_old"),
        event(2, "death_old", NOW - 2 * DAY, "lost2", "wild", null, "died_old"),
        event(3, "death_old", NOW - 3 * DAY, "lost2", "wild", null, "died_old"),
        event(4, "death_old", NOW - DAY, "rec1", "wild", null, "recovering"),
        event(5, "death_old", NOW - 4 * DAY, "w0", "wild", null, "present"),
        event(6, "revived", NOW - 3 * DAY, "w0", "wild", null, "present")
    ];
    const survival = arkSurvivalByPlace(animals, arkReadEvents({events: rows}), NOW);
    const wild = survival.places.find((place) => place.place === "wild")!;
    const zoo = survival.places.find((place) => place.place === "zoo")!;
    assert.equal(wild.alive, 8);
    assert.equal(wild.lost, 2);
    assert.equal(wild.recovering, 1);
    assert.equal(wild.everThere, 11);
    assert.ok(Math.abs(wild.share! - 9 / 11) < 1e-9);
    assert.equal(zoo.lost, 0);
    assert.equal(zoo.share, 1);
    // Causes: every death is a fall (w0's too; a return is not one); only the animals that did not come back are lost for good.
    assert.deepEqual(survival.causes.falls, {old: 5, starved: 0, eaten: 0});
    assert.deepEqual(survival.causes.lostForGood, {old: 2, starved: 0, eaten: 0});
    assert.equal(survival.windowDays, 7);
});

test("a death in the log of an animal the snapshot still has aboard is not a loss", () => {
    const animals = aboard(3, "wild", null, "w");
    const rows = [event(1, "eaten", NOW - DAY, "w1", "wild", null, "eaten")];
    const wild = arkSurvivalByPlace(animals, arkReadEvents(rows), NOW).places.find((place) => place.place === "wild")!;
    assert.equal(wild.lost, 0);
    assert.equal(wild.everThere, 3);
});

test("the daily losses count back from now, per 100 animals aboard that day, and say whether losses are rising", () => {
    const animals = aboard(100, "town", null, "t");
    // One loss in each of the first five days, then four a day for the last two: losses are rising.
    const rows: ReturnType<typeof event>[] = [];
    let id = 0;
    for (let day = 6; day >= 0; day--) {
        const count = day <= 1 ? 4 : 1;
        for (let i = 0; i < count; i++) rows.push(event(++id, "death_old", NOW - day * DAY - DAY / 2 - i * 1000, `gone-${day}-${i}`, "town", null, "died_old"));
    }
    const town = arkSurvivalByPlace(animals, arkReadEvents(rows), NOW).places.find((place) => place.place === "town")!;
    assert.deepEqual(town.lostDaily, [1, 1, 1, 1, 1, 4, 4]);
    assert.equal(town.ratePer100.length, 7);
    assert.ok(town.ratePer100[6] > town.ratePer100[0]);
    assert.equal(town.trend, "more");
    // Calm: the same loss every day.
    const calm = arkSurvivalByPlace(animals, arkReadEvents(Array.from({length: 7}, (_, i) => event(100 + i, "death_old", NOW - i * DAY - DAY / 2, `calm${i}`, "town", null, "died_old"))), NOW).places.find((place) => place.place === "town")!;
    assert.equal(calm.trend, "steady");
});

test("the population a day started with is today's less every change since", () => {
    const animals = aboard(10, "wild", null, "w");
    // Six arrivals in the last 12 hours: the last day started with four aboard.
    const rows = Array.from({length: 6}, (_, i) => event(i + 1, "arrival", NOW - 6 * 3_600_000 - i * 1000, `new${i}`, "wild", null, "present"));
    rows.push(event(20, "death_old", NOW - 3_600_000, "w0", "wild", null, "died_old"));
    const wild = arkSurvivalByPlace(animals.slice(1), arkReadEvents(rows), NOW).places.find((place) => place.place === "wild")!;
    // aboard now 9; since the last day began: +6 arrivals, -1 death: it began with 9 - 5 = 4.
    assert.ok(Math.abs(wild.ratePer100[6] - (1 / 4) * 100) < 1e-9, `${wild.ratePer100[6]}`);
});

// MARK: Groups and risk

const groups = new Map<string, ArkGroup>([["kind-vole", "mammal"], ["kind-moth", "insect"], ["kind-finch", "bird"], ["kind-trout", "fish"]]);
const groupOf = (id: string) => groups.get(id) ?? null;

function animal(kind: string, slug: string, over: Partial<ArkAnimal> = {}): ArkAnimal {
    return {
        id: `${kind}-${Math.random().toString(36).slice(2, 10)}`,
        species_profile_id: kind,
        name: slug,
        scientific_name: null,
        model_slug: slug,
        zone: "woodland",
        arrived_at: "2026-11-10T00:00:00Z",
        brought_by: {label: "Voyager", named: false},
        mine: false,
        origin: "arrived",
        island: "wild",
        area: null,
        condition: "well_fed",
        born_ark_day: 150,
        lifespan_days: 3650,
        lifespan_estimate: false,
        ...over
    } as ArkAnimal;
}

function snapshotOf(animals: ArkAnimal[], arkDay = 300): ArkSnapshot {
    return {voyage: {slug: "first", name: "The first Ark", started_at: "2026-11-08T21:45:21Z"}, counts: {animals: animals.length, species: new Set(animals.map((a) => a.species_profile_id)).size, founders: 0}, zones: [], animals, as_of: "2026-11-20T06:00:00Z", ark_day: arkDay};
}

test("the least chance of another Ark year comes first, the soonest end settles a tie, and the model's own chance is used", () => {
    const animals = [
        animal("kind-vole", "field-vole", {lifespan_days: 3650}),
        animal("kind-moth", "moth-a", {lifespan_days: 20, born_ark_day: 295}),
        animal("kind-moth", "moth-b", {lifespan_days: 40, born_ark_day: 295}),
        animal("kind-finch", "finch", {lifespan_days: 700, born_ark_day: 100})
    ];
    const risk = arkRiskRanking(snapshotOf(animals), () => null, groupOf);
    // Both moths are at the model's floor; the one with less time left is first.
    assert.deepEqual(risk.animals.map((row) => row.animal.model_slug), ["moth-a", "moth-b", "finch", "field-vole"]);
    assert.ok(risk.animals[0].chance <= risk.animals[1].chance);
    assert.ok(risk.animals[0].left && risk.animals[1].left && risk.animals[0].left.lowDays <= risk.animals[1].left.lowDays);
    assert.ok(risk.animals.every((row) => row.outlook), "the rows shown carry the card's whole block");
    assert.equal(risk.considered, 4);
});

test("a kind's chance is that at least one of its animals is still aboard; one nothing bounds is never at risk", () => {
    const animals = [
        animal("kind-moth", "moth", {lifespan_days: 30, born_ark_day: 299}),
        animal("kind-vole", "vole-a", {lifespan_days: 400, born_ark_day: 100}),
        animal("kind-vole", "vole-b", {lifespan_days: 400, born_ark_day: 100}),
        animal("kind-finch", "finch-a", {lifespan_days: 3650}),
        // A finch with no lifespan: nothing bounds it, so the kind cannot be at risk.
        animal("kind-finch", "finch-b", {lifespan_days: null})
    ];
    const risk = arkRiskRanking(snapshotOf(animals), () => null, groupOf);
    const byKind = new Map(risk.kinds.map((kind) => [kind.kindId, kind]));
    assert.ok(!byKind.has("kind-finch"));
    assert.equal(risk.unbounded, 1);
    const moth = byKind.get("kind-moth")!;
    const vole = byKind.get("kind-vole")!;
    assert.ok(moth.persistence < vole.persistence);
    assert.equal(moth.group, "insect");
    assert.equal(vole.aboard, 2);
    // Two voles: the kind's chance is above either one's own.
    assert.ok(vole.persistence >= vole.worst.chance);
    assert.equal(risk.kindRank.get("kind-moth"), 1);
    assert.equal(risk.kindRank.get("kind-vole"), 2);
});

test("every group's least-safe kinds are kept even when the overall cut would drop them", () => {
    const animals = [
        ...Array.from({length: 8}, (_, i) => animal(`kind-moth-${i}`, `moth-${i}`, {lifespan_days: 20, born_ark_day: 295})),
        animal("kind-vole", "vole", {lifespan_days: 500, born_ark_day: 100})
    ];
    const map = new Map<string, ArkGroup>([["kind-vole", "mammal"], ...animals.slice(0, 8).map((a): [string, ArkGroup] => [a.species_profile_id, "insect"])]);
    const risk = arkRiskRanking(snapshotOf(animals), () => null, (id) => map.get(id) ?? null, {limit: 3, perGroup: 2});
    assert.ok(risk.kinds.some((kind) => kind.group === "mammal"), "the mammal is kept beyond the overall three");
    // The three least overall (every animal here is on the wild island, whose own two least are among them).
    assert.equal(risk.animals.length, 3);
    // Its overall rank is where the full order puts it, not its place in the cut list.
    assert.equal(risk.kindRank.get("kind-vole"), 9);
    assert.equal(risk.animalRank.get(risk.animals[0].animal.id), 1);
});

test("the vertebrates are mammals, birds, reptiles, amphibians and fish", () => {
    for (const group of ["mammal", "bird", "reptile", "amphibian", "fish"] as const) assert.equal(arkIsVertebrate(group), true, group);
    for (const group of ["insect", "other", null] as const) assert.equal(arkIsVertebrate(group), false, String(group));
});

// MARK: Fastest breeders

function history(span: "hour" | "day", t0: string, steps: unknown[][], base: unknown[][] = []) {
    const hours = span === "hour";
    return decodeArkHistory(
        arkCompactHistory({
            available: true,
            bucket: span,
            bucket_seconds: hours ? 3600 : 86400,
            t0,
            since: t0,
            as_of: "2026-11-20T06:00:00Z",
            first_at: "2026-11-08T21:45:00Z",
            started_at: "2026-11-08T21:45:21Z",
            base,
            steps,
            gone: {}
        })
    )!;
}

test("young per adult: births since the record began over the grown animals aboard, a pair at least, the most first", () => {
    const grown = (kind: string, slug: string, n: number) => Array.from({length: n}, () => animal(kind, slug, {born_ark_day: 100, lifespan_days: 1000}));
    const youngOne = animal("kind-vole", "vole", {origin: "born", born_ark_day: 299, lifespan_days: 1000});
    const snapshot = snapshotOf([...grown("kind-moth", "moth", 4), ...grown("kind-vole", "vole", 2), youngOne, ...grown("kind-finch", "finch", 1), ...grown("kind-trout", "trout", 5)]);
    // Whole record by the day: moth 12 born, vole 3, finch 2 (one grown aboard: left out), trout 0 (left out).
    const all = history("day", "2026-11-08T00:00:00Z", [["kind-moth", 0, 4, 0, 7, 0, 0, 0], ["kind-moth", 0, 11, 0, 5, 0, 0, 0], ["kind-vole", 0, 11, 0, 3, 0, 0, 0], ["kind-finch", 0, 11, 0, 2, 0, 0, 0]]);
    // The last week by the hour (t0 = 7 days back): the moth's last 5 came in the last day, the vole's 3 in the week.
    const week = history("hour", "2026-11-13T06:00:00Z", [["kind-moth", 0, 166, 0, 2, 0, 0, 0], ["kind-moth", 0, 120, 0, 3, 0, 0, 0], ["kind-vole", 0, 100, 0, 3, 0, 0, 0]]);
    const rows = arkBreeders(snapshot, week, all, groupOf);
    assert.deepEqual(rows.map((row) => row.slug), ["moth", "vole"]);
    const [moth, vole] = rows;
    assert.equal(moth.bornAll, 12);
    assert.equal(moth.adults, 4);
    assert.equal(moth.youngPerAdult, 3);
    assert.equal(moth.bornDay, 2);
    assert.equal(moth.bornWeek, 5);
    assert.equal(moth.group, "insect");
    // The young vole is aboard but not grown: two grown voles, three births.
    assert.equal(vole.aboard, 3);
    assert.equal(vole.adults, 2);
    assert.equal(vole.youngPerAdult, 1.5);
    assert.equal(vole.bornWeek, 3);
    assert.equal(vole.bornDay, 0);
    assert.ok(ARK_BREEDER_MIN_ADULTS >= 2);
    assert.deepEqual(arkBirthTotals(week, all), {day: 2, week: 8, all: 17});
});

// MARK: Words and rows

const WORDS = JSON.parse(readFileSync(path.join("src/data/locales", "en.json"), "utf8")).ark.rankings as ArkRankingsWords;

test("percentages and chances read as the Ark card's (1 to 99), in the reader's language", () => {
    assert.equal(arkChancePercent(0), 1);
    assert.equal(arkChancePercent(0.004), 1);
    assert.equal(arkChancePercent(0.5), 50);
    assert.equal(arkChancePercent(1), 99);
    assert.equal(arkPercent(0.9286, "en", 1), "92.9%");
    assert.equal(arkPercent(1, "en", 1), "100%");
    assert.equal(arkPercent(1.4, "en"), "100%");
    assert.equal(arkPercent(-1, "en"), "0%");
    // An unknown locale reads as English rather than throwing.
    assert.equal(arkPercent(0.5, "not a locale!"), "50%");
    assert.equal(arkFocusPath("a b/c"), "/ark?focus=a%20b%2Fc");
});

test("the place cards, the safest place and the cause bars read from a survival", () => {
    const animals = [...aboard(30, "wild", null, "w"), ...aboard(30, "town", "zoo", "z"), ...aboard(2, "town", "farm", "f")];
    const rows = [event(1, "death_old", NOW - DAY, "x1", "wild", null, "died_old"), event(2, "death_old", NOW - DAY, "x2", "wild", null, "died_old"), event(3, "starved", NOW - DAY, "x3", "wild", null, "starved")];
    const survival = arkSurvivalByPlace(animals, arkReadEvents(rows), NOW);
    const cards = arkPlaceCards(survival, WORDS, "en");
    // Places nobody was in are not cards.
    assert.deepEqual(cards.map((card) => card.place), ["zoo", "farm", "wild"]);
    assert.equal(cards[0].alive, "100% still alive");
    assert.match(cards[2].line, /3 lost for good · 0 recovering · 30 aboard/);
    assert.equal(cards[2].series.length, 7);
    // The farm has only two animals: too few to call it the safest.
    assert.equal(arkSafestPlace(survival)?.place, "zoo");
    const bars = arkCauseBars(survival, WORDS, "en");
    assert.deepEqual(bars.map((bar) => [bar.cause, bar.falls, bar.lost]), [["old", 2, 2], ["starved", 1, 1], ["eaten", 0, 0]]);
    assert.ok(Math.abs(bars[0].share - 2 / 3) < 1e-9);
});

test("the hunting line says when the protection ends, or that hunting is on, and nothing when that is not published", () => {
    const report = (state: "protected" | "on" | "unknown", endsArkDay: number | null, inDays: number | null) => ({hunt: {state, endsArkDay, inDays}, hunting: "counted" as const});
    assert.equal(arkHuntingLine(report("protected", 443.6, 5.7), WORDS, "en"), "Hunting has not started: the launch protection lasts until Ark day 444, about 6 real days from now.");
    assert.equal(arkHuntingLine(report("on", 400, null), WORDS, "en"), "Hunting is on.");
    assert.equal(arkHuntingLine(report("unknown", null, null), WORDS, "en"), "");
});

// MARK: The words in 45 languages

const LOCALES = path.join("src/data/locales");

function rankingsOf(language: string): Record<string, unknown> {
    const file = language === "en" || language === "id" ? path.join(LOCALES, `${language}.json`) : path.join(LOCALES, "ark", `${language}.json`);
    const rankings = JSON.parse(readFileSync(file, "utf8")).ark.rankings;
    assert.ok(rankings, `${language} has no ark.rankings`);
    return rankings;
}

function flat(value: unknown, prefix = "", into = new Map<string, string>()): Map<string, string> {
    if (value && typeof value === "object") for (const [key, child] of Object.entries(value as Record<string, unknown>)) flat(child, prefix ? `${prefix}.${key}` : key, into);
    else into.set(prefix, String(value));
    return into;
}

test("the ranking pages' words are in all 45 languages, and every one of them is translated", () => {
    const english = flat(rankingsOf("en"));
    assert.ok(english.size >= 110, `${english.size} English words`);
    for (const language of ARK_LANGUAGES.filter((code) => code !== "en")) {
        const local = flat(rankingsOf(language));
        assert.deepEqual(Array.from(local.keys()), Array.from(english.keys()), `${language}: the same keys in the same order`);
        const same = Array.from(english).filter(([key, text]) => local.get(key) === text && /[A-Za-z]{4,}/.test(text.replace(/\{\w+\}/g, "")));
        // A few words are the same in a sister language (a name, a short label): a bundle left in English is not.
        assert.ok(same.length <= 10, `${language} left ${same.length} words in English: ${same.slice(0, 6).map(([key]) => key).join(", ")}`);
    }
});

test("no ranking word has the ICU characters that break the Ark's formatter outside a placeholder", () => {
    for (const language of ARK_LANGUAGES) {
        for (const [key, text] of Array.from(flat(rankingsOf(language)))) {
            const rest = text.replace(/\{\w+\}/g, "");
            assert.ok(!/[{}]/.test(rest), `${language} ${key}: stray brace in ${text}`);
            assert.ok(text.trim().length > 0, `${language} ${key} is empty`);
        }
    }
});

// MARK: The pages are static, cached and light

const read = (file: string) => readFileSync(file, "utf8");
const TIER = "src/app/[locale]/(composited)/tier-list";

test("both pages and their language routes are static: revalidated, no searchParams, no cookies, no dynamic rendering", () => {
    for (const slug of ["ark-survival", "ark-fastest-breeders"]) {
        for (const file of [`${TIER}/${slug}/page.tsx`, `${TIER}/${slug}/lang/[lang]/page.tsx`]) {
            const source = read(file);
            assert.match(source, /export const revalidate = 3600/, file);
            assert.match(source, /export function generateStaticParams\(\)/, file);
            assert.doesNotMatch(source, /searchParams|cookies\(|headers\(|force-dynamic/, file);
        }
        assert.match(read(`${TIER}/${slug}/lang/[lang]/page.tsx`), /arkLanguage\(params\.lang\)/, "an unknown language is a 404");
    }
});

test("?lang= lands on the language route, and the plain URL carries the structured data, canonical and hreflang of the tier lists", () => {
    const config = read("next.config.js");
    assert.match(config, /\["ark-survival", "ark-fastest-breeders"\]\.map\(\(slug\) => \(\{\s*source: `\/tier-list\/\$\{slug\}`,\s*has: \[\{type: "query", key: "lang"/);
    assert.match(config, /destination: `\/tier-list\/\$\{slug\}\/lang\/:lang`/);
    const page = read("src/app/[locale]/(composited)/rankings/_components/ark-ranking-page.ts");
    assert.match(page, /buildContentMetadata/);
    assert.match(page, /robots: \{index: false, follow: true\}/);
    for (const schema of ['"Article"', '"ItemList"', '"FAQPage"', '"BreadcrumbList"']) assert.ok(page.includes(schema), schema);
});

test("the hub, the sitemap and the related lists name the Ark rankings", () => {
    const hub = read("src/app/[locale]/(composited)/rankings/page.tsx");
    assert.match(hub, /ARK_RANKING_SLUGS/);
    assert.match(hub, /FEATURED_TIER_LIST_SLUGS\.length, 0/, "after the featured lists, so they stay on page 1");
    const sitemap = read("src/lib/build-sitemap.ts");
    assert.match(sitemap, /ARK_RANKING_SLUGS\.map/);
    assert.match(sitemap, /hubPageEntries\(locale, tierListPagination, rankingPages\.length \+ ARK_RANKING_SLUGS\.length\)/);
    const detail = read("src/app/[locale]/(composited)/rankings/[slug]/page.tsx");
    assert.match(detail, /arkRankingRelatedTo\(ranking\.category\)/);
});

test("the ranking pages import nothing of the Ark's 3D scene (they are their own light routes)", () => {
    const files = [
        "src/lib/ark-rankings.ts",
        "src/lib/ark-rankings-text.ts",
        "src/lib/ark-rankings-words.ts",
        "src/data/ark-rankings.ts",
        "src/data/ark-ranking-pages.ts",
        `${TIER}/ark-survival/page.tsx`,
        `${TIER}/ark-fastest-breeders/page.tsx`,
        ...readdirSync("src/app/[locale]/(composited)/rankings/_components").filter((file) => file.startsWith("ark-")).map((file) => `src/app/[locale]/(composited)/rankings/_components/${file}`)
    ].filter(existsSync);
    assert.ok(files.length >= 10);
    // `ark-scene/types` is types only, `placeholder-icon` is the generic figure (no three.js), `stats` is the survival model's table; nothing else.
    const allowed = /@\/ark-scene\/(types|placeholder-icon|stats|snapshot)"/;
    for (const file of files) {
        for (const line of read(file).split("\n").filter((text) => /^import .*@\/ark-scene\//.test(text))) assert.match(line, allowed, `${file}: ${line}`);
    }
});
