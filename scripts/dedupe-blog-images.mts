// Replace repeated, near-identical or off-topic photos inside symbolism blog posts with
// distinct licensed Wikimedia Commons photos of the same animal. Filenames are kept, so post
// data does not change; credits are MERGED into src/data/blog/symbolism/image-credits.ts.
//
// Run: NODE_OPTIONS=--conditions=react-server npx tsx scripts/dedupe-blog-images.mts [slug ...]
//   No args = every entry in REPLACE; `slug:4,7` re-rolls just those indexes. Commons titles
//   rejected after eyeballing go in scripts/dedupe-blog-images.rejected.json ({"<slug>": ["File:…"]}),
//   and their whole photo series is skipped on re-runs.
//
// Finding candidates: scripts/blog-image-dupes.mts flags exact/near repeats and
// scripts/blog-image-sheets.mts draws contact sheets. Burst frames and off-topic shots
// (maps, skulls, drawings, empty enclosures) still need a human look at the sheets.
import {existsSync, readFileSync, writeFileSync} from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {blogPosts} from "../src/data/blog.ts";
import {symbolismImageCredits} from "../src/data/blog/symbolism/image-credits.ts";

const UA = "AnimalDexLanding/1.0 (image licensing; https://animaldex.app)";
const CREDITS_FILE = "src/data/blog/symbolism/image-credits.ts";
const REJECTED_FILE = "scripts/dedupe-blog-images.rejected.json";

// post slug → image indexes to replace (0 = hero, then section images in order).
// Chosen from contact sheets, Oct 2026.
const REPLACE: Record<string, number[]> = {
    "indus-river-dolphin-symbolism": [1, 3, 4, 5, 6],
    "blue-ringed-octopus-symbolism": [1, 5],
    "beluga-whale-symbolism": [3, 4, 6],
    "tiger-salamander-symbolism": [3, 7],
    "gorilla-symbolism": [1, 2, 3],
    "black-rhinoceros-symbolism": [4],
    "sumatran-orangutan-symbolism": [2, 3, 4, 7],
    "lionfish-symbolism": [6],
    "antlion-symbolism": [1, 4],
    "adelie-penguin-symbolism": [2, 7],
    "blue-whale-symbolism": [7],
    "philippine-eagle-symbolism": [4, 5, 6, 7],
    "giant-pacific-octopus-symbolism": [5, 6, 7],
    "polar-bear-symbolism": [3, 4],
    "great-white-shark-symbolism": [4, 5, 6, 7],
    "african-grey-parrot-symbolism": [2],
    "alpine-newt-symbolism": [1],
    "african-bush-elephant-symbolism": [2],
    "andean-goose-symbolism": [3],
    "aardwolf-symbolism": [5, 7],
    "wolf-symbolism": [5],
    "dolphin-symbolism": [1],
    "eagle-symbolism": [1],
    "raven-symbolism": [0, 5, 6, 7],
    "cat-symbolism": [1, 3],
    "chameleon-symbolism": [1],
    "crocodile-symbolism": [0],
    "leopard-symbolism": [0, 3, 5],
    "jellyfish-symbolism": [1, 4, 5, 6],
    "orangutan-symbolism": [1, 5],
    "owl-symbolism": [7],
    "dragonfly-symbolism": [0, 4]
};

// Species with too few Commons photos to search blind: exact files, picked by hand. Indus river
// dolphin has ~3 usable photos, so the theme sections use its habitat (the Sukkur Barrage
// fragmentation is the species' main threat). Never substitute the Ganges subspecies.
const PINNED: Record<string, Record<number, string>> = {
    "indus-river-dolphin-symbolism": {
        1: "File:Indus river Dolphin , The National Aquatic Animal of Pakistan.jpg",
        3: "File:Artificial island near Sukkur Barrage.jpg",
        4: "File:Sukkur Barrage in daylight.jpg",
        5: "File:Indus hund evening.jpg",
        6: "File:پاکستان کا قومی آبی سمندری ممالیہ.jpg"
    },
    // Search results here are mostly one baited-lure burst plus cage-diving boats.
    "great-white-shark-symbolism": {4: "File:Great white shark at Guadalupe Island.png"}
};

