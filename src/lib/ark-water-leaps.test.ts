import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {LEAP_TICK_SECONDS, leapAt, leapBoutsIn, leapKinds, leapPose, leapSpec, leapsInTick} from "@/ark-scene/water-leaps";

test("only kinds whose own text says they leave the water leap; none tied to a catch", () => {
    for (const slug of ["flathead-grey-mullet", "spinner-dolphin", "dusky-dolphin", "tropical-two-wing-flyingfish", "southern-right-whale", "spotted-eagle-ray"]) assert.ok(leapSpec(slug), slug);
    // A catch (arowana's insect-catching leap, a great white's breach on prey, an orca's tail slaps on herring), being
    // hooked (a mako), or no word of it in its text (humpback, blue whale): never.
    for (const slug of ["silver-arowana", "great-white-shark", "orca", "shortfin-mako", "humpback-whale", "blue-whale", "bala-shark", null, ""]) assert.equal(leapSpec(slug), null, String(slug));
    for (const slug of leapKinds()) assert.ok(leapSpec(slug)!.quote.length > 20, slug);
});

test("the same leaps for every viewer, in order, inside the tick", () => {
    const tick = 9001;
    for (const slug of leapKinds()) {
        const a = leapsInTick(`a-${slug}`, slug, 1.5, tick);
        const b = JSON.parse(JSON.stringify(leapsInTick(`a-${slug}`, slug, 1.5, tick)));
        assert.deepEqual(a, b);
        for (let i = 0; i < a.length; i++) {
            assert.ok(a[i].from >= tick * LEAP_TICK_SECONDS && a[i].to <= (tick + 1) * LEAP_TICK_SECONDS, slug);
            assert.ok(a[i].to > a[i].from);
            if (i) assert.ok(a[i].from >= a[i - 1].to, `${slug}: leaps overlap`);
        }
    }
    // Across many ticks a mullet ("often") leaps far more than a thresher shark ("can also").
    const count = (slug: string) => Array.from({length: 200}, (_, k) => leapsInTick(`x-${slug}`, slug, 2, k).length).reduce((s, n) => s + n, 0);
    assert.ok(count("flathead-grey-mullet") > 4 * count("thresher-shark"));
});

test("a leap's arc clears the surface and comes back to its swim; a glide's run is eased away under water", () => {
    const tick = 4242;
    const steps = Array.from({length: 40}, (_, k) => leapsInTick("dolphin", "spinner-dolphin", 2, tick + k)).flat();
    assert.ok(steps.length > 0);
    const step = steps[0];
    const mid = leapPose(step, (step.out + step.back) / 2, -3, 0, 0.6, 2, 1);
    assert.ok(mid.base > 0, "its base is over the water at the top of the arc");
    assert.ok(mid.airborne);
    const end = leapPose(step, step.to - step.from, -3, 0, 0.6, 2, 1);
    assert.ok(Math.abs(end.base + 3) < 1e-6 && Math.abs(end.pitch) < 1e-6);
    const start = leapPose(step, 0, -3, 0, 0.6, 2, 1);
    assert.ok(Math.abs(start.base + 3) < 1e-6);
    assert.equal(leapAt("dolphin", "spinner-dolphin", 2, (step.from + step.to) / 2)?.from, step.from);
    const glides = Array.from({length: 40}, (_, k) => leapsInTick("fish", "tropical-two-wing-flyingfish", 0.25, tick + k)).flat();
    const glide = glides[0];
    assert.ok(glide.run >= 10 && glide.run <= 40);
    assert.ok(Math.abs(leapPose(glide, glide.to - glide.from, -1, 0, 0.1, 0.25, 1).ahead) < 1e-6);
    // A right whale's sail: no air under it, head down.
    const sail = Array.from({length: 40}, (_, k) => leapsInTick("whale", "southern-right-whale", 15, tick + k)).flat()[0];
    const held = leapPose(sail, sail.out + 10, -4, 0, 3, 15, 1);
    assert.ok(held.pitch > 1 && !held.airborne);
});

test("the live log's bouts: the first leap of each bout in the window", () => {
    const steps = leapsInTick("m", "flathead-grey-mullet", 0.5, 77);
    const firsts = steps.filter((s) => s.first);
    const from = 77 * LEAP_TICK_SECONDS;
    assert.equal(leapBoutsIn("m", "flathead-grey-mullet", 0.5, from, from + LEAP_TICK_SECONDS).length, firsts.length);
});

test("the leap lines are in all 45 locales", () => {
    const dir = path.join(process.cwd(), "src/data/locales");
    const files = ["en.json", "id.json", ...readdirSync(path.join(dir, "ark")).map((f) => `ark/${f}`)];
    assert.equal(files.length, 45);
    for (const file of files) {
        const text = readFileSync(path.join(dir, file), "utf8");
        for (const key of ["leapt", "glided", "sailing"]) {
            const m = text.match(new RegExp(`"${key}": "([^"]*)"`));
            assert.ok(m && m[1].includes("{aAnimal}"), `${file}: ${key}`);
        }
    }
});
