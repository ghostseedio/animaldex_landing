import assert from "node:assert/strict";
import test from "node:test";
import {createRequire} from "node:module";
import path from "node:path";
import examples from "./trial-motion/__fixtures__/examples.json";
import glyphs from "./trial-motion/glyphs.json";
import vocabulary from "./trial-motion/vocabulary.json";
import {
    compileFigure,
    createTrialMotionScene,
    renderTrialMotionPosterMarkup,
    ringLabel,
    sampleFigure,
    virtualMotionDoc,
    virtualMotionInnerMarkup,
    type VirtualMotionNode
} from "./trial-motion/engine";
import {
    parseTrialStoryboard,
    trialMotionAccessibilityLabel,
    trialMotionBeatIndexAt,
    trialMotionCaptions,
    trialMotionPosterTime,
    type TrialStoryboard
} from "./trial-motion/storyboard";

/*
 * The reference renderer (`AnimalDex/docs/trial-motion/trial-motion.js`, copied to
 * `__fixtures__/reference-renderer.cjs`) is the behavioural spec. It runs in node
 * against a tiny fake `document`; the port runs against its virtual tree; the two
 * trees must match attribute for attribute at every sampled time.
 */

type FakeNode = {tag: string; attrs: Record<string, string>; children: FakeNode[]; textContent: string | null};

function fakeElement(tag: string) {
    const node = {
        tag,
        attrs: {} as Record<string, string>,
        children: [] as FakeNode[],
        _text: null as string | null,
        setAttribute(name: string, value: unknown) {
            node.attrs[name] = String(value);
        },
        appendChild(child: FakeNode) {
            node.children.push(child);
            return child;
        },
        removeChild(child: FakeNode) {
            node.children.splice(node.children.indexOf(child), 1);
        },
        get firstChild() {
            return node.children[0] ?? null;
        },
        get textContent() {
            return node._text;
        },
        set textContent(value: string | null) {
            node._text = value == null ? null : String(value);
        }
    };
    return node;
}

(globalThis as unknown as {document: unknown}).document = {createElementNS: (_ns: string, tag: string) => fakeElement(tag)};

const require = createRequire(path.join(process.cwd(), "src/lib/trial-motion/reference.cjs"));
const Reference = require("./__fixtures__/reference-renderer.cjs") as {
    create: (svg: unknown, sb: unknown, V: unknown, G: unknown) => {draw: (t: number) => void; beatIndexAt: (t: number) => number; poster: number; loop: number};
    compileFigure: (sb: unknown, id: string, V: unknown) => Array<Record<string, unknown>>;
    sampleFigure: (kf: unknown, t: number, V: unknown) => {joints: number[][]; x: number; y: number; o: number; facing: number};
    ringLabel: (total: number, v: number, countdown?: boolean) => string;
};

function canonical(node: {tag: string; attrs: Record<string, string>; children: unknown[]}, text: string | null): string {
    const attrs = Object.keys(node.attrs).sort().map((name) => `${name}=${node.attrs[name]}`).join(" ");
    const children = (node.children as Array<FakeNode & {_text?: string | null; text?: string | null}>)
        .map((child) => canonical(child, child._text ?? child.text ?? null))
        .join("");
    return `<${node.tag} ${attrs}>${text ?? ""}${children}</${node.tag}>`;
}

const storyboards = (examples as Array<{key: string; storyboard: unknown}>).map((example) => ({
    key: example.key,
    storyboard: parseTrialStoryboard(example.storyboard) as TrialStoryboard
}));

test("every worked example parses", () => {
    for (const {key, storyboard} of storyboards) assert.ok(storyboard, key);
});

test("figure keyframes and samples match the reference", () => {
    for (const {key, storyboard} of storyboards) {
        for (const [id, actor] of Object.entries(storyboard.actors)) {
            if (actor.kind !== "figure") continue;
            const ours = compileFigure(storyboard, id, vocabulary);
            const theirs = Reference.compileFigure(storyboard, id, vocabulary);
            assert.deepEqual(ours, theirs, `${key}/${id} keyframes`);
            for (let t = 0; t <= storyboard.loop; t += 0.137) {
                assert.deepEqual(sampleFigure(ours, t, vocabulary), Reference.sampleFigure(theirs, t, vocabulary), `${key}/${id} at ${t}`);
            }
        }
    }
});