async function imageInfo(title: string) {
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.search = new URLSearchParams({action: "query", format: "json", titles: title, prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: "1600"}).toString();
    const response = await fetch(url, {headers: {"User-Agent": UA, Accept: "application/json"}});
    if (!response.ok) throw new Error(`Commons ${response.status} for ${title}`);
    const page: any = Object.values((await response.json() as any).query?.pages || {})[0];
    return page?.imageinfo?.[0] ? {page, info: page.imageinfo[0]} : null;
}

// species slug → Commons search queries (first is preferred) and words a candidate must mention.
const SPECIES: Record<string, {queries: string[]; must: string[]}> = {
    aardwolf: {queries: ["Proteles cristata", "aardwolf"], must: ["aardwolf", "proteles"]},
    "adelie-penguin": {queries: ["Pygoscelis adeliae", "Adelie penguin"], must: ["adelie", "adélie", "pygoscelis adeliae"]},
    "african-bush-elephant": {queries: ["Loxodonta africana", "African bush elephant"], must: ["loxodonta", "elephant"]},
    "african-grey-parrot": {queries: ["Psittacus erithacus", "African grey parrot"], must: ["erithacus", "grey parrot", "gray parrot", "african grey"]},
    "alpine-newt": {queries: ["Ichthyosaura alpestris", "alpine newt"], must: ["alpestris", "alpine newt", "bergmolch"]},
    "andean-goose": {queries: ["Chloephaga melanoptera", "Andean goose"], must: ["chloephaga", "andean goose"]},
    antlion: {queries: ["Myrmeleontidae", "antlion", "Myrmeleon formicarius", "Euroleon nostras"], must: ["antlion", "ant-lion", "ant lion", "myrmeleon", "euroleon", "myrmeleontidae", "palpares", "distoleon"]},
    "beluga-whale": {queries: ["Delphinapterus leucas", "beluga whale"], must: ["beluga", "delphinapterus"]},
    "black-rhinoceros": {queries: ["Diceros bicornis", "black rhinoceros"], must: ["diceros", "black rhino"]},
    "blue-ringed-octopus": {queries: ["Hapalochlaena", "blue-ringed octopus"], must: ["hapalochlaena", "blue-ringed", "blue ringed"]},
    "blue-whale": {queries: ["Balaenoptera musculus", "blue whale"], must: ["balaenoptera musculus", "blue whale"]},
    cat: {queries: ["Felis catus", "domestic cat", "tabby cat"], must: ["felis catus", "domestic cat", "tabby", "cat"]},
    chameleon: {queries: ["Chamaeleo", "Furcifer pardalis", "chameleon"], must: ["chamaeleo", "chameleon", "furcifer", "trioceros"]},
    crocodile: {queries: ["Crocodylus niloticus", "Nile crocodile"], must: ["crocodylus", "crocodile"]},
    dolphin: {queries: ["Tursiops truncatus", "bottlenose dolphin"], must: ["tursiops", "bottlenose"]},
    dragonfly: {queries: ["Anisoptera", "dragonfly", "Aeshna", "Libellula"], must: ["dragonfly", "anisoptera", "aeshna", "libellula", "anax", "sympetrum", "orthetrum"]},
    eagle: {queries: ["Haliaeetus leucocephalus", "bald eagle"], must: ["haliaeetus", "bald eagle"]},
    "giant-pacific-octopus": {queries: ["Enteroctopus dofleini", "giant Pacific octopus"], must: ["dofleini", "giant pacific octopus", "enteroctopus"]},
    gorilla: {queries: ["Gorilla gorilla", "Gorilla beringei", "gorilla"], must: ["gorilla"]},
    "great-white-shark": {queries: ["Carcharodon carcharias", "great white shark", "white shark Guadalupe", "Carcharodon carcharias underwater"], must: ["carcharodon", "great white", "white shark"]},
    "indus-river-dolphin": {queries: ["Platanista minor", "Indus river dolphin", "Platanista"], must: ["platanista minor", "indus river dolphin", "indus dolphin", "bhulan"]},
    jellyfish: {queries: ["Aurelia aurita", "moon jellyfish", "Chrysaora", "Cyanea capillata"], must: ["aurelia", "jellyfish", "medusa", "chrysaora", "cyanea"]},
    leopard: {queries: ["Panthera pardus", "leopard"], must: ["panthera pardus", "leopard"]},
    lionfish: {queries: ["Pterois volitans", "Pterois miles", "lionfish"], must: ["pterois", "lionfish"]},
    orangutan: {queries: ["Pongo pygmaeus", "Bornean orangutan", "orangutan"], must: ["pongo", "orangutan", "orang-utan"]},
    owl: {queries: ["Bubo bubo", "Eurasian eagle-owl"], must: ["bubo bubo", "eagle-owl", "eagle owl", "uhu"]},
    "philippine-eagle": {queries: ["Pithecophaga jefferyi", "Philippine eagle"], must: ["pithecophaga", "philippine eagle"]},
    "polar-bear": {queries: ["Ursus maritimus", "polar bear"], must: ["maritimus", "polar bear"]},
    raven: {queries: ["Corvus corax", "common raven"], must: ["corvus corax", "common raven", "raven"]},
    "sumatran-orangutan": {queries: ["Pongo abelii", "Sumatran orangutan"], must: ["abelii", "sumatran orangutan", "sumatra"]},
    "tiger-salamander": {queries: ["Ambystoma tigrinum", "Ambystoma mavortium", "tiger salamander"], must: ["ambystoma tigrinum", "ambystoma mavortium", "tiger salamander"]},
    wolf: {queries: ["Canis lupus", "gray wolf"], must: ["canis lupus", "gray wolf", "grey wolf", "wolf"]}
};

