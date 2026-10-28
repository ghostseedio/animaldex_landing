/**
 * Renders a sample carousel from a few image URLs, without Claude or the
 * database, to check the slide design (photos and species cut-outs both work):
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/render-carousel-sample.mts <outDir> <imageUrl…>
 */
import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {pictureFromBytes, renderSlide, type SlideSize} from "@/lib/social-content/render";
import type {Slide} from "@/lib/social-content/types";

const [outDir = "carousel-sample", ...urls] = process.argv.slice(2);
if (!urls.length) throw new Error("usage: <outDir> <imageUrl…>");
const images = urls.map((src, offset) => ({index: offset + 1, src, alt: `Animal ${offset + 1}`}));
const source = {title: "Fastest animals in the world: the top 5", images};
const slides: Slide[] = [
    {layout: "cover", kicker: "TIER LIST", title: source.title.split(":")[0].slice(0, 40), body: "Number one isn't even the one you're thinking of.", image: images[0]?.index ?? null, stat: null},
    ...images.slice(1, 4).map((image, offset): Slide => ({layout: "item", kicker: `#${4 - offset}`, title: image.alt.slice(0, 30) || "Mystery animal", body: "A real fact from the page goes here, around twenty words, so we can see how the body wraps on two lines.", image: image.index, stat: offset === 0 ? {label: "Top speed", value: "112 km/h"} : null})),
    {layout: "text", kicker: "MYTH", title: "Sharks can smell one drop of blood a mile away", body: "Actually: it's more like one drop in an Olympic pool, and only close up.", image: null, stat: null},
    {layout: "cta", kicker: "YOUR CALL", title: "Which one would you bet on?", body: "Full ranking on animaldex.app", image: images[0]?.index ?? null, stat: null}
];
await mkdir(outDir, {recursive: true});
const pictures = await Promise.all(slides.map((slide) => {
    const image = source.images.find((candidate) => candidate.index === slide.image);
    return image ? fetch(image.src).then((response) => response.arrayBuffer()).then((bytes) => pictureFromBytes(Buffer.from(bytes))) : Promise.resolve(null);
}));
for (const size of ["feed", "tall"] as SlideSize[]) {
    for (let index = 0; index < slides.length; index += 1) {
        const started = Date.now();
        const jpeg = await renderSlide(slides[index], pictures[index], size, {index, total: slides.length});
        const file = path.join(outDir, `${size}-${String(index + 1).padStart(2, "0")}.jpg`);
        await writeFile(file, jpeg);
        console.log(file, `${Math.round(jpeg.length / 1024)} KB`, `${Date.now() - started} ms`, pictures[index]?.cutout ? "(cut-out)" : "");
    }
}
const pin = await renderSlide(slides[0], pictures[0], "pin", {index: 0, total: slides.length});
await writeFile(path.join(outDir, "pin.jpg"), pin);
