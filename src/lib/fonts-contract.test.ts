import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("app fonts are self-hosted and never fetched from Google at build time", () => {
    const source = readFileSync(join(root, "app/fonts.ts"), "utf8");
    assert.match(source, /from ["']next\/font\/local["']/);
    assert.doesNotMatch(source, /next\/font\/google/);
});
