#!/usr/bin/env node
/**
 * EATSOON (`src/lib/ark-eat-soon.ts`): pictures of the chance of a catch on the bars over a selected hunter and on its
 * card, and the words for a plant-eater, composed in the real embed (`public/ark/embed.html` with `?eatsoon=1`, built by
 * `node scripts/build-ark-bundle.mjs`), at phone and desktop width.
 *
 * The data are the live public reads (`/api/ark/*` from the site, read only). The hunting read is the live one; until the
 * engine sends its two numbers, `--odds <rows.json>` lays the rows a real voyage-world run wrote for
 * voyage_hunt_odds_put_v1 (AnimalDex `scripts/ark/tick-profile.ts --commits --dump`, on a production snapshot) over it,
 * as the read would carry them after that run: [id, from, found / due, catch]. The words are the site's, with this
 * branch's `ark.card` keys laid over them from the locale files.
 *
 *   node scripts/ark-eat-soon-shots.mjs --out <dir> [--odds <dump.json>] [--site https://animaldex.app]
 *       [--hunter <name>] [--grazer <name>]
 */
import {createServer} from "node:http";
import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
};
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "eat-soon-shots")));
mkdirSync(out, {recursive: true});
const site = arg("site", "https://animaldex.app");
const hunterName = arg("hunter", "African Lion");
const grazerName = arg("grazer", "Red Deer");

// The engine's rows from a real run (the put's p_rows), by animal id: the read's [find, catch] after it.
const odds = new Map();
const oddsFile = arg("odds", null);
if (oddsFile) {
    for (const write of JSON.parse(readFileSync(oddsFile, "utf8"))) {
        if (write.fn !== "voyage_hunt_odds_put_v1") continue;
        for (const row of write.args.p_rows) if (row.due > 0 && row.catch !== null) odds.set(row.id, [Math.round((row.found / row.due) * 1000) / 1000, row.catch]);
    }
}

// `--illustrate <find>` (until the engine sends its numbers and none can be read from a run): the hunter's row only, with
// that find share and its kind's PUBLISHED catch rate (the middle of `HUNT_SUCCESS`, the engine's own for that kind). The
// pictures' log says so; never a product path.
const illustrate = arg("illustrate", null);
const published = Object.fromEntries([...readFileSync(path.join(root, "src/lib/ark-time-left-constants.ts"), "utf8").matchAll(/"([0-9a-f-]{36})": \[([0-9.]+), ([0-9.]+)\]/g)].map((m) => [m[1], (Number(m[2]) + Number(m[3])) / 2]));

const cardKeys = (lang) => {
    const file = lang === "en" || lang === "id" ? path.join(root, "src/data/locales", `${lang}.json`) : path.join(root, "src/data/locales/ark", `${lang}.json`);
    if (!existsSync(file)) return {};
    const card = JSON.parse(readFileSync(file, "utf8")).ark.card;
    return Object.fromEntries(Object.entries(card).filter(([k]) => k.startsWith("eatSoon")));
};

const cache = new Map();
async function live(url) {
    if (!cache.has(url)) cache.set(url, fetch(`${site}${url}`, {headers: {"User-Agent": "ark-shots"}}).then(async (r) => ({status: r.status, type: r.headers.get("content-type") ?? "application/json", body: Buffer.from(await r.arrayBuffer())})));
    return cache.get(url);
}

const used = [];
const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    try {
        if (url.pathname.startsWith("/api/")) {
            const answer = await live(url.pathname + url.search);
            let body = answer.body;
            if (url.pathname === "/api/ark/hunting" && answer.status === 200) {
                const read = JSON.parse(body.toString("utf8"));
                if (read.hunting?.predators) {
                    read.hunting.predators = read.hunting.predators.map((item) => {
                        const o = odds.get(item[0]);
                        if (!o) return item;
                        used.push(item[0]);
                        return [item[0], item[1], o[0], o[1]];
                    });
                }
                body = Buffer.from(JSON.stringify(read));
            } else if (url.pathname === "/api/ark/words" && answer.status === 200) {
                const words = JSON.parse(body.toString("utf8"));
                if (words.ark?.card) Object.assign(words.ark.card, cardKeys(url.searchParams.get("lang") || "en"));
                body = Buffer.from(JSON.stringify(words));
            }
            response.writeHead(answer.status, {"Content-Type": answer.type, "Cache-Control": "no-store"}).end(body);
            return;
        }
        const folder = path.join(root, "public");
        const file = path.join(folder, path.normalize(url.pathname).replace(/^\/+/, ""));
        if (!file.startsWith(folder) || !existsSync(file)) return void response.writeHead(404).end();
        const ext = path.extname(file);
        const type = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".glb": "model/gltf-binary", ".ktx2": "image/ktx2", ".jpg": "image/jpeg", ".wasm": "application/wasm"}[ext] ?? "application/octet-stream";
        response.writeHead(200, {"Content-Type": type, "Cache-Control": "no-store"}).end(readFileSync(file));
    } catch (error) {
        response.writeHead(502).end(String(error));
    }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

