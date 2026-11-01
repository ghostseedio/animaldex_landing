import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {resolveSpeciesBehaviorProfileForPage} from "@/data/species-behavior-lessons";
import {getCatalogSpeciesPower} from "@/lib/species-power";
import {CATALOG_ANIMAL_COUNT, formatAnimalCount, ROUNDED_ANIMAL_COUNT} from "@/lib/animal-count";
import {speciesTalkHref} from "@/lib/species-talk-href";
import {withIndefiniteArticle} from "@/data/blog/symbolism/_helpers";
import {animalsWorkPointBody, getAnimalsWorkPoints} from "@/data/animal-perspective";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const readRepo = (...parts: string[]) => readFileSync(join(repoRoot, ...parts), "utf8");

test("a species page shows the Power Talk and the chat answer from, not its browse cluster (WEB-7)", () => {
    // The Talk catalog (species_catalog_v1.principle_name) calls these Cunning,
    // Spring-Loaded Spine and Memory Path; the local clusters were
    // Adaptability and Precision.
    assert.equal(getCatalogSpeciesPower("red-fox")?.name, "Cunning");
    assert.equal(resolveSpeciesBehaviorProfileForPage("red-fox")?.principle, "Cunning");
    assert.equal(resolveSpeciesBehaviorProfileForPage("cheetah")?.principle, "Spring-Loaded Spine");
    assert.equal(resolveSpeciesBehaviorProfileForPage("african-bush-elephant")?.principle, "Memory Path");
    // The cluster stays for grouping only.
    assert.ok(resolveSpeciesBehaviorProfileForPage("red-fox")?.browseCluster);
    // The Lion page stands for the catalog's African Lion: Pride Command on the page and in the chat.
    assert.equal(getCatalogSpeciesPower("lion")?.name, "Pride Command");
    assert.equal(resolveSpeciesBehaviorProfileForPage("lion")?.principle, "Pride Command");
    // A group page with no catalog profile keeps its local profile, as its chat does.
    assert.equal(getCatalogSpeciesPower("fox"), null);
});

test("one animal count, rounded for copy (WEB-29)", () => {
    assert.ok(CATALOG_ANIMAL_COUNT >= 2000);
    assert.equal(ROUNDED_ANIMAL_COUNT % 100, 0);
    assert.ok(ROUNDED_ANIMAL_COUNT <= CATALOG_ANIMAL_COUNT);
    assert.match(formatAnimalCount("en"), /^\d,\d00$/);
    assert.match(formatAnimalCount("id"), /^\d\.\d00$/);
    for (const file of [
        "src/app/[locale]/(composited)/(home)/page.tsx",
        "src/data/how-it-works.ts",
        "src/lib/og/static-og-cards.ts"
    ]) {
        assert.doesNotMatch(readRepo(file), /2[,.]500\+?/, `${file} should quote the shared count`);
    }
});

test("the header's Talk button talks to the animal on its own species page (JRN-5)", () => {
    assert.equal(speciesTalkHref("/animals/red-fox"), "/talk/red-fox");
    assert.equal(speciesTalkHref("/animals/red-fox/"), "/talk/red-fox");
    assert.equal(speciesTalkHref("/animals"), null);
    assert.equal(speciesTalkHref("/animals/red-fox/extra"), null);
    assert.equal(speciesTalkHref("/blog/owl-symbolism"), null);
});

test("no generic Ask AnimalDex launcher on public pages (WEB-8, DECISIONS §8)", () => {
    const surface = readRepo("src/components/ask-animaldex/ask-animaldex-surface.tsx");
    const en = JSON.parse(readRepo("src/data/locales/en.json"));
    assert.equal(en.askAnimalDex.launcher, "Talk to an animal");
    assert.equal(en.askAnimalDex.aboutAnimal, "Talking with {animal}");
    // The generic pill links to the picker, only where the header hides its own Talk button.
    assert.match(surface, /<Link href="\/talk"/);
    assert.match(surface, /className="xl:hidden"/);
    // And it never rests over something tappable.
    assert.match(surface, /coversTappable/);
    assert.match(surface, /elementsFromPoint/);
});

