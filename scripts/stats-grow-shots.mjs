#!/usr/bin/env node
/**
 * Stats grow from Ark life (STATS-GROW): pictures of the two new lines, from the real code with the server's answers:
 * the stats panel's "+2 from the Ark" (`ArkGainNote`) and the /ark card's log lines (`arkStatGainNotes` through
 * `arkStatusText`, drawn in the card's log markup), in English and three other locales, at phone and desktop width.
 *
 *   node scripts/stats-grow-shots.mjs --out <dir>
 */
import {execFileSync} from "node:child_process";
import {createServer} from "node:http";
import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
import {build} from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
};
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "stats-grow-shots")));
mkdirSync(out, {recursive: true});
const site = path.join(root, ".ark-golden", "stats-grow");
mkdirSync(site, {recursive: true});

const entry = path.join(site, "entry.tsx");
writeFileSync(entry, `
import React from "react";
import {createRoot} from "react-dom/client";
import {ArkGainNote} from "@/components/animal-detail/ark-gain-note";
import {captureWords} from "@/lib/capture-words";
import {arkGrewWords, arkStatGainNotes, decodeArkStatGains, decodeCardStatGains} from "@/lib/ark-stat-gains";
import {arkStatusLog, arkStatusText, arkStatusWords} from "@/lib/ark-animal-status";
import en from "@/data/locales/en.json";
import id from "@/data/locales/id.json";
import de from "@/data/locales/ark/de.json";
import ja from "@/data/locales/ark/ja.json";
import ar from "@/data/locales/ark/ar.json";

// The server's answers (migration 20261225120000): a card with +1 dominance (a hunt) and +1 intelligence (its first young).
const RPC = {total: 2, dominance: 1, speed: 0, size: 0, intelligence: 1, lines: [
    {stat: "intelligence", points: 1, source: "young", ark_day: 312, at: new Date(Date.now() - 2 * 3600e3).toISOString()},
    {stat: "dominance", points: 1, source: "hunt", ark_day: 300, at: new Date(Date.now() - 26 * 3600e3).toISOString()}
]};
const LOCALES: Array<[string, any, boolean]> = [["en", en, false], ["id", id, false], ["de", de, false], ["ja", ja, false], ["ar", ar, true]];

function CardLog({ark, locale, rtl}: {ark: any; locale: string; rtl: boolean}) {
    const words = arkStatusWords(ark);
    const notes = arkStatGainNotes("a1", decodeArkStatGains(RPC), arkGrewWords(ark.grew), locale);
    const arrived = {id: "origin:a1", source: "record" as const, at: Date.now() - 40 * 3600e3, day: 290, kind: "arrived" as const, via: "capture" as const};
    const meal = {id: "meal:a1", source: "record" as const, at: Date.now() - 27 * 3600e3, day: 300, kind: "meal" as const, other: "Cape Hare"};
    const record = [arrived, meal, ...notes.map((n) => ({id: n.id, source: "record" as const, at: n.at, day: n.day, kind: n.kind, text: n.text}))];
    const text = arkStatusText({id: "a1", activity: null, since: null, goal: null, log: arkStatusLog([], record), bars: {fed: null, health: null, energy: null, age: null}}, words, locale, Date.now());
    return (
        <div dir={rtl ? "rtl" : "ltr"} className="ark-card-glass border-t border-white/[0.12] px-4 py-3">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-400">{words.card.logTitle} · {locale}</p>
            <ol className="mt-1 pr-1">
                {text.log.map((line) => (
                    <li key={line.id} className="flex min-w-0 items-center gap-2 py-[2px] text-[12.5px] leading-snug">
                        <span aria-hidden="true" className={"h-1.5 w-1.5 shrink-0 rounded-full " + (line.source === "record" ? "bg-primary-300" : "bg-white/25")} />
                        <span className={"min-w-0 flex-1 truncate " + (line.source === "record" ? "font-semibold text-ink-100" : "text-ink-200")}>{line.text}</span>
                        <span className="shrink-0 whitespace-nowrap text-[11.5px] tabular-nums text-ink-400">{line.stamp}</span>
                    </li>
                ))}
            </ol>
        </div>
    );
}

function Stats({messages, locale}: {messages: any; locale: string}) {
    const words = captureWords(messages.appCapture).stats;
    const gain = decodeCardStatGains(RPC)!;
    const labels = {dominance: words.dominance, speed: words.speed, size: words.size, intelligence: words.intelligence, rarity: words.rarity};
    return (
        <section className="bg-[#090909] py-3.5 font-sans">
            <h2 className="px-4 text-[22px] font-bold leading-[1.25] text-white">{words.statsTitle} · {locale}</h2>
            <div className="mx-4 mt-3 grid h-24 place-items-center border border-white/[0.08] text-[11px] text-white/40">(radar chart, unchanged)</div>
            <ArkGainNote gain={gain} words={words} labels={labels} />
        </section>
    );
}

createRoot(document.getElementById("root")!).render(
    <div className="flex flex-col gap-0">
        <Stats messages={en} locale="en" />
        <Stats messages={id} locale="id" />
        {LOCALES.map(([code, m, rtl]) => <CardLog key={code} ark={m.ark} locale={code} rtl={rtl} />)}
    </div>
);
(window as any).__ready = true;
`);
await build({entryPoints: [entry], outfile: path.join(site, "page.js"), bundle: true, format: "iife", platform: "browser", target: ["es2020"], jsx: "automatic", tsconfig: path.join(root, "tsconfig.json"), define: {"process.env.NODE_ENV": JSON.stringify("production")}, loader: {".json": "json"}, logLevel: "warning"});
const css = path.join(site, "page.css");
execFileSync(path.join(root, "node_modules", ".bin", "tailwindcss"), ["-c", path.join(root, "tailwind.config.js"), "-i", path.join(root, "src/app/[locale]/_assets/globals.css"), "--content", `${entry},${path.join(root, "src/components/animal-detail/ark-gain-note.tsx")}`, "-o", css], {cwd: root, stdio: "inherit"});
writeFileSync(path.join(site, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Stats grow</title><link rel="stylesheet" href="./page.css"></head><body style="margin:0;background:#2a3a30"><div id="root"></div><script src="./page.js"></script></body></html>`);

const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const file = path.join(site, path.normalize(url.pathname).replace(/^\/+/, "") || "index.html");
    if (!file.startsWith(site) || !existsSync(file)) return void response.writeHead(404).end();
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "application/octet-stream";
    response.writeHead(200, {"Content-Type": type, "Cache-Control": "no-store"}).end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/index.html`;
const {chromium} = createRequire(path.join(root, "node_modules", "x.js"))("playwright-core");
let browser;
try {
    browser = await chromium.launch({channel: "chrome", headless: true});
} catch {
    const cache = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
    const dir = readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()[0];
    browser = await chromium.launch({executablePath: path.join(cache, dir, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"), headless: true});
}
try {
    for (const [name, width] of [["phone", 390], ["desktop", 900]]) {
        const page = await browser.newPage({viewport: {width, height: 900}, deviceScaleFactor: 2});
        page.on("pageerror", (e) => console.log("pageerror", String(e).slice(0, 300)));
        await page.goto(base);
        await page.waitForFunction(() => window.__ready === true, null, {timeout: 30000});
        await page.waitForTimeout(300);
        const file = path.join(out, `stats-grow-${name}.png`);
        await page.screenshot({path: file, fullPage: true});
        console.log("wrote", file);
        await page.close();
    }
} finally {
    await browser.close();
    server.close();
}