// The animals to show: by name from the live snapshot (a hunter the hunting read names, out in the wild; a wild plant-eater).
const snapshot = JSON.parse((await live("/api/ark/voyage")).body.toString("utf8")).snapshot;
const hunting = JSON.parse((await live("/api/ark/hunting")).body.toString("utf8")).hunting;
const hunters = new Set(hunting.predators.map((p) => p[0]));
const wild = (a) => !a.area && a.island !== "town";
const hunter = snapshot.animals.find((a) => a.name === hunterName && hunters.has(a.id) && wild(a) && odds.has(a.id)) ?? snapshot.animals.find((a) => a.name === hunterName && hunters.has(a.id) && wild(a));
const grazer = snapshot.animals.find((a) => a.name === grazerName && !hunters.has(a.id) && wild(a));
if (!hunter || !grazer) throw new Error(`no ${!hunter ? hunterName : grazerName} in the live snapshot`);
if (illustrate !== null && !odds.has(hunter.id)) {
    const rate = published[hunter.kind_species_profile_id ?? hunter.species_profile_id];
    if (rate === undefined) throw new Error(`${hunterName} has no published catch rate to illustrate with`);
    odds.set(hunter.id, [Number(illustrate), Math.round(rate * 10000) / 10000]);
}

const {chromium} = createRequire(path.join(root, "node_modules", "x.js"))("playwright-core");
let browser;
try {
    browser = await chromium.launch({channel: "chrome", headless: true, args: ["--use-angle=metal", "--ignore-gpu-blocklist"]});
} catch {
    const dir = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
    const chromiumDir = readdirSync(dir).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()[0];
    browser = await chromium.launch({executablePath: path.join(dir, chromiumDir, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"), headless: true, args: ["--use-angle=metal", "--ignore-gpu-blocklist"]});
}
const log = [];
try {
    const views = [["phone", {width: 390, height: 844}, 3], ["desktop", {width: 1280, height: 800}, 1]];
    const langs = (arg("langs", "en,de,ar")).split(",");
    for (const [label, viewport, scale] of views) {
        for (const lang of label === "phone" ? langs : ["en"]) {
            // The embed waits 2.5 s for its words and mounts no card without them: read them first.
            await live(`/api/ark/words?lang=${encodeURIComponent(lang)}`);
            const page = await browser.newPage({viewport, deviceScaleFactor: scale});
            page.on("pageerror", (e) => console.log("pageerror", String(e).slice(0, 200)));
            await page.goto(`${base}/ark/embed.html?eatsoon=1&hud=bars&lang=${lang}`);
            await page.waitForFunction(() => document.querySelector("canvas") && document.getElementById("ark-loader")?.style.display === "none", null, {timeout: 300000}).catch(() => null);
            await page.waitForTimeout(4000);
            for (const [who, animal] of [["hunter", hunter], ["grazer", grazer]]) {
                await page.evaluate((id) => window.postMessage({type: "ark:select", id, closeUp: true}, "*"), animal.id);
                await page.waitForSelector("[data-testid=ark-card-eat-soon]", {timeout: 60000}).catch(() => null);
                await page.waitForTimeout(6000);
                const said = await page.evaluate(() => ({card: document.querySelector("[data-testid=ark-card-eat-soon]")?.textContent ?? null, kind: document.querySelector("[data-testid=ark-card-eat-soon]")?.getAttribute("data-kind") ?? null, bars: document.querySelector("[data-ark-bars-soon]")?.textContent ?? null}));
                const file = path.join(out, `${label}-${lang}-${who}.png`);
                await page.screenshot({path: file});
                log.push({file, who, name: animal.name, lang, ...said, engineOdds: odds.get(animal.id) ?? null});
                console.log(label, lang, who, animal.name, JSON.stringify(said));
            }
            await page.close();
        }
    }
} finally {
    await browser.close();
    server.close();
}
writeFileSync(path.join(out, "shots.json"), JSON.stringify({site, odds: oddsFile ? path.basename(oddsFile) : null, illustrated: illustrate !== null ? {hunter: hunter.name, find: Number(illustrate), catch: odds.get(hunter.id)?.[1] ?? null, note: "find is illustrative; catch is the kind's published rate"} : null, oddsLaid: [...new Set(used)].length, log}, null, 1));
