/**
 * Replace repeated photos inside symbolism articles with distinct
 * licensed photographs of the same animal.
 */
import {mkdir, readdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const ROOT = process.cwd();
const BLOG_IMAGES = path.join(ROOT, "public/images/blog");
const SYMBOLISM_DATA = path.join(ROOT, "src/data/blog/symbolism");
const UA = "AnimalDexLanding/1.0 (image licensing; https://animaldex.app)";

const SCIENTIFIC = {
    aardwolf: ["Proteles cristata", "aardwolf"],
    "adelie-penguin": ["Pygoscelis adeliae", "Adelie penguin"],
    "african-bush-elephant": ["Loxodonta africana", "African bush elephant"],
    "african-grey-parrot": ["Psittacus erithacus", "African grey parrot"],
    "alpine-newt": ["Ichthyosaura alpestris", "alpine newt"],
    "andean-goose": ["Chloephaga melanoptera", "Andean goose"],
    antlion: ["Myrmeleontidae", "antlion"],
    "beluga-whale": ["Delphinapterus leucas", "beluga whale"],
    "black-rhinoceros": ["Diceros bicornis", "black rhinoceros"],
    "blue-ringed-octopus": ["Hapalochlaena", "blue-ringed octopus"],
    "blue-tongued-skink": ["Tiliqua scincoides", "blue-tongued skink"],
    "blue-whale": ["Balaenoptera musculus", "blue whale"],
    cat: ["Felis catus", "domestic cat"],
    chameleon: ["Chamaeleonidae", "chameleon"],
    crocodile: ["Crocodylus niloticus", "Nile crocodile"],
    dolphin: ["Tursiops truncatus", "bottlenose dolphin"],
    dragonfly: ["Anisoptera", "dragonfly"],
    eagle: ["Haliaeetus leucocephalus", "bald eagle"],
    elephant: ["Loxodonta africana", "African elephant"],
    fox: ["Vulpes vulpes", "red fox"],
    "giant-pacific-octopus": ["Enteroctopus dofleini", "giant Pacific octopus"],
    gorilla: ["Gorilla gorilla", "western gorilla"],
    "great-white-shark": ["Carcharodon carcharias", "great white shark"],
    "indus-river-dolphin": ["Platanista minor", "Indus river dolphin"],
    jellyfish: ["Aurelia aurita", "moon jellyfish"],
    leopard: ["Panthera pardus", "leopard"],
    lion: ["Panthera leo", "lion"],
    lionfish: ["Pterois volitans", "lionfish"],
    orangutan: ["Pongo pygmaeus", "Bornean orangutan"],
    owl: ["Bubo bubo", "Eurasian eagle-owl"],
    "philippine-eagle": ["Pithecophaga jefferyi", "Philippine eagle"],
    "polar-bear": ["Ursus maritimus", "polar bear"],
    raven: ["Corvus corax", "common raven"],
    remora: ["Echeneis naucrates", "sharksucker remora"],
    "snowy-owl": ["Bubo scandiacus", "snowy owl"],
    "sumatran-orangutan": ["Pongo abelii", "Sumatran orangutan"],
    "tiger-salamander": ["Ambystoma tigrinum", "tiger salamander"],
    tiger: ["Panthera tigris", "tiger"],
    wolf: ["Canis lupus", "gray wolf"]
};

const MUST = {
    aardwolf: ["aardwolf", "proteles"],
    "adelie-penguin": ["adelie", "adélie", "pygoscelis"],
    "african-bush-elephant": ["loxodonta", "elephant"],
    "african-grey-parrot": ["erithacus", "grey parrot", "gray parrot", "african grey"],
    "alpine-newt": ["alpestris", "alpine newt", "newt"],
    "andean-goose": ["chloephaga", "andean goose", "goose"],
    antlion: ["antlion", "ant-lion", "myrmeleon"],
    "beluga-whale": ["beluga", "leucas"],
    "black-rhinoceros": ["diceros", "black rhino", "rhinoceros"],
    "blue-ringed-octopus": ["hapalochlaena", "blue-ringed", "blue ringed"],
    "blue-tongued-skink": ["tiliqua", "blue-tongued", "blue tongued"],
    "blue-whale": ["musculus", "blue whale"],
    cat: ["felis catus", "domestic cat", "tabby"],
    chameleon: ["chamaeleo", "chameleon"],
    crocodile: ["crocodyl", "crocodile"],
    dolphin: ["tursiops", "bottlenose", "dolphin"],
    dragonfly: ["dragonfly", "anisoptera"],
    eagle: ["haliaeetus", "bald eagle", "eagle"],
    elephant: ["loxodonta", "elephant"],
    fox: ["vulpes", "red fox"],
    "giant-pacific-octopus": ["dofleini", "pacific octopus", "octopus"],
    gorilla: ["gorilla"],
    "great-white-shark": ["carcharodon", "great white", "white shark"],
    "indus-river-dolphin": ["platanista", "indus", "river dolphin"],
    jellyfish: ["aurelia", "jellyfish", "medusa"],
    leopard: ["pardus", "leopard"],
    lion: ["panthera leo", "lion"],
    lionfish: ["pterois", "lionfish"],
    orangutan: ["pongo", "orangutan", "orang-utan"],
    owl: ["bubo", "eagle-owl", "eagle owl", "owl"],
    "philippine-eagle": ["pithecophaga", "philippine eagle"],
    "polar-bear": ["maritimus", "polar bear"],
    raven: ["corvus corax", "raven"],
    remora: ["echeneis", "remora", "sharksucker"],
    "snowy-owl": ["scandiacus", "snowy owl"],
    "sumatran-orangutan": ["abelii", "sumatran orangutan", "orangutan"],
    "tiger-salamander": ["ambystoma", "tiger salamander"],
    tiger: ["panthera tigris", "tiger"],
    wolf: ["canis lupus", "gray wolf", "grey wolf", "wolf"]
};

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function licenseOk(shortName) {
    const value = (shortName || "").toLowerCase();
    if (!value || /nc|nd|noncommercial|no derivatives/.test(value)) return false;
    return /cc0|public domain|cc by-sa|cc by\b|gfdl|pdm/.test(value);
}

function licenseLabel(shortName) {
    const value = (shortName || "").toLowerCase();
    if (value.includes("cc0")) return "CC0";
    if (value.includes("by-sa")) return "CC BY-SA";
    if (value.includes("by")) return "CC BY";
    if (value.includes("gfdl")) return "GFDL";
    return "Public domain";
}

function stripHtml(value) {
    return (value || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, "\"")
        .replace(/&#039;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
}

function hashFile(buffer) {
    return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function search(query) {
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("format", "json");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrsearch", `${query} filetype:bitmap`);
    url.searchParams.set("gsrnamespace", "6");
    url.searchParams.set("gsrlimit", "30");
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "url|size|mime|extmetadata");
    url.searchParams.set("iiurlwidth", "1600");
    const response = await fetch(url, {headers: {"User-Agent": UA, Accept: "application/json"}});
    if (!response.ok) throw new Error(`Commons ${response.status} for ${query}`);
    const body = await response.json();
    return Object.values(body.query?.pages || {});
}

const REJECT = [
    "sea lion",
    "lionfish",
    "lion fish",
    "tiger shark",
    "tiger beetle",
    "elephant seal",
    "elephant bird",
    "fox squirrel",
    "flying fox",
    "wolf spider",
    "wolf eel"
];

function candidates(pages, must, usedTitles) {
    return pages
        .map((page) => ({page, info: page.imageinfo?.[0]}))
        .filter(({page, info}) => {
            if (!info?.thumburl && !info?.url) return false;
            if (!String(info.mime || "").startsWith("image/")) return false;
            if (info.mime === "image/svg+xml" || info.mime === "image/gif") return false;
            const license = info.extmetadata?.LicenseShortName?.value || "";
            if (!licenseOk(license)) return false;
            const title = page.title.toLowerCase();
            if (/logo|icon|map|diagram|coat of arms|flag of|drawing|painting|illustration|engraving|sculpture|cartoon|clipart|stamp|coin|skeleton|fossil|range map|distribution/.test(title)) return false;
            const description = stripHtml(info.extmetadata?.ImageDescription?.value || "").toLowerCase();
            const blob = `${title} ${description}`;
            if (REJECT.some((word) => blob.includes(word) && !must.some((needed) => needed.includes(word)))) return false;
            if (!must.some((word) => blob.includes(word))) return false;
            if (usedTitles.has(page.title)) return false;
            const width = info.thumbwidth || info.width || 0;
            if (width < 800) return false;
            return true;
        });
}

function altFromTitle(title, displayName) {
    const cleaned = title.replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
    const sentence = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    if (sentence.toLowerCase().includes(displayName.toLowerCase().split(" ")[0])) return sentence;
    return `${displayName}: ${sentence}`;
}

function referencedFiles(source, speciesSlug) {
    const themes = [...source.matchAll(/imageFile:\s*"([^"]+)"/g)].map((match) => match[1]);
    const last = speciesSlug.split("-").pop();
    return [
        `${speciesSlug}-symbolism-hero.webp`,
        `what-is-a-${last}.webp`,
        `${last}-biology-symbolism.webp`,
        ...themes,
        `${speciesSlug}-symbolism-lesson.webp`,
        `${speciesSlug}-symbolism-final.webp`
    ];
}

async function loadSpecies() {
    const names = (await readdir(SYMBOLISM_DATA)).filter((name) => name.endsWith("-symbolism.ts"));
    const species = [];
    for (const name of names) {
        const source = await readFile(path.join(SYMBOLISM_DATA, name), "utf8");
        const slug = source.match(/speciesSlug:\s*"([^"]+)"/)?.[1];
        const displayName = source.match(/displayName:\s*"([^"]+)"/)?.[1];
        if (!slug || !displayName || !SCIENTIFIC[slug]) continue;
        species.push({slug, displayName, source, files: referencedFiles(source, slug)});
    }
    return species;
}

