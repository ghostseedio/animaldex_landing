import {readFile} from "node:fs/promises";
import path from "node:path";
import React from "react";
import satori from "satori";
import sharp from "sharp";
import {ARK_END_URL, CLIP_HEIGHT, CLIP_WIDTH, placeCues, type ArkCue, type ArkMarks, type ArkShotPlan} from "@/lib/ark-clips/shots";

/**
 * An Ark clip's words as full-frame transparent PNGs (Satori + sharp, the
 * carousels' renderer), one per caption, laid over the recording by ffmpeg
 * with a short fade. Drawn here rather than with libass so the recorder runs
 * on any ffmpeg (Homebrew's has no libass or freetype).
 *
 * The page videos' house look: Barlow Condensed, white with a dark shadow,
 * the hook's last word and the labels in AnimalDex lime. Words stay out of
 * the bottom fifth (TikTok and Reels captions) and the right edge (buttons).
 */

const LIME = "#A7F432";
const INK = "#0E0F0E";
const SHADOW = "0 4px 0 rgba(0,0,0,0.55), 0 0 26px rgba(0,0,0,0.6)";
const PUBLIC_DIR = path.join(process.cwd(), "public");

/** Where the caption block's foot sits (px from the top): above the bottom fifth. */
export const CAPTION_FOOT = 1360;

type Font = {name: string; data: Buffer; weight: 600 | 800; style: "normal"};
let fontsPromise: Promise<Font[]> | null = null;

function loadFonts() {
    fontsPromise ??= Promise.all([
        readFile(path.join(PUBLIC_DIR, "video-fonts/BarlowCondensed-ExtraBold.ttf")),
        readFile(path.join(PUBLIC_DIR, "video-fonts/BarlowCondensed-SemiBold.ttf"))
    ]).then(([extraBold, semiBold]): Font[] => [
        {name: "Barlow", data: extraBold, weight: 800, style: "normal"},
        {name: "Barlow", data: semiBold, weight: 600, style: "normal"}
    ]).catch((error) => {
        fontsPromise = null;
        throw error;
    });
    return fontsPromise;
}

export type ArkOverlay = {kind: ArkCue["kind"]; label: string | null; text: string; start: number; stop: number};

/** The cues placed in time, as the overlays draw them. Pure. */
export function arkOverlays(plan: ArkShotPlan, marks: ArkMarks): ArkOverlay[] {
    return placeCues(plan.cues, marks).map((cue) => ({kind: cue.kind, label: cue.label ?? null, text: cue.text, start: cue.start, stop: cue.stop}));
}

/** Hook size: as big as fits three short lines. */
export function hookSize(text: string): number {
    const longest = Math.max(...text.split(/\s+/).map((word) => word.length), 1);
    if (text.length <= 18 && longest <= 9) return 132;
    if (text.length <= 30) return 116;
    return 100;
}

function Hook({text}: {text: string}) {
    const words = text.toUpperCase().split(/\s+/).filter(Boolean);
    const size = hookSize(text);
    return (
        <div style={{position: "absolute", top: 300, left: 80, right: 80, display: "flex", flexWrap: "wrap", justifyContent: "center", fontFamily: "Barlow", fontWeight: 800, fontSize: size, lineHeight: 1.0, textAlign: "center", textShadow: SHADOW, letterSpacing: -0.5}}>
            {words.map((word, index) => (
                <span key={index} style={{color: index === words.length - 1 && words.length > 1 ? LIME : "#ffffff", marginRight: index === words.length - 1 ? 0 : size * 0.22}}>{word}</span>
            ))}
        </div>
    );
}

function Caption({label, text}: {label: string | null; text: string}) {
    const size = text.length > 90 ? 64 : text.length > 56 ? 70 : 78;
    return (
        <div style={{position: "absolute", left: 90, right: 90, top: 0, height: CAPTION_FOOT, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center"}}>
            {label ? (
                <div style={{display: "flex", background: LIME, color: INK, fontFamily: "Barlow", fontWeight: 800, fontSize: 40, padding: "4px 18px", letterSpacing: 2, marginBottom: 18}}>{label.toUpperCase()}</div>
            ) : null}
            <div style={{display: "flex", textAlign: "center", justifyContent: "center", fontFamily: "Barlow", fontWeight: 800, fontSize: size, lineHeight: 1.08, color: "#ffffff", textShadow: SHADOW}}>{text}</div>
        </div>
    );
}

function EndCard({title}: {title: string}) {
    return (
        <div style={{position: "absolute", top: 0, left: 0, width: CLIP_WIDTH, height: CLIP_HEIGHT, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingBottom: 200}}>
            <div style={{display: "flex", fontFamily: "Barlow", fontWeight: 800, fontSize: 168, letterSpacing: 8, color: "#ffffff", textShadow: SHADOW}}>{title}</div>
            <div style={{display: "flex", marginTop: 34, background: LIME, color: INK, fontFamily: "Barlow", fontWeight: 800, fontSize: 64, padding: "8px 30px"}}>{ARK_END_URL}</div>
        </div>
    );
}

/** One overlay as a 1080×1920 transparent PNG. */
export async function renderArkOverlay(overlay: ArkOverlay): Promise<Buffer> {
    const element = (
        <div style={{width: CLIP_WIDTH, height: CLIP_HEIGHT, display: "flex", position: "relative"}}>
            {overlay.kind === "hook" ? <Hook text={overlay.text} /> : overlay.kind === "end" ? <EndCard title={overlay.text} /> : <Caption label={overlay.label} text={overlay.text} />}
        </div>
    );
    const svg = await satori(element, {width: CLIP_WIDTH, height: CLIP_HEIGHT, fonts: await loadFonts()});
    return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * The ffmpeg filter that lays the overlays (inputs `firstInput`…) over
 * `[base]`, each fading in and out over its own seconds, ending in `[out]`.
 */
export function overlayFilter(overlays: ArkOverlay[], firstInput: number, base = "base", out = "out"): string[] {
    if (!overlays.length) return [`[${base}]null[${out}]`];
    const fade = 0.18;
    const lines: string[] = [];
    let current = base;
    overlays.forEach((overlay, index) => {
        const input = firstInput + index;
        const end = Math.max(overlay.stop - fade, overlay.start);
        lines.push(`[${input}:v]format=rgba,fade=t=in:st=${overlay.start.toFixed(2)}:d=${fade}:alpha=1,fade=t=out:st=${end.toFixed(2)}:d=${fade}:alpha=1[o${index}]`);
        const next = index === overlays.length - 1 ? out : `v${index}`;
        lines.push(`[${current}][o${index}]overlay=0:0:enable='between(t,${overlay.start.toFixed(2)},${overlay.stop.toFixed(2)})'[${next}]`);
        current = next;
    });
    return lines;
}
