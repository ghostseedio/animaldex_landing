import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(import.meta.url);

type Redirect = {source: string; destination: string; permanent: boolean};

/** First matching redirect, the way Next applies them (no regex params beyond :name and :name*). */
function resolve(redirects: Redirect[], path: string) {
    for (const redirect of redirects) {
        const pattern = redirect.source
            .replace(/[.]/g, "\\.")
            .replace(/\/:(\w+)\*/g, "(?:/(?<$1>.*))?")
            .replace(/:(\w+)/g, "(?<$1>[^/]+)");
        const match = path.match(new RegExp(`^${pattern}$`));
        if (!match) continue;
        const groups = match.groups ?? {};
        const destination = redirect.destination
            .replace(/\/:(\w+)\*/g, (_, name) => (groups[name] ? `/${groups[name]}` : ""))
            .replace(/:(\w+)/g, (_, name) => groups[name] ?? "");
        return {destination, permanent: redirect.permanent};
    }
    return null;
}

test("Oct 2026 Animal Wisdom rename: every old URL 301s to its new home in one hop", async () => {
    const config = require(join(root, "next.config.js"));
    const redirects: Redirect[] = await config.redirects();
    const cases: Array<[string, string]> = [
        ["/animal-lessons", "/animal-powers"],
        ["/animal-lessons/wolf", "/animal-powers/wolf"],
        ["/id/animal-lessons", "/id/animal-powers"],
        ["/id/animal-lessons/wolf", "/animal-powers/wolf"],
        ["/id/animal-powers/wolf", "/animal-powers/wolf"],
        ["/animal-meanings", "/animal-powers"],
        ["/powers", "/qualities"],
        ["/powers/resilience", "/qualities/resilience"],
        ["/id/powers/resilience", "/id/qualities/resilience"],
        ["/principles/resilience", "/qualities/resilience"],
        ["/animal-behaviours", "/animal-frequencies"],
        ["/animal-behaviours/page/1", "/animal-frequencies"],
        ["/animal-behaviours/page/3", "/animal-frequencies/page/3"],
        ["/challenge-yourself", "/animal-trials"],
        ["/id/challenge-yourself", "/id/animal-trials"],
        ["/challenge-yourself/page/1", "/animal-trials"],
        ["/animal-trials/page/1", "/animal-trials"]
    ];
    for (const [from, to] of cases) {
        assert.deepEqual(resolve(redirects, from), {destination: to, permanent: true}, from);
    }
    // The new hubs themselves must not redirect (/qualities used to 301 to /powers).
    for (const path of ["/animal-powers", "/animal-powers/wolf", "/qualities", "/qualities/resilience", "/animal-frequencies", "/animal-trials"]) {
        assert.equal(resolve(redirects, path), null, path);
    }
    const rewrites: Array<{source: string}> = await config.rewrites();
    assert.ok(!rewrites.some((rewrite) => /powers|qualities/.test(rewrite.source)));
});
