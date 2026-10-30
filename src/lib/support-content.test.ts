import assert from "node:assert/strict";
import test from "node:test";
import {SUPPORT_ID_ARTICLES, getSupportContent} from "@/data/support-content";
import {getSupportArticleBySlugs, slugifySupportText} from "@/lib/support-articles";

test("the Help Center says what is special first, and gallery uploads are allowed", () => {
    const items = getSupportContent("en").sections.flatMap((section) => section.items);
    const answer = (question: string) => items.find((item) => item.question === question)?.answer ?? "";
    assert.match(answer("What is AnimalDex?"), /talk to them about your life/);
    assert.doesNotMatch(answer("What is AnimalDex?"), /scanner, field guide, and wildlife collection app/);
    assert.match(answer("Can I upload an animal from my photo gallery?"), /^Yes\./);
});

test("the four articles on your animals are there, in English and Indonesian, at the same addresses", () => {
    for (const question of ["What is a Power?", "What is the Warmup?", "What do the bond level and stages mean?", "What should I talk to my animal about?"]) {
        const slug = slugifySupportText(question);
        const english = getSupportArticleBySlugs("your-animals", slug, "en");
        const indonesian = getSupportArticleBySlugs("your-animals", slug, "id");
        assert.ok(english, question);
        assert.ok(indonesian, `${question} in Indonesian`);
        assert.notEqual(indonesian.title, english.title, `${question} is translated`);
    }
});

test("every Indonesian article keeps its English question's slug", () => {
    const english = new Set(getSupportContent("en").sections.flatMap((section) => section.items.map((item) => item.question)));
    for (const [question, article] of Object.entries(SUPPORT_ID_ARTICLES)) {
        assert.ok(english.has(question), `${question} is an English article`);
        assert.equal(article.slug, slugifySupportText(question), question);
    }
});
