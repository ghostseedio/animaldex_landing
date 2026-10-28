/**
 * Writes one carousel and a batch of text posts for a page with the real
 * prompts and Claude, renders the slides to a folder, and saves nothing:
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json --env-file=.env \
 *     scripts/social-content-dry-run.mts <outDir> <pageUrl> <pageText.txt> <template> <imageUrl…>
 *
 * (Page sources need Next's next-intl alias, so the page text and photo URLs are passed in.)
 */
import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import type {VideoSource} from "@/lib/content-video/plan";
import {chooseExperiment} from "@/lib/social-lab/bandit";
import {structuredClaude} from "@/lib/social-content/claude";
import {buildCarouselUserPrompt, buildTextUserPrompt, CAROUSEL_SYSTEM_PROMPT, carouselJsonSchema, normalizeCarousel, normalizeTextPosts, TEXT_JSON_SCHEMA, TEXT_SYSTEM_PROMPT} from "@/lib/social-content/plan";
import {pictureFromBytes, renderSlide} from "@/lib/social-content/render";
import type {CarouselTemplate} from "@/lib/social-content/types";
import type {TextFormat} from "@/lib/social-lab/arms";

const [outDir, url, textFile, template, ...imageUrls] = process.argv.slice(2);
const text = await readFile(textFile, "utf8");
const images = imageUrls.map((src, offset) => ({index: offset + 1, src, alt: path.basename(src).replace(/\.\w+$/, "").replace(/-/g, " "), caption: null, width: 1200, height: 900, license: null}));
const source: VideoSource = {type: "ranking", format: "editorial", slug: "dry-run", title: text.split("\n")[0], description: text.split("\n")[3] ?? "", url, tags: [], text, images};
const bytes = await Promise.all(images.map(async (image) => ({index: image.index, bytes: Buffer.from(await (await fetch(image.src)).arrayBuffer())})));
const templates = [template as CarouselTemplate];
const experiment = chooseExperiment("carousel", []);
console.log("experiment", experiment);
const reply = await structuredClaude({system: CAROUSEL_SYSTEM_PROMPT, user: buildCarouselUserPrompt(source, templates, experiment), schema: carouselJsonSchema(templates), images: bytes});
console.log("carousel cost", reply.usd);
const carousel = normalizeCarousel(reply.value, reply.loadedImages, templates);
if (!carousel) throw new Error(`unusable carousel: ${JSON.stringify(reply.value).slice(0, 500)}`);
await mkdir(outDir, {recursive: true});
await writeFile(path.join(outDir, "carousel.json"), JSON.stringify(carousel, null, 2));
const pictures = new Map(await Promise.all(bytes.map(async (entry) => [entry.index, await pictureFromBytes(entry.bytes)] as const)));
for (const [index, slide] of carousel.spec.slides.entries()) {
    const jpeg = await renderSlide(slide, slide.image !== null ? pictures.get(slide.image) ?? null : null, "feed", {index, total: carousel.spec.slides.length});
    await writeFile(path.join(outDir, `feed-${String(index + 1).padStart(2, "0")}.jpg`), jpeg);
}
const formats: TextFormat[] = ["poll", "hot_take", "would_you_rather", "wild_fact"];
const textReply = await structuredClaude({system: TEXT_SYSTEM_PROMPT, user: buildTextUserPrompt(source, formats), schema: TEXT_JSON_SCHEMA, effort: "low"});
console.log("text cost", textReply.usd);
await writeFile(path.join(outDir, "text.json"), JSON.stringify(normalizeTextPosts(textReply.value, formats), null, 2));
console.log("done");
