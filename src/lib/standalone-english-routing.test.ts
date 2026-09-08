import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {matchDefaultLocalePrefixedPath} from "@/lib/request-routing";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function readRepo(...parts: string[]) {
    return readFileSync(join(repoRoot, ...parts), "utf8");
}

/**
 * Standalone / `next start` applies next.config redirects again after
 * middleware rewrites. next-intl `localePrefix: 'as-needed'` rewrites
 * `/animals/x` → `/en/animals/x`. A permanent `/en/:path*` config redirect
 * then 308s back to `/animals/x` (self-redirect). Guard both sides.
 */
test("next.config must not permanently redirect /en paths that next-intl rewrites to", () => {
    const config = readRepo("next.config.js");
    const redirectsBlock = config.slice(
        config.indexOf("async redirects()"),
        config.indexOf("async rewrites()")
    );

    assert.doesNotMatch(redirectsBlock, /source:\s*["']\/en["']/);
    assert.doesNotMatch(redirectsBlock, /source:\s*["']\/en\/:path\*/);
    assert.match(config, /output:\s*['"]standalone['"]/);
});

test("middleware collapses external /en before intlMiddleware runs", () => {
    const middleware = readRepo("src/middleware.ts");
    const intlCallIndex = middleware.indexOf("intlMiddleware(request)");
    const collapseIndex = middleware.indexOf("matchDefaultLocalePrefixedPath");

    assert.ok(collapseIndex >= 0, "middleware must collapse /en via matchDefaultLocalePrefixedPath");
    assert.ok(intlCallIndex >= 0, "middleware must still call intlMiddleware");
    assert.ok(
        collapseIndex < intlCallIndex,
        "external /en collapse must run before next-intl rewrite"
    );
    assert.match(middleware, /NextResponse\.redirect\(destination,\s*308\)/);
});

test("canonical unprefixed English detail paths are not /en collapse targets", () => {
    for (const path of [
        "/animals/aardvark",
        "/animal-lessons/aardvark",
        "/pokemon-animals/generation-i"
    ]) {
        assert.equal(matchDefaultLocalePrefixedPath(path), null);
    }

    assert.equal(matchDefaultLocalePrefixedPath("/en/animals/aardvark"), "/animals/aardvark");
    assert.equal(matchDefaultLocalePrefixedPath("/en/animal-lessons/aardvark"), "/animal-lessons/aardvark");
    assert.equal(
        matchDefaultLocalePrefixedPath("/en/pokemon-animals/generation-i"),
        "/pokemon-animals/generation-i"
    );
});

test("i18n keeps as-needed English unprefixed with detection off", () => {
    const i18n = readRepo("src/i18n.ts");
    assert.match(i18n, /defaultLocale:\s*['"]en['"]/);
    assert.match(i18n, /localePrefix:\s*['"]as-needed['"]/);
    assert.match(i18n, /localeDetection:\s*false/);
});
