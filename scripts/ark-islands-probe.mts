// Quick probe: the /ark page on the local preview, the town with its animals, then the crossing to the wild island.
import {existsSync, readdirSync, mkdirSync} from "node:fs";
import os from "node:os";
import path from "node:path";
const base = process.env.ARK_BASE ?? "http://localhost:3303";
const out = process.env.ARK_OUT ?? "/tmp/islands-shots";
const query = process.env.ARK_QUERY ?? "snapshot=/ark-local/live.json&islands=/ark-local/islands-routing.json&island=town";
mkdirSync(out, {recursive: true});
function chromiumPath(): string | undefined {
    const cache = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
    if (!existsSync(cache)) return undefined;
    for (const name of readdirSync(cache).filter((e) => /^chromium-\d+$/.test(e)).sort().reverse()) {
        const p = path.join(cache, name, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing");
        if (existsSync(p)) return p;
    }
}
const {chromium} = await import("playwright-core");
const browser = await chromium.launch({executablePath: chromiumPath(), headless: true, args: ["--headless=new", "--enable-precise-memory-info", "--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=metal", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"]});
const phone = process.env.ARK_PHONE === "1";
const context = await browser.newContext(phone ? {viewport: {width: 360, height: 800}, deviceScaleFactor: 2, isMobile: true, hasTouch: true} : {viewport: {width: 1280, height: 800}, deviceScaleFactor: 1});
const page = await context.newPage();
if (phone && process.env.ARK_THROTTLE !== "0") {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", {rate: 4});
}
page.setDefaultTimeout(900_000);
page.on("pageerror", (e) => console.log("pageerror:", e.message));
page.on("console", (m) => { if (m.type() === "error" || /\[ark\]/.test(m.text())) console.log("console:", m.text().slice(0, 300)); });
const t0 = Date.now();
const log = (...a: unknown[]) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
await page.goto(`${base}/ark?${query}`, {waitUntil: "domcontentloaded", timeout: 1_800_000});
log("loaded");
await page.waitForFunction(() => Boolean((window as any).__arkScene), null, {timeout: 1_800_000});
log("scene handle");
const ready = async () => page.waitForFunction(() => { const s = (window as any).__arkScene; try { return s && s.island && !s.crossing() && s.stats && s.stats().drawCalls > 0; } catch { return false; } }, null, {timeout: 900_000});
await ready();
await page.waitForTimeout(Number(process.env.ARK_SETTLE ?? 9000));
const stats = async () => page.evaluate(() => { const s = (window as any).__arkScene; const st = s.stats(); const heap = Math.round(((performance as any).memory?.usedJSHeapSize ?? 0) / 1048576); return {island: s.island(), live: st.live, near: st.near, far: st.far, sprites: st.sprites, drawCalls: st.drawCalls, tier: st.tier, models: st.modelsLoaded, scheduled: st.scheduled, behaviourMs: st.behaviourMs, buildMs: st.behaviourBuildMs, frameMs: st.frameMs, intervalMs: st.intervalMs, heapMB: heap, streaming: st.streaming ? {distance: st.streaming.renderDistance, chunks: st.streaming.chunks} : null}; });
log("first island", JSON.stringify(await stats()));
const world = page.locator("canvas").first();
await world.screenshot({path: `${out}/1-first.png`});
// Close views of the first island (ARK_VIEWS: {name: ArkCameraView}): the models load in, then a still each.
for (const [name, view] of Object.entries(JSON.parse(process.env.ARK_VIEWS ?? "{}") as Record<string, unknown>)) {
    await page.evaluate((v) => (window as any).__arkScene.setView(v), view);
    await page.waitForTimeout(Number(process.env.ARK_VIEW_WAIT ?? 12000));
    log(name, JSON.stringify(await stats()));
    await page.locator("canvas").first().screenshot({path: `${out}/2-${name}.png`});
}
if (process.env.ARK_CROSS !== "0") {
    const first = await page.evaluate(() => (window as any).__arkScene.island());
    const to = first === "town" ? "wild" : "town";
    await page.evaluate((to) => { (window as any).__crossDone = false; (window as any).__arkScene.crossTo(to).then(() => ((window as any).__crossDone = true)); }, to);
    for (let i = 0; i < 14; i++) {
        await page.waitForTimeout(450);
        await page.screenshot({path: `${out}/cross-${String(i).padStart(2, "0")}.png`, clip: {x: 0, y: 0, width: 1280, height: 800}});
    }
    await page.waitForFunction(() => (window as any).__crossDone === true, null, {timeout: 900_000});
    log("crossed to", to);
    await page.waitForTimeout(Number(process.env.ARK_SETTLE ?? 9000));
    log("second island", JSON.stringify(await stats()));
    await page.locator("canvas").first().screenshot({path: `${out}/3-second.png`});
}
await browser.close();