async function main() {
    const species = await loadSpecies();
    const usedTitles = new Set();
    const credits = {};
    const summary = [];

    for (const animal of species) {
        const folder = path.join(BLOG_IMAGES, `${animal.slug}-symbolism`);
        await mkdir(folder, {recursive: true});
        const hashes = new Map();
        for (const file of animal.files) {
            try {
                const bytes = await readFile(path.join(folder, file));
                hashes.set(file, hashFile(bytes));
            } catch {
                hashes.set(file, null);
            }
        }
        const seen = new Set();
        const keep = new Set();
        for (const file of animal.files) {
            const hash = hashes.get(file);
            if (!hash || seen.has(hash)) continue;
            seen.add(hash);
            keep.add(file);
        }
        const replace = animal.files.filter((file) => !keep.has(file));
        if (replace.length === 0) {
            summary.push(`${animal.slug}: already distinct`);
            continue;
        }

        const pool = [];
        for (const query of SCIENTIFIC[animal.slug]) {
            try {
                const pages = await search(query);
                for (const item of candidates(pages, MUST[animal.slug], usedTitles)) {
                    if (!pool.some((entry) => entry.page.title === item.page.title)) pool.push(item);
                }
            } catch (error) {
                console.error("search", animal.slug, error.message);
            }
            await sleep(250);
            if (pool.length >= replace.length) break;
        }

        const keptHashes = new Set([...keep].map((file) => hashes.get(file)).filter(Boolean));
        let written = 0;
        for (const file of replace) {
            let chosen = null;
            while (pool.length && !chosen) {
                const next = pool.shift();
                if (usedTitles.has(next.page.title)) continue;
                chosen = next;
            }
            if (!chosen) break;
            const info = chosen.info;
            const response = await fetch(info.thumburl || info.url, {headers: {"User-Agent": UA}});
            if (!response.ok) {
                console.error("download", animal.slug, response.status);
                continue;
            }
            const input = Buffer.from(await response.arrayBuffer());
            const output = await sharp(input, {failOn: "none"})
                .rotate()
                .resize({width: 1400, height: 1400, fit: "inside", withoutEnlargement: true})
                .webp({quality: 72, effort: 4})
                .toBuffer({resolveWithObject: true});
            const digest = hashFile(output.data);
            if (keptHashes.has(digest)) continue;
            keptHashes.add(digest);
            usedTitles.add(chosen.page.title);
            await writeFile(path.join(folder, file), output.data);
            const license = info.extmetadata?.LicenseShortName?.value || "";
            const creator = stripHtml(info.extmetadata?.Artist?.value).slice(0, 90) || "the photographer";
            credits[`${animal.slug}/${file}`] = {
                alt: altFromTitle(chosen.page.title, animal.displayName),
                caption: `Photo by ${creator}, ${licenseLabel(license)}`,
                width: output.info.width,
                height: output.info.height
            };
            written += 1;
            await sleep(150);
        }
        const line = `${animal.slug}: replaced ${written}/${replace.length}`;
        summary.push(line);
        console.log(line);
    }

    const body = `import type {ContentImage} from "@/data/content-schema";

export const symbolismImageCredits: Record<string, Pick<ContentImage, "alt" | "caption" | "width" | "height">> = ${JSON.stringify(credits, null, 4)};
`;
    await writeFile(path.join(SYMBOLISM_DATA, "image-credits.ts"), body);
    console.log("---");
    console.log(summary.join("\n"));
    console.log("credits", Object.keys(credits).length);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
