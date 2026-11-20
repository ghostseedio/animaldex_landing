/**
 * Male and female, said (the coordinator, 2026-11-20): ♂ / ♀ beside an animal's name in its panel and in the species list's rows, with
 * accessible labels in the 45 Ark languages; a kind with no sexes says so. The server sends `sex` ("m", "f" or null) for every animal
 * and `reproduction` for a kind that is not a male and a female, only while its `sexes` switch is on; with it off nothing is said.
 */
import assert from "node:assert/strict";
import {readFileSync, readdirSync} from "node:fs";
import test from "node:test";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import type {ArkAnimal} from "@/ark-scene/types";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkSexView, type ArkSexWords} from "@/lib/ark-sex";
import ArkSex from "@/app/[locale]/(composited)/ark/ark-sex";
import {arkPopulation} from "@/lib/ark-population";

const EN = (JSON.parse(readFileSync("src/data/locales/en.json", "utf8")) as {ark: {sex: ArkSexWords}}).ark.sex;

test("one animal: ♂ or ♀ with its label; none stored: nothing", () => {
    assert.deepEqual(arkSexView([{sex: "m"}], EN), {text: "♂", label: "male", note: false});
    assert.deepEqual(arkSexView([{sex: "f"}], EN), {text: "♀", label: "female", note: false});
    assert.equal(arkSexView([{sex: null}], EN), null, "a sexual kind with no sex stored (a human): nothing");
});

test("with the server's switch off no animal carries sex: nothing is said, for one animal or a row", () => {
    assert.equal(arkSexView([{}], EN), null);
    assert.equal(arkSexView([{}, {}, {}], EN), null);
});

test("a species row: the tally, each count labelled; a sex with none is left out", () => {
    const row = [{sex: "m" as const}, {sex: "m" as const}, {sex: "m" as const}, {sex: "f" as const}, {sex: "f" as const}, {sex: "f" as const}, {sex: "f" as const}];
    assert.deepEqual(arkSexView(row, EN), {text: "♂3 ♀4", label: "male: 3, female: 4", note: false});
    assert.deepEqual(arkSexView([{sex: "f"}, {sex: "f"}], EN), {text: "♀2", label: "female: 2", note: false});
    assert.deepEqual(arkSexView([{sex: "m"}, {sex: "f"}, {sex: null}], EN), {text: "♂1 ♀1", label: "male: 1, female: 1", note: false});
    assert.equal(arkSexView([{sex: null}, {sex: null}], EN), null);
});

test("a kind with no males and females says so, whatever its animals' sex", () => {
    assert.deepEqual(arkSexView([{sex: null, reproduction: "hermaphrodite"}], EN), {text: "Hermaphrodite", label: "Hermaphrodite", note: true});
    assert.equal(arkSexView([{sex: null, reproduction: "asexual"}, {sex: null, reproduction: "asexual"}], EN)?.text, "This kind has no males or females");
    assert.equal(arkSexView([{sex: "f", reproduction: "parthenogenetic"}], EN)?.text, "All female, no male needed");
    assert.equal(arkSexView([{sex: "f", reproduction: "sexual" as never}], EN)?.text, "♀", "an unknown mode is not a note");
});

test("no words, no say; a number reads in the locale", () => {
    assert.equal(arkSexView([{sex: "m"}], null), null);
    assert.equal(arkSexView([{sex: "m"}, {sex: "m"}], {male: "m", maleN: "{count}"}, (n) => `#${n}`)?.label, "#2");
});

