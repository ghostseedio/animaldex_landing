import {test} from "node:test";
import assert from "node:assert/strict";
import {buildAss, buildTimeline, chunkWords, licenseFromCaption, MAX_AI_CLIPS, normalizePlan, parseModelJson, timeWords} from "./content-video/plan";
import {parseEstimateUSD} from "./content-video/higgsfield";
import {wavSeconds} from "./content-video/tts";
import {MUSIC_MOODS, MUSIC_TRACKS, pickMusicTrack} from "./content-video/music";
import {existsSync} from "node:fs";

const share = {
    youtube: {title: "The deadliest animal is tiny", description: "d"},
    tiktok: {caption: "t"},
    instagram: {caption: "i"},
    facebook: {caption: "f"},
    x: {text: "x"}
};

function scene(visual: "image" | "ai_clip", image = 1, motion = "the mosquito shifts its legs") {
    return {narration: "Mosquitoes kill more people than sharks.", overlay: "Tiny killer", visual, image, focus_x: 0.5, motion_prompt: visual === "ai_clip" ? motion : ""};
}

test("normalizePlan forces the hook to be an AI clip and caps clips at hook + 4", () => {
    const plan = normalizePlan({
        title: "t",
        hook_text: "Deadlier than any predator",
        scenes: [scene("image"), ...Array.from({length: 7}, () => scene("ai_clip", 2))],
        cta_narration: "The full story is on AnimalDex.",
        cta_text: "Read the full story",
        share
    }, 3);
    assert.ok(plan);
    assert.equal(plan.scenes[0].visual, "ai_clip");
    assert.ok(plan.scenes[0].motionPrompt.length > 0);
    assert.equal(plan.scenes.filter((entry) => entry.visual === "ai_clip").length, MAX_AI_CLIPS);
});

test("normalizePlan clamps photo numbers, drops empty lines, and rejects too-short scripts", () => {
    const plan = normalizePlan({hook_text: "h", scenes: [scene("ai_clip", 9), scene("image", 0), {narration: ""}, scene("image"), scene("image"), scene("image")], share}, 3);
    assert.ok(plan);
    assert.equal(plan.scenes.length, 5);
    assert.equal(plan.scenes[0].image, 3);
    assert.equal(plan.scenes[1].image, 1);
    assert.equal(normalizePlan({scenes: [scene("image")], share}, 3), null);
    assert.equal(normalizePlan({scenes: Array.from({length: 6}, () => scene("image"))}, 3), null, "share copy is required");
});

test("an ai_clip with no motion prompt becomes a still (except the hook)", () => {
    const plan = normalizePlan({hook_text: "h", scenes: [scene("ai_clip"), scene("ai_clip", 1, ""), scene("image"), scene("image"), scene("image")], share}, 2);
    assert.equal(plan?.scenes[1].visual, "image");
});

test("parseModelJson tolerates fences and chatter", () => {
    assert.deepEqual(parseModelJson("```json\n{\"a\":1}\n```"), {a: 1});
    assert.deepEqual(parseModelJson("Here you go: {\"a\":2} hope it helps"), {a: 2});
    assert.equal(parseModelJson("nope"), null);
});

test("timeline lays scenes end to end and ends on the end card", () => {
    const plan = normalizePlan({hook_text: "Hook", scenes: Array.from({length: 5}, () => scene("image")), share}, 1)!;
    const timeline = buildTimeline(plan, [3, 4, 4, 4, 4], 2);
    assert.equal(timeline.length, 6);
    assert.equal(timeline[0].kind, "hook");
    assert.equal(timeline[0].overlay, "Hook");
    assert.equal(timeline.at(-1)!.kind, "end");
    assert.ok(timeline.at(-1)!.duration >= 2.8);
    for (let index = 1; index < timeline.length; index += 1) {
        assert.equal(timeline[index].start, Math.round((timeline[index - 1].start + timeline[index - 1].duration) * 100) / 100);
    }
});

test("caption words cover the spoken time and break at punctuation", () => {
    const words = timeWords("Forget sharks. They kill fewer than ten people a year.", 2, 4);
    assert.equal(words[0].start, 2);
    assert.ok(Math.abs(words.at(-1)!.end - 6) < 0.02);
    const chunks = chunkWords(words);
    assert.deepEqual(chunks[0].map((word) => word.word), ["Forget", "sharks."]);
    assert.ok(chunks.every((chunk) => chunk.length <= 3));
});

test("ASS highlights one word at a time and escapes override braces", () => {
    const plan = normalizePlan({hook_text: "Hook {bad}", scenes: Array.from({length: 5}, () => scene("image")), share}, 1)!;
    const timeline = buildTimeline(plan, [2, 2, 2, 2, 2], 1.5);
    const ass = buildAss({timeline, spokenSeconds: [2, 2, 2, 2, 2, 1.5], endUrl: "ANIMALDEX.APP", credit: "Photos: Commons"});
    assert.match(ass, /Style: Caption,Barlow Condensed ExtraBold/);
    assert.match(ass, /\{\\c&H0032F4A7&\}MOSQUITOES\{\\c&H00FFFFFF&\} KILL MORE/);
    assert.match(ass, /HOOK \{\\c&H0032F4A7&\}BAD/, "hook punchline in lime, braces stripped");
    assert.match(ass, /EndUrl,,0,0,0,,.*ANIMALDEX\.APP/);
    assert.match(ass, /EndCredit/);
});

