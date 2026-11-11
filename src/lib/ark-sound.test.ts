import assert from "node:assert/strict";
import test from "node:test";
import {
    alarmLevel,
    alarmWave,
    ambientMix,
    ARK_AMBIENT_BEDS,
    ARK_AMBIENT_SOURCES,
    ARK_HELD_SOUND_BANKS,
    ARK_SOUND_TIERS,
    audibleCalls,
    callMood,
    callVoice,
    cappedMix,
    distanceGain,
    initialSoundPreference,
    parseSoundManifest,
    scheduledCalls,
    soundAudioUrl,
    soundCreditLines,
    soundManifestUrl,
    speciesCallPace,
    storedSoundPreference,
    type ArkSoundManifest
} from "@/lib/ark-sound";

/** The European Robin's live manifest (2026-11-11), trimmed. */
const ROBIN_RAW = {
    version: 1,
    kind: "species",
    audio: "sprite-68e71ef4.m4a",
    calls: [[0.15, 4.5818], [4.8818, 3.8736]],
    grains: [[8.9054, 2.462], [11.5174, 2.462]],
    style: "long",
    rhythm: {ioi: 0.221, event: 2.757},
    credits: [
        {recordist: "Zdeněk Vermouzek", license: "CC BY-SA 4.0", source: "Wikimedia Commons", page: "https://commons.wikimedia.org/wiki/File:Erithacus_rubecula_-_European_Robin_XC249306.mp3"},
        {recordist: "Gianni Del Bufalo bygdb", license: "CC BY", source: "iNaturalist", page: "https://www.inaturalist.org/observations/406105906"}
    ]
};
const HABITAT_RAW = {
    version: 1,
    kind: "habitat",
    habitat: "grassland",
    shared_audio: "habitat/grassland/sprite-5cea18c0.m4a",
    calls: [[0, 3]],
    grains: [[3, 0.6]],
    style: "ambient",
    rhythm: {ioi: 3.5, event: 1},
    credits: [{recordist: "Beeld en Geluid", license: "CC BY-SA 3.0", source: "Wikimedia Commons"}]
};

const ROBIN = parseSoundManifest(ROBIN_RAW)!;
const GRASS = parseSoundManifest(HABITAT_RAW)!;

test("ark-sound: manifests parse as the chat's bucket writes them; bad ones are refused", () => {
    assert.equal(ROBIN.kind, "species");
    assert.equal(ROBIN.calls.length, 2);
    assert.equal(GRASS.kind, "habitat");
    assert.equal(GRASS.audio, "habitat/grassland/sprite-5cea18c0.m4a");
    assert.equal(parseSoundManifest({...ROBIN_RAW, audio: "../x.m4a"}), null);
    assert.equal(parseSoundManifest({...HABITAT_RAW, shared_audio: "https://elsewhere/x.m4a"}), null);
    assert.equal(parseSoundManifest(null), null);
    assert.equal(parseSoundManifest({...ROBIN_RAW, credits: [{recordist: "x", license: "CC0", source: "y", page: "javascript:alert(1)"}]})?.credits[0].page, null);
    const base = "https://wwhsdzpczekgdlobwaej.supabase.co";
    assert.equal(soundManifestUrl(base, "abc"), `${base}/storage/v1/object/public/animal-chat-sounds/v1/abc/manifest.json`);
    assert.equal(soundAudioUrl(base, "abc", ROBIN), `${base}/storage/v1/object/public/animal-chat-sounds/v1/abc/sprite-68e71ef4.m4a`);
    assert.equal(soundAudioUrl(base, "abc", GRASS), `${base}/storage/v1/object/public/animal-chat-sounds/v1/habitat/grassland/sprite-5cea18c0.m4a`);
});

