import assert from "node:assert/strict";
import test from "node:test";
import snapshotFixture from "@/ark-scene/fixtures/snapshot-v2.json";
import eventsFixture from "@/ark-scene/fixtures/events.json";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {installRecordClock, seededRandom} from "@/ark-scene/record-clock";
import {arkClipShareCopy, arkClipTimeline, arkClipVideoPlan} from "@/lib/ark-clips/captions";
import {arkOverlays, hookSize, overlayFilter, renderArkOverlay} from "@/lib/ark-clips/overlays";
import {arkClipCommand} from "@/lib/ark-clips/command";
import {firstSentence, isPowerVoice, pickArkFacts, type ArkFieldGuide} from "@/lib/ark-clips/facts";
import {arkClipExperiment, ArkClipRefused, assertPublishable} from "@/lib/ark-clips/publish";
import {clipProblems} from "@/lib/ark-clips/recorder";
import {ARK_MOMENT_SHOTS, ARK_SHOTS, ArkShotUnavailable, newestArrival, pickArkSubject, placeCues, planArkShot, type ArkMarks} from "@/lib/ark-clips/shots";
import {videoProblems} from "@/lib/content-video/fix";
import {planHasAiImagery} from "@/lib/content-video/footage";
import {isRecordedSourceType, isSourceType, isVideoSourceType, SOURCE_TYPES} from "@/lib/content-video/plan";
import {SOURCE_LABELS, sourcePath} from "@/lib/content-video/source-paths";
import {decodeArkEvents} from "@/lib/ark-life";
import {KIND_DIMENSIONS} from "@/lib/social-lab/arms";
import {formatOfPost, SOURCE_FORMAT} from "@/lib/social-lab/format-board";
import {serializeVideoSitemapXml, videoWatchPath} from "@/lib/video-sitemap";

const snapshot = decodeArkSnapshot(snapshotFixture)!;
const events = decodeArkEvents(eventsFixture, snapshot);
const now = new Date("2026-11-10T12:00:00Z");

const zebraGuide: ArkFieldGuide = {
    diet_summary: "Plains zebras graze mainly on tall, coarse grasses. They also browse leaves and shoots in the dry season.",
    typical_habitat: "Open grasslands and savanna woodlands of eastern and southern Africa.",
    sleep_pattern: "Sleeps standing up in short bouts, mostly at night.",
    lifespan_estimate: "About 20 years in the wild (approx. 40 in zoos).",
    predators_summary: null,
    interesting_facts: [
        "Their stripes teach us that standing out can be a principle of survival.",
        "No two zebras have exactly the same stripe pattern."
    ],
    signature_traits: []
};

function marksFor(plan: ReturnType<typeof planArkShot>, act = 0, actEnd = 0): ArkMarks {
    const d = plan.direction;
    const total = Math.max(d.act ? actEnd + d.linger + d.end : d.lead + d.linger + d.end, d.minSeconds);
    return {start: 0, act: d.act ? act : d.lead, actEnd: d.act ? actEnd : d.lead, end: total - d.end, total};
}

test("field-guide captions are stored first sentences, never the Power's voice", () => {
    assert.equal(firstSentence(zebraGuide.diet_summary), "Plains zebras graze mainly on tall, coarse grasses.");
    assert.equal(firstSentence("About 20 years in the wild (approx. 40 in zoos). More text."), "About 20 years in the wild (approx. 40 in zoos).");
    assert.equal(firstSentence("Unknown"), null);
    assert.equal(firstSentence("x".repeat(200)), null, "too long for the screen");
    for (const sentence of ["This lesson is about patience.", "Its Power rewards the bold.", "It teaches us to wait.", "Its stripes are a principle of survival.", "This habit supports the herd."]) {
        assert.ok(isPowerVoice(sentence), sentence);
        assert.equal(firstSentence(sentence), null, sentence);
    }
    assert.ok(!isPowerVoice("A powerful kick can break a lion's jaw."));
    const facts = pickArkFacts(zebraGuide, 3);
    assert.deepEqual(facts.map((fact) => fact.source), ["diet_summary", "typical_habitat", "interesting_facts"]);
    assert.equal(facts[2].text, "No two zebras have exactly the same stripe pattern.", "the Power-voice fact is skipped, the next one used verbatim");
    assert.deepEqual(pickArkFacts(null), []);
});

/** A cross-layer moment's shot plans only when someone aboard can act it out: the v2 fixture has no canopy primate. */
function planned(kind: (typeof ARK_SHOTS)[number], fixture: boolean) {
    try {
        return planArkShot(kind, {snapshot, events, fieldGuide: zebraGuide, fixture, now, species: kind === "meet" ? "plains-zebra" : null});
    } catch (error) {
        if (error instanceof ArkShotUnavailable && ARK_MOMENT_SHOTS.includes(kind)) return null;
        throw error;
    }
}

