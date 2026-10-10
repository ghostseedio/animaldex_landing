import assert from "node:assert/strict";
import test from "node:test";
import {systemDynamicsIntro, type SpeciesSystemDynamics} from "@/lib/system-dynamics";

const entry = {equivalent: "x", reasoning: "y", frequency: null};
const withDomains = (domains: string[]) => ({
    crossDomainMatrix: domains.map((domain) => ({domain, entries: [entry]}))
}) as unknown as SpeciesSystemDynamics;

test("the intro is a one-line Pro hook when locked, and names the areas when unlocked", () => {
    assert.equal(
        systemDynamicsIntro(withDomains([]), "apple snail"),
        "Want to see the apple snail's system in history, sport and business? Unlock it with Pro."
    );
    assert.equal(
        systemDynamicsIntro(withDomains(["SPORT_ATHLETICS", "HISTORY_POWER", "MUSIC"]), "lion"),
        "The lion's system across 3 areas of life, from history and music."
    );
});
