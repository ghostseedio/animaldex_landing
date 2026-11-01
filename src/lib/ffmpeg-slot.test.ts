import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {ffmpegSlotDepth, lowPriority, withFfmpegSlot} from "@/lib/ffmpeg-slot";

const readRepo = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Nov 1 2026: an in-container encode starved the web server on the 2-vCPU VM.

test("ffmpeg runs one at a time, in the order asked, and a failure frees the slot", async () => {
    let running = 0;
    let most = 0;
    const order: string[] = [];
    const job = (name: string, fail = false) => withFfmpegSlot(async () => {
        running += 1;
        most = Math.max(most, running);
        await pause(15);
        order.push(name);
        running -= 1;
        if (fail) throw new Error(`${name} failed`);
        return name;
    });
    const results = await Promise.allSettled([job("a"), job("b", true), job("c")]);
    assert.equal(most, 1);
    assert.deepEqual(order, ["a", "b", "c"]);
    assert.deepEqual(results.map((result) => result.status), ["fulfilled", "rejected", "fulfilled"]);
    assert.equal(ffmpegSlotDepth(), 0);
});

test("ffmpeg starts at the lowest CPU priority unless turned off", () => {
    const before = process.env.CONTENT_VIDEO_NICE;
    try {
        delete process.env.CONTENT_VIDEO_NICE;
        assert.deepEqual(lowPriority("ffmpeg", ["-i", "a.mp4"]), {command: "nice", args: ["-n", "19", "ffmpeg", "-i", "a.mp4"]});
        process.env.CONTENT_VIDEO_NICE = "0";
        assert.deepEqual(lowPriority("ffmpeg", ["-i", "a.mp4"]), {command: "ffmpeg", args: ["-i", "a.mp4"]});
    } finally {
        if (before === undefined) delete process.env.CONTENT_VIDEO_NICE;
        else process.env.CONTENT_VIDEO_NICE = before;
    }
});

test("every server ffmpeg goes through the slot, and every encode uses one thread", () => {
    for (const file of ["src/lib/content-video/render.ts", "src/lib/social/video-normalize.ts"]) {
        const source = readRepo(file);
        // Each spawn uses the low-priority command, inside withFfmpegSlot.
        const spawns = source.match(/spawn\([^,]+,/g) ?? [];
        assert.ok(spawns.length > 0, file);
        for (const call of spawns) assert.match(call, /^spawn\((run\.)?command,$/, `${file}: ${call}`);
        assert.equal((source.match(/withFfmpegSlot\(/g) ?? []).length, spawns.length, `${file}: one slot per spawn`);
        // libx264 uses every core by default: each encode names one thread.
        const encodes = source.match(/"libx264"[^\n]*(\n[^\n]*){0,1}/g) ?? [];
        assert.ok(encodes.length > 0, file);
        for (const encode of encodes) assert.match(encode, /"-threads", "1"/, `${file}: ${encode}`);
        assert.ok(!source.includes('"-threads", "2"'), file);
    }
});
