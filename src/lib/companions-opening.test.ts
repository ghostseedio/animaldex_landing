import assert from "node:assert/strict";
import test from "node:test";
import {pickCompanionToOpen} from "@/lib/companions-opening";

const T0 = Date.parse("2026-11-06T12:00:00Z");
type Row = {speciesProfileId: string; at: number | null};
const row = (speciesProfileId: string, at: number | null = null): Row => ({speciesProfileId, at});
const lastAt = (r: Row) => r.at;

test("the newest conversation opens, whatever the roster's order", () => {
    const rows = [row("luna", T0 - 3_600_000), row("pip", T0 - 60_000), row("ghost")];
    assert.equal(pickCompanionToOpen(rows, lastAt, null)?.speciesProfileId, "pip");
});

test("a switch in this browser counts as being with that animal", () => {
    const rows = [row("luna", T0 - 3_600_000), row("ghost")];
    assert.equal(pickCompanionToOpen(rows, lastAt, {speciesProfileId: "ghost", at: T0 - 600_000})?.speciesProfileId, "ghost");
});

test("a message newer than the switch wins over it", () => {
    const rows = [row("luna", T0 - 60_000), row("ghost")];
    assert.equal(pickCompanionToOpen(rows, lastAt, {speciesProfileId: "ghost", at: T0 - 600_000})?.speciesProfileId, "luna");
});

test("nobody talked to yet: the roster's first row, and nothing from nothing", () => {
    assert.equal(pickCompanionToOpen([row("ghost"), row("pip")], lastAt, null)?.speciesProfileId, "ghost");
    assert.equal(pickCompanionToOpen([], lastAt, null), null);
});

test("a remembered animal they no longer hold is ignored", () => {
    assert.equal(pickCompanionToOpen([row("pip", T0 - 3_600_000)], lastAt, {speciesProfileId: "ghost", at: T0})?.speciesProfileId, "pip");
});
