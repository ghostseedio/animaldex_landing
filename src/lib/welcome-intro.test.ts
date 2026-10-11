import assert from "node:assert/strict";
import {existsSync} from "node:fs";
import test from "node:test";
import {resolveVisualSignature} from "@/lib/system-dynamics";
import {WELCOME_INTRO_LINEUP, WELCOME_INTRO_VOICEOVER, welcomeSystemDynamics} from "@/lib/welcome-intro";

test("every System Dynamics card decodes its live rows and draws a wave", () => {
    const stories = WELCOME_INTRO_LINEUP.flatMap((animal) => (animal.system ? [animal.system] : []));
    assert.equal(stories.length, 3);
    for (const story of stories) {
        const dynamics = welcomeSystemDynamics(story);
        assert.ok(dynamics, "rows decode");
        assert.ok(dynamics.frequencyProfile.modes.length > 0, "has frequency modes");
        assert.ok(dynamics.waveform?.pathD, "has the waveform path");
        assert.notEqual(resolveVisualSignature(dynamics).type, undefined);
    }
});

test("each lesson's cues are in order, one per domain or evidence step", () => {
    for (const animal of WELCOME_INTRO_LINEUP) {
        const cues = animal.system?.cueSeconds ?? animal.trial?.cueSeconds;
        if (!cues) continue;
        assert.deepEqual([...cues].sort((a, b) => a - b), cues, `${animal.name} cues ascend`);
        if (animal.system) assert.equal(cues.length, animal.system.domains.length);
        if (animal.trial) assert.equal(cues.length, 4);
    }
});

test("every card's image and voiceover is in public/", () => {
    for (const animal of WELCOME_INTRO_LINEUP) {
        assert.ok(existsSync(`public/images/welcome/${animal.image}.webp`), animal.image);
        assert.ok(existsSync(`public/audio/welcome/${animal.voiceover}.mp3`), animal.voiceover);
    }
    assert.ok(existsSync(`public/audio/welcome/${WELCOME_INTRO_VOICEOVER}.mp3`));
    for (const sound of ["camera_shutter", "reward_points", "reward_credits", "train_complete"]) {
        assert.ok(existsSync(`public/audio/welcome/${sound}.wav`), sound);
    }
});
