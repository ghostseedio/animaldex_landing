import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {earnEconomyBlogPosts} from "@/data/blog/earn";
import {
    blogHrefs,
    creditsAreNotCash,
    earnCanonicalRoutes,
    earnFacts,
    earnPaths,
    supportArticleHrefs
} from "@/data/earn-economy";
import {getBlogPost} from "@/data/blog";
import {getSupportArticleBySlugs, slugifySupportText} from "@/lib/support-articles";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

function readRepo(...parts: string[]) {
    return readFileSync(join(repoRoot, ...parts), "utf8");
}

const productCopy = [
    readRepo("src/app/[locale]/(composited)/earn-on-animaldex/page.tsx"),
    readRepo("src/app/[locale]/(composited)/creator-rewards/page.tsx"),
    readRepo("src/app/[locale]/(composited)/sponsor-a-challenge/page.tsx"),
    readRepo("src/data/support-content.ts"),
    readRepo("src/data/blog/earn/creator-cluster.ts"),
    readRepo("src/data/blog/earn/business-cluster.ts"),
    readRepo("src/data/blog/earn/guide-cluster.ts"),
    readRepo("src/data/blog/earn/experiences-cluster.ts")
].join("\n");

test("canonical earn routes are unique and sitemap-listed", () => {
    assert.deepEqual([...earnCanonicalRoutes], [
        "/earn-on-animaldex",
        "/wildlife-guides",
        "/creator-rewards",
        "/sponsor-a-challenge"
    ]);
    const sitemap = readRepo("src/lib/build-sitemap.ts");
    for (const route of earnCanonicalRoutes) {
        assert.match(sitemap, new RegExp(route.replaceAll("/", "\\/")));
    }
    assert.doesNotMatch(sitemap, /\/challenges"\s*,\s*\n\s*\{url: getAbsoluteUrl\(locale, "\/sponsor/);
});

test("support articles compile to the advertised paths", () => {
    const expected = [
        ["earnings", "How do I earn on AnimalDex?"],
        ["earnings", "What are AnimalDex Credits?"],
        ["earnings", "What are AnimalDex Earnings?"],
        ["earnings", "Are AnimalDex Credits worth real money?"],
        ["earnings", "What are Creator Rewards?"],
        ["earnings", "Why are Creator Rewards unavailable?"],
        ["wildlife-guides", "How do I become a Wildlife Guide?"],
        ["sponsored-challenges", "What are Sponsored Challenges?"],
        ["sponsored-challenges", "How can a business sponsor an AnimalDex Challenge?"]
    ] as const;

    for (const [category, question] of expected) {
        const slug = slugifySupportText(question);
        const article = getSupportArticleBySlugs(category, slug);
        assert.ok(article, `missing ${category}/${slug}`);
        assert.match(article.body, /Credit|Guide|Challenge|Creator/i);
    }
    // Reworded for virtual guides; the indexed URL is kept.
    const payments = getSupportArticleBySlugs("wildlife-guides", "how-do-wildlife-guide-bookings-and-payments-work");
    assert.ok(payments, "missing wildlife-guides payments article");
    assert.equal(payments.title, "How do Wildlife Guide purchases and payments work?");
    assert.equal(supportArticleHrefs.guidePayments, "/support/wildlife-guides/how-do-wildlife-guide-bookings-and-payments-work");

    assert.equal(supportArticleHrefs.howEarn, "/support/earnings/how-do-i-earn-on-animaldex");
    assert.equal(supportArticleHrefs.becomeGuide, "/support/wildlife-guides/how-do-i-become-a-wildlife-guide");
});

test("earn blogs are registered and internally linked", () => {
    assert.equal(earnEconomyBlogPosts.length, 28);
    for (const href of Object.values(blogHrefs)) {
        const slug = href.replace("/blog/", "");
        const post = getBlogPost(slug);
        assert.ok(post, `missing blog ${slug}`);
        assert.ok(post.canonicalUrl?.includes(slug));
        const linked = JSON.stringify(post.sections);
        assert.ok(
            linked.includes(earnPaths.earn) ||
                linked.includes(earnPaths.wildlifeGuidesMarketplace) ||
                linked.includes(earnPaths.creatorRewards) ||
                linked.includes(earnPaths.sponsor) ||
                linked.includes("/support/"),
            `${slug} should link into the earn hub`
        );
    }
});

test("copy keeps the Credits / Earnings firewall", () => {
    assert.match(creditsAreNotCash, /not cash/i);
    assert.match(productCopy, /cannot be withdrawn/i);
    assert.doesNotMatch(productCopy, /\bWise\b/);
    assert.doesNotMatch(productCopy, /Ghostseed/);
    assert.doesNotMatch(productCopy, /40%/);
    assert.doesNotMatch(productCopy, /guaranteed earnings/i);
    assert.doesNotMatch(productCopy, /automatically become a Guide/i);
    assert.doesNotMatch(productCopy, /AnimalDex pays (you|Guides) for bookings/i);
    assert.doesNotMatch(productCopy, /Creator Rewards is (live and paying|currently paying)/i);
    assert.doesNotMatch(productCopy, /cash prizes are live/i);
    assert.match(productCopy, /currently paused/i);
    assert.match(productCopy, new RegExp(`${earnFacts.guideMinSpecies} or more`));
});

test("Wildlife Guides copy is virtual only", () => {
    // In-person guiding (applications, bookings, guests, cash on the day) was removed.
    assert.doesNotMatch(productCopy, /["'`]\/(become-a-wildlife-guide|wildlife-experiences|app\/guides)\b/);
    assert.doesNotMatch(productCopy, /Guide Seller Terms|seller application|cash on the day to the Guide|approved (local )?Guides?\b/i);
    assert.doesNotMatch(productCopy, /request a date/i);
    assert.match(productCopy, /virtual/i);
});

test("footer and contact expose the new commercial routes", () => {
    const footer = readRepo("src/app/[locale]/(composited)/_components/footer.tsx");
    const nav = readRepo("src/data/public-navigation.ts");
    const contact = readRepo("src/data/contact-content.ts");
    const contactPage = readRepo("src/app/[locale]/(composited)/contact/page.tsx");
    assert.match(footer, /public-navigation/);
    assert.match(nav, /earn-on-animaldex/);
    assert.match(nav, /sponsor-a-challenge/);
    // Become a Wildlife Guide was removed (it redirects to /wildlife-guides) and
    // Creator Rewards was deliberately retired from public navigation;
    // `public-navigation.test.ts` guards that they stay out of the header and footer.
    assert.doesNotMatch(nav, /become-a-wildlife-guide/);
    assert.doesNotMatch(nav, /creator-rewards/);
    assert.match(contact, /\/sponsor-a-challenge/);
    assert.match(contactPage, /\/earn-on-animaldex/);
});