test("the cross-layer moments are shot options: the fixture's puffin dives, its humpback surfaces, its barn owl swoops; no primate, no drop", () => {
    assert.equal(planned("seabird_dive", true)?.subject?.modelSlug, "atlantic-puffin");
    assert.equal(planned("whale_surface", true)?.subject?.modelSlug, "humpback-whale");
    assert.equal(planned("owl_swoop", true)?.subject?.modelSlug, "barn-owl");
    assert.equal(planned("primate_drop", true), null);
    // Cosmetic only: no act (no meal) in the direction, and the captions are counts, the zone and the general rule.
    for (const kind of ["seabird_dive", "whale_surface", "owl_swoop"] as const) {
        const plan = planned(kind, true)!;
        assert.equal(plan.direction.act, null);
        assert.doesNotMatch(JSON.stringify(plan.cues), /\b(?:eats?|meals?|hunts?|prey|catch(?:es)?)\b/i);
    }
});

test("every shot plans from the fixture as a sample, within 15–45 s", () => {
    for (const kind of ARK_SHOTS) {
        const plan = planned(kind, true);
        if (!plan) continue;
        assert.equal(plan.dataSource, "fixture");
        assert.match(plan.slug, /^sample-[a-z0-9-]+$/);
        const marks = marksFor(plan, plan.direction.lead, plan.direction.lead + 3.5);
        assert.ok(marks.total >= 15 && marks.total <= 45, `${kind}: ${marks.total}`);
        assert.ok(plan.cues.some((cue) => cue.kind === "hook"), kind);
        assert.ok(plan.cues.some((cue) => cue.kind === "end"), kind);
        assert.ok(placeCues(plan.cues, marks).length >= 3, kind);
    }
});

test("captions never name a person: no bringer labels, no usernames", () => {
    const labels = new Set(snapshot.animals.flatMap((animal) => [animal.brought_by.label, ...(animal.bringers ?? []).map((bringer) => bringer.label)]).filter((label) => label.trim().length > 0));
    assert.ok(labels.size > 0, "the fixture has bringer labels to look for");
    for (const kind of ARK_SHOTS) {
        const plan = planned(kind, false);
        if (!plan) continue;
        const words = JSON.stringify([plan.cues, plan.title, plan.hookText, arkClipShareCopy(plan)]);
        assert.doesNotMatch(words, /Voyager/i, kind);
        for (const label of Array.from(labels)) assert.ok(!words.includes(label), `${kind} shows "${label}"`);
    }
});

test("a live plan has no sample prefix and can be uploaded; a sample cannot", () => {
    const live = planArkShot("flyover", {snapshot, events, fixture: false, now});
    assert.equal(live.slug, "flyover-2026-11-10");
    assertPublishable(live);
    const sample = planArkShot("flyover", {snapshot, events, fixture: true, now});
    assert.throws(() => assertPublishable(sample), ArkClipRefused);
});

test("the subjects are deterministic and follow the rules", () => {
    const arrival = newestArrival(snapshot)!;
    assert.notEqual(arrival.origin, "born");
    assert.ok(snapshot.animals.filter((animal) => animal.origin !== "born").every((animal) => animal.arrived_at <= arrival.arrived_at));
    const meet = pickArkSubject(snapshot, "meet", "plains-zebra")!;
    assert.equal(meet.model_slug, "plains-zebra");
    assert.equal(pickArkSubject(snapshot, "meet"), pickArkSubject(snapshot, "meet"));
    assert.equal(pickArkSubject(snapshot, "follow", "no-such-animal"), null);
    assert.throws(() => planArkShot("meet", {snapshot, events, fieldGuide: null, fixture: false, now, species: "plains-zebra"}), ArkShotUnavailable, "no stored facts, no clip");
    assert.throws(() => planArkShot("meal_chase", {snapshot, events: [], fixture: false, now}), ArkShotUnavailable);
    const meal = planArkShot("meal_chase", {snapshot, events, fixture: false, now});
    assert.equal(meal.direction.act?.kind, "meal");
    assert.match(meal.hookText, / VS /);
});

