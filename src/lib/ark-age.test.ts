import assert from "node:assert/strict";
import test from "node:test";
import careTable from "@/ark-scene/care.json";
import {ageOf, chosenParent, speciesCare} from "@/lib/ark-age";
import {careFromText, careOf, decodeCare, encodeCare, independenceDays} from "@/lib/ark-care";

test("ark-care: the stored text's care, with the deciding sentence", () => {
    const pouch = careFromText("Females carry young in a backward-facing pouch and raise them from the safety of burrows.");
    assert.deepEqual([pouch?.kind, pouch?.basis], ["carry", "stated"]);
    assert.equal(careFromText("Chicks hatch covered in down and feed themselves within a day, staying close to the hen for several weeks.")?.kind, "follow");
    assert.equal(careFromText("The calf lies hidden for the first weeks before joining the herd.")?.kind, "follow");
    assert.equal(careFromText("Both parents feed the chicks, which fledge after about three weeks.")?.kind, "nest");
    assert.equal(careFromText("Females build nests and guard eggs and hatchlings.")?.kind, "guard");
    // "No care" wins over a nest word that is only about where eggs go.
    const beetle = careFromText("Females lay eggs on bird-nest material. There is no parental care.");
    assert.deepEqual([beetle?.kind, beetle?.basis, beetle?.phrase], ["none", "stated", "There is no parental care."]);
    assert.equal(careFromText("Females release many eggs into open water.")?.kind, "none");
    assert.equal(careFromText(""), null);
    assert.equal(careFromText("Reproduction has not been documented."), null);
});

test("ark-care: independence ages in days", () => {
    assert.equal(independenceDays("It is weaned at about six months."), 182);
    assert.equal(independenceDays("The chicks fledge after 3 to 4 weeks."), 25);
    assert.equal(independenceDays("Young are independent at 18 months."), 547);
    assert.equal(independenceDays("Chicks leave the nest within a day."), null);
    assert.equal(independenceDays("No numbers here."), null);
});

test("ark-care: a silent text, or an egg site of a reptile or an insect, takes the body plan's default, flagged", () => {
    assert.deepEqual(careOf(null, "mammal"), {kind: "follow", basis: "plan_default", independentDays: null, phrase: null});
    assert.equal(careOf(null, "bird").kind, "nest");
    assert.equal(careOf(null, "fish").kind, "none");
    assert.equal(careOf("Females lay eggs in burrows or termite mounds.", "reptile").basis, "plan_default");
    assert.equal(careOf("Females lay eggs in burrows or termite mounds.", "bird").kind, "nest");
    const row = encodeCare(careFromText("It is weaned at about six months and nursed in a den.")!);
    assert.deepEqual(decodeCare(row, "mammal").independentDays, 182);
});

test("ark-care: the shipped table reads from the stored text (kinds, days and bases only)", () => {
    const species = (careTable as unknown as {species: Record<string, [string, number, string]>}).species;
    assert.ok(Object.keys(species).length > 1500);
    for (const [slug, row] of Object.entries(species)) {
        assert.match(slug, /^[a-z0-9-]+$/);
        assert.ok(["f", "c", "n", "g", "x"].includes(row[0]) && ["s", "i"].includes(row[2]) && row[1] >= 0);
    }
    assert.equal(speciesCare("greater-bilby", "mammal").kind, "carry");
    assert.equal(speciesCare("northern-pike", "fish").kind, "none");
    assert.equal(speciesCare("cuban-crocodile", "reptile").kind, "guard");
    assert.equal(speciesCare("common-myna", "bird").independentDays, 21);
    assert.equal(speciesCare("not-a-species", "mammal").basis, "plan_default");
});

const ZEBRA = speciesCare("plains-zebra", "mammal");

