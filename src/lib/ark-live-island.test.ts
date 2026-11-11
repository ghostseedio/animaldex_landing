import assert from "node:assert/strict";
import test from "node:test";
import {abilitiesOf} from "@/ark-live/species";
import {LazyTerrain} from "@/ark-live/terrain";
import {newMotion, validatePose} from "@/ark-live/validate";
import {NO_INPUT, startMover, stepMover} from "@/ark-live/movement";
import type {AnimalFacts} from "@/ark-live/rules";
import type {Mode} from "@/ark-live/protocol";
import {worldSampler} from "@/ark-scene/world-sampler";
import {defaultHomePlots} from "@/ark-scene/props/home-layout";
import {ZONE_SITES} from "@/ark-scene/world";
import type {ArkZone} from "@/ark-scene/types";

/**
 * On today's real island: ten body plans driven by the page's mover for 90 s each (walking, running, sprinting,
 * taking off, flying, landing, paddling, diving, swimming, digging, climbing), every pose checked by the server's
 * validator. A real client must never be corrected for moving as the rules allow.
 */
test("real island: the mover's poses pass the validator for every body plan", () => {
    const terrain = new LazyTerrain("wild", 132, worldSampler(), {plots: defaultHomePlots()});
    const species: Array<[string, ArkZone]> = [["red-fox", "woodland"], ["roe-deer", "woodland"], ["cheetah", "grassland"], ["golden-eagle", "mountains"], ["mallard", "river_lake"], ["european-otter", "river_lake"], ["dromedary-camel", "desert"], ["lar-gibbon", "rainforest"], ["atlantic-salmon", "open_ocean"], ["american-badger", "grassland"]];
    const modesSeen = new Set<Mode>();
    for (const [slug, zone] of species) {
        const a = abilitiesOf(slug);
        const facts: AnimalFacts = {id: slug, slug, zone, area: null, enclosure: null};
        const site = ZONE_SITES[zone];
        const mode: Mode = a.gills ? "swim" : "ground";
        const y = a.gills ? -1.5 : terrain.height(site.x, site.z);
        const ctx = {a, facts, terrain, sig: null};
        let s = startMover({x: site.x, y, z: site.z, yaw: 0, mode}, ctx);
        const m = newMotion({x: site.x, y, z: site.z, yaw: 0, pitch: 0, roll: 0, mode, clip: "idle", speed: 0}, 1e6);
        let heading = 0;
        const rejected: string[] = [];
        for (let i = 1; i <= 90 * 60; i++) {
            const t = i / 60;
            heading += (Math.sin(t / 3 + slug.length) * 0.4) / 60;
            const tt = t % 20;
            s = stepMover(s, {
                ...NO_INPUT,
                dirX: Math.sin(heading),
                dirZ: Math.cos(heading),
                amount: 1,
                run: tt > 12,
                sprint: tt > 18,
                takeoff: a.canFly && tt > 5 && tt < 5.02,
                vertical: a.canFly ? (tt < 9 ? 0.5 : tt > 16 ? -1 : 0) : a.gills ? Math.sin(t) : 0,
                flap: tt < 9,
                dig: slug === "american-badger" && ((tt > 2 && tt < 2.02) || (tt > 8 && tt < 8.02)),
                climb: slug === "lar-gibbon" && tt > 3 && tt < 3.02
            }, 1 / 60, ctx);
            if (i % 6 !== 0) continue;
            const now = 1e6 + Math.round(t * 1000);
            const v = validatePose(m, {seq: (m.last.seq + 1) & 0xffff, t: now, x: s.x, y: s.y, z: s.z, yaw: s.yaw, pitch: s.pitch, roll: s.roll, mode: s.mode, clip: s.clip, speed: s.speed, flags: 0}, now, ctx);
            modesSeen.add(s.mode);
            if (v.kind === "reject") {
                rejected.push(`${t.toFixed(1)} ${v.reason} ${s.mode}`);
                s = {...s, x: m.last.x, y: m.last.y, z: m.last.z, mode: m.last.mode, speed: 0};
            }
        }
        assert.deepEqual(rejected, [], `${slug} corrected`);
    }
    for (const mode of ["ground", "air", "paddle", "swim", "burrow"] as Mode[]) assert.ok(modesSeen.has(mode), `exercised ${mode}: ${Array.from(modesSeen).join(",")}`);
});