test("captions are overlays timed by the director's marks, and the row's timeline and plan come from them", async () => {
    const plan = planArkShot("meet", {snapshot, events, fieldGuide: zebraGuide, fixture: false, now, species: "plains-zebra"});
    const marks = marksFor(plan);
    const overlays = arkOverlays(plan, marks);
    assert.equal(overlays[0].kind, "hook");
    assert.equal(overlays[0].start, 0);
    assert.equal(overlays.at(-1)!.kind, "end");
    assert.equal(overlays.at(-1)!.stop, marks.total);
    assert.ok(overlays.some((overlay) => overlay.label === "Diet" && overlay.text === "Plains zebras graze mainly on tall, coarse grasses."));
    const filter = overlayFilter(overlays, 3);
    assert.equal(filter.length, overlays.length * 2);
    assert.match(filter.at(-1)!, /\[out\]$/);
    assert.ok(hookSize("MEET THE PLAINS ZEBRA") >= 100);
    const png = await renderArkOverlay(overlays[1]);
    assert.deepEqual([png[1], png[2], png[3]], [0x50, 0x4e, 0x47], "a PNG");
    const timeline = arkClipTimeline(plan, marks);
    assert.equal(timeline[0].kind, "hook");
    assert.equal(timeline.at(-1)!.kind, "end");
    assert.ok(timeline.some((entry) => entry.narration === "Diet: Plains zebras graze mainly on tall, coarse grasses."));
    const videoPlan = arkClipVideoPlan(plan, marks);
    assert.equal(videoPlan.format, "ark");
    assert.ok(planHasAiImagery(videoPlan), "the Ark's 3D models are AI-made: TikTok's AI label stays on");
    assert.equal(videoPlan.ark.dataSource, "live");
    assert.equal(arkClipExperiment(16).length, "short");
    assert.equal(arkClipExperiment(24).length, "medium");
});

test("`ark` is a recorded content-video type wired like the page families", () => {
    assert.ok(isVideoSourceType("ark"));
    assert.ok(isRecordedSourceType("ark"));
    assert.ok(!isSourceType("ark"), "the AI video maker never builds an ark video from a page");
    assert.ok(!(SOURCE_TYPES as readonly string[]).includes("ark"));
    assert.equal(sourcePath("ark", "meet-plains-zebra"), "/ark");
    assert.equal(videoWatchPath("ark", "meet-plains-zebra"), "/videos/ark/meet-plains-zebra");
    assert.ok(SOURCE_LABELS.ark);
    assert.equal(SOURCE_FORMAT.ark, "ark");
    assert.ok(KIND_DIMENSIONS.ark);
    assert.equal(formatOfPost({mediaKind: "blog_video", videoFormat: "ark", sourceType: "ark"}), "ark");
    const xml = serializeVideoSitemapXml("https://animaldex.app", [{type: "ark", slug: "meet-plains-zebra", sourceTitle: "Meet the Plains Zebra", videoUrl: "https://x/v.mp4", posterUrl: "https://x/p.jpg", durationSeconds: 21.4, title: "Meet the Plains Zebra on the AnimalDex Ark", hookText: "MEET THE PLAINS ZEBRA", timeline: [], publishedAt: "2026-11-10T00:00:00Z"}]);
    assert.match(xml, /<loc>https:\/\/animaldex\.app\/videos\/ark\/meet-plains-zebra<\/loc>/);
    const problems = videoProblems({source_type: "ark", status: "ready", plan: {format: "ark", title: "", hookText: "", scenes: [], ctaNarration: "", ctaText: "", musicMood: "wonder", share: arkClipShareCopy(planArkShot("flyover", {snapshot, events, fixture: false, now}))}, clips: [], tts_provider: null, video_path: "ark/x.mp4", poster_path: "ark/x.jpg", running: false});
    assert.deepEqual(problems.map((problem) => problem.code), ["not_editable"], "never offered a paid Fix");
});

test("the recorder's clock moves only when told, and runs each frame once", () => {
    const target = {
        performance: {now: () => 1000},
        requestAnimationFrame: (_callback: (time: number) => void) => 0,
        cancelAnimationFrame: (_handle: number) => undefined,
        Math: {random: Math.random}
    };
    const clock = installRecordClock(target, 7);
    const seen: number[] = [];
    const loop = (time: number) => {
        seen.push(time);
        target.requestAnimationFrame(loop);
    };
    target.requestAnimationFrame(loop);
    assert.equal(target.performance.now(), 1000);
    clock.tick(1000 / 30);
    clock.tick(1000 / 30);
    assert.deepEqual(seen.map((time) => Math.round(time * 100) / 100), [1033.33, 1066.67]);
    assert.equal(clock.elapsed(), 2000 / 30);
    const a = seededRandom(7);
    const b = seededRandom(7);
    assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test("a clip off the brief is caught, and the admin command is exact", () => {
    assert.deepEqual(clipProblems({width: 1080, height: 1920, fps: 30, seconds: 20, videoCodec: "h264", audioCodec: "aac", bytes: 1}), []);
    assert.equal(clipProblems({width: 720, height: 1280, fps: 25, seconds: 50, videoCodec: "vp9", audioCodec: null, bytes: 1}).length, 5);
    assert.equal(arkClipCommand({shot: "meet", species: "plains-zebra", upload: true}), "npm run ark:clip -- --shot meet --species plains-zebra --upload");
    assert.equal(arkClipCommand({shot: "flyover", species: "x; rm -rf /"}), "npm run ark:clip -- --shot flyover");
});
