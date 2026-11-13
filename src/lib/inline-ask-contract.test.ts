import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

import {storeLinkClickedParameters} from "@/components/store/store-link";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath: string) {
    return readFileSync(join(root, relativePath), "utf8");
}

/** Source without comments, so a "never X" comment cannot satisfy a "mentions X" check. */
function code(relativePath: string) {
    return read(relativePath).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

test("the inline Ask box keeps the tier lists and comparisons static: data after hydration, no server fetch, square", () => {
    const box = code("components/ask-animaldex/inline-ask-box.tsx");
    const buttons = code("components/store/install-buttons.tsx");
    const tierList = read("app/[locale]/(composited)/tier-list/[slug]/page.tsx");
    const comparisons = read("app/[locale]/(composited)/comparisons/[slug]/page.tsx");
    const ranking = code("app/[locale]/(composited)/rankings/[slug]/page.tsx");
    const article = code("app/[locale]/(composited)/comparisons/_components/comparison-article.tsx");
    const hub = code("app/[locale]/(composited)/comparisons/page.tsx");

    // The SSG contract the pages already carry is untouched.
    for (const source of [tierList, comparisons]) {
        assert.match(source, /export const dynamicParams = false/);
        assert.match(source, /export const revalidate = false/);
        assert.match(source, /export function generateStaticParams/);
    }
    // The box is a client component that reads its data in an effect, from the drawer's own context endpoint, never at render.
    assert.match(box, /^"use client";/);
    assert.match(box, /useEffect\(/);
    assert.match(box, /fetchAskContext\(/);
    assert.doesNotMatch(box, /api\/ask\/stream/);
    assert.doesNotMatch(box, /useAskThread/);
    assert.match(box, /askAboutAnimal\(/);
    // Its artwork is a route src, so it is unoptimized (next-image-rejects-artwork-redirect).
    assert.match(box, /<Image src=\{avatarUrl\} unoptimized/);
    // Square: no rounded containers (the avatar circle is the one exception).
    for (const [name, source] of [["inline-ask-box", box], ["install-buttons", buttons], ["ask-limit-panel", code("components/ask-animaldex/ask-limit-panel.tsx")]] as const) {
        const rounded = (source.match(/(?<![\w-])(?:[a-z0-9]+:)*rounded(?:-[\w[\]./-]+)?(?![\w[-])/g) ?? []).filter((match) => match !== "rounded-full");
        assert.deepEqual(rounded, [], `${name} stays square`);
    }
    assert.match(buttons, /detectStorePlatform\(navigator\.userAgent/);
    assert.match(buttons, /utmContent=\{utmContent\}/);
    assert.match(buttons, /uiSource=\{uiSource\}/);

    // The pages mount it under the H1 and declare the animal as the drawer's subject.
    assert.match(ranking, /hasTierListAskBox\(ranking\.slug\)/);
    assert.match(ranking, /tierListAskQuestion\(title\)/);
    assert.match(ranking, /hasTierListInstallButtons\(ranking\.slug\)/);
    assert.match(ranking, /tierListUtmContent\(ranking\.slug\)/);
    assert.match(ranking, /uiSource="tierlist"/);
    assert.match(ranking, /installButtons\?\.\("top"\)/);
    assert.match(ranking, /installButtons\?\.\("after_first"\)/);
    assert.ok(ranking.indexOf("<RankingHero") < ranking.indexOf("<InlineAskBox"), "the box follows the hero (H1)");
    assert.ok(ranking.indexOf("<InlineAskBox") < ranking.indexOf("<PageVideo"), "the box sits above the fold, before the video");
    assert.ok(ranking.indexOf("<TierListSummary") < ranking.indexOf('installButtons?.("after_first")'), "the second buttons follow the #1 entry");
    assert.match(article, /comparisonAskTarget\(/);
    assert.match(article, /scope="species"[\s\S]*slug=\{askTarget\.target\.slug\}/);
    assert.ok(article.indexOf("<ChallengeHero") < article.indexOf("<InlineAskBox"), "the comparison box follows the hero (H1)");
    assert.match(hub, /comparisonAskTarget\(/);
    assert.match(hub, /pageKind="comparisons_hub"/);
    assert.ok(hub.indexOf("<h1") < hub.indexOf("<InlineAskBox"), "the hub box follows the H1");
});

test("the limit panel is the install moment: two actions, the hand-off, ui_source=ask_limit and the funnel step", () => {
    const panel = code("components/ask-animaldex/ask-limit-panel.tsx");
    const conversation = code("components/ask-animaldex/ask-conversation.tsx");
    const route = code("app/api/ask/handoff/route.ts");
    const migration = read("../supabase/migrations/20261113180000_web_ask_handoffs.sql");
    const labels = read("loaders/ask-labels.ts");

    assert.match(conversation, /<AskLimitPanel/);
    assert.match(conversation, /webProPlan=\{context\?\.webProPlan \?\? null\}/);
    assert.match(panel, /data-ask-limit-action="app"/);
    assert.match(panel, /data-ask-limit-action="pro"/);
    assert.match(panel, /placement="ask_limit"/);
    assert.match(panel, /utmContent="ask_limit"/);
    assert.match(panel, /uiSource="ask_limit"/);
    assert.match(panel, /trackFunnel\("store_click_ask_limit"\)/);
    assert.match(panel, /askHandoffRequestBody\(/);
    assert.match(panel, /askHandoffLinks\(/);
    assert.match(panel, /startWebCheckout\(proAction\.plan, "\/app\/credits", "ask_limit"\)/);
    for (const key of ["limitPanelBody", "limitAppFree", "limitProWeek", "limitProNote", "limitOpenApp", "limitHandoffNote"]) {
        assert.match(labels, new RegExp(`${key}: askT\\("${key}"\\)`));
        assert.match(read("data/locales/en.json"), new RegExp(`"${key}": "`));
        assert.match(read("data/locales/id.json"), new RegExp(`"${key}": "`));
    }
    assert.match(read("data/locales/en.json"), /"limitAppFree": "Keep talking in the app, free"/);
    assert.match(read("data/locales/en.json"), /"limitProWeek": "Pro for a week"/);

    // The route inserts with the service role and answers the id; the table is service-role only.
    assert.match(route, /getSupabaseServiceKey\(\)/);
    assert.match(route, /rest\/v1\/web_ask_handoffs/);
    assert.match(route, /normalizeAskHandoff\(/);
    assert.match(route, /checkRateLimit\(/);
    assert.match(migration, /create table if not exists public\.web_ask_handoffs/);
    assert.match(migration, /redeemed_at timestamptz/);
    assert.match(migration, /enable row level security/);
    assert.match(migration, /revoke all on public\.web_ask_handoffs from public, anon, authenticated/);
    assert.match(migration, /grant all on public\.web_ask_handoffs to service_role/);
    assert.match(migration, /'store_click_ask_limit'/);
    assert.match(code("app/api/ask/context/route.ts"), /webProPlan: webProPlanOnSale\(\)/);
});

test("GA4 store_link_clicked carries ui_source (never `source`) and the page path", () => {
    assert.deepEqual(storeLinkClickedParameters({store: "app_store", placement: "ask_limit", effective: "ask_limit", uiSource: "ask_limit", pagePath: "/tier-list/strongest-animals"}), {
        store: "app_store",
        placement: "ask_limit",
        ui_source: "ask_limit",
        page_path: "/tier-list/strongest-animals"
    });
    assert.deepEqual(storeLinkClickedParameters({store: "google_play", placement: "home_download", effective: "species_hero", uiSource: null, pagePath: "/"}), {
        store: "google_play",
        placement: "species_hero",
        via: "home_download",
        ui_source: "species_hero",
        page_path: "/"
    });
    assert.doesNotMatch(code("components/store/store-link.tsx"), /\bsource:/);
});