test("ark-sound: calls only in a species' own voice or its kind's (A1); never a habitat bank or a held one", () => {
    const banks: Record<string, ArkSoundManifest> = {robin: ROBIN, dog: ROBIN, komodo: GRASS, [Array.from(ARK_HELD_SOUND_BANKS)[0]]: ROBIN};
    const of = (id: string) => banks[id] ?? null;
    assert.deepEqual(callVoice({species_profile_id: "robin"}, of), {speciesProfileId: "robin", via: "own"});
    assert.equal(callVoice({species_profile_id: "komodo"}, of), null);
    assert.deepEqual(callVoice({species_profile_id: "labrador", kind_species_profile_id: "dog"}, of), {speciesProfileId: "dog", via: "kind"});
    assert.equal(callVoice({species_profile_id: "breed", kind_species_profile_id: "komodo"}, of), null);
    assert.equal(callVoice({species_profile_id: Array.from(ARK_HELD_SOUND_BANKS)[0]}, of), null);
    assert.equal(ARK_HELD_SOUND_BANKS.size, 18);
});

test("ark-sound: moods from the behaviour state; asleep is silent, dawn singers sing at dawn", () => {
    assert.equal(callMood({asleep: true, hours: 6}), "asleep");
    assert.equal(callMood({asleep: true, alarm: true, hours: 6}), "alarm");
    assert.equal(callMood({asleep: false, dawnSinger: true, hours: 6}), "dawn");
    assert.equal(callMood({asleep: false, dawnSinger: true, hours: 13}), "awake");
    assert.equal(callMood({asleep: false, courting: true, hours: 13}), "courting");
    assert.equal(scheduledCalls("a", "asleep", 1, 2, 0, 3_600_000).length, 0);
    assert.equal(speciesCallPace(ROBIN), 0.4);
});

test("ark-sound: the schedule is the same for every viewer and for any window that covers it", () => {
    const from = Date.UTC(2026, 10, 11, 5, 0);
    const hour = scheduledCalls("animal-1", "dawn", 1, 2, from, from + 3_600_000);
    const halves = [
        ...scheduledCalls("animal-1", "dawn", 1, 2, from, from + 1_800_000),
        ...scheduledCalls("animal-1", "dawn", 1, 2, from + 1_800_000, from + 3_600_000)
    ];
    assert.deepEqual(hour, halves);
    assert.deepEqual(hour, scheduledCalls("animal-1", "dawn", 1, 2, from, from + 3_600_000));
    // About three calls a minute at dawn, under one when merely awake.
    assert.ok(hour.length > 120 && hour.length < 240, `${hour.length}`);
    const awake = scheduledCalls("animal-1", "awake", 1, 2, from, from + 3_600_000).length;
    assert.ok(awake > 25 && awake < 80, `${awake}`);
    for (const c of hour) assert.ok(c.call >= 0 && c.call < 2 && Math.abs(c.rate - 1) <= 0.035);
    // Two animals do not call in step.
    const other = scheduledCalls("animal-2", "dawn", 1, 2, from, from + 3_600_000).map((c) => c.at);
    assert.ok(hour.filter((c) => other.includes(c.at)).length < 3);
});

test("ark-sound: alarms spread outward with short delays, a few call, and calm after a while", () => {
    const flock = [
        {id: "s1", x: 0, z: 0},
        {id: "s2", x: 2, z: 0},
        {id: "s3", x: 6, z: 1},
        {id: "s4", x: 12, z: 3},
        {id: "s5", x: 1, z: 1}
    ];
    const wave = alarmWave("s1", flock, 1000);
    assert.equal(wave[0].id, "s1");
    assert.equal(wave[0].delayMs, 0);
    const byId = new Map(wave.map((r) => [r.id, r]));
    assert.ok(byId.get("s4")!.delayMs > byId.get("s3")!.delayMs && byId.get("s3")!.delayMs > byId.get("s2")!.delayMs);
    assert.ok(byId.get("s4")!.delayMs < 2000);
    assert.equal(wave.filter((r) => r.calls).length, 3);
    assert.deepEqual(wave, alarmWave("s1", [...flock].reverse(), 1000));
    assert.equal(alarmLevel(-1), 0);
    assert.equal(alarmLevel(1000), 1);
    assert.ok(alarmLevel(9000) < 1 && alarmLevel(9000) > 0);
    assert.equal(alarmLevel(13000), 0);
});

