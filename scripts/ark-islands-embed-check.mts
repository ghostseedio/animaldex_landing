// The apps' embed with two islands (390x844): the host's messages after the town joins: ark:visible, ark:power, ark:select
// across the strait, ark:reset; no page errors. Development only (a dev bundle, the local real snapshot and routing).
import {existsSync, readdirSync, mkdirSync} from "node:fs";
import os from "node:os";
import path from "node:path";
const base = process.env.ARK_BASE ?? "http://localhost:3303";
const out = process.env.ARK_OUT ?? "/tmp/islands-embed";
const [zooId, wildId] = (process.env.ARK_IDS ?? "").split(" ");
mkdirSync(out, {recursive: true});
const cache = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
const chrome = readdirSync(cache).filter((e) => /^chromium-\d+$/.test(e)).sort().reverse().map((n) => path.join(cache, n, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing")).find((p) => existsSync(p));
const {chromium} = await import("playwright-core");
const browser = await chromium.launch({executablePath: chrome, headless: true, args: ["--headless=new", "--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=metal"]});
const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, isMobile: true, hasTouch: true});
const page = await context.newPage();
const errors: string[] = [];
const told: unknown[] = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.exposeFunction("__toldHost", (m: unknown) => told.push(m));
// (A string, not a function: tsx's name helpers do not exist in the page. The Android bridge, as the app's WebView has it.)
await page.addInitScript("window.AndroidArk = {postMessage: function (text) { window.__toldHost(JSON.parse(text)); }};");
// (ARK_QUERY without `islands=`: the one-island embed as before.)
const query = process.env.ARK_QUERY ?? "snapshot=/ark-local/live.json&islands=/ark-local/islands-routing.json&regions=1&lang=de";
await page.goto(`${base}/ark/embed.html?${query}`, {waitUntil: "domcontentloaded"});
const send = (m: unknown) => page.evaluate((x) => (window as any).AnimalDexArkHost.send(x), m);
// (Sent before the scene is up, as the apps do on launch: held, then replayed once it is.)
await page.waitForFunction(() => Boolean((window as any).AnimalDexArkHost), null, {timeout: 60_000});
await send({type: "ark:power", saver: true});
// (A focus link to a zoo animal on launch: chosen at once, flown to across the strait once the town is in.)
await send({type: "ark:select", id: zooId});
await page.waitForFunction(() => { const s = (window as any).__arkScene; return s && s.attached && s.attached(); }, null, {timeout: 600_000});
await page.waitForTimeout(4000);
const runtime = () => page.evaluate(() => { const r = (window as any).__arkScene.runtime(); return {mode: r.mode, visible: r.visible, power: r.power}; });
const heldPower = await runtime();
await send({type: "ark:visible", visible: false});
await page.waitForTimeout(1500);
const hidden = await runtime();
await send({type: "ark:visible", visible: true});
await send({type: "ark:power", power: null});
await page.waitForTimeout(1500);
const shown = await runtime();
const nearOnLaunch = await page.evaluate(() => (window as any).__arkScene.island());
await send({type: "ark:select", id: zooId});
await page.waitForTimeout(6000);
await page.locator("canvas").first().screenshot({path: `${out}/select-zoo.png`});
const zooAt = await page.evaluate((id) => (window as any).__arkScene.locate(id), zooId);
const near = await page.evaluate(() => (window as any).__arkScene.island());
await send({type: "ark:select", id: wildId});
await page.waitForTimeout(6000);
const near2 = await page.evaluate(() => (window as any).__arkScene.island());
await send({type: "ark:reset"});
await page.waitForTimeout(4000);
await page.locator("canvas").first().screenshot({path: `${out}/reset.png`});
const lang = await page.evaluate(() => document.documentElement.lang);
console.log(JSON.stringify({errors, lang, nearOnLaunch, heldPower, hidden, shown, zooAt, nearAfterZoo: near, nearAfterWild: near2, told: told.map((m: any) => m.type === "ark:selected" ? `selected:${m.animal?.id ?? null}` : m.type)}, null, 0));
await browser.close();
