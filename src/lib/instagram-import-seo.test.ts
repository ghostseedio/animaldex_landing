import assert from "node:assert/strict";
import test from "node:test";
import {getUseCase} from "@/data/use-cases";
import {getBlogPost, getRelatedBlogPosts} from "@/data/blog";
import {getSupportArticleBySlugs, searchSupportArticles} from "@/lib/support-articles";
import {INSTAGRAM_IMPORT_PATH, INSTAGRAM_IMPORT_USE_CASE_PATH, instagramWebImportCtaLabel} from "@/lib/instagram-import";

test("canonical Instagram import use-case exists with a product path", () => {
    const page = getUseCase("import-instagram-wildlife-photos");
    assert.ok(page);
    assert.equal(page?.productCta?.path, INSTAGRAM_IMPORT_PATH);
    assert.match(page?.limitationNote ?? "", /professional account/i);
    assert.doesNotMatch(page?.description ?? "", /Creator Rewards eligibility relies on Instagram/i);
});

test("herping page is distinct from the import page", () => {
    const herping = getUseCase("herping-field-journal");
    const photography = getUseCase("wildlife-photography-companion-app");
    assert.ok(herping);
    assert.equal(herping?.productCta?.path, "/app/collection");
    assert.ok(photography?.sections.some((section) => /Instagram/i.test(section.title) || section.paragraphs.some((p) => /Instagram/i.test(p))));
    assert.equal(getUseCase("reptile-wildlife-photographers"), undefined);
    assert.ok(herping?.relatedSlugs?.includes("import-instagram-wildlife-photos"));
});

test("support search finds Instagram import articles", () => {
    const hits = searchSupportArticles("instagram import", 8, "en");
    assert.ok(hits.length > 0);
    const how = getSupportArticleBySlugs("instagram-import", "how-do-i-import-wildlife-posts-from-instagram");
    assert.ok(how);
    assert.match(how?.body ?? "", /Connected services/);
    assert.doesNotMatch(how?.body ?? "", /^Open AnimalDex on the web/i);
    assert.doesNotMatch(how?.body ?? "", /import stills on the web/i);
    const rewards = getSupportArticleBySlugs("instagram-import", "can-imported-instagram-posts-earn-creator-rewards");
    assert.match(rewards?.body ?? "", /does not add qualifying live-capture/i);
    const credits = getSupportArticleBySlugs("instagram-import", "how-do-instagram-import-credits-work");
    assert.match(credits?.body ?? "", /first 20 lifetime screening units/i);
    assert.match(credits?.body ?? "", /1 Credit per 15/i);
    const paid = getSupportArticleBySlugs("credits-purchases", "i-paid-but-credits-are-not-showing");
    assert.match(paid?.body ?? "", /verified server event/i);
});

test("support search retrieves Instagram articles for common synonyms", () => {
    for (const query of ["ig", "import posts", "old wildlife photos", "reels", "professional account", "instagram connect", "location import", "wrong species"]) {
        const hits = searchSupportArticles(query, 8, "en");
        assert.ok(hits.some((hit) => hit.categorySlug === "instagram-import"), `expected Instagram help for "${query}"`);
    }
    const reels = getSupportArticleBySlugs("instagram-import", "can-i-import-instagram-reels");
    assert.match(reels?.body ?? "", /Often, yes/i);
    assert.doesNotMatch(reels?.summary ?? "", /^Yes\./);
});

test("Instagram import use-case Reels claim is qualified", () => {
    const page = getUseCase("import-instagram-wildlife-photos");
    const reels = page?.faq.find((item) => /reels/i.test(item.question));
    assert.ok(reels?.question);
    assert.match(reels?.answer ?? "", /skipped/i);
});

test("blog cluster articles pin related posts inside the cluster", () => {
    const related = getRelatedBlogPosts("how-to-keep-a-herping-field-journal", 3);
    assert.ok(related.some((post) => post.slug === "reptile-amphibian-life-list"));
    const photography = getRelatedBlogPosts("organize-years-of-wildlife-photos-by-species", 3);
    assert.ok(photography.some((post) => post.slug === "wildlife-photography-life-list"));
});

test("Instagram import positions casual past encounters without unsupported claims", () => {
    const page = getUseCase("import-instagram-wildlife-photos");
    const blob = [
        page?.heroEyebrow,
        page?.description,
        ...(page?.sections.flatMap((section) => [section.title, ...section.paragraphs]) ?? [])
    ].join(" ");
    assert.match(page?.heroEyebrow ?? "", /already started your AnimalDex/i);
    assert.match(blob, /How many animals have you actually encountered/i);
    assert.match(blob, /Most collections start today/i);
    assert.match(blob, /unique AnimalDex entries/i);
    assert.ok(page?.audiences?.some((item) => /Casual wildlife fans/i.test(item.title)));
    assert.doesNotMatch(blob, /heavily requested/i);
    assert.doesNotMatch(blob, /Most wildlife apps force you to use their camera/i);
    assert.doesNotMatch([page?.title, page?.description, blob].join(" "), /Import on the web|no app download required/i);
    assert.equal(page?.productCta?.label, "Check my Instagram");
    assert.equal(instagramWebImportCtaLabel(false), "Check my Instagram");
    assert.equal(process.env.NEXT_PUBLIC_INSTAGRAM_WEB_IMPORT_LIVE === "true", false);
});

test("casual funnel CTAs explain first, then activate on the import landing", () => {
    const page = getUseCase("import-instagram-wildlife-photos");
    const collection = getUseCase("wildlife-collection-animal-card-app");
    const photography = getUseCase("wildlife-photography-companion-app");
    const herping = getUseCase("herping-field-journal");
    assert.equal(page?.productCta?.path, INSTAGRAM_IMPORT_PATH);
    assert.equal(page?.productCta?.event, "instagram_import_cta");
    assert.equal(collection?.secondaryCta?.path, INSTAGRAM_IMPORT_USE_CASE_PATH);
    assert.equal(collection?.secondaryCta?.event, "collection_to_import");
    assert.equal(photography?.productCta?.path, INSTAGRAM_IMPORT_USE_CASE_PATH);
    assert.equal(photography?.productCta?.event, "photography_to_import");
    assert.equal(herping?.secondaryCta?.path, INSTAGRAM_IMPORT_USE_CASE_PATH);
    assert.equal(herping?.secondaryCta?.event, "herping_to_import");
});

test("casual life-list articles do not duplicate the photographer archive cluster", () => {
    assert.ok(getBlogPost("how-to-keep-track-of-animals-you-have-seen"));
    assert.ok(getBlogPost("how-many-animals-have-you-already-encountered"));
    assert.ok(getBlogPost("already-seen-hundreds-of-animals-start-collection"));
    const collection = getUseCase("wildlife-collection-animal-card-app");
    assert.equal(collection?.secondaryCta?.event, "collection_to_import");
    assert.equal(collection?.secondaryCta?.path, INSTAGRAM_IMPORT_USE_CASE_PATH);
    assert.ok(collection?.sections.some((section) => /New encounters and past encounters/i.test(section.title)));
});

test("creator and herping blog cluster is wired", () => {
    assert.ok(getBlogPost("turn-instagram-wildlife-archive-into-species-collection"));
    assert.ok(getBlogPost("how-to-keep-a-herping-field-journal"));
    assert.ok(getBlogPost("wildlife-creators-need-a-species-archive"));
    const rewardsCopy = getBlogPost("turn-instagram-wildlife-archive-into-species-collection")?.sections
        .flatMap((section) => section.paragraphs)
        .join(" ") ?? "";
    assert.match(rewardsCopy, /do not add qualifying live-capture/i);
});
