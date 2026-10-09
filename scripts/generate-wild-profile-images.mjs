#!/usr/bin/env node
/**
 * Builds the Wild Profile graphics used by /what-animal-am-i, the
 * /blog/what-animal-am-i post, the nav card and the best-app page.
 *
 * Each image is an Origin / Apex / Active triad composed from the species
 * artwork in the public `animals` storage bucket, so the pictures show the
 * real thing the page is about instead of stock app screenshots.
 *
 *   node scripts/generate-wild-profile-images.mjs
 *
 * Output: public/images/blog/what-animal-am-i/*.webp (overwritten in place).
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const BUCKET = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals";
const OUT_DIR = path.resolve("public/images/blog/what-animal-am-i");

const C = {
    canvas: "#07100B",
    canvas2: "#0A1610",
    surface: "#0D2A16",
    line: "#1C3324",
    lineBright: "#2A4434",
    ink: "#FFFFFF",
    ink2: "#A8B0AA",
    ink3: "#7E8781",
    neon: "#A7F432",
    green: "#21C05E",
    violet: "#B79CFF"
};
const FONT = "Helvetica Neue, Helvetica, Arial, sans-serif";

const ROLES = {
    origin: {label: "ORIGIN", meaning: "Your root pattern", color: C.neon},
    apex: {label: "APEX", meaning: "You under pressure", color: "#FFB547"},
    active: {label: "ACTIVE", meaning: "Showing up right now", color: C.violet}
};

const artCache = new Map();

async function art(slug, size) {
    if (!artCache.has(slug)) {
        const response = await fetch(`${BUCKET}/${slug}.webp`);
        if (!response.ok) throw new Error(`No artwork for ${slug} (${response.status})`);
        artCache.set(slug, Buffer.from(await response.arrayBuffer()));
    }
    return sharp(artCache.get(slug))
        .resize(size, size, {fit: "contain", background: {r: 0, g: 0, b: 0, alpha: 0}, kernel: "lanczos3"})
        .png()
        .toBuffer();
}

const esc = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function svg(width, height, body) {
    return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`);
}

function text(x, y, value, {size = 20, weight = 700, fill = C.ink, anchor = "start", spacing = 0, opacity = 1} = {}) {
    return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" fill-opacity="${opacity}" text-anchor="${anchor}" letter-spacing="${spacing}">${esc(value)}</text>`;
}

function backdrop(width, height, glows = []) {
    const defs = glows.map((glow, index) => `
        <radialGradient id="glow${index}" cx="${glow.x}" cy="${glow.y}" r="${glow.r}" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="${glow.color}" stop-opacity="${glow.opacity ?? 0.35}"/>
            <stop offset="1" stop-color="${glow.color}" stop-opacity="0"/>
        </radialGradient>`).join("");
    const fills = glows.map((_, index) => `<rect width="${width}" height="${height}" fill="url(#glow${index})"/>`).join("");
    return `<defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${C.canvas2}"/>
            <stop offset="1" stop-color="${C.canvas}"/>
        </linearGradient>${defs}
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>${fills}`;
}

/** A role card: rounded panel, coloured top rule, role label, animal name and meaning. */
function roleCard({x, y, w, h, role, name, radius = 22, nameSize = 30, labelSize = 15, meaningSize = 17, showMeaning = true}) {
    const r = ROLES[role];
    const bottom = y + h;
    return `
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${C.surface}" fill-opacity="0.72" stroke="${r.color}" stroke-opacity="0.45" stroke-width="2"/>
        <rect x="${x + 24}" y="${y}" width="${w - 48}" height="4" rx="2" fill="${r.color}"/>
        ${text(x + w / 2, y + 40, r.label, {size: labelSize, weight: 800, fill: r.color, anchor: "middle", spacing: 3})}
        ${text(x + w / 2, bottom - (showMeaning ? 52 : 30), name, {size: nameSize, weight: 800, anchor: "middle"})}
        ${showMeaning ? text(x + w / 2, bottom - 24, r.meaning, {size: meaningSize, weight: 500, fill: C.ink2, anchor: "middle"}) : ""}`;
}

