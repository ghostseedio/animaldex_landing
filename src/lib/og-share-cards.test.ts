import {test} from "node:test";
import assert from "node:assert/strict";
import {readdirSync, readFileSync, statSync} from "node:fs";
import path from "node:path";
import {ogImagePath, withOgCard} from "./og/og-image";
import {STATIC_OG_CARDS} from "./og/static-og-cards";

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) return sourceFiles(full);
        return /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") ? [full] : [];
    });
}

test("share card paths end in .png so the CDN caches them", () => {
    assert.equal(ogImagePath("lesson", "gray-wolf"), "/api/og/lesson/gray-wolf.png");
    assert.equal(ogImagePath("page", "legal/privacy"), "/api/og/page/legal/privacy.png");
    assert.equal(ogImagePath("support", "getting-started", "what-is-animaldex"), "/api/og/support/getting-started/what-is-animaldex.png");
});

test("withOgCard sets the Twitter image too, so pages stop inheriting the layout card", () => {
    const metadata = withOgCard({title: "T", openGraph: {title: "OG title", description: "D"}}, "Alt", "page", "blog");
    const twitter = metadata.twitter as {card?: string; title?: string; images?: Array<{url: string}>};
    assert.equal(twitter.card, "summary_large_image");
    assert.equal(twitter.title, "OG title");
    assert.equal(twitter.images?.[0]?.url, "/api/og/page/blog.png");
    const images = (metadata.openGraph as {images?: Array<{url: string; width: number}>}).images;
    assert.equal(images?.[0]?.url, "/api/og/page/blog.png");
    assert.equal(images?.[0]?.width, 1200);
});

test("every static share card a page asks for exists", () => {
    const root = path.join(process.cwd(), "src");
    const missing: string[] = [];
    let found = 0;
    for (const file of sourceFiles(root)) {
        if (file.includes(`${path.sep}og${path.sep}`)) continue;
        const source = readFileSync(file, "utf8");
        if (!source.includes("@/lib/og/og-image")) continue;
        // The trailing `"page", "<key>")` of a withOgCard / ogContentImage call.
        for (const match of Array.from(source.matchAll(/"page",\s*((?:"[^"]+"(?:,\s*)?)+)\);?$/gm))) {
            found += 1;
            const key = Array.from(match[1].matchAll(/"([^"]+)"/g), (part) => part[1]).join("/");
            if (!STATIC_OG_CARDS[key]) missing.push(`${path.relative(root, file)} → ${key}`);
        }
    }
    assert.ok(found >= 20, `expected the page share-card calls to be found, got ${found}`);
    assert.deepEqual(missing, []);
    // Earn pages build their key from the route path.
    for (const key of ["earn-on-animaldex", "become-a-wildlife-guide", "creator-rewards", "sponsor-a-challenge", "wildlife-experiences"]) {
        assert.ok(STATIC_OG_CARDS[key], key);
    }
});

test("public pages no longer share the generic og.png or the SVG card", () => {
    const appRoot = path.join(process.cwd(), "src/app/[locale]");
    // The home page shares the brand card on purpose; guide listings fall back to it without a cover.
    const allowed = new Set(["(composited)/(home)/page.tsx", "(composited)/guides/[listing]/page.tsx", "layout.tsx"]);
    const offenders = sourceFiles(appRoot)
        .filter((file) => !file.includes("/(authenticated)/"))
        .filter((file) => /\/images\/og(-animaldex)?\.(png|svg)/.test(readFileSync(file, "utf8")))
        .map((file) => path.relative(appRoot, file))
        .filter((file) => !allowed.has(file));
    assert.deepEqual(offenders, []);
});
