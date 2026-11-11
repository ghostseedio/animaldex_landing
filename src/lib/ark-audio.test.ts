import assert from "node:assert/strict";
import test from "node:test";
import {ArkAudio, type ArkAudioAnimal, type ArkAudioFrame} from "@/ark-scene/ark-audio";
import {alarmCall, bedsToPlay, listenerMix, planCalls, type ArkCallSource, type ArkListener} from "@/lib/ark-audio-plan";
import {ARK_HELD_SOUND_BANKS, ARK_SOUND_TIERS} from "@/lib/ark-sound";

const LISTENER: ArkListener = {x: 0, y: 2, z: 0, rightX: 1, rightZ: 0};

test("listener mix: louder near, panned to the side it is on, centred close by", () => {
    const right = listenerMix(LISTENER, 20, 2, 0);
    const left = listenerMix(LISTENER, -20, 2, 0);
    assert.ok(right.pan > 0.5 && left.pan < -0.5);
    assert.ok(Math.abs(listenerMix(LISTENER, 0.5, 2, 0).pan) < 0.2, "close by: all round you");
    assert.ok(listenerMix(LISTENER, 3, 2, 0).gain > listenerMix(LISTENER, 30, 2, 0).gain);
    assert.equal(listenerMix(LISTENER, 100, 2, 0).gain, 0);
});

test("plan: the tier's cap of animals, alarms first, each call at its shared moment", () => {
    const sources: ArkCallSource[] = Array.from({length: 12}, (_, i) => ({id: `bird-${i}`, x: i * 2, y: 1, z: 3, mood: "dawn", pace: 1, callCount: 3}));
    const plan = planCalls(sources, LISTENER, 0, 120_000, "low");
    const animals = new Set(plan.map((c) => c.animalId));
    assert.ok(animals.size <= ARK_SOUND_TIERS.low.calls, `${animals.size} animals heard`);
    assert.ok(plan.length > 0);
    for (let i = 1; i < plan.length; i++) assert.ok(plan[i].at >= plan[i - 1].at);
    // The same window asked in two halves gives the same calls (no matter when a viewer started listening).
    const whole = planCalls(sources, LISTENER, 10_000, 70_000, "high").map((c) => `${c.animalId}@${c.at}`);
    const halves = [...planCalls(sources, LISTENER, 10_000, 40_000, "high"), ...planCalls(sources, LISTENER, 40_000, 70_000, "high")].map((c) => `${c.animalId}@${c.at}`);
    assert.deepEqual(halves, whole);
    // Asleep: silent.
    assert.equal(planCalls([{...sources[0], mood: "asleep"}], LISTENER, 0, 600_000, "high").length, 0);
    const alarm = alarmCall(sources[0], LISTENER, 5_000, "high");
    assert.equal(alarm?.mood, "alarm");
    assert.ok(alarm!.call >= 0 && alarm!.call < 3);
});

test("beds: the loudest few, never one without a URL", () => {
    const beds = bedsToPlay([{id: "a", url: "u", gain: 0.2}, {id: "b", url: "u", gain: 0.9}, {id: "c", url: "", gain: 1}, {id: "d", url: "u", gain: 0.5}], 2);
    assert.deepEqual(beds.map((b) => b.id), ["b", "d"]);
});

// MARK: The player, on a fake AudioContext

type Param = {value: number; setTargetAtTime(v: number): void; cancelScheduledValues(): void};
const param = (value: number): Param => ({value, setTargetAtTime(v: number) { this.value = v; }, cancelScheduledValues() {}});

class FakeNode {
    connect<T>(next: T): T { return next; }
    disconnect() {}
}

class FakeSource extends FakeNode {
    buffer: {duration: number} | null = null;
    loop = false;
    playbackRate = param(1);
    started: Array<[number, number, number?]> = [];
    stopped = false;
    onended: (() => void) | null = null;
    start(when: number, offset = 0, duration?: number) { this.started.push([when, offset, duration]); }
    stop() { this.stopped = true; this.onended?.(); }
}

class FakeContext {
    currentTime = 0;
    sampleRate = 44100;
    state = "running";
    destination = new FakeNode();
    sources: FakeSource[] = [];
    resumed = 0;
    createGain() { return Object.assign(new FakeNode(), {gain: param(1)}); }
    createBiquadFilter() { return Object.assign(new FakeNode(), {type: "", frequency: param(20000)}); }
    createStereoPanner() { return Object.assign(new FakeNode(), {pan: param(0)}); }
    createBuffer() { return {duration: 0}; }
    createBufferSource() { const s = new FakeSource(); this.sources.push(s); return s; }
    decodeAudioData(_data: ArrayBuffer, ok: (b: unknown) => void) { ok({duration: 20}); return undefined; }
    resume() { this.resumed++; return Promise.resolve(); }
    suspend() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
}

