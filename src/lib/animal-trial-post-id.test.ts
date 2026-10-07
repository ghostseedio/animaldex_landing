import assert from "node:assert/strict";
import test from "node:test";
import {animalTrialDiscoverPostId} from "./animal-trial-post-id";

test("the history post id is the database's md5 uuid for the same row", () => {
    // A live row: Lenny's MID Alpaca Trial on discover_animal_trial_timeline_v1.
    assert.equal(
        animalTrialDiscoverPostId("138bd2bc-af58-4e51-ac92-3df6161d53db", "29A0E9DE-7D63-4D03-9701-00EDF7C51FE2", "MID"),
        "d848f876-2402-a0bf-b797-5cc036601716"
    );
});
