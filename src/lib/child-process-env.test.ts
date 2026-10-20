import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {childProcessEnv} from "@/lib/child-process-env";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("child processes do not inherit Next's oversized standalone config", () => {
    const env = childProcessEnv({
        PATH: "/usr/bin",
        FFMPEG_PATH: "/usr/bin/ffmpeg",
        __NEXT_PRIVATE_STANDALONE_CONFIG: "{}",
        HUGE: "x".repeat(200 * 1024)
    });
    assert.deepEqual(env, {PATH: "/usr/bin", FFMPEG_PATH: "/usr/bin/ffmpeg"});
});

test("every ffmpeg spawn on the server passes the trimmed env (spawn E2BIG, Oct 20 2026)", () => {
    for (const file of ["src/lib/content-video/render.ts", "src/lib/social/video-normalize.ts"]) {
        const source = readFileSync(join(repoRoot, file), "utf8");
        const spawns = source.match(/spawn\([^;]*?\{stdio[^}]*\}/g) ?? [];
        assert.ok(spawns.length > 0, file);
        for (const call of spawns) assert.match(call, /env: childProcessEnv\(\)/, `${file}: ${call}`);
    }
});