test("one lockup, and the chrome wordmark is retired from the UI (DECISIONS §5)", () => {
    for (const file of [
        "src/app/[locale]/(composited)/_components/header.tsx",
        "src/app/[locale]/(composited)/_components/header-menu.tsx",
        "src/app/[locale]/(composited)/_components/footer.tsx",
        "src/app/[locale]/talk/talk-sidebar.tsx"
    ]) {
        const source = readRepo(file);
        assert.match(source, /BrandLockup/, file);
        assert.doesNotMatch(source, /animaldex-logo-text\.webp/, file);
    }
    const lockup = readRepo("src/components/brand/brand-lockup.tsx");
    assert.match(lockup, /brand-word-animal">Animal</);
    assert.match(lockup, /brand-word-dex">Dex</);
});

test("articles say a/an correctly (WEB-30)", () => {
    assert.equal(withIndefiniteArticle("Owl"), "an Owl");
    assert.equal(withIndefiniteArticle("Eagle"), "an Eagle");
    assert.equal(withIndefiniteArticle("Elephant"), "an Elephant");
    assert.equal(withIndefiniteArticle("Wolf"), "a Wolf");
    assert.equal(withIndefiniteArticle("Unicorn Fish"), "a Unicorn Fish");
});

test("a card that shows a point's title does not repeat it in the body (WEB-43)", () => {
    const step = getAnimalsWorkPoints("en").find((point) => point.id === "step")!;
    assert.equal(animalsWorkPointBody(step), "Bring it a real problem and it gives you one step to try. Do it, and its Power is yours.");
    const power = getAnimalsWorkPoints("en").find((point) => point.id === "power")!;
    assert.equal(animalsWorkPointBody(power), power.text);
});

test("side by side, not who would win, on the comparison page itself (WEB-9)", () => {
    const article = readRepo("src/app/[locale]/(composited)/comparisons/_components/comparison-article.tsx");
    assert.doesNotMatch(article, /Watch the battle/);
    assert.doesNotMatch(article, /winnerLabel=\{/);
    assert.match(article, /buttonHref=\{`\/talk\/\$\{animalA\.slug\}`\}/);
    const en = JSON.parse(readRepo("src/data/locales/en.json"));
    assert.equal(en.comparisons.sideBySideTitle, "{animalA} and {animalB}, side by side");
    assert.ok(!en.meta.keywords.some((keyword: string) => /Pokemon|Top Trumps|grading/i.test(keyword)));
});

test("people are never public: no human species page, side by side or catalog entry (DECISIONS §11)", async () => {
    const {isHumanComparisonSlug, isHumanSpecies} = await import("@/lib/people-are-never-public");
    const {isPublishedAnimalSlug, isPublishedLessonSlug} = await import("@/lib/published-seo-slugs");
    const {getPublishedEnglishAnimalStaticParams, getPublishedEnglishComparisonStaticParams, listSnapshotComparisons, listSnapshotSpecies} = await import("@/lib/published-seo-page-data");

    assert.equal(isHumanSpecies({slug: "human"}), true);
    assert.equal(isHumanSpecies({scientificName: "Homo sapiens"}), true);
    assert.equal(isHumanSpecies({identityKey: "homo_sapiens"}), true);
    assert.equal(isHumanSpecies({slug: "red-fox", scientificName: "Vulpes vulpes"}), false);
    assert.equal(isHumanComparisonSlug("giant-malaysian-leaf-insect-vs-human"), true);
    assert.equal(isHumanComparisonSlug("tiger-vs-lion"), false);

    assert.equal(isPublishedAnimalSlug("human"), false);
    assert.equal(isPublishedLessonSlug("human"), false);
    assert.ok(!getPublishedEnglishAnimalStaticParams().some((param) => param.slug === "human"));
    assert.ok(!getPublishedEnglishComparisonStaticParams().some((param) => isHumanComparisonSlug(param.slug)));
    assert.ok(!listSnapshotComparisons().some((entry) => isHumanComparisonSlug(entry.slug)));
    assert.ok(!listSnapshotSpecies().some((entry) => entry.slug === "human"));
});