test("cheetah: the figure squats, jumps 100 then 182, and lands where the reference says", () => {
    const cheetah = storyboards.find((item) => item.key === "cheetah-LOW")!.storyboard;
    const kf = compileFigure(cheetah, "you", vocabulary);
    const at = (t: number) => sampleFigure(kf, t, vocabulary);
    assert.equal(at(0).x, 52);
    assert.equal(at(2.0).x, 52);
    assert.equal(Math.round(at(3.5).x), 152);
    assert.equal(at(4.2).x, 52, "reset puts the figure back at its start");
    assert.equal(Math.round(at(5.6).x), 234);
    assert.ok(at(2.81).y < -30, "mid-jump is in the air");
});

test("every frame of every example matches the reference, element for element", () => {
    for (const {key, storyboard} of storyboards) {
        const refSvg = fakeElement("svg");
        const ref = Reference.create(refSvg, storyboard, vocabulary, glyphs);
        const ourSvg = virtualMotionDoc.create("svg");
        const ours = createTrialMotionScene(virtualMotionDoc, ourSvg, storyboard, vocabulary, glyphs);
        assert.equal(ours.poster, ref.poster, `${key} poster`);
        assert.equal(canonical(ourSvg, null), canonical(refSvg as never, null), `${key} poster frame`);

        const times = [0, 0.15, storyboard.loop - 0.2];
        for (let i = 0; i < 6; i++) times.push(+(((i + 0.5) / 6) * storyboard.loop).toFixed(2));
        for (let t = 0.05; t < storyboard.loop; t += 0.31) times.push(t);
        times.push(-1.3, storyboard.loop + 2.4);
        for (const t of times) {
            ref.draw(t);
            ours.draw(t);
            assert.equal(canonical(ourSvg, null), canonical(refSvg as never, null), `${key} at ${t}`);
            assert.equal(ours.beatIndexAt(t), ref.beatIndexAt(t), `${key} caption at ${t}`);
            assert.equal(trialMotionBeatIndexAt(storyboard, t), ref.beatIndexAt(t), `${key} caption helper at ${t}`);
        }
    }
});

test("several count events in a row: only the latest started one shows", () => {
    const base = storyboards.find((item) => item.key === "koala-MID")!.storyboard;
    const refSvg = fakeElement("svg");
    const ref = Reference.create(refSvg, base, vocabulary, glyphs);
    const svg = virtualMotionDoc.create("svg");
    const ours = createTrialMotionScene(virtualMotionDoc, svg, base, vocabulary, glyphs);
    const counts = () => {
        const out: VirtualMotionNode[] = [];
        const walk = (node: VirtualMotionNode) => {
            if (node.tag === "text" && node.attrs["font-size"] === "30") out.push(node);
            node.children.forEach(walk);
        };
        walk(svg);
        return out;
    };
    for (const t of [0.1, 1.0, 3.0, 6.0]) {
        ours.draw(t);
        ref.draw(t);
        const visible = counts().filter((node) => Number(node.attrs.opacity) > 0);
        assert.ok(visible.length <= 1, `one count visible at ${t}`);
        assert.equal(canonical(svg, null), canonical(refSvg as never, null), `koala at ${t}`);
    }
});

test("poster markup is server-renderable and stays on the stage palette", () => {
    for (const {key, storyboard} of storyboards) {
        const markup = renderTrialMotionPosterMarkup(storyboard, vocabulary, glyphs);
        assert.ok(markup && markup.startsWith("<g"), key);
        assert.doesNotMatch(markup, /NaN|undefined/, key);
    }
    const svg = virtualMotionDoc.create("svg");
    createTrialMotionScene(virtualMotionDoc, svg, storyboards[0].storyboard, vocabulary, glyphs);
    assert.equal(svg.attrs.viewBox, "0 0 360 202");
    assert.ok(virtualMotionInnerMarkup(svg).length > 100);
});

