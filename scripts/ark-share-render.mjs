#!/usr/bin/env node
/**
 * A real render of the live Ark for share cards (SEO lane S3,
 * docs/seo/ark-share-render.md): opens `/ark?record=1&models=live` on a
 * development server (the recorder: the live Ark alone, no page around it,
 * real animals only), lets the director load every model, and saves a
 * 1200×630 JPEG of one view.
 *
 *   node scripts/ark-share-render.mjs --base http://localhost:3331 --out public/images/og/ark-world.jpg
 *     [--kind flyover|islands|day_to_night] [--at 0.0-1.0] [--hour 9.5] [--width 1200] [--height 630]
 *
 * The camera and the light only: what is shown is the live public snapshot.
 */
import {writeFileSync, mkdirSync, existsSync, readdirSync} from "node:fs";
import os from "node:os";
import path from "node:path";

function arg(name, fallback) {
    const at = process.argv.indexOf(`--${name}`);
    return at >= 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
}

const base = arg("base", "http://localhost:3331");
const out = arg("out", "public/images/og/ark-world.jpg");
const kind = arg("kind", "flyover");
const at = Number(arg("at", "0.75"));
const hour = Number(arg("hour", "9.5"));
const width = Number(arg("width", "1200"));
const height = Number(arg("height", "630"));

function chromePath() {
    if (process.env.ARK_CHROMIUM) return process.env.ARK_CHROMIUM;
    const cache = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
    if (existsSync(cache)) {
        for (const name of readdirSync(cache).filter((entry) => /^chromium-\d+$/.test(entry)).sort().reverse()) {
            const candidate = path.join(cache, name, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing");
            if (existsSync(candidate)) return candidate;
        }
    }
    const system = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    return existsSync(system) ? system : undefined;
}

const {chromium} = await import("playwright-core");
const browser = await chromium.launch({
    executablePath: chromePath(),
    headless: true,
    args: ["--headless=new", "--enable-gpu", "--ignore-gpu-blocklist", ...(process.platform === "darwin" ? ["--use-angle=metal"] : []), "--disable-background-timer-throttling", "--disable-renderer-backgrounding"]
});
try {
    const page = await browser.newPage({viewport: {width, height}, deviceScaleFactor: 1});
    page.on("console", (message) => {
        if (message.type() === "error" || message.type() === "warning") console.log("[page]", message.text().slice(0, 200));
    });
    await page.goto(`${base}/ark?record=1&models=live`, {waitUntil: "domcontentloaded", timeout: 300_000});
    await page.waitForSelector('[data-ark-record="ready"]', {timeout: 300_000});
    const seconds = 8;
    const result = await page.evaluate(async ({kind, hour, seconds}) => {
        const director = window.__arkDirector;
        const info = director.info();
        const direction = {kind, hours: {from: hour, to: hour}, lead: seconds, linger: 0, end: 0, minSeconds: seconds, subject: null, act: null, preload: []};
        const prepared = await director.prepare(direction);
        return {models: prepared.models, animals: info.snapshot.counts.animals, species: info.snapshot.counts.species, fixture: info.fixture};
    }, {kind, hour, seconds});
    if (result.fixture) throw new Error("the recorder is showing the fixture, not the live Ark");
    const frames = Math.max(1, Math.round(at * seconds * 30));
    const image = await page.evaluate(async (frames) => {
        let last = null;
        for (let i = 0; i < frames; i++) last = window.__arkDirector.frame(0.92);
        return last.image;
    }, frames);
    const data = Buffer.from(image.split(",")[1], "base64");
    mkdirSync(path.dirname(out), {recursive: true});
    writeFileSync(out, data);
    console.log(JSON.stringify({out, bytes: data.length, ...result, kind, at, hour}));
} finally {
    await browser.close();
}
