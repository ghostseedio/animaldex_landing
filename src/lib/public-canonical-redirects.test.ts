import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function readRepo(...parts: string[]) {
    return readFileSync(join(repoRoot, ...parts), "utf8");
}

test("default-locale /en URLs permanently redirect via middleware, not next.config", () => {
    const config = readRepo("next.config.js");
    const redirectsBlock = config.slice(
        config.indexOf("async redirects()"),
        config.indexOf("async rewrites()")
    );
    const middleware = readRepo("src/middleware.ts");
    const routing = readRepo("src/lib/request-routing.ts");

    // Config redirects on /en would catch next-intl's internal as-needed rewrite
    // and 308 unprefixed English URLs back onto themselves.
    assert.doesNotMatch(redirectsBlock, /source:\s*["']\/en["']/);
    assert.doesNotMatch(redirectsBlock, /source:\s*["']\/en\/:path\*/);
    assert.match(redirectsBlock, /Do NOT add \/en/);

    assert.match(routing, /matchDefaultLocalePrefixedPath/);
    assert.match(middleware, /matchDefaultLocalePrefixedPath/);
    assert.match(middleware, /NextResponse\.redirect\(destination,\s*308\)/);
});

test("ranking aliases preserve /tier-list as the successful canonical", () => {
    const config = readRepo("next.config.js");
    const redirectsBlock = config.slice(config.indexOf("async redirects()"), config.indexOf("async rewrites()"));

    assert.match(redirectsBlock, /source: "\/rankings"/);
    assert.match(redirectsBlock, /destination: "\/tier-list"/);
    assert.match(redirectsBlock, /source: "\/rankings\/:path\*"/);
    assert.match(redirectsBlock, /destination: "\/tier-list\/:path\*"/);
    assert.match(redirectsBlock, /source: "\/id\/rankings"/);
    assert.match(redirectsBlock, /destination: "\/id\/tier-list"/);
    assert.doesNotMatch(redirectsBlock, /destination: "\/:locale\/tier-list"/);

    const site = readRepo("src/lib/site.ts");
    assert.match(site, /locale === localeConfig\.defaultLocale/);
    assert.match(site, /return `\/\$\{locale\}\$\{normalisedPath\}`/);
});

test("homepage featured ranking card points at the canonical tier-list path", () => {
    const home = readRepo("src/app/[locale]/(composited)/(home)/page.tsx");

    assert.match(home, /\$\{RANKING_CANONICAL_BASE_PATH\}\/rarest-animals/);
    assert.doesNotMatch(home, /\/rankings\/rarest-animals/);
});