async function render(file, width, height, backgroundSvg, layers, foregroundSvg = "") {
    const composites = [];
    for (const layer of layers) {
        composites.push({input: await art(layer.slug, layer.size), left: Math.round(layer.x), top: Math.round(layer.y)});
    }
    if (foregroundSvg) composites.push({input: svg(width, height, foregroundSvg), left: 0, top: 0});
    await sharp(svg(width, height, backgroundSvg))
        .composite(composites)
        .webp({quality: 84})
        .toFile(path.join(OUT_DIR, file));
    console.log(`wrote ${file} ${width}x${height}`);
}

const HERO_TRIAD = [
    {role: "origin", slug: "gray-wolf", name: "Gray Wolf"},
    {role: "apex", slug: "honey-badger", name: "Honey Badger"},
    {role: "active", slug: "octopus", name: "Octopus"}
];

/** 1200x630 — Open Graph, blog featured image, nav card. Content kept in the centre for square crops. */
async function hero() {
    const W = 1200, H = 630;
    const cardW = 300, cardH = 390, gap = 26;
    const left = (W - (cardW * 3 + gap * 2)) / 2;
    const top = 168;
    const cards = HERO_TRIAD.map((item, index) => ({...item, x: left + index * (cardW + gap), y: top}));
    const bg = backdrop(W, H, [
        {x: 600, y: 360, r: 520, color: C.green, opacity: 0.28},
        {x: 1100, y: 40, r: 380, color: C.violet, opacity: 0.18}
    ]) + cards.map((card) => roleCard({...card, w: cardW, h: cardH})).join("");
    const fg = `
        ${text(W / 2, 74, "WILD PROFILE", {size: 18, weight: 800, fill: C.neon, anchor: "middle", spacing: 6})}
        ${text(W / 2, 128, "What animal are you?", {size: 46, weight: 800, anchor: "middle"})}
        ${text(W / 2, 600, "Three animals, one profile  ·  AnimalDex", {size: 17, weight: 600, fill: C.ink3, anchor: "middle", spacing: 1})}`;
    await render("wild-profile-hero.webp", W, H, bg, cards.map((card) => ({slug: card.slug, size: 236, x: card.x + 32, y: card.y + 56})), fg);
}

/** 960x960 — page hero column (object-cover, bottom overlaid by a caption box). */
async function heroSquare() {
    const W = 960, H = 960;
    const bg = backdrop(W, H, [
        {x: 480, y: 420, r: 560, color: C.green, opacity: 0.3},
        {x: 860, y: 80, r: 360, color: C.violet, opacity: 0.2}
    ]);
    // Apex big in the middle, Origin and Active flanking it higher up.
    const spots = [
        {...HERO_TRIAD[0], cx: 210, cy: 380, size: 300},
        {...HERO_TRIAD[2], cx: 750, cy: 380, size: 300},
        {...HERO_TRIAD[1], cx: 480, cy: 520, size: 380}
    ];
    const labels = spots.map((spot) => {
        const r = ROLES[spot.role];
        const y = spot.cy + spot.size / 2 + 6;
        return `
            <rect x="${spot.cx - 92}" y="${y - 26}" width="184" height="64" rx="16" fill="${C.canvas}" fill-opacity="0.82" stroke="${r.color}" stroke-opacity="0.55" stroke-width="2"/>
            ${text(spot.cx, y - 4, r.label, {size: 14, weight: 800, fill: r.color, anchor: "middle", spacing: 3})}
            ${text(spot.cx, y + 24, spot.name, {size: 22, weight: 800, anchor: "middle"})}`;
    }).join("");
    const fg = `${text(W / 2, 150, "ORIGIN  ·  APEX  ·  ACTIVE", {size: 22, weight: 800, fill: C.neon, anchor: "middle", spacing: 5})}${labels}`;
    await render("wild-profile-triad.webp", W, H, bg, spots.map((spot) => ({slug: spot.slug, size: spot.size, x: spot.cx - spot.size / 2, y: spot.cy - spot.size / 2})), fg);
}

