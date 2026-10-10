// Flag repeated / near-identical photos inside each code-defined blog post (perceptual dHash).
// Run: NODE_OPTIONS=--conditions=react-server npx tsx scripts/blog-image-dupes.mts  (writes tmp/blog-image-dupes.json)
import {existsSync, writeFileSync} from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {blogPosts} from "../src/data/blog.ts";

const THRESHOLD = Number(process.env.DUPE_THRESHOLD ?? 0.95);

function collect(post: any) {
    const out: Array<{where: string; src: string}> = [];
    const add = (where: string, src?: string) => { if (src) out.push({where, src}); };
    const media = (where: string, m: any) => {
        if (!m) return;
        if (m.type === "image") add(where, m.image?.src);
        if (m.type === "gallery") (m.images ?? []).forEach((i: any, n: number) => add(`${where}[${n}]`, i.src));
    };
    add("featured", post.featuredImage?.src);
    (post.sections ?? []).forEach((s: any, i: number) => {
        media(`s${i}`, s.media);
        (s.cards ?? []).forEach((c: any, n: number) => add(`s${i}.card${n}`, c.image?.src));
        (s.subsections ?? []).forEach((sub: any, n: number) => media(`s${i}.sub${n}`, sub.media));
        for (const m of (s.html ?? "").matchAll(/<img[^>]+src="([^"]+)"/g)) add(`s${i}.html`, m[1]);
    });
    return out;
}

// Blurred 12x12 colour fingerprint compared by Pearson correlation. A plain dHash misses burst
// frames (grass/fur texture flips bits); correlation catches them. Similar-looking but distinct
// photos can still score high, so treat flags as candidates for a contact-sheet look.
const cache = new Map<string, number[] | null>();
async function fingerprint(src: string) {
    if (cache.has(src)) return cache.get(src)!;
    const file = path.join("public", src.split("?")[0]);
    let value: number[] | null = null;
    if (src.startsWith("/") && existsSync(file)) {
        const {data} = await sharp(file).resize(256, 256, {fit: "fill"}).blur(8).resize(12, 12, {fit: "fill"}).removeAlpha().raw().toBuffer({resolveWithObject: true});
        const values = [...data];
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length) || 1;
        value = values.map((v) => (v - mean) / sd);
    }
    cache.set(src, value);
    return value;
}
const correlation = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + v * b[i], 0) / a.length;

const flagged: any[] = [];
const heroes: Array<{slug: string; src: string; print: number[]}> = [];
for (const post of blogPosts as any[]) {
    const images = collect(post);
    const hashed = [];
    for (const image of images) hashed.push({...image, print: await fingerprint(image.src)});
    const pairs = [];
    for (let i = 0; i < hashed.length; i++) for (let j = i + 1; j < hashed.length; j++) {
        const a = hashed[i], b = hashed[j];
        if (a.src === b.src) { pairs.push({a: `${a.where} ${a.src}`, b: `${b.where} (same file)`, score: 1}); continue; }
        if (!a.print || !b.print) continue;
        const score = correlation(a.print, b.print);
        if (score >= THRESHOLD) pairs.push({a: `${a.where} ${a.src}`, b: `${b.where} ${b.src}`, score: Number(score.toFixed(3))});
    }
    const hero = hashed.find((image) => image.where === "featured");
    if (hero?.print) heroes.push({slug: post.slug, src: hero.src, print: hero.print});
    if (pairs.length) flagged.push({slug: post.slug, images: images.length, pairs});
}
// Two posts whose share images (the hero is the og:image) are the same photo.
const sharedHeroes = [];
for (let i = 0; i < heroes.length; i++) for (let j = i + 1; j < heroes.length; j++) {
    const score = heroes[i].src === heroes[j].src ? 1 : correlation(heroes[i].print, heroes[j].print);
    if (score >= 0.98) sharedHeroes.push({a: `${heroes[i].slug} ${heroes[i].src}`, b: `${heroes[j].slug} ${heroes[j].src}`, score: Number(score.toFixed(3))});
}
writeFileSync("tmp/blog-image-dupes.json", JSON.stringify({threshold: THRESHOLD, posts: blogPosts.length, flagged, sharedHeroes}, null, 2));
console.log(`posts ${blogPosts.length}, flagged ${flagged.length}, shared heroes ${sharedHeroes.length}`);
for (const f of flagged) for (const pair of f.pairs) console.log(`${f.slug}: ${pair.a} ~ ${pair.b} (${pair.score})`);
for (const pair of sharedHeroes) console.log(`shared hero: ${pair.a} ~ ${pair.b} (${pair.score})`);