// Off-topic shots the earlier pass let through: maps, specimens, artwork, people, products.
const OFF_TOPIC = /\b(logo|icon|map|range|distribution|diagram|coat of arms|flag|drawing|painting|illustration|engraving|lithograph|plate|sculpture|statue|cartoon|clipart|stamp|coin|skull|skeleton|bone|jaw|fossil|specimen|museum|taxiderm|mounted|stuffed|preserved|jar|pelt|rug|egg|eggs|shell|concert|band|festival|musician|book|author|poster|toy|plush|costume|mascot|enclosure|cage|carcass|dead|roadkill|road kill|feather|pluma|stranded|necropsy|fishing|bait|baited|cage diving|tattoo|meat|market|dish|hybrid|captive-bred)\b/i;
const NAME_CLASH = ["sea lion", "lionfish", "lion fish", "tiger shark", "tiger beetle", "elephant seal", "elephant bird", "elephant shrew", "fox squirrel", "flying fox", "wolf spider", "wolf eel", "wolffish", "raven (band)", "catfish", "cat shark", "catshark", "leopard seal", "leopard shark", "leopard gecko", "leopard frog", "leopard tortoise", "eagle ray", "eagle-owl", "dolphinfish", "crocodile fish", "crocodile newt", "crocodile skink", "crocodile monitor", "goose barnacle"];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const stripHtml = (value?: string) => (value || "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#0?39;/g, "'").replace(/\s+/g, " ").trim();

function licenseOk(short: string) {
    const value = short.toLowerCase();
    if (!value || /\bnc\b|\bnd\b|noncommercial|no derivatives/.test(value)) return false;
    return /cc0|public domain|cc by-sa|cc by\b|pdm/.test(value);
}
function licenseLabel(short: string) {
    const value = short.toLowerCase();
    if (value.includes("cc0")) return "CC0";
    const version = value.match(/(\d\.\d)/)?.[1];
    if (value.includes("by-sa")) return `CC BY-SA${version ? ` ${version}` : ""}`;
    if (value.includes("by")) return `CC BY${version ? ` ${version}` : ""}`;
    return "Public domain";
}

async function search(query: string) {
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.search = new URLSearchParams({
        action: "query", format: "json", generator: "search", gsrsearch: `${query} filetype:bitmap`, gsrnamespace: "6",
        gsrlimit: "40", prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: "1600"
    }).toString();
    for (let attempt = 0; attempt < 4; attempt++) {
        const response = await fetch(url, {headers: {"User-Agent": UA, Accept: "application/json"}});
        if (response.status === 429) { await sleep(5000 * (attempt + 1)); continue; }
        if (!response.ok) throw new Error(`Commons ${response.status} for ${query}`);
        const body: any = await response.json();
        return Object.values(body.query?.pages || {}).sort((a: any, b: any) => a.index - b.index) as any[];
    }
    return [];
}

// Blurred 12x12 colour fingerprint; Pearson correlation > 0.95 means the same scene/burst.
async function fingerprint(input: string | Buffer) {
    const {data} = await sharp(input).resize(256, 256, {fit: "fill"}).blur(8).resize(12, 12, {fit: "fill"}).removeAlpha().raw().toBuffer({resolveWithObject: true});
    const values = [...data];
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length) || 1;
    return values.map((v) => (v - mean) / sd);
}
const correlation = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + v * b[i], 0) / a.length;
// "IMG_1234.jpg" and "IMG_1236.jpg" from one uploader are almost always the same burst.
const MONTHS = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/gi;
const burstStem = (title: string) => title.replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, "").replace(MONTHS, " ").replace(/[\d_\-\s(),.]+/g, " ").trim().toLowerCase();