const CREDIT = [{recordist: "A. Recordist", license: "CC BY 4.0", source: "Wikimedia Commons", page: "https://commons.wikimedia.org/x"}];
const manifest = (credits: unknown[]) => ({version: 1, kind: "species", audio: "sprite-0123abcd.m4a", calls: [[0, 1.2], [3, 0.8], [6, 1]], grains: [], style: null, rhythm: {ioi: 2, event: 1}, habitat: null, credits});

function fakeFetch(log: string[]) {
    return async (url: string) => {
        log.push(url);
        const body = /silent-species/.test(url) ? manifest([]) : manifest(CREDIT);
        return {ok: !/missing/.test(url), json: async () => body, arrayBuffer: async () => new ArrayBuffer(8)};
    };
}

const settle = async () => {
    for (let i = 0; i < 6; i++) await new Promise((resolve) => setImmediate(resolve));
};

function animals(n: number, mood: ArkAudioAnimal["mood"] = "courting"): ArkAudioAnimal[] {
    return Array.from({length: n}, (_, i) => ({id: `a${i}`, speciesProfileId: `species-${i % 3}`, x: 2 + i, y: 1, z: 4, mood}));
}

function frame(nowMs: number, list: ArkAudioAnimal[], extra: Partial<ArkAudioFrame> = {}): ArkAudioFrame {
    return {nowMs, listener: LISTENER, animals: list, alarms: [], beds: [], ...extra};
}

test("player: nothing is made or fetched before the tap", async () => {
    const log: string[] = [];
    let made = 0;
    const audio = new ArkAudio({soundBase: "https://store.example", tier: "high", fetch: fakeFetch(log), createContext: () => { made++; return new FakeContext() as unknown as AudioContext; }});
    audio.step(frame(1_000, animals(4)));
    await settle();
    assert.equal(made, 0);
    assert.equal(log.length, 0);
    assert.equal(audio.playing, false);
    assert.equal(audio.unlock(), true);
    assert.equal(audio.unlock(), true);
    assert.equal(made, 1, "one context");
    assert.equal(audio.playing, true);
});

test("player: calls at their moments, within the voice cap, credited; alarms jump the queue", async () => {
    const log: string[] = [];
    const ctx = new FakeContext();
    const audio = new ArkAudio({soundBase: "https://store.example", tier: "low", fetch: fakeFetch(log), createContext: () => ctx as unknown as AudioContext});
    audio.unlock();
    const list = animals(10);
    let maxVoices = 0;
    for (let t = 0; t < 120_000; t += 100) {
        ctx.currentTime = t / 1000;
        audio.step(frame(t, list));
        maxVoices = Math.max(maxVoices, audio.activity().voices);
        if (t % 1000 === 0) await settle();
    }
    assert.ok(audio.counts.calls > 3, `calls ${audio.counts.calls}`);
    assert.ok(maxVoices <= ARK_SOUND_TIERS.low.calls, `voices ${maxVoices}`);
    assert.ok(log.some((url) => url.endsWith("/species-0/manifest.json")));
    assert.ok(log.some((url) => url.endsWith("/species-0/sprite-0123abcd.m4a")));
    assert.deepEqual(audio.credits().map((c) => c.text), ["A. Recordist (CC BY 4.0, Wikimedia Commons)"]);
    const before = audio.counts.alarms;
    audio.step(frame(121_000, list, {alarms: ["a0"]}));
    assert.equal(audio.counts.alarms, before + 1);
});

test("player: held banks and banks without credits never call", async () => {
    const log: string[] = [];
    const ctx = new FakeContext();
    const audio = new ArkAudio({soundBase: "https://store.example", tier: "high", fetch: fakeFetch(log), createContext: () => ctx as unknown as AudioContext});
    audio.unlock();
    const held = Array.from(ARK_HELD_SOUND_BANKS)[0];
    const list: ArkAudioAnimal[] = [
        {id: "h", speciesProfileId: held, x: 1, y: 1, z: 1, mood: "courting"},
        {id: "s", speciesProfileId: "silent-species", x: 2, y: 1, z: 1, mood: "courting"}
    ];
    for (let t = 0; t < 60_000; t += 200) {
        ctx.currentTime = t / 1000;
        audio.step(frame(t, list));
        await settle();
    }
    assert.equal(audio.counts.calls, 0);
    assert.ok(!log.some((url) => url.includes(held)), "a held bank is never fetched");
});