test("ark-age: arrivals came aboard grown; old ones walk a little slower", () => {
    const arrival = ageOf({id: "a", origin: "arrived"}, 400, "mammal", ZEBRA);
    assert.deepEqual([arrival.stage, arrival.scale, arrival.follow, arrival.pace], ["adult", 1, null, 1]);
    const old = ageOf({id: "a", origin: "arrived", condition: "old"}, 400, "mammal", ZEBRA);
    assert.equal(old.stage, "old");
    assert.ok(old.pace < 1 && old.pace > 0.7);
});

test("ark-age: the young grow toward adult size, follow a parent, play, and are the same for everyone", () => {
    const parents = ["p-2", "p-1"];
    let prevScale = 0;
    let prevPlay = Infinity;
    for (let day = 0; day <= 320; day += 10) {
        const young = ageOf({id: "foal-1", origin: "born", born_ark_day: 100, parents}, 100 + day, "mammal", ZEBRA);
        assert.ok(young.scale >= prevScale, `scale shrank at ${day}`);
        assert.ok(young.play <= prevPlay + 1e-9);
        prevScale = young.scale;
        prevPlay = young.play;
        if (day === 0) {
            assert.equal(young.stage, "young");
            assert.ok(Math.abs(young.scale - 0.35) < 1e-9);
            assert.ok(young.follow && parents.includes(young.follow.parentId));
            assert.ok(young.play > 0.9);
        }
        if (day >= 300) assert.deepEqual([young.stage, young.scale, young.follow], ["adult", 1, null]);
    }
    // The parent it keeps to is chosen from its id, whatever order the parents come in.
    assert.equal(chosenParent("foal-1", ["p-1", "p-2"]), chosenParent("foal-1", ["p-2", "p-1"]));
    assert.equal(chosenParent("foal-1", []), null);
    assert.deepEqual(
        ageOf({id: "foal-1", origin: "born", born_ark_day: 100, parents}, 150, "mammal", ZEBRA),
        ageOf({id: "foal-1", origin: "born", born_ark_day: 100, parents: [...parents].reverse()}, 150, "mammal", ZEBRA)
    );
});

test("ark-age: carried, at the nest, guarded or on its own, by its species' care", () => {
    const bilby = ageOf({id: "b", origin: "born", born_ark_day: 0, parents: ["m"]}, 5, "mammal", speciesCare("greater-bilby", "mammal"));
    assert.deepEqual([bilby.carried, bilby.follow?.distance], [true, 0]);
    const chick = ageOf({id: "c", origin: "born", born_ark_day: 0, parents: ["m"]}, 5, "bird", speciesCare("common-myna", "bird"));
    assert.deepEqual([chick.atHome, chick.follow], [true, null]);
    const fledged = ageOf({id: "c", origin: "born", born_ark_day: 0, parents: ["m"]}, 30, "bird", speciesCare("common-myna", "bird"));
    assert.deepEqual([fledged.atHome, fledged.stage], [false, "young"]);
    const pike = ageOf({id: "f", origin: "born", born_ark_day: 0, parents: ["m"]}, 5, "fish", speciesCare("northern-pike", "fish"));
    assert.deepEqual([pike.follow, pike.atHome], [null, false]);
    assert.ok(pike.play === 0 && pike.scale < 0.4);
    const croc = ageOf({id: "k", origin: "born", born_ark_day: 0, parents: ["m"]}, 10, "reptile", speciesCare("cuban-crocodile", "reptile"));
    assert.equal(croc.follow?.parentId, "m");
});

test("ark-age: eggs, sat on by birds and guarding parents, hatching on the server's day", () => {
    const egg = ageOf({id: "e", status: "egg", origin: "born", laid_ark_day: 10, hatch_ark_day: 30}, 20, "bird", speciesCare("common-myna", "bird"));
    assert.deepEqual([egg.stage, egg.egg?.satOn, egg.egg?.progress], ["egg", true, 0.5]);
    const turtle = ageOf({id: "e", status: "egg", origin: "born", laid_ark_day: 10}, 20, "turtle", speciesCare(null, "turtle"));
    assert.deepEqual([turtle.egg?.satOn, turtle.egg?.progress], [false, 0]);
});
