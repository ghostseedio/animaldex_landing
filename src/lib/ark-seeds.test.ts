import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {ARK_SEEDS_ABSENT, arkSeedCommitment, shapeArkSeeds} from "@/lib/ark-seeds";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

// Computed outside this code base (Python hashlib) from the database's own format.
const SEED_A = "a".repeat(64);
const COMMIT_A3 = "935f66664b5c4dde57cdd5ffe49555894125d34dd2523a9a793a5b1f62cf83e1";
const SEED_B = "0123456789abcdef".repeat(4);
const COMMIT_B0 = "213d078656a06344b58e87d6894fa135a7811a0440f96c276f8ab25310a38ad5";

const row = (over: Record<string, unknown> = {}) => ({
    year: 3,
    starts_ark_day: 1095,
    ends_ark_day: 1460,
    commitment: COMMIT_A3,
    committed_at: "2026-12-20T03:10:05Z",
    committed_ark_day: 1095.1,
    late: false,
    revealed: false,
    ...over
});
const answer = (years: unknown[], over: Record<string, unknown> = {}) => ({available: true, ark_day: 1200.5, voyage: "first", format: "x", years, ...over});

test("a commitment is the SHA-256 of 'animaldex-ark-seed-v1|<voyage>|<year>|<seed>', as the database computes it", () => {
    assert.equal(arkSeedCommitment("first", 3, SEED_A), COMMIT_A3);
    assert.equal(arkSeedCommitment("first", 0, SEED_B), COMMIT_B0);
    assert.notEqual(arkSeedCommitment("first", 4, SEED_A), COMMIT_A3, "the year is part of it");
    assert.notEqual(arkSeedCommitment("second", 3, SEED_A), COMMIT_A3, "the voyage is part of it");
});

test("not available, or not an answer: the calm empty state, or nothing", () => {
    assert.deepEqual(shapeArkSeeds({available: false, years: [row()]}), ARK_SEEDS_ABSENT);
    assert.equal(shapeArkSeeds(null), null);
    assert.equal(shapeArkSeeds([]), null);
    assert.equal(shapeArkSeeds("x"), null);
    assert.equal(shapeArkSeeds({available: true}), null, "available with no list of years is not an answer");
    assert.equal(shapeArkSeeds(answer([]))?.available, false, "no year, no section");
});

test("a year that is not over: its fingerprint, never its seed, even if the row somehow carries one", () => {
    const body = shapeArkSeeds(answer([row({seed: SEED_A, revealed: false})]));
    assert.equal(body?.available, true);
    const year = body!.years[0];
    assert.equal(year.commitment, COMMIT_A3);
    assert.equal(year.seed, null);
    assert.equal(year.revealed, false);
    assert.equal(year.matches, null);
    assert.ok(!JSON.stringify(body).includes(SEED_A), "the seed is nowhere in what is passed on");
});

test("a revealed year is checked here against its commitment", () => {
    const good = shapeArkSeeds(answer([row({revealed: true, seed: SEED_A})]))!.years[0];
    assert.equal(good.seed, SEED_A);
    assert.equal(good.matches, true);
    const wrong = shapeArkSeeds(answer([row({revealed: true, seed: "b".repeat(64)})]))!.years[0];
    assert.equal(wrong.matches, false, "a seed that does not hash to its commitment is flagged");
    const notASeed = shapeArkSeeds(answer([row({revealed: true, seed: "not a seed"})]))!.years[0];
    assert.equal(notASeed.seed, null);
    assert.equal(notASeed.revealed, false, "a revealed year with no usable seed is not shown as revealed");
});

