import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {getAnimalHybridCards, searchAnimalHybridCards} from "@/data/animal-hybrid-cards";
import {publishedAnimalFusions} from "@/data/animal-fusions";
import {behaviourSignatures} from "@/data/animal-behaviours";
import {animalHybridsPagination} from "@/data/hub-pagination";
import {resolveClosedSeoNamespacePath} from "@/lib/closed-seo-namespaces";
import {FREQUENCY_LESSONS} from "@/lib/frequency-lessons";

test("the Hybrid Lab pages its grid instead of shipping every card", () => {
    const cards = getAnimalHybridCards();
    const pages = animalHybridsPagination.pageCount(cards.length);
    assert.ok(cards.length > animalHybridsPagination.perPage, "more cards than one page");
    assert.equal(animalHybridsPagination.slice(cards, 1).length, animalHybridsPagination.perPage);
    assert.equal(animalHybridsPagination.pagePath(1), "/animal-hybrids");
    assert.equal(animalHybridsPagination.pagePath(pages), `/animal-hybrids/page/${pages}`);
});

test("paged hub URLs pass the closed SEO namespace; anything else nested still 404s", () => {
    assert.equal(resolveClosedSeoNamespacePath("/animal-hybrids/page/2")?.action, "allow");
    assert.equal(resolveClosedSeoNamespacePath("/id/animal-hybrids/page/3")?.action, "allow");
    for (const path of ["/animal-hybrids/page/02", "/animal-hybrids/page/0", "/animal-hybrids/page/2/x", "/animal-hybrids/page/abc", "/animals/page/2", "/comparisons/page/2"]) {
        assert.equal(resolveClosedSeoNamespacePath(path)?.action, "block", path);
    }
});

test("hybrid search covers every card, not only the current page", () => {
    const cards = getAnimalHybridCards();
    const last = cards[cards.length - 1];
    const result = searchAnimalHybridCards(last.title, 48);
    assert.ok(result.cards.some((card) => card.slug === last.slug), "a card from the last page is found");
    assert.equal(searchAnimalHybridCards("lion", 5).cards.length <= 5, true);
});

test("old ?page links and /page/1 redirect to their path URLs", () => {
    const config = readFileSync("next.config.js", "utf8");
    assert.match(config, /\["\/animal-hybrids", "\/animal-hybrids"\]/);
    assert.match(config, /source: `\$\{prefix\}\/animal-hybrids`,\s+has: \[\{type: "query", key: "page"/);
    for (const route of ["src/app/[locale]/(composited)/animal-hybrids/page/[page]/page.tsx"]) {
        const source = readFileSync(route, "utf8");
        assert.match(source, /export const revalidate = 86400/);
        assert.doesNotMatch(source, /searchParams|cookies\(|headers\(|force-dynamic/);
    }
});

test("every explainer example is a real published entry", () => {
    for (const lesson of FREQUENCY_LESSONS) {
        const entry = behaviourSignatures.find((signature) => signature.slug === lesson.slug);
        assert.ok(entry, lesson.slug);
        assert.ok(entry.waveform?.pathD, `${lesson.slug} has a waveform`);
        assert.ok(lesson.frequencies.includes(entry.frequency as never), `${lesson.slug} is ${entry.frequency}`);
    }
    const hub = readFileSync("src/app/[locale]/(composited)/animal-hybrids/page.tsx", "utf8");
    const slugs = Array.from(hub.matchAll(/"([a-z-]+-learns-from-[a-z-]+)"/g), (match) => match[1]);
    assert.equal(slugs.length, 3);
    for (const slug of slugs) {
        assert.ok(publishedAnimalFusions.some((fusion) => fusion.slug === slug), slug);
    }
});
