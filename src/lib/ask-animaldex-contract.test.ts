import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function readRepo(...parts: string[]) {
    return readFileSync(join(repoRoot, ...parts), "utf8");
}

/**
 * Source with comments removed.
 *
 * A "this is deliberately not X" comment is exactly the thing worth writing,
 * and it should not fail an assertion that X is never called.
 */
function readCode(...parts: string[]) {
    return readRepo(...parts)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("Ask AnimalDex is one assistant mounted once, not a copy per surface", () => {
    const rootLayout = readRepo("src/app/[locale]/layout.tsx");
    const surface = readRepo("src/components/ask-animaldex/ask-animaldex-surface.tsx");
    const speciesSection = readCode("src/app/[locale]/(composited)/animals/[slug]/species-ask-animaldex.tsx");

    // One provider and one launcher, in the layout every locale route shares.
    assert.match(rootLayout, /AskAnimalDexProvider/);
    assert.match(rootLayout, /AskAnimalDexSurface/);
    assert.match(rootLayout, /getScopedTranslator\(locale, "askAnimalDex"\)/);

    // The panel is loaded on demand. This sits on every SEO page, so shipping
    // the renderer, the visual mediums and the chart to a reader who never
    // opens it would be a real cost.
    assert.match(surface, /dynamic\(\(\) => import\("@\/components\/ask-animaldex\/ask-drawer"\)/);
    assert.match(surface, /ssr: false/);

    // Pages hand off to it rather than holding conversations of their own.
    assert.doesNotMatch(speciesSection, /api\/ask\/stream/);
    assert.doesNotMatch(speciesSection, /useState/);
    assert.match(speciesSection, /askAboutAnimal/);

    for (const file of [
        "src/app/[locale]/(composited)/blog/[slug]/page.tsx",
        // Rendered by /comparisons/[slug] and /compare/[slug].
        "src/app/[locale]/(composited)/comparisons/_components/comparison-article.tsx",
        "src/app/[locale]/(composited)/locations/[slug]/page.tsx",
        "src/app/[locale]/(authenticated)/app/capture/[id]/capture-detail-client.tsx",
        "src/app/[locale]/(composited)/animals/[slug]/page.tsx"
    ]) {
        assert.match(readRepo(file), /AskSubjectBridge/, `${file} should declare its Ask subject`);
    }
});

test("the streaming route is the web's own endpoint, not a proxy to the app's gated one", () => {
    const route = readCode("src/app/api/ask/stream/route.ts");

    // The iOS edge function needs a capture id, Pro, and premium field-guide
    // provenance. An anonymous reader on a species page has none of those, and
    // the public page is deliberately not behind a paywall.
    assert.doesNotMatch(route, /generate-applied-insight/);
    assert.doesNotMatch(route, /pro_required/);
    assert.doesNotMatch(route, /premium_field_guide/);

    // The entitlement is the shared daily allowance.
    assert.match(route, /checkAskRateLimit/);
    assert.match(route, /limit_reached/);
    // A conversation is private and must never be indexed; the header lives
    // with the other shared Ask response headers.
    assert.match(route, /ASK_RESPONSE_HEADERS/);
    assert.match(readRepo("src/lib/ask-animaldex/request.ts"), /"X-Robots-Tag": "noindex, nofollow"/);
    // A buffering proxy is what turns streaming back into a long blank wait.
    assert.match(route, /X-Accel-Buffering/);
    assert.match(route, /text\/event-stream/);
    // A missing key is an outage, not a cheerful fallback answer.
    assert.match(route, /503/);
});

test("the grounding packet is assembled server-side from canonical rows", () => {
    const grounding = readRepo("src/data/ask-grounding.ts");
    const request = readRepo("src/lib/ask-animaldex/request.ts");

    assert.match(grounding, /getEnhancedAnimalPowerProfile/);
    assert.match(grounding, /getSpeciesSystemDynamics/);
    assert.match(grounding, /getResolvedSpeciesBySlug/);

    // The route is the trustworthy part of a subject. A page may refine it, but
    // what it sends is capped and can never nominate a different species.
    assert.match(request, /askSubjectFromPath/);
    assert.match(request, /SLUG_PATTERN/);
    assert.match(request, /cappedText/);
});

test("both providers are wired, Gemini first, exactly as the app does it", () => {
    const providers = readRepo("src/lib/ask-animaldex/providers.ts");
    assert.match(providers, /gemini-2\.5-flash/);
    assert.match(providers, /streamGenerateContent\?alt=sse/);
    assert.match(providers, /thinkingBudget: 0/);
    assert.match(providers, /api\.openai\.com/);
    assert.match(providers, /stream: true/);
    // The one-piece path survives what kills a stream.
    assert.match(providers, /requestAskAnswerJSON/);
});

test("the answer renderer is the block renderer, not a markdown drop-in", () => {
    const renderer = readRepo("src/components/ask-animaldex/assistant-markdown.tsx");
    const visual = readRepo("src/components/ask-animaldex/ask-visual.tsx");

    assert.match(renderer, /parseAskMarkdown/);
    assert.match(renderer, /pendingVisual/);
    // Bold carries the point, and the renderer tints it — that is what makes an
    // answer scannable rather than a uniform slab.
    assert.match(renderer, /text-primary-200/);
    for (const kind of ["flow", "scale", "chart", "photo"]) {
        assert.match(visual, new RegExp(`case "${kind}"`), `${kind} medium must render`);
    }
    // No photo on screen means the model was never offered the medium, so this
    // is a guard rather than a fallback.
    assert.match(visual, /if \(!photoUrl\)/);
});

test("the drawer keeps the page readable under it and never traps the reader", () => {
    const drawer = readCode("src/components/ask-animaldex/ask-drawer.tsx");

    // Docked, not modal: the reader keeps reading the page it is about.
    assert.match(drawer, /aria-modal="false"/);
    assert.doesNotMatch(drawer, /overflow:\s*hidden|document\.body\.style/);
    assert.match(drawer, /Escape/);

    // A translucent panel lets this site's lime radial glows ghost through the
    // conversation, even at 98% opacity.
    assert.match(drawer, /bg-canvas-950/);
    assert.doesNotMatch(drawer, /ask-panel[^"]*backdrop-blur/);

    // Stop is a real action with a real outcome, not a disabled send button.
    assert.match(drawer, /onClick=\{isSending \? stop : undefined\}/);
});