/** Phone frame helper: returns svg for the frame plus the inner screen rect. */
function phone(x, y, w, h) {
    const screen = {x: x + 16, y: y + 16, w: w - 32, h: h - 32};
    return {
        screen,
        svg: `
            <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="58" fill="#050806" stroke="${C.lineBright}" stroke-width="3"/>
            <rect x="${screen.x}" y="${screen.y}" width="${screen.w}" height="${screen.h}" rx="44" fill="${C.canvas}"/>
            <rect x="${x + w / 2 - 60}" y="${y + 30}" width="120" height="30" rx="15" fill="#050806"/>`
    };
}

/** 512x1084 — Wild Profile start screen inside a phone. */
async function identityPhone() {
    const W = 512, H = 1084;
    const p = phone(6, 6, W - 12, H - 12);
    const s = p.screen;
    const cx = s.x + 24, cw = s.w - 48;
    const bg = backdrop(W, H, [{x: 256, y: 380, r: 420, color: C.green, opacity: 0.22}]) + p.svg + `
        ${text(s.x + s.w / 2, s.y + 100, "Wild Profile", {size: 22, weight: 800, anchor: "middle"})}
        <rect x="${cx}" y="${s.y + 140}" width="${cw}" height="560" rx="22" fill="${C.surface}" stroke="${C.lineBright}" stroke-width="1.5"/>
        ${text(cx + 24, s.y + 188, "Find your three animals", {size: 25, weight: 800})}
        ${text(cx + 24, s.y + 224, "Answer a few animal-style questions.", {size: 16, weight: 500, fill: C.ink2})}
        ${text(cx + 24, s.y + 248, "AnimalDex will match you to your", {size: 16, weight: 500, fill: C.ink2})}
        ${text(cx + 24, s.y + 272, "Origin, Apex, and Active animals.", {size: 16, weight: 500, fill: C.ink2})}
        ${["origin", "apex", "active"].map((role, index) => {
            const r = ROLES[role];
            const y = s.y + 316 + index * 112;
            return `<rect x="${cx + 20}" y="${y}" width="${cw - 40}" height="96" rx="16" fill="${C.canvas}" stroke="${r.color}" stroke-opacity="0.4" stroke-width="1.5"/>
                ${text(cx + 132, y + 40, r.label, {size: 13, weight: 800, fill: r.color, spacing: 3})}
                ${text(cx + 132, y + 68, r.meaning, {size: 17, weight: 600})}`;
        }).join("")}
        <rect x="${cx + 20}" y="${s.y + 650}" width="${cw - 40}" height="0" fill="none"/>
        <rect x="${cx}" y="${s.y + 730}" width="${cw}" height="58" rx="29" fill="${C.neon}"/>
        ${text(s.x + s.w / 2, s.y + 767, "Start", {size: 19, weight: 800, fill: C.canvas, anchor: "middle"})}
        ${text(s.x + s.w / 2, s.y + 826, "Private by default. Reflective, not a diagnosis.", {size: 13, weight: 500, fill: C.ink3, anchor: "middle"})}`;
    const icons = HERO_TRIAD.map((item, index) => ({slug: item.slug, size: 84, x: cx + 26, y: s.y + 322 + index * 112}));
    await render("animaldex-identity-phone.webp", W, H, bg, icons);
}