test("bad rows are dropped, the rest kept, newest first, at most 60, one per year", () => {
    const rows = [
        row({year: 1, commitment: "ab".repeat(31)}),
        row({year: 1.5}),
        row({year: -1}),
        row({year: 2, committed_at: "yesterday"}),
        row({year: 3}),
        row({year: 3, late: true}),
        row({year: 5, commitment: COMMIT_B0, revealed: true, seed: SEED_B}),
        null,
        "x",
        row({year: 4, starts_ark_day: "soon"})
    ];
    const body = shapeArkSeeds(answer(rows))!;
    assert.deepEqual(body.years.map((y) => y.year), [5, 3]);
    assert.equal(body.years[1].late, false, "the first row of a year wins");
    const many = Array.from({length: 80}, (_, i) => row({year: i}));
    assert.equal(shapeArkSeeds(answer(many))!.years.length, 60);
    assert.equal(shapeArkSeeds(answer([row()], {voyage: "../x"}))!.voyage, "first", "a voyage name that is not a slug is not used");
});

test("the late flag and the Ark day are passed on, nothing else of the row", () => {
    const body = shapeArkSeeds(answer([row({late: true, internal: "nope", seed_secret: SEED_A})]))!;
    assert.deepEqual(Object.keys(body.years[0]).sort(), ["commitment", "committedArkDay", "committedAt", "endsArkDay", "late", "matches", "revealed", "seed", "startsArkDay", "year"]);
    assert.equal(body.years[0].late, true);
    assert.equal(body.arkDay, 1200.5);
});

test("the words: the fairness section exists in English and Indonesian with the same keys and placeholders", () => {
    const en = JSON.parse(read("data/locales/en.json")).pages.howItWorks.fair as Record<string, string>;
    const id = JSON.parse(read("data/locales/id.json")).pages.howItWorks.fair as Record<string, string>;
    assert.deepEqual(Object.keys(id).sort(), Object.keys(en).sort());
    for (const key of Object.keys(en)) {
        assert.ok(en[key].trim() && id[key].trim(), `${key} is empty`);
        const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join(",");
        assert.equal(placeholders(id[key]), placeholders(en[key]), `${key}: placeholders differ`);
    }
    for (const key of ["title", "p1", "p2", "p3", "p4", "seeds", "verify", "command"]) assert.ok(en[key], key);
    assert.match(en.command, /animaldex-ark-seed-v1\|first\|<year>\|<number>/);
    // Rules in plain words: nothing that predicts an outcome (no odds of anything, no countdown, no date in the future); the one look-ahead the Ark has, the estimated time left, is named as odds and not a promise.
    const rules = [en.p1, en.p2, en.p3, en.p4].join(" ");
    assert.ok(!/\b(will die|odds of|chance of|probability|expected to|likely to)\b/i.test(rules));
});

test("the page shows the section only while the seeds are published, in its own route, and /ark does not know of it", () => {
    const page = read("app/[locale]/(composited)/ark/how-it-works/page.tsx");
    assert.match(page, /const fair = seeds\?\.available === true;/);
    assert.match(page, /readArkSeeds\(revalidate\)/);
    assert.match(page, /fair \? \[\.\.\.SECTIONS\.slice\(0, -1\), "fair", SECTIONS\[SECTIONS\.length - 1\]\] : SECTIONS/);
    const component = read("app/[locale]/(composited)/ark/how-it-works/ark-fair-seeds.tsx");
    assert.doesNotMatch(component, /["']use client["']/);
    // /ark's JS budget is nearly spent: nothing of this may reach it.
    for (const file of ["app/[locale]/(composited)/ark/page.tsx", "app/[locale]/(composited)/ark/ark-view.tsx", "app/[locale]/(composited)/ark/ark-about.tsx", "app/[locale]/(composited)/ark/ark-intro.tsx"]) {
        const text = read(file);
        assert.doesNotMatch(text, /ark-seeds|ArkFairSeeds|how-it-works\/ark-fair/, file);
    }
    const route = read("app/api/ark/seeds/route.ts");
    assert.match(route, /voyage_year_seeds_public_v1/);
    assert.match(route, /shapeArkSeeds/);
});