test("parsing: NULL, empty and malformed storyboards are null, so the Trial renders as before", () => {
    const good = storyboards[0].storyboard;
    const clone = () => JSON.parse(JSON.stringify(good));
    assert.equal(parseTrialStoryboard(null), null);
    assert.equal(parseTrialStoryboard(undefined), null);
    assert.equal(parseTrialStoryboard({}), null);
    assert.equal(parseTrialStoryboard("not json"), null);
    assert.ok(parseTrialStoryboard(JSON.stringify(good)), "a JSON string column still parses");
    assert.equal(parseTrialStoryboard({...clone(), v: 2}), null);
    assert.equal(parseTrialStoryboard({...clone(), loop: 30}), null);
    assert.equal(parseTrialStoryboard({...clone(), poster: 99}), null);
    assert.equal(parseTrialStoryboard({...clone(), actors: {}}), null);
    assert.equal(parseTrialStoryboard({...clone(), beats: [clone().beats[0]]}), null, "one beat is too few");

    const unknownPose = clone();
    unknownPose.beats[0].events[0].pose = "moonwalk";
    assert.equal(parseTrialStoryboard(unknownPose), null);

    const unknownEvent = clone();
    unknownEvent.beats[0].events.push({type: "explode", at: 1});
    assert.equal(parseTrialStoryboard(unknownEvent), null);

    const ghostActor = clone();
    ghostActor.beats[0].events[0].actor = "nobody";
    assert.equal(parseTrialStoryboard(ghostActor), null);

    const missingMark = clone();
    missingMark.beats[2].events[0].marks = ["A", "Z"];
    assert.equal(parseTrialStoryboard(missingMark), null);

    const firstBeatLate = clone();
    firstBeatLate.beats[0].at = 0.5;
    assert.equal(parseTrialStoryboard(firstBeatLate), null);

    const koala = JSON.parse(JSON.stringify(storyboards.find((item) => item.key === "koala-MID")!.storyboard));
    koala.beats[1].events[0].keep = [4, 40];
    assert.equal(parseTrialStoryboard(koala), null, "a kept tile outside the pile");
});

test("captions, label and poster time", () => {
    const cheetah = storyboards[0].storyboard;
    assert.deepEqual(trialMotionCaptions(cheetah), [
        "Hold a flat squat for five seconds",
        "Drop and spring straight back out",
        "Compare the two sets of marks"
    ]);
    assert.equal(
        trialMotionAccessibilityLabel(trialMotionCaptions(cheetah)),
        "Hold a flat squat for five seconds. Drop and spring straight back out. Compare the two sets of marks."
    );
    assert.equal(trialMotionPosterTime(cheetah), 9.2 - 0.6);
    assert.equal(trialMotionPosterTime({...cheetah, poster: 8}), 8);
});

test("ring labels: seconds under 100 s, then whole minutes, then whole hours", () => {
    assert.equal(ringLabel(5, 3), "3");
    assert.equal(ringLabel(1200, 725), "12m");
    assert.equal(ringLabel(7200, 3600), "1h");
    // A countdown (hold) rounds up; a count-up (timer) rounds down.
    assert.equal(ringLabel(120, 45, true), "1m");
    assert.equal(ringLabel(120, 61, true), "2m");
    assert.equal(ringLabel(1200, 725, false), "12m");
    assert.equal(ringLabel(7200, 3600, true), "1h");
    for (const countdown of [false, true]) {
        for (const [total, v] of [[5, 3], [99, 99], [100, 59], [120, 1], [1200, 725], [5999, 5999], [6000, 7199], [7200, 3600], [7200, 3601], [3600, 0]]) {
            assert.equal(ringLabel(total, v, countdown), Reference.ringLabel(total, v, countdown), `${total}, ${v}, ${countdown}`);
        }
    }
});

test("long hold and timer rings match the reference frame by frame", () => {
    const sb = parseTrialStoryboard({
        v: 1, loop: 8,
        actors: {you: {kind: "figure", x: 70, pose: "sit"}},
        beats: [
            {at: 0, caption: "Hold still for two minutes", events: [{type: "hold", actor: "you", seconds: 120, at: 0.4, until: 3.6}]},
            {at: 3.8, caption: "Rest for two hours", events: [{type: "timer", seconds: 7200, at: 3.9, until: 7.0}]}
        ]
    }) as TrialStoryboard;
    assert.ok(sb);
    const refSvg = fakeElement("svg");
    const ref = Reference.create(refSvg, sb, vocabulary, glyphs);
    const svg = virtualMotionDoc.create("svg");
    const ours = createTrialMotionScene(virtualMotionDoc, svg, sb, vocabulary, glyphs);
    for (let t = 0; t < 8; t += 0.23) {
        ref.draw(t);
        ours.draw(t);
        assert.equal(canonical(svg, null), canonical(refSvg as never, null), `at ${t}`);
    }
    assert.match(virtualMotionInnerMarkup(svg), /\d+h</);
    // The hold's last stretch reads "1m", never "0m".
    ours.draw(3.5);
    assert.match(virtualMotionInnerMarkup(svg), />1m</);
    assert.doesNotMatch(virtualMotionInnerMarkup(svg), />0m</);
});