test("ark-sound: louder when close, silent far away, capped by tier with alarms first", () => {
    assert.equal(distanceGain(1), 1);
    assert.ok(distanceGain(10) < distanceGain(5));
    assert.equal(distanceGain(60), 0);
    assert.ok(distanceGain(55) < distanceGain(40) * 0.5);
    const candidates = [
        {animalId: "a", mood: "awake" as const, distance: 3},
        {animalId: "b", mood: "alarm" as const, distance: 30},
        {animalId: "c", mood: "asleep" as const, distance: 1},
        {animalId: "d", mood: "dawn" as const, distance: 10},
        {animalId: "e", mood: "awake" as const, distance: 70}
    ];
    assert.deepEqual(audibleCalls(candidates, ARK_SOUND_TIERS.low.calls).map((c) => c.animalId), ["b", "d"]);
    assert.deepEqual(audibleCalls(candidates, ARK_SOUND_TIERS.high.calls).map((c) => c.animalId), ["b", "d", "a"]);
    assert.ok(ARK_SOUND_TIERS.high.calls > ARK_SOUND_TIERS.medium.calls && ARK_SOUND_TIERS.medium.calls > ARK_SOUND_TIERS.low.calls);
});

test("ark-sound: the ambient beds follow the zone, the hour, the weather and the camera's layer", () => {
    const calm = {rain: 0, wind: 0.2, storm: 0, insects: 1};
    const base = {zones: {woodland: 1}, shore: 0, river: 0, pond: 0, underwater: false, altitude: 0};
    const noon = ambientMix({...base, hours: 12, elevation: 58, weather: calm});
    const midnight = ambientMix({...base, hours: 0, elevation: -58, weather: calm});
    assert.ok(noon.forest_day > 0.4 && midnight.forest_day === 0);
    assert.ok(midnight.night_insects > 0.4 && noon.night_insects === 0);
    const dawn = ambientMix({...base, hours: 6, elevation: 0, weather: calm});
    assert.ok(dawn.dawn_chorus > 0.3);
    const storm = ambientMix({...base, hours: 12, elevation: 58, weather: {rain: 1, wind: 1, storm: 1, insects: 0.1}});
    assert.ok(storm.rain > 0.9 && storm.thunder > 0.9 && storm.wind > noon.wind && storm.forest_day < noon.forest_day);
    const peak = ambientMix({...base, zones: {mountains: 1}, altitude: 1, hours: 12, elevation: 58, weather: calm});
    assert.ok(peak.wind > noon.wind);
    const beach = ambientMix({...base, zones: {seashore: 1}, shore: 1, hours: 12, elevation: 58, weather: calm});
    assert.ok(beach.waves > 0.5);
    const below = ambientMix({...base, zones: {seashore: 1}, shore: 1, underwater: true, hours: 12, elevation: 58, weather: calm});
    assert.ok(below.underwater > 0.5 && below.waves === 0 && below.forest_day === 0);
    const capped = cappedMix(storm, ARK_SOUND_TIERS.low.beds);
    assert.equal(ARK_AMBIENT_BEDS.filter((b) => capped[b] > 0).length, 2);
    // Every bed names its source, or says it still needs a free recording.
    for (const bed of ARK_AMBIENT_BEDS) assert.ok(ARK_AMBIENT_SOURCES[bed].habitat || /needed/.test(ARK_AMBIENT_SOURCES[bed].note));
});

test("ark-sound: off until a tap, on the web and (never remembered) in the apps' panel", () => {
    assert.deepEqual(initialSoundPreference(null, false), {on: false, volume: 0.7, remembered: false});
    const stored = storedSoundPreference({on: true, volume: 0.4});
    assert.deepEqual(initialSoundPreference(stored, false), {on: false, volume: 0.4, remembered: true});
    assert.deepEqual(initialSoundPreference(stored, true), {on: false, volume: 0.7, remembered: false});
    assert.deepEqual(initialSoundPreference("{bad", false), {on: false, volume: 0.7, remembered: false});
});

test("ark-sound: credit lines for what plays, one per recordist and licence", () => {
    const lines = soundCreditLines([ROBIN, GRASS, ROBIN, null]);
    assert.deepEqual(lines.map((l) => l.text), [
        "Beeld en Geluid (CC BY-SA 3.0, Wikimedia Commons)",
        "Gianni Del Bufalo bygdb (CC BY, iNaturalist)",
        "Zdeněk Vermouzek (CC BY-SA 4.0, Wikimedia Commons)"
    ]);
    assert.match(lines[2].page ?? "", /^https:\/\/commons\.wikimedia\.org\//);
});
