import assert from "node:assert/strict";
import test from "node:test";
import moves from "@/ark-scene/bird-moves.json";
import {animalMaterial} from "@/ark-scene/animal-material";
import {tailHabitOf, tailHabitUniform, tailHinge, tailLift} from "@/ark-scene/tail-habit";
import {ShaderLib} from "three";

test("a tail habit only where the species' own text says it, by its catalogue moves", () => {
    assert.equal(tailHabitOf("plains-zebra"), null);
    assert.equal(tailHabitOf("house-sparrow"), null);
    assert.equal(tailHabitOf(null), null);
    const wagtail = tailHabitOf("grey-wagtail")!;
    assert.ok(wagtail.pump > 0 && wagtail.cock === 0 && wagtail.fan === 0, "a wagtail pumps");
    const wren = tailHabitOf("house-wren")!;
    assert.ok(wren.cock > 0.3 && wren.pump === 0, "a wren's tail is held cocked");
    assert.ok(tailHabitOf("australasian-swamphen")!.pump < 0, "a swamphen flicks");
    assert.ok(tailHabitOf("masked-water-tyrant")!.fan > 0, "a water tyrant fans");
    assert.ok(tailHabitOf("common-sandpiper")!.pump > 0 && tailHabitOf("common-sandpiper")!.pump < wagtail.pump, "a sandpiper's bob is smaller");
    const table = moves.tail as Record<string, {moves: string[]; quote: string; line: string | null}>;
    assert.ok(Object.keys(table).length >= 10);
    for (const [slug, row] of Object.entries(table)) {
        const habit = tailHabitOf(slug);
        assert.ok(habit && habit.rate > 0, slug);
        assert.ok(/tail|rear end/i.test(row.quote), `${slug}: its own text speaks of the tail`);
        // The tail never folds over the back or under the body: always within a quarter turn.
        for (let t = 0; t < 30; t += 0.01) assert.ok(Math.abs(tailLift(habit, t)) <= 1.2, slug);
    }
});

test("the pump goes down and up about level; a cocked tail stays up; a flick is brief", () => {
    const wagtail = tailHabitOf("western-yellow-wagtail")!;
    let lo = Infinity, hi = -Infinity;
    for (let t = 0; t < 5; t += 0.005) {
        lo = Math.min(lo, tailLift(wagtail, t));
        hi = Math.max(hi, tailLift(wagtail, t));
    }
    assert.ok(hi > 0.25 && lo < -0.25, "both ways");
    const wren = tailHabitOf("carolina-wren")!;
    for (let t = 0; t < 5; t += 0.05) assert.ok(tailLift(wren, t) >= wren.cock - 1e-9);
    const hen = tailHabitOf("australasian-swamphen")!;
    let up = 0, n = 0;
    for (let t = 0; t < 40; t += 0.01, n++) {
        assert.ok(tailLift(hen, t) >= 0, "a flick only goes up");
        if (tailLift(hen, t) > 0.2) up++;
    }
    assert.ok(up / n > 0.03 && up / n < 0.25, `up a small share of the time (${(up / n).toFixed(2)})`);
});

test("the hinge: only the marked tail moves, its tip rises by the lift, the body ahead of the base is untouched", () => {
    // (A wagtail's own tail from its model: `ark.json` behaviour.tail.)
    const tail = {base: [0.0006, -0.0852, -0.14] as [number, number, number], length: 0.36};
    const head = {x: 0.02, y: 0.1, z: 0.4};
    assert.deepEqual(tailHinge(head, tail, 0.5), head);
    const breast = {x: 0, y: -0.1, z: -0.139};
    assert.deepEqual(tailHinge(breast, tail, 0.5), breast);
    const tip = {x: 0, y: -0.0852, z: -0.5};
    const up = tailHinge(tip, tail, 0.3);
    assert.ok(Math.abs(up.y - (tail.base[1] + 0.36 * Math.sin(0.3))) < 1e-6, "the tip up by the lift");
    assert.ok(Math.abs(Math.hypot(up.y - tail.base[1], up.z - tail.base[2]) - 0.36) < 1e-6, "its length kept");
    const down = tailHinge(tip, tail, -0.3);
    assert.ok(down.y < tip.y);
    // A wing tip far out to the side is not the tail.
    const wing = {x: 0.4, y: 0, z: -0.3};
    assert.deepEqual(tailHinge(wing, tail, 0.5), wing);
    // A fan spreads the feathers at the tip, not at the base.
    const feather = {x: 0.03, y: -0.0852, z: -0.5};
    assert.ok(tailHinge(feather, tail, 0, 0.5).x > feather.x * 1.4);
    assert.ok(Math.abs(tailHinge({x: 0.03, y: -0.0852, z: -0.141}, tail, 0, 0.5).x - 0.03) < 1e-3);
    assert.deepEqual(tailHinge(tip, {base: [0, 0, 0], length: 0}, 0.5), tip, "no tail marked: nothing moves");
});

test("the material carries the habit only for a model with its tail marked, and the shader declares it once", () => {
    const habit = tailHabitOf("grey-wagtail");
    const behaviour = {plan: "bird", tail: {base: [0.0006, -0.0852, -0.14], length: 0.36}} as never;
    const compose = (options: Parameters<typeof animalMaterial>[0]) => {
        const material = animalMaterial(options);
        const shader = {vertexShader: ShaderLib.physical.vertexShader, fragmentShader: ShaderLib.physical.fragmentShader, uniforms: {} as Record<string, {value: {x: number; w: number} & number}>, defines: material.defines};
        (material.onBeforeCompile as unknown as (s: typeof shader, r: unknown) => void)(shader, null);
        return shader;
    };
    const marked = compose({map: null, behaviour, minY: 0, maxY: 1, animated: true, tailHabit: habit});
    assert.equal(marked.uniforms.arkTailHabit.value.w, habit!.rate);
    assert.equal(marked.uniforms.arkTailBaseY.value, -0.0852);
    assert.equal(marked.vertexShader.match(/uniform vec4 arkTailHabit;/g)?.length, 1);
    const unmarked = compose({map: null, behaviour: {plan: "bird"} as never, minY: 0, maxY: 1, animated: true, tailHabit: habit});
    assert.equal(unmarked.uniforms.arkTailHabit.value.w, 0, "no tail marked on the model: off");
    const other = compose({map: null, behaviour, minY: 0, maxY: 1, animated: true});
    assert.equal(other.uniforms.arkTailHabit.value.w, 0, "another species: off");
    assert.deepEqual(tailHabitUniform(null), [0, 0, 0, 0]);
});
