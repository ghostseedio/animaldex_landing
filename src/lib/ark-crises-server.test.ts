import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {decodeArkCrises} from "./ark-crises";
import {arkCrisesFixture} from "./ark-crises-fixture";
import {arkCrisisCountriesFrom, arkCrisisHabitat, arkCrisisIdParam, shapeArkCrises} from "./ark-crises-server";

const BOAR = "Native range keys: europe, north_africa_middle_east, east_asia. Broadleaf and mixed forest, especially oak and beech woods, together with reed beds, marshes, scrub, steppe edges and farmland with nearby cover, from lowlands into mountains. It needs dense cover to lie up in and water within reach.";

/** `voyage_crises_v1`'s answer (AnimalDex migration 20261203160000): the contract's rows with the stored habitat text and no countries. */
function serverAnswer() {
    const answer = arkCrisesFixture(Date.parse("2026-11-27T08:10:00Z"), true);
    const texts: Record<string, string | null> = {
        "Wild Boar": BOAR,
        "Red Squirrel": "Native range keys: europe. Conifer and mixed woodland with a continuous canopy, in France, Sweden and the United Kingdom.",
        "Eurasian Lynx": null
    };
    return {
        ...answer,
        crises: answer.crises.map((row) => {
            const {countries: _countries, ...rest} = row;
            return {...rest, habitat: texts[String(row.name)] ?? row.habitat ?? null};
        })
    };
}

test("habitat: one sentence, without the range-keys line, cut at a clause or a word when it is long", () => {
    assert.equal(arkCrisisHabitat("Native range keys: europe. Open farmland and grassland with hedges. It rests in a shallow form."), "Open farmland and grassland with hedges.");
    const long = arkCrisisHabitat(BOAR)!;
    assert.ok(long.length <= 160, `${long.length}`);
    assert.ok(long.startsWith("Broadleaf and mixed forest, especially oak and beech woods"));
    assert.ok(long.endsWith("…") && !/[,\s]…$/.test(long));
    assert.equal(
        arkCrisisHabitat("Native range keys: europe. Open woodland, woodland rides and edges, scrub, hedgerows, fens and gardens, wherever its buckthorn foodplants grow; in the north-west, buckthorn favours chalk and limestone and alder buckthorn damp, acid soils."),
        "Open woodland, woodland rides and edges, scrub, hedgerows, fens and gardens, wherever its buckthorn foodplants grow."
    );
    assert.equal(arkCrisisHabitat("Dry <b>tropical</b> islands"), "Dry tropical islands");
    assert.equal(arkCrisisHabitat("Native range keys: europe."), null);
    assert.equal(arkCrisisHabitat(null), null);
    assert.equal(arkCrisisHabitat(42), null);
});

test("countries: only the countries the text names, in its order, as codes; never a region key, a region or a look-alike", () => {
    assert.deepEqual(arkCrisisCountriesFrom("Native range keys: europe. Hedges in France, Germany and Poland."), ["FR", "DE", "PL"]);
    assert.deepEqual(arkCrisisCountriesFrom("Dry tropical islands and monsoon forest in parts of eastern Indonesia."), ["ID"]);
    // region keys and regions are not countries
    assert.deepEqual(arkCrisisCountriesFrom("Native range keys: southeast_asia, europe. Forests across Europe and Southeast Asia."), []);
    // a longer name is not the shorter one inside it; an island or a sea is not the country in its name
    assert.deepEqual(arkCrisisCountriesFrom("Rainforest in Papua New Guinea and South Sudan, and on New Guinea."), ["PG", "SS"]);
    assert.deepEqual(arkCrisisCountriesFrom("Reefs of the Gulf of Mexico and the South China Sea; deserts of New Mexico."), []);
    assert.deepEqual(arkCrisisCountriesFrom("Coasts of the Indian Ocean, from India to Australia."), ["IN", "AU"]);
    // words that are also names: only as a capitalised whole name, and never the ambiguous ones
    assert.deepEqual(arkCrisisCountriesFrom("It eats wild turkey eggs and guinea fowl in Georgia and Chad."), []);
    assert.deepEqual(arkCrisisCountriesFrom("Woods of England, Scotland, the United States and the USA."), ["GB", "US"]);
    assert.deepEqual(arkCrisisCountriesFrom("Nigeria, not its neighbour."), ["NG"]);
    assert.equal(arkCrisisCountriesFrom("Spain, France, Italy, Greece, Portugal, Germany, Poland, Sweden, Norway, Finland.").length, 8);
    assert.deepEqual(arkCrisisCountriesFrom(null), []);
});

test("the crisis id parameter: a uuid or nothing", () => {
    assert.equal(arkCrisisIdParam("6F3C0F4E-2f7b-4c53-9a31-1d6a8c0a5b01"), "6f3c0f4e-2f7b-4c53-9a31-1d6a8c0a5b01");
    assert.equal(arkCrisisIdParam("1; drop table"), null);
    assert.equal(arkCrisisIdParam(null), null);
});

test("the route's answer: the contract's keys and no other, a page slug only for a page that exists, and it decodes in the client", () => {
    const body = shapeArkCrises(serverAnswer(), (slug) => slug !== "red-squirrel")!;
    assert.equal(body.available, true);
    assert.equal(body.as_of, "2026-11-27T08:10:00.000Z");
    const contract = JSON.parse(readFileSync(path.join(__dirname, "ark-crises-contract-keys.json"), "utf8")) as string[];
    for (const row of body.crises) assert.deepEqual(Object.keys(row).sort(), [...contract].sort());
    const boar = body.crises.find((row) => row.name === "Wild Boar")!;
    assert.equal(boar.page_slug, "wild-boar");
    assert.deepEqual(boar.countries, []);
    assert.ok(String(boar.habitat).length <= 160);
    const squirrel = body.crises.find((row) => row.name === "Red Squirrel")!;
    assert.equal(squirrel.page_slug, null);
    assert.equal(squirrel.habitat, "Conifer and mixed woodland with a continuous canopy, in France, Sweden and the United Kingdom.");
    assert.deepEqual(squirrel.countries, ["FR", "SE", "GB"]);
    const lynx = body.crises.find((row) => row.name === "Eurasian Lynx")!;
    assert.deepEqual([lynx.habitat === null || typeof lynx.habitat === "string", lynx.countries], [true, lynx.countries]);
    // nothing about a person, a capture or a place finer than a country can be in it
    const said = JSON.stringify(body);
    for (const never of ["user", "owner", "bringer", "capture", "latitude", "longitude", "city", "predator", "estimate"]) assert.ok(!said.includes(never), never);
    // and the clients' decoder takes every row
    const decoded = decodeArkCrises(body)!;
    assert.equal(decoded.length, body.crises.length);
    assert.deepEqual(decoded.find((one) => one.name === "Red Squirrel")!.countries, ["FR", "SE", "GB"]);
});

test("the route's answer: not available, and what is not an answer", () => {
    assert.deepEqual(shapeArkCrises({available: false, crises: []}, () => true), {available: false, crises: []});
    assert.deepEqual(shapeArkCrises({available: true, ark_day: 262.4, as_of: "2026-11-27T08:10:00Z", crises: []}, () => true), {available: true, ark_day: 262.4, as_of: "2026-11-27T08:10:00Z", crises: []});
    assert.equal(shapeArkCrises(null, () => true), null);
    assert.equal(shapeArkCrises([], () => true), null);
    assert.equal(shapeArkCrises({available: true}, () => true), null);
});
