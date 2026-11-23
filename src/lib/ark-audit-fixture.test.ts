/**
 * The audit fixture's places are stable under additions (SPECIES-ANIM-B2, 2026-11-24): a species added to the
 * catalogue moves no other cluster, so the behaviour and collision checks measure the scene, not the catalogue's size.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {auditFixture, decodePreyTable, fixtureZoneSlots, type AuditProfile} from "@/lib/ark-audit/fixture";

const root = path.resolve(__dirname, "../..");
const all = (JSON.parse(readFileSync(path.join(root, "data/ark/behaviour-profiles.json"), "utf8")) as {profiles: AuditProfile[]}).profiles;
const preyOf = decodePreyTable(JSON.parse(readFileSync(path.join(root, "data/ark/audit-predator-prey.json"), "utf8")), all);
const kept = all.filter((p) => !p.excluded && p.zone);

const slots = (profiles: AuditProfile[]) => new Map(auditFixture(profiles, preyOf, "adjacent").animals.map((a) => [a.id, [a.slot, a.slot_rank, a.arrived_at]]));

test("every cluster has its own slot in its zone, inside the zone's table, ranks from 0", () => {
    const fixture = auditFixture(all, preyOf, "adjacent");
    const seen = new Map<string, string>();
    for (const a of fixture.animals) {
        assert.ok(typeof a.slot === "number" && a.slot >= 0 && a.slot < 2 * fixtureZoneSlots(a.zone), `${a.model_slug} slot ${a.slot}`);
        const key = `${a.zone}#${a.slot}`;
        assert.ok(!seen.has(key) || seen.get(key) === a.model_slug, `${key}: ${seen.get(key)} and ${a.model_slug}`);
        seen.set(key, a.model_slug);
    }
});

test("each zone's table has room (raise FIXTURE_ZONE_SLOTS, a re-baseline, past 0.85)", () => {
    const count = new Map<string, number>();
    for (const p of kept) count.set(p.zone, (count.get(p.zone) ?? 0) + 1);
    for (const [zone, n] of Array.from(count)) assert.ok(n <= fixtureZoneSlots(zone) * 0.85, `${zone}: ${n} species in ${fixtureZoneSlots(zone)} slots`);
});

test("adding species moves almost no one: dropping 36 species leaves the others' slots", () => {
    // The 36 species the 2026-11-24 rows added (the cat breeds, chickens, horses...), or any 36: every 70th species.
    const drop = new Set(kept.filter((_, i) => i % 70 === 0).map((p) => p.slug));
    const fewer = all.map((p) => (drop.has(p.slug) ? {...p, excluded: "test"} : p));
    const a = slots(all);
    const b = slots(fewer);
    let moved = 0;
    b.forEach((place, id) => {
        if (JSON.stringify(a.get(id)) !== JSON.stringify(place)) moved++;
    });
    // (A probe chain one of them sat in, or a predator whose next odd slot it took, and that predator's group: about 2%,
    // never the zone. The rank-based fixture moved 25%: 1,321 of 5,328 for #112's 36 species.)
    assert.ok(moved <= b.size * 0.03, `${moved} of ${b.size} moved`);
});

test("adjacent: a predator stands just after its prey, among that prey's other hunters", () => {
    const fixture = auditFixture(all, preyOf, "adjacent");
    const slotOf = new Map(fixture.animals.map((a) => [a.model_slug, a.slot!]));
    const position = new Map(fixture.order.map((slug, i) => [slug, i]));
    // The prey each predator follows, as the fixture picks it: the first in order in its zone that hunts nothing.
    const hunters = new Map<string, string[]>();
    for (const [predator, prey] of Array.from(preyOf)) {
        if (!slotOf.has(predator)) continue;
        const zone = fixture.profileOf.get(predator)!.zone;
        const target = Array.from(prey).filter((s) => fixture.profileOf.get(s)?.zone === zone && slotOf.has(s) && !preyOf.has(s)).sort((a, b) => position.get(a)! - position.get(b)!)[0];
        if (target) hunters.set(target, [...(hunters.get(target) ?? []), predator]);
    }
    let predators = 0;
    let near = 0;
    for (const [target, list] of Array.from(hunters)) {
        const size = 2 * fixtureZoneSlots(fixture.profileOf.get(target)!.zone);
        for (const predator of list) {
            predators++;
            const gap = (slotOf.get(predator)! - slotOf.get(target)! + size) % size;
            // On the odd slots after it: 1, 3, 5... one per hunter, a few more where another prey's hunters are.
            assert.equal(gap % 2, 1, `${predator} on an odd slot after ${target}`);
            if (gap <= 2 * list.length + 9) near++;
        }
    }
    // (A prey with 38 hunters spreads them over 75 slots, as the consecutive ranks did; another's hunters can sit between.)
    assert.ok(predators > 300 && near >= predators * 0.97, `${near} of ${predators} within their prey's run`);
});
