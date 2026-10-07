/**
 * Fetch freely licensed Wikimedia Commons photos for blog posts.
 *
 * Input: a JSON file with an array of
 *   {slug, file, title?: "File:Example.jpg", query?: "search terms", must?: ["word"], alt}
 * Either `title` (an exact Commons file) or `query` (a Commons search; `must`
 * words filter titles). Keeps only public-domain, CC0, CC BY and CC BY-SA.
 *
 * Output: public/images/blog/<slug>/<file>.webp (≤1400px) and one JSON line
 * per image on stdout with width, height, the credit caption to paste into
 * the post, and the Commons page URL.
 *
 *   node scripts/fetch-blog-images.mjs spec.json
 */
import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const UA = "AnimalDexLanding/1.0 (article images; https://animaldex.app)";
const ROOT = process.cwd();
const MAX = 1400;

function licenseOk(shortName) {
    const value = (shortName || "").toLowerCase();
    if (!value || /nc|nd|noncommercial|no derivatives/.test(value)) return false;
    return /cc0|public domain|cc by-sa|cc by\b|gfdl|pdm/.test(value);
}

function licenseLabel(shortName) {
    const value = (shortName || "").toLowerCase();
    if (value.includes("cc0")) return "CC0";
    if (value.includes("public domain") || value.includes("pdm")) return "Public domain";
    const m = (shortName || "").match(/CC BY(-SA)?( \d\.\d)?/i);
    return m ? m[0].toUpperCase().replace("CC BY-SA", "CC BY-SA").replace(/\s+/g, " ") : shortName;
}

async function api(params) {
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.searchParams.set("format", "json");
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const response = await fetch(url, {headers: {"User-Agent": UA, Accept: "application/json"}});
    if (!response.ok) throw new Error(`Commons ${response.status}`);
    return response.json();
}

async function pagesFor(item) {
    if (item.title) {
        const body = await api({action: "query", titles: item.title, prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: "1600"});
        return Object.values(body.query?.pages || {});
    }
    const body = await api({action: "query", generator: "search", gsrsearch: `${item.query} filetype:bitmap`, gsrnamespace: "6", gsrlimit: "20", prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: "1600"});
    return Object.values(body.query?.pages || {});
}

function pick(pages, item, used) {
    const must = (item.must || []).map((w) => w.toLowerCase());
    const candidates = pages
        .map((page) => ({page, info: page.imageinfo?.[0]}))
        .filter(({page, info}) => {
            if (!info?.thumburl && !info?.url) return false;
            if (!String(info.mime || "").startsWith("image/")) return false;
            if (info.mime === "image/svg+xml" || info.mime === "image/gif") return false;
            if (!licenseOk(info.extmetadata?.LicenseShortName?.value)) return false;
            const title = page.title.toLowerCase();
            if (/logo|icon|\bmap\b|diagram|coat of arms|flag of|chart|screenshot/.test(title)) return false;
            if (must.length && !must.some((w) => title.includes(w))) return false;
            if (used.has(page.title)) return false;
            return (info.width || 0) >= 800;
        })
        .sort((a, b) => (b.info.width || 0) - (a.info.width || 0));
    return candidates[0] || null;
}

const specPath = process.argv[2];
if (!specPath) {
    console.error("usage: node scripts/fetch-blog-images.mjs spec.json");
    process.exit(2);
}
const items = JSON.parse(await readFile(specPath, "utf8"));
const used = new Set();
for (const item of items) {
    try {
        const pages = await pagesFor(item);
        const chosen = pick(pages, item, used);
        if (!chosen) {
            console.log(JSON.stringify({slug: item.slug, file: item.file, error: "no licensed match", tried: pages.slice(0, 5).map((p) => p.title)}));
            continue;
        }
        used.add(chosen.page.title);
        const info = chosen.info;
        const response = await fetch(info.thumburl || info.url, {headers: {"User-Agent": UA}});
        if (!response.ok) throw new Error(`download ${response.status}`);
        const output = await sharp(Buffer.from(await response.arrayBuffer()), {failOn: "none"})
            .rotate()
            .resize({width: MAX, height: MAX, fit: "inside", withoutEnlargement: true})
            .webp({quality: 76, effort: 5})
            .toBuffer({resolveWithObject: true});
        const dir = path.join(ROOT, "public/images/blog", item.slug);
        await mkdir(dir, {recursive: true});
        await writeFile(path.join(dir, `${item.file}.webp`), output.data);
        const creator = (info.extmetadata?.Artist?.value || "").replace(/<[^>]+>/g, "").trim() || "Wikimedia Commons";
        const license = licenseLabel(info.extmetadata?.LicenseShortName?.value);
        console.log(JSON.stringify({
            slug: item.slug,
            file: `${item.file}.webp`,
            src: `/images/blog/${item.slug}/${item.file}.webp`,
            width: output.info.width,
            height: output.info.height,
            alt: item.alt,
            caption: `Photo: ${creator}, ${license}, via Wikimedia Commons.`,
            commons: info.descriptionurl,
            commonsTitle: chosen.page.title
        }));
    } catch (error) {
        console.log(JSON.stringify({slug: item.slug, file: item.file, error: String(error.message || error)}));
    }
}
