import assert from "node:assert/strict";
import {existsSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import {blogPosts} from "@/data/blog";

// A post's featuredImage is its share image (og:image / twitter:image), so it
// must work as a social card: a real photo, unique to the post, landscape,
// large enough, and declared at its true size. Placeholder product graphics and
// off-subject stock picks shipped here before; this keeps them out.

const MIN_WIDTH = 800;
const MIN_ASPECT = 1.2;
const MAX_ASPECT = 2.5;

test("every blog post has a unique, landscape, full-size share image", () => {
    const problems: string[] = [];
    const bySrc = new Map<string, string[]>();
    for (const post of blogPosts) {
        const image = post.featuredImage;
        bySrc.set(image.src, [...(bySrc.get(image.src) ?? []), post.slug]);
        if (/\.svg($|\?)|\/placeholders\//.test(image.src)) problems.push(`${post.slug}: placeholder graphic ${image.src}`);
        if (image.width < MIN_WIDTH) problems.push(`${post.slug}: ${image.width}px wide (needs ${MIN_WIDTH}+)`);
        const aspect = image.width / image.height;
        if (aspect < MIN_ASPECT || aspect > MAX_ASPECT) problems.push(`${post.slug}: ${image.width}×${image.height} is not a share-card shape (${aspect.toFixed(2)}:1)`);
        if (!image.alt.trim()) problems.push(`${post.slug}: no alt text`);
    }
    bySrc.forEach((slugs, src) => {
        if (slugs.length > 1) problems.push(`shared by ${slugs.join(", ")}: ${src}`);
    });
    assert.deepEqual(problems, []);
});

test("local share images exist and are declared at their real size", async () => {
    const problems: string[] = [];
    for (const post of blogPosts) {
        const {src, width, height} = post.featuredImage;
        if (!src.startsWith("/")) continue;
        const file = path.join(process.cwd(), "public", src.split("?")[0]);
        if (!existsSync(file)) {
            problems.push(`${post.slug}: missing file ${src}`);
            continue;
        }
        const meta = await sharp(file).metadata();
        if (Math.abs((meta.width ?? 0) - width) > 2 || Math.abs((meta.height ?? 0) - height) > 2) {
            problems.push(`${post.slug}: declared ${width}×${height}, file is ${meta.width}×${meta.height}`);
        }
    }
    assert.deepEqual(problems, []);
});