test("player: beds fade in, cross over and are let go; off stops new calls", async () => {
    const ctx = new FakeContext();
    const audio = new ArkAudio({soundBase: "https://store.example", tier: "high", fetch: fakeFetch([]), createContext: () => ctx as unknown as AudioContext});
    audio.unlock();
    const bed = {id: "waves", url: "https://store.example/bed.m4a", gain: 0.7, credits: CREDIT};
    audio.step(frame(0, [], {beds: [bed, {id: "uncredited", url: "https://store.example/x.m4a", gain: 0.9}]}));
    await settle();
    audio.step(frame(300, [], {beds: [bed]}));
    assert.equal(audio.counts.beds, 1, "only the credited bed");
    assert.equal(audio.activity().beds, 1);
    ctx.currentTime = 1;
    audio.step(frame(1000, [], {beds: []}));
    assert.equal(audio.activity().beds, 0);
    ctx.currentTime = 5;
    audio.step(frame(5000, [], {beds: []}));
    assert.ok(ctx.sources.some((s) => s.loop && s.stopped), "the faded bed is stopped");
    audio.setOn(false);
    const calls = audio.counts.calls;
    for (let t = 6000; t < 60_000; t += 200) {
        ctx.currentTime = t / 1000;
        audio.step(frame(t, animals(3)));
        await settle();
    }
    assert.equal(audio.counts.calls, calls);
    audio.dispose();
});

test("ambient beds through the player: loop points, the seam blended once, M4A where WebM fails, thunder after its flash", async () => {
    const {selectAmbientBeds, thunderClaps, ambientCredits, AMBIENT_LOOP_START} = await import("@/ark-scene/ambient-beds");
    const {waterNear} = await import("@/ark-scene/liveliness-scene");
    // On the beach: the sea is near, so the surf or the shore bed plays. (x = 105: the home growth's east shoulder
    // took the old beach at x = 70 inland; the east coast is now about x = 110.)
    const near = waterNear(105, 0, 0);
    assert.ok(near.sea && typeof near.sea === "object" && near.sea.distance < 15, JSON.stringify(near.sea));
    const beds = selectAmbientBeds({zone: "seashore", weather: {rain: 0, wind: 0.4, storm: 0, insects: 1, cold: 0.3}, hour: 12, tide: {height: 0}, cameraPos: {x: 105, y: 1, z: 0}, nearWater: near, format: "webm", nowMs: 1_000_000}).map((bed) => ({...bed, credits: ambientCredits([bed.id])}));
    assert.ok(beds.length > 0);
    assert.ok(beds.every((b) => b.credits.length > 0 && /\.webm$/.test(b.url) && /\.m4a$/.test(b.fallbackUrl)));
    const log: string[] = [];
    const ctx = new FakeContext();
    let blended = 0;
    ctx.decodeAudioData = (_data: ArrayBuffer, ok: (b: unknown) => void) => {
        ok({duration: 120, sampleRate: 8000, numberOfChannels: 1, getChannelData: () => {
            blended++;
            return new Float32Array(8000 * 120);
        }});
        return undefined;
    };
    const fetchBeds = async (url: string) => {
        log.push(url);
        // WebM can't be read here (as on older Safari): the M4A must be used.
        if (/\.webm$/.test(url)) return {ok: false, json: async () => null, arrayBuffer: async () => new ArrayBuffer(0)};
        return {ok: true, json: async () => null, arrayBuffer: async () => new ArrayBuffer(8)};
    };
    const audio = new ArkAudio({soundBase: null, tier: "high", fetch: fetchBeds, createContext: () => ctx as unknown as AudioContext});
    audio.unlock();
    for (let t = 0; t < 4000; t += 200) {
        ctx.currentTime = t / 1000;
        audio.step(frame(1_000_000 + t, [], {beds}));
        await settle();
    }
    assert.ok(log.some((url) => url.endsWith(".webm")) && log.some((url) => url.endsWith(".m4a")), "tried WebM, then the M4A");
    assert.equal(audio.activity().beds, Math.min(beds.length, ARK_SOUND_TIERS.high.beds));
    const looped = ctx.sources.filter((s) => s.loop);
    assert.ok(looped.length > 0);
    for (const source of looped) {
        const loop = source as unknown as {loopStart: number; loopEnd: number};
        assert.equal(loop.loopStart, AMBIENT_LOOP_START);
        assert.ok(loop.loopEnd > loop.loopStart);
        // Started inside its loop.
        assert.ok(source.started[0][1] >= loop.loopStart && source.started[0][1] < loop.loopEnd);
    }
    assert.equal(blended, looped.length, "each buffer's seam blended once");
    // Thunder: a storm's claps play as one-shots at their moments.
    let claps: ReturnType<typeof thunderClaps> = [];
    let from = 1_000_000;
    while (!claps.length && from < 1_000_000 + 3_600_000) {
        claps = thunderClaps({fromMs: from, toMs: from + 60_000, storm: 1, format: "m4a"});
        from += 60_000;
    }
    assert.ok(claps.length > 0, "a storm thunders within the hour");
    const clap = claps[0];
    assert.ok(clap.at > clap.flashAt, "sound after the flash");
    audio.preload([clap.url]);
    await settle();
    ctx.currentTime = 10;
    assert.equal(audio.shot({...clap, credits: ambientCredits([clap.id])}, clap.at - 500), true);
    assert.equal(audio.shot({...clap, credits: ambientCredits([clap.id])}, clap.at - 400), false, "once");
    assert.ok(audio.credits().length > 0);
    audio.dispose();
});
