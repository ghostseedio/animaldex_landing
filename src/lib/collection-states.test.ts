import assert from "node:assert/strict";
import test from "node:test";
import {collectionShowsCount, collectionShowsProgress, speciesTakesAn} from "@/lib/collection-states";

test("the count only with a catalog, the bar only from 5%", () => {
    assert.equal(collectionShowsCount(0), false);
    assert.equal(collectionShowsCount(2613), true);
    assert.equal(collectionShowsProgress(29, 2483), false);
    assert.equal(collectionShowsProgress(125, 2483), true);
    assert.equal(collectionShowsProgress(5, 0), false);
});

test("a/an by sound, as iOS findLine", () => {
    assert.equal(speciesTakesAn("Ocelot"), true);
    assert.equal(speciesTakesAn("Eurasian Lynx"), false);
    assert.equal(speciesTakesAn("Ural Owl"), false);
    assert.equal(speciesTakesAn("Great Blue Heron"), false);
    assert.equal(speciesTakesAn("African Elephant"), true);
});

test("the Collection's and the species page's words are in en.json and id.json", async () => {
    const {readFileSync} = await import("node:fs");
    const en = JSON.parse(readFileSync("src/data/locales/en.json", "utf8")).appCollection;
    const id = JSON.parse(readFileSync("src/data/locales/id.json", "utf8")).appCollection;
    for (const key of ["unavailableTitle", "serverMessage", "retry", "noMatchesTitle", "resetView", "talkToItNow", "findToCaptureA", "findToCaptureAn", "findToMeetA", "findToMeetAn", "capture", "latestCapture", "openCaptureCard"]) {
        assert.equal(typeof en[key], "string", `en.appCollection.${key}`);
        assert.equal(typeof id[key], "string", `id.appCollection.${key}`);
    }
    assert.equal(en.talkToItNow, "Talk to it now");
    assert.equal(en.findToCaptureAn.replace("{species}", "Ocelot"), "Find an Ocelot to capture it");
    assert.match(id.findToMeetA, /\{species\}/);
});