test("the read's sex and mode reach the animal as sent: absent while the switch is off, present (null too) while it is on", () => {
    const row = (extra: Record<string, unknown>) => ({id: "a1", species_profile_id: "s1", name: "Goldfish", scientific_name: null, model_slug: "goldfish", zone: "farm_garden", arrived_at: "2026-11-01T00:00:00Z", brought_by: {label: "", named: false}, mine: false, ...extra});
    const snap = (extra: Record<string, unknown>) => decodeArkSnapshot({voyage: {slug: "first", name: "Ark", started_at: null}, counts: {animals: 1, species: 1, founders: 0}, zones: [], animals: [row(extra)], as_of: null})!.animals[0];
    assert.equal("sex" in snap({}), false);
    assert.equal(snap({sex: "m"}).sex, "m");
    assert.equal(snap({sex: null}).sex, null);
    assert.equal(snap({sex: null, reproduction: "hermaphrodite"}).reproduction, "hermaphrodite");
    assert.equal("reproduction" in snap({sex: "f"}) ? snap({sex: "f"}).reproduction : undefined, undefined);
});

test("the species list's row counts the sexes of the animals in it, from the read", () => {
    const animal = (id: string, sex: "m" | "f" | null) => ({id, species_profile_id: "sp-1", name: "Guppy", scientific_name: null, model_slug: "guppy", zone: "river_lake", arrived_at: `2026-11-0${id.length}T00:00:00Z`, brought_by: {label: "", named: false}, mine: false, sex}) as ArkAnimal;
    const snapshot = {voyage: {slug: "first", name: "Ark", started_at: null}, counts: {animals: 5, species: 1, founders: 0}, zones: [], animals: [animal("a", "m"), animal("bb", "f"), animal("ccc", "f"), animal("dddd", "f"), animal("eeeee", null)], as_of: null};
    const rows = arkPopulation(snapshot as never).regions.flatMap((r) => r.species);
    assert.equal(rows.length, 1);
    assert.equal(arkSexView(rows[0].animals, EN)?.text, "♂1 ♀3");
});

test("the lazy component: an image to a screen reader labelled male / female, the tally labelled, the kind's note; nothing with the switch off", () => {
    const html = (animals: Array<Partial<ArkAnimal>>, row = false) => renderToStaticMarkup(React.createElement(ArkSex, {animals, words: EN, locale: "en", row}));
    assert.match(html([{sex: "m"}]), /role="img" aria-label="male"[^>]*>♂</);
    assert.match(html([{sex: "f"}]), /aria-label="female"[^>]*>♀</);
    assert.match(html([{sex: "m"}, {sex: "f"}, {sex: "f"}], true), /aria-label="male: 1, female: 2"[^>]*>♂1 ♀2</);
    assert.match(html([{sex: null, reproduction: "hermaphrodite"}]), /aria-label="Hermaphrodite"[^>]*>Hermaphrodite</);
    assert.equal(html([{}]), "");
});

test("the words: every one of the 45 Ark languages says male, female, the two tallies and the three kinds' notes", () => {
    const sites = ["en", "id"].map((l) => [l, `src/data/locales/${l}.json`] as const);
    const bundles = readdirSync("src/data/locales/ark").filter((f) => f.endsWith(".json")).map((f) => [f.replace(/\.json$/, ""), `src/data/locales/ark/${f}`] as const);
    const all = [...sites, ...bundles];
    assert.equal(all.length, 45, "45 Ark languages");
    const keys = Object.keys(EN).sort();
    assert.deepEqual(keys, ["asexual", "female", "femaleN", "hermaphrodite", "male", "maleN", "parthenogenetic"]);
    const seen = new Map<string, string>();
    for (const [lang, file] of all) {
        const words = (JSON.parse(readFileSync(file, "utf8")) as {ark: {sex?: Record<string, string>}}).ark.sex;
        assert.ok(words, `${lang}: ark.sex`);
        assert.deepEqual(Object.keys(words).sort(), keys, `${lang}: keys`);
        for (const key of keys) assert.ok(typeof words[key] === "string" && words[key].trim().length > 0, `${lang}.${key}`);
        assert.ok(words.maleN.includes("{count}") && words.femaleN.includes("{count}"), `${lang}: tallies carry {count}`);
        assert.notEqual(words.male, words.female, `${lang}: male and female differ`);
        if (lang !== "en") seen.set(lang, words.male);
    }
    assert.notEqual(seen.get("de"), EN.male, "translated, not English copied");
    assert.notEqual(seen.get("ja"), EN.male);
});