test("licenses are read from Commons credit captions", () => {
    assert.equal(licenseFromCaption("Photo: Jane Doe, CC BY-SA 4.0, via Wikimedia Commons."), "CC BY-SA 4.0");
    assert.equal(licenseFromCaption("Photo: CDC, Public domain, via Wikimedia Commons."), "Public domain");
    assert.equal(licenseFromCaption(undefined), null);
});

test("Higgsfield estimates are read only from USD fields", () => {
    assert.equal(parseEstimateUSD({credits: "1.500", usd: "0.094"}), 0.094);
    assert.equal(parseEstimateUSD({data: {cost_usd: 0.2}}), 0.2);
    assert.equal(parseEstimateUSD({credits: 12}), null);
});

test("wavSeconds reads the duration, including streamed placeholder sizes", () => {
    const rate = 24000;
    const data = Buffer.alloc(rate * 2 * 3);
    const header = Buffer.alloc(44);
    header.write("RIFF", 0, "ascii");
    header.writeUInt32LE(36 + data.length, 4);
    header.write("WAVE", 8, "ascii");
    header.write("fmt ", 12, "ascii");
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(rate, 24);
    header.writeUInt32LE(rate * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write("data", 36, "ascii");
    header.writeUInt32LE(data.length, 40);
    assert.equal(wavSeconds(Buffer.concat([header, data])), 3);
    header.writeUInt32LE(0xFFFFFFFF, 40);
    assert.equal(wavSeconds(Buffer.concat([header, data])), 3);
});

test("every mood has a bed on disk, and a video keeps its bed across re-edits", () => {
    for (const mood of MUSIC_MOODS) assert.ok(MUSIC_TRACKS.some((track) => track.mood === mood), `no track for ${mood}`);
    for (const track of MUSIC_TRACKS) assert.ok(existsSync(`public/video-music/${track.id}.mp3`), `missing public/video-music/${track.id}.mp3`);
    assert.equal(pickMusicTrack("suspense", "video-a")?.id, pickMusicTrack("suspense", "video-a")?.id);
    assert.equal(pickMusicTrack("suspense", "video-a")?.mood, "suspense");
    assert.equal(pickMusicTrack(undefined, "x")?.mood, "curious");
});

test("the plan's music mood is validated, defaulting to curious", () => {
    const base = {hook_text: "h", scenes: Array.from({length: 5}, () => scene("image")), share};
    assert.equal(normalizePlan({...base, music_mood: "epic"}, 1)?.musicMood, "epic");
    assert.equal(normalizePlan({...base, music_mood: "dubstep"}, 1)?.musicMood, "curious");
});

test("spoken syllables count numbers the way they are read", async () => {
    const {spokenSyllables, numberWords} = await import("./content-video/word-timing");
    assert.equal(numberWords(610000), "six hundred ten thousand");
    assert.equal(numberWords(2024), "twenty twenty four");
    assert.ok(spokenSyllables("610,000") >= 6);
    assert.equal(spokenSyllables("cat"), 1);
    assert.ok(spokenSyllables("70%") >= 4);
});

test("aligned words map back onto the script, including split numbers", async () => {
    const {mapAlignedWords} = await import("./content-video/word-timing");
    const mapped = mapAlignedWords(["Malaria", "killed", "610,000", "people."], [
        {text: "Malaria", start: 0, end: 0.5}, {text: "killed", start: 0.55, end: 0.9},
        {text: "610", start: 0.95, end: 1.4}, {text: "000", start: 1.4, end: 1.9}, {text: "people", start: 2, end: 2.4}
    ]);
    assert.deepEqual(mapped?.map((word) => [word.word, word.start, word.end]), [["Malaria", 0, 0.5], ["killed", 0.55, 0.9], ["610,000", 0.95, 1.9], ["people.", 2, 2.4]]);
});

test("pause-pinned timing puts a clause break in the recording's pause", async () => {
    const {timeLineWords} = await import("./content-video/word-timing");
    const words = timeLineWords("Forget sharks. They kill fewer than ten people.", 3, {spans: [{start: 0.1, end: 0.9}, {start: 1.5, end: 2.9}]});
    assert.ok(words[1].end <= 0.9 + 1e-6, "first clause ends before the pause");
    assert.ok(Math.abs(words[2].start - 1.5) < 0.01, "second clause starts when speech resumes");
});

test("stat cards go only where relevant: first appearance, never the hook, never imagined animals", async () => {
    const {applyStatCards} = await import("./content-video/plan");
    const card = {name: "Cheetah", tier: "A" as const, stats: {dominance: 60, speed: 98, size: 40, intelligence: 50, rarity: 55}};
    const plan = normalizePlan({hook_text: "h", scenes: [scene("ai_clip", 1), scene("image", 1), scene("image", 2), scene("image", 1), scene("image", 2)], share}, 2)!;
    const withCards = applyStatCards(plan, {species: [{slug: "cheetah", name: "Cheetah", image: 1, card}]});
    assert.equal(withCards.scenes[0].statCard, undefined, "never over the hook");
    assert.deepEqual(withCards.scenes[1].statCard, card);
    assert.equal(withCards.scenes[3].statCard, undefined, "only the first time it appears");
    assert.equal(withCards.scenes[2].statCard, undefined, "no stats, no card");
    assert.equal(applyStatCards({...plan, format: "creature"}, {species: [{slug: "cheetah", name: "Cheetah", image: 1, card}]}).scenes[1].statCard, undefined);
});