/** 1024x767 — the adaptive interview: Wild Guide chat with quick chips and the signal badge. */
async function interview() {
    const W = 1024, H = 767;
    const panel = {x: 172, y: 40, w: 680, h: 687};
    const bubble = (x, y, w, lines, {user = false, label} = {}) => {
        const h = 30 + lines.length * 26 + (label ? 20 : 0);
        return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${user ? C.neon : C.surface}" stroke="${user ? "none" : C.lineBright}" stroke-width="1.5"/>
            ${label ? text(x + 18, y + 26, label, {size: 12, weight: 800, fill: user ? "#2a3a10" : C.ink3, spacing: 1}) : ""}
            ${lines.map((line, index) => text(x + 18, y + (label ? 52 : 34) + index * 26, line, {size: 18, weight: 600, fill: user ? C.canvas : C.ink})).join("")}`;
    };
    const px = panel.x + 28;
    const chips = ["Sharper", "Quieter", "Faster", "Tougher", "More social"];
    let chipX = px;
    const chipSvg = chips.map((chip) => {
        const w = chip.length * 10 + 30;
        const out = `<rect x="${chipX}" y="${panel.y + 548}" width="${w}" height="34" rx="17" fill="${C.neon}" fill-opacity="0.12"/>${text(chipX + w / 2, panel.y + 571, chip, {size: 14, weight: 700, fill: C.neon, anchor: "middle"})}`;
        chipX += w + 10;
        return out;
    }).join("");
    const bg = backdrop(W, H, [
        {x: 512, y: 380, r: 560, color: C.green, opacity: 0.22},
        {x: 980, y: 60, r: 320, color: C.violet, opacity: 0.18}
    ]) + `
        <rect x="${panel.x}" y="${panel.y}" width="${panel.w}" height="${panel.h}" rx="30" fill="${C.canvas}" stroke="${C.lineBright}" stroke-width="2"/>
        ${text(panel.x + panel.w / 2, panel.y + 50, "Wild Profile", {size: 20, weight: 800, anchor: "middle"})}
        <rect x="${panel.x + panel.w - 132}" y="${panel.y + 22}" width="108" height="42" rx="21" fill="#ffffff" fill-opacity="0.06" stroke="#ffffff" stroke-opacity="0.12"/>
        <circle cx="${panel.x + panel.w - 112}" cy="${panel.y + 43}" r="4" fill="${C.neon}"/>
        ${text(panel.x + panel.w - 98, panel.y + 43, "64%", {size: 15, weight: 900})}
        ${text(panel.x + panel.w - 98, panel.y + 56, "SIGNAL", {size: 8, weight: 800, fill: C.ink3, spacing: 1})}
        ${text(px, panel.y + 104, "Question 5", {size: 14, weight: 900, fill: C.ink2})}
        ${bubble(px, panel.y + 124, 470, ["A small crew over a big pack?", "That is a very wolf move."], {label: "Wild Guide"})}
        ${bubble(px + 154, panel.y + 248, 470, ["Mostly. A few people I'd do", "anything for, and that's enough."], {user: true, label: "You"})}
        ${bubble(px, panel.y + 372, 470, ["On a hard day, do you get sharper,", "quieter, or tougher under pressure?"], {label: "Wild Guide"})}
        ${chipSvg}
        <rect x="${px}" y="${panel.y + 604}" width="${panel.w - 56 - 62}" height="52" rx="14" fill="${C.surface}" stroke="${C.lineBright}"/>
        ${text(px + 18, panel.y + 636, "Type a short answer", {size: 16, weight: 500, fill: C.ink3})}
        <circle cx="${panel.x + panel.w - 54}" cy="${panel.y + 630}" r="26" fill="${C.neon}"/>
        <path d="M ${panel.x + panel.w - 54} ${panel.y + 641} L ${panel.x + panel.w - 54} ${panel.y + 619} M ${panel.x + panel.w - 64} ${panel.y + 628} L ${panel.x + panel.w - 54} ${panel.y + 618} L ${panel.x + panel.w - 44} ${panel.y + 628}" stroke="${C.canvas}" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    // A wolf peeking in on the side panel's edge ties the chat back to animals.
    await render("wild-profile-app-interface.webp", W, H, bg, [
        {slug: "gray-wolf", size: 180, x: 0, y: 540},
        {slug: "barn-owl", size: 170, x: W - 190, y: 120}
    ]);
}

/** 1024x688 — catalog shortlist, then the triad AI picks from it. */
async function results() {
    const W = 1024, H = 688;
    const shortlist = ["barn-owl", "red-fox", "grizzly-bear", "american-crow", "sea-otter", "bald-eagle"];
    const pick = [
        {role: "origin", slug: "barn-owl", name: "Barn Owl"},
        {role: "apex", slug: "grizzly-bear", name: "Grizzly Bear"},
        {role: "active", slug: "red-fox", name: "Red Fox"}
    ];
    const chipW = 128, chipGap = 16;
    const rowLeft = (W - (chipW * 6 + chipGap * 5)) / 2;
    const cardW = 276, cardH = 330, gap = 28;
    const cardLeft = (W - (cardW * 3 + gap * 2)) / 2;
    const cardTop = 300;
    const picked = new Set(pick.map((item) => item.slug));
    const bg = backdrop(W, H, [{x: 512, y: 470, r: 520, color: C.green, opacity: 0.26}]) + `
        ${text(W / 2, 56, "1  ·  CATALOG SHORTLIST", {size: 15, weight: 800, fill: C.ink2, anchor: "middle", spacing: 3})}
        ${shortlist.map((slug, index) => {
            const x = rowLeft + index * (chipW + chipGap);
            const on = picked.has(slug);
            return `<rect x="${x}" y="78" width="${chipW}" height="128" rx="18" fill="${C.surface}" fill-opacity="${on ? 0.9 : 0.45}" stroke="${on ? C.neon : C.lineBright}" stroke-opacity="${on ? 0.7 : 1}" stroke-width="2"/>`;
        }).join("")}
        <path d="M ${W / 2} 222 L ${W / 2} 252 M ${W / 2 - 9} 243 L ${W / 2} 253 L ${W / 2 + 9} 243" stroke="${C.neon}" stroke-width="3" fill="none" stroke-linecap="round"/>
        ${text(W / 2, 282, "2  ·  YOUR WILD PROFILE", {size: 15, weight: 800, fill: C.neon, anchor: "middle", spacing: 3})}
        ${pick.map((item, index) => roleCard({...item, x: cardLeft + index * (cardW + gap), y: cardTop, w: cardW, h: cardH, nameSize: 27, meaningSize: 16})).join("")}`;
    const layers = [
        ...shortlist.map((slug, index) => ({slug, size: 112, x: rowLeft + index * (chipW + chipGap) + 8, y: 86})),
        ...pick.map((item, index) => ({slug: item.slug, size: 200, x: cardLeft + index * (cardW + gap) + 38, y: cardTop + 52}))
    ];
    // Dim the animals that were not picked.
    const fg = shortlist.map((slug, index) => picked.has(slug) ? "" : `<rect x="${rowLeft + index * (chipW + chipGap)}" y="78" width="${chipW}" height="128" rx="18" fill="${C.canvas}" fill-opacity="0.55"/>`).join("");
    await render("animaldex-animal-profile-results.webp", W, H, bg, layers, fg);
}

/** 720x900 — the "get your real Wild Profile" CTA: the reveal screen. */
async function cta() {
    const W = 720, H = 900;
    const bg = backdrop(W, H, [
        {x: 360, y: 420, r: 520, color: C.green, opacity: 0.3},
        {x: 680, y: 40, r: 300, color: C.violet, opacity: 0.2}
    ]);
    const rows = HERO_TRIAD.map((item, index) => ({...item, y: 160 + index * 236}));
    const card = (row) => {
        const r = ROLES[row.role];
        return `<rect x="60" y="${row.y}" width="600" height="212" rx="26" fill="${C.surface}" fill-opacity="0.75" stroke="${r.color}" stroke-opacity="0.5" stroke-width="2"/>
            <rect x="60" y="${row.y + 30}" width="5" height="152" rx="2.5" fill="${r.color}"/>
            ${text(290, row.y + 78, r.label, {size: 18, weight: 800, fill: r.color, spacing: 4})}
            ${text(290, row.y + 122, row.name, {size: 38, weight: 800})}
            ${text(290, row.y + 158, r.meaning, {size: 20, weight: 500, fill: C.ink2})}`;
    };
    const fg = `
        ${text(W / 2, 74, "YOUR WILD PROFILE", {size: 20, weight: 800, fill: C.neon, anchor: "middle", spacing: 6})}
        ${text(W / 2, 118, "Revealed in AnimalDex", {size: 26, weight: 700, fill: C.ink2, anchor: "middle"})}`;
    await render("wild-profile-cta.webp", W, H, bg + rows.map(card).join(""), rows.map((row) => ({slug: row.slug, size: 188, x: 82, y: row.y + 12})), fg);
}

await fs.mkdir(OUT_DIR, {recursive: true});
await hero();
await heroSquare();
await identityPhone();
await interview();
await results();
await cta();
