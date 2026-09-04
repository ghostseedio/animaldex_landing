import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function readRepo(...parts: string[]) {
    return readFileSync(join(repoRoot, ...parts), "utf8");
}

test("default-locale /en URLs permanently redirect to unprefixed canonicals", () => {
    const redirectsBlock = readRepo("next.config.js").slice(
        readRepo("next.config.js").indexOf("async redirects()"),
        readRepo("next.config.js").indexOf("async rewrites()")
    );

    assert.match(redirectsBlock, /source: "\/en"/);
    assert.match(redirectsBlock, /destination: "\/"/);
    assert.match(redirectsBlock, /source: "\/en\/:path\*"/);
    assert.match(redirectsBlock, /destination: "\/:path\*"/);
    assert.match(redirectsBlock, /permanent: true/);
    assert.doesNotMatch(redirectsBlock, /destination: "\/en/);
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