function postImages(post: any): string[] {
    const out: string[] = [post.featuredImage?.src];
    const media = (m: any) => { if (m?.type === "image") out.push(m.image.src); if (m?.type === "gallery") out.push(...m.images.map((i: any) => i.src)); };
    for (const section of post.sections ?? []) { media(section.media); for (const sub of section.subsections ?? []) media(sub.media); }
    return out;
}

function altText(displayName: string, page: any, info: any) {
    const description = stripHtml(info.extmetadata?.ImageDescription?.value).replace(/\s*\(.*?\)\s*/g, " ").trim();
    const first = description.split(/(?<=[.!?])\s/)[0]?.replace(/[.\s]+$/, "") ?? "";
    if (first.length >= 12 && first.length <= 140 && !/^(own work|photo|image|file)\b/i.test(first) && !/[{}|=]/.test(first)) {
        return first.toLowerCase().includes(displayName.toLowerCase().split(" ").pop()!) ? first : `${displayName}: ${first}`;
    }
    const cleaned = page.title.replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, "").replace(/[_]+/g, " ").replace(/\b(IMG|DSC|DSCN|P)\s?\d+\b/gi, "").replace(/\s+/g, " ").trim();
    return cleaned.length > 8 ? `${displayName} — ${cleaned}` : `${displayName} photographed in the wild`;
}

