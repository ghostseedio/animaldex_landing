import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function readRepo(...parts: string[]) {
    return readFileSync(join(repoRoot, ...parts), "utf8");
}

test("species pages keep canonical knowledge server-rendered and treat Ask as an exploration layer", () => {
    const page = readRepo("src/app/[locale]/(composited)/animals/[slug]/page.tsx");
    const askApi = readRepo("src/app/api/animals/ask/route.ts");
    const askUi = readRepo("src/app/[locale]/(composited)/animals/[slug]/species-ask-animaldex.tsx");
    const understand = readRepo("src/app/[locale]/(composited)/animals/[slug]/species-understand-guide.tsx");
    const sitemap = readRepo("src/lib/build-sitemap.ts");
    const askLib = readRepo("src/lib/species-ask.ts");

    assert.match(page, /SpeciesUnderstandGuide/);
    assert.match(page, /SpeciesAnimalPowerGuide/);
    assert.match(page, /SpeciesAskAnimalDex/);
    assert.match(page, /SpeciesAtAGlanceCard/);
    assert.match(page, /speciesHasSubstantiveFieldGuide/);
    assert.match(page, /id="where"/);
    assert.match(page, /id="compare"/);
    assert.doesNotMatch(page, /visible condition/i);
    assert.doesNotMatch(page, /What this capture's age means/);
    assert.doesNotMatch(page, /animals\/\$\{.*\}\/questions/);
    assert.doesNotMatch(sitemap, /\/questions\//);
    assert.doesNotMatch(askApi, /generate-applied-insight/);
    assert.doesNotMatch(askApi, /pro_required/);
    assert.match(askApi, /SPECIES_ASK_WINDOW_MS/);
    assert.match(askApi, /X-Robots-Tag/);
    assert.match(askApi, /2–4 short paragraphs/);
    assert.match(askUi, /AskWhyButton/);
    assert.match(askUi, /href="#ask"/);
    assert.match(askUi, /SPECIES_ASK_EVENT/);
    assert.match(askUi, /<noscript>/);
    assert.match(askUi, /species_ask_why_clicked|SPECIES_ASK_FUNNEL_EVENTS.whyClicked/);
    assert.match(askUi, /AnimalDex’s interpretation|labels.layers/);
    assert.match(understand, /AskWhyButton/);
    assert.match(askLib, /anonymous: 3/);
    assert.match(askLib, /signedIn: 10/);
    assert.match(askLib, /pro: 30/);
    assert.match(askLib, /species_page_viewed/);
    assert.match(askLib, /species_ask_collect_clicked/);
});
