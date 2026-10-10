import {test} from "node:test";
import assert from "node:assert/strict";
import {speciesEntries} from "../data/species";
import {applyStaticSpeciesOverlay} from "./static-species-overlay";
import {getStaticSpeciesGroupMembers, getStaticSpeciesProfileId} from "./static-species-profiles";

test("hand-coded pages carry their catalog profile, so the Play tab's Trial and System Dynamics load", () => {
    const linked = speciesEntries.filter((entry) => applyStaticSpeciesOverlay(entry).speciesProfileId).length;
    // ~920 of ~1,010 at the first snapshot; before it, none did.
    assert.ok(linked >= 900, `only ${linked} hand-coded pages have a species_profile_id`);
    const dungBeetle = speciesEntries.find((entry) => entry.slug === "dung-beetle");
    assert.ok(dungBeetle && applyStaticSpeciesOverlay(dungBeetle).speciesProfileId, "dung-beetle should use its group profile");
});

test("a group page with no indexed group profile lists the species it covers", () => {
    assert.equal(getStaticSpeciesProfileId("octopus"), null);
    const octopus = getStaticSpeciesGroupMembers("octopus").map((member) => member.slug);
    assert.ok(octopus.includes("common-octopus") && octopus.includes("giant-pacific-octopus"));
    assert.ok(getStaticSpeciesGroupMembers("tiger").some((member) => member.slug === "sumatran-tiger"));
});

test("group lists match on the name's ending and skip animals that only share the word", () => {
    const all = speciesEntries.flatMap((entry) => getStaticSpeciesGroupMembers(entry.slug).map((member) => member.slug));
    for (const notAMember of ["california-sea-lion", "large-flying-fox", "iridescent-shark"]) {
        assert.ok(!all.includes(notAMember), `${notAMember} should not be listed as a group member`);
    }
    assert.ok(!getStaticSpeciesGroupMembers("tiger").some((member) => member.slug === "tiger-shark"), "a tiger shark is not a tiger");
    assert.deepEqual(getStaticSpeciesGroupMembers("dung-beetle"), [], "pages with their own profile list no members");
});