async function main() {
    const only = new Map(process.argv.slice(2).map((arg) => {
        const [slug, list] = arg.split(":");
        return [slug, list ? list.split(",").map(Number) : null] as const;
    }));
    const rejected: Record<string, string[]> = existsSync(REJECTED_FILE) ? JSON.parse(readFileSync(REJECTED_FILE, "utf8")) : {};
    const credits: Record<string, any> = {...symbolismImageCredits};
    const usedTitles = new Set<string>();
    const summary: string[] = [];

    for (const [slug, configured] of Object.entries(REPLACE)) {
        if (only.size && !only.has(slug)) continue;
        const indexes = only.get(slug) ?? configured;
        const post: any = (blogPosts as any[]).find((p) => p.slug === slug);
        if (!post) { summary.push(`${slug}: post not found`); continue; }
        const speciesSlug = slug.replace(/-symbolism$/, "");
        const species = SPECIES[speciesSlug];
        if (!species) { summary.push(`${slug}: no species search config`); continue; }
        const displayName = post.title.split(" Symbolism")[0];
        const images = postImages(post);
        const keptPrints: number[][] = [];
        for (const [i, src] of images.entries()) {
            if (indexes.includes(i) || !src?.startsWith("/")) continue;
            const file = path.join("public", src);
            if (existsSync(file)) keptPrints.push(await fingerprint(file));
        }
        const stems = new Set<string>();
        for (const [i, src] of images.entries()) {
            const source = !indexes.includes(i) && src ? credits[`${speciesSlug}/${path.basename(src)}`]?.source : undefined;
            if (source) { stems.add(burstStem(source)); usedTitles.add(source); }
        }
        const skip = new Set(rejected[slug] ?? []);
        // A rejected shot's siblings from the same series are rejected with it.
        const rejectedStems = new Set([...skip].map(burstStem));

        const pool: Array<{page: any; info: any}> = [];
        const pinned = PINNED[slug];
        const searches = pinned ? [] : [...species.queries.slice(0, 2).map((q) => `"${q}" incategory:Quality_images`), ...species.queries];
        for (const query of searches) {
            try {
                for (const page of await search(query)) {
                    const info = page.imageinfo?.[0];
                    if (!info || pool.some((p) => p.page.title === page.title)) continue;
                    if (!/^image\/(jpeg|png|webp|tiff)$/.test(info.mime || "")) continue;
                    if (!licenseOk(info.extmetadata?.LicenseShortName?.value || "")) continue;
                    if (skip.has(page.title) || usedTitles.has(page.title)) continue;
                    const description = stripHtml(info.extmetadata?.ImageDescription?.value).toLowerCase();
                    const categories = stripHtml(info.extmetadata?.Categories?.value).toLowerCase();
                    const blob = `${page.title.toLowerCase()} ${description}`;
                    if (OFF_TOPIC.test(page.title) || OFF_TOPIC.test(description.slice(0, 300))) continue;
                    if (/maps of|skulls|specimens|illustrations|drawings|paintings|museum/.test(categories)) continue;
                    if (NAME_CLASH.some((word) => blob.includes(word) && !species.must.some((m) => m.includes(word)))) continue;
                    if (!species.must.some((word) => `${blob} ${categories}`.includes(word))) continue;
                    if ((info.width || 0) < 1000 || (info.height || 0) < 600) continue;
                    pool.push({page, info});
                }
            } catch (error: any) {
                console.error("search", slug, error.message);
            }
            await sleep(400);
        }
        // Landscape photos crop best into the article's 3:2 frames.
        pool.sort((a, b) => Number(b.info.width / b.info.height >= 1.25) - Number(a.info.width / a.info.height >= 1.25));

        let written = 0;
        for (const index of indexes) {
            const src = images[index];
            if (!src) continue;
            const file = path.basename(src);
            const hero = index === 0;
            let done = false;
            if (pinned?.[index]) {
                const item = await imageInfo(pinned[index]);
                if (item && licenseOk(item.info.extmetadata?.LicenseShortName?.value || "")) pool.unshift(item);
            }
            while (pool.length && !done) {
                const candidate = pool.shift()!;
                const {page, info} = candidate;
                if (hero && info.width / info.height < 1.3) continue;
                if (stems.has(burstStem(page.title)) || rejectedStems.has(burstStem(page.title))) continue;
                const isPinned = pinned?.[index] === page.title;
                const response = await fetch(info.thumburl || info.url, {headers: {"User-Agent": UA}});
                if (!response.ok) { await sleep(1500); continue; }
                const input = Buffer.from(await response.arrayBuffer());
                const print = await fingerprint(input).catch(() => null);
                if (!print || (!isPinned && keptPrints.some((kept) => correlation(kept, print) > 0.95))) continue;
                const output = await sharp(input, {failOn: "none"}).rotate()
                    .resize({width: 1400, height: 1400, fit: "inside", withoutEnlargement: true})
                    .webp({quality: 74, effort: 4}).toBuffer({resolveWithObject: true});
                writeFileSync(path.join("public", src), output.data);
                keptPrints.push(print);
                stems.add(burstStem(page.title));
                usedTitles.add(page.title);
                const license = info.extmetadata?.LicenseShortName?.value || "";
                const artist = stripHtml(info.extmetadata?.Artist?.value).replace(/^by\s+/i, "").slice(0, 90) || "Unknown photographer";
                credits[`${speciesSlug}/${file}`] = {
                    alt: altText(displayName, page, info),
                    caption: `Photo: ${artist}, ${licenseLabel(license)}, via Wikimedia Commons.`,
                    width: output.info.width,
                    height: output.info.height,
                    source: page.title
                };
                console.log(`${slug} [${index}] ${file} ← ${page.title}`);
                written += 1;
                done = true;
                await sleep(300);
            }
            if (!done) console.log(`${slug} [${index}] ${file}: no acceptable candidate left`);
        }
        summary.push(`${slug}: replaced ${written}/${indexes.length}`);
    }

    // `source` records the Commons title so a later run can reject it by name; it is not rendered.
    const body = `import type {ContentImage} from "@/data/content-schema";

export const symbolismImageCredits: Record<string, Pick<ContentImage, "alt" | "caption" | "width" | "height"> & {source?: string}> = ${JSON.stringify(credits, null, 4)};
`;
    writeFileSync(CREDITS_FILE, body);
    console.log("---\n" + summary.join("\n"));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
