/* eslint-disable @next/next/no-img-element -- rendered by Satori into a JPEG, not served as HTML */
import "server-only";

import {readFile} from "node:fs/promises";
import path from "node:path";
import satori from "satori";
import sharp from "sharp";
import type {Slide} from "@/lib/social-content/types";

// Carousel slides as JPEGs, drawn with Satori in the house video style:
// Barlow Condensed ExtraBold headlines in capitals, the punchline word in
// AnimalDex lime, photos full-bleed under a dark gradient. Picture first: a
// photo fills every slide that has one, the words sit low and short, and a
// words-only slide sits on a blurred photo rather than flat black. Three sizes:
//   feed 1080×1350 (4:5)  Instagram, Facebook, Threads, X, Bluesky
//   tall 1080×1920 (9:16) TikTok photo mode, text kept out of its side and bottom UI
//   pin  1000×1500 (2:3)  the Pinterest cover

export type SlideSize = "feed" | "tall" | "pin";
export const SLIDE_SIZES: Record<SlideSize, {width: number; height: number}> = {
    feed: {width: 1080, height: 1350},
    tall: {width: 1080, height: 1920},
    pin: {width: 1000, height: 1500}
};

const LIME = "#A7F432";
const INK = "#0E0F0E";
const PUBLIC_DIR = path.join(process.cwd(), "public");

type Font = {name: string; data: Buffer; weight: 400 | 500 | 600 | 700 | 800; style: "normal"};
let fontsPromise: Promise<Font[]> | null = null;

function loadFonts() {
    fontsPromise ??= Promise.all([
        readFile(path.join(PUBLIC_DIR, "video-fonts/BarlowCondensed-ExtraBold.ttf")),
        readFile(path.join(PUBLIC_DIR, "video-fonts/BarlowCondensed-SemiBold.ttf")),
        readFile(path.join(PUBLIC_DIR, "og-fonts/Onest-Medium.woff")),
        readFile(path.join(PUBLIC_DIR, "og-fonts/Onest-Bold.woff")),
        readFile(path.join(PUBLIC_DIR, "og-fonts/NotoSans-Regular.ttf"))
    ]).then(([extraBold, semiBold, medium, bold, noto]): Font[] => [
        {name: "Barlow", data: extraBold, weight: 800, style: "normal"},
        {name: "Barlow", data: semiBold, weight: 600, style: "normal"},
        {name: "Onest", data: medium, weight: 500, style: "normal"},
        {name: "Onest", data: bold, weight: 700, style: "normal"},
        {name: "Noto Sans", data: noto, weight: 400, style: "normal"}
    ]).catch((error) => {
        fontsPromise = null;
        throw error;
    });
    return fontsPromise;
}

let logoPromise: Promise<string> | null = null;
function loadLogo() {
    logoPromise ??= readFile(path.join(PUBLIC_DIR, "images/animaldex-logo-text.webp"))
        .then((bytes) => sharp(bytes).resize({width: 360}).png().toBuffer())
        .then((png) => `data:image/png;base64,${png.toString("base64")}`);
    return logoPromise;
}

/** A photo, or a cut-out (species artwork on transparency) that must not be cropped full-bleed. */
export type Picture = {bytes: Buffer; cutout: boolean};

export async function pictureFromBytes(bytes: Buffer): Promise<Picture | null> {
    try {
        const meta = await sharp(bytes).metadata();
        let cutout = false;
        if (meta.hasAlpha) {
            const stats = await sharp(bytes).ensureAlpha().extractChannel(3).stats();
            cutout = (stats.channels[0]?.min ?? 255) < 16;
        }
        return {bytes, cutout};
    } catch {
        return null;
    }
}

async function fitted(picture: Picture, width: number, height: number) {
    const image = sharp(picture.bytes).rotate();
    const out = picture.cutout
        ? await image.resize(width, height, {fit: "contain", background: {r: 0, g: 0, b: 0, alpha: 0}}).png().toBuffer()
        : await image.resize(width, height, {fit: "cover", position: sharp.strategy.attention}).jpeg({quality: 86}).toBuffer();
    return `data:image/${picture.cutout ? "png" : "jpeg"};base64,${out.toString("base64")}`;
}

async function blurred(picture: Picture, width: number, height: number) {
    const out = await sharp(picture.bytes).rotate().flatten({background: INK}).resize(width, height, {fit: "cover"}).blur(30).modulate({brightness: 0.45}).jpeg({quality: 80}).toBuffer();
    return `data:image/jpeg;base64,${out.toString("base64")}`;
}

/** Headline words, the last one in lime (the punchline lands visually, as in the videos). */
function Headline({text, size, align = "left"}: {text: string; size: number; align?: "left" | "center"}) {
    const words = text.toUpperCase().split(/\s+/).filter(Boolean);
    return (
        <div style={{display: "flex", flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start", fontFamily: "Barlow", fontWeight: 800, fontSize: size, lineHeight: 0.98, color: "#ffffff", letterSpacing: -0.5}}>
            {words.map((word, index) => (
                <span key={index} style={{color: index === words.length - 1 && words.length > 1 ? LIME : "#ffffff", marginRight: index === words.length - 1 ? 0 : size * 0.22}}>{word}</span>
            ))}
        </div>
    );
}

function Kicker({text}: {text: string}) {
    if (!text) return null;
    return (
        <div style={{display: "flex", alignSelf: "flex-start", background: LIME, color: INK, fontFamily: "Barlow", fontWeight: 800, fontSize: 36, padding: "6px 18px", letterSpacing: 1}}>
            {text.toUpperCase()}
        </div>
    );
}

function Stat({stat, size = 64}: {stat: Slide["stat"]; size?: number}) {
    if (!stat) return null;
    return (
        <div style={{display: "flex", flexDirection: "column", alignSelf: "flex-start", background: "rgba(14,15,14,0.72)", border: `4px solid ${LIME}`, padding: "10px 22px", marginTop: 8}}>
            <div style={{display: "flex", fontFamily: "Barlow", fontWeight: 600, fontSize: 28, color: "#c8ccc8", letterSpacing: 2}}>{stat.label.toUpperCase()}</div>
            <div style={{display: "flex", fontFamily: "Barlow", fontWeight: 800, fontSize: stat.value.length > 14 ? Math.round(size * 0.75) : size, color: "#ffffff", lineHeight: 1}}>{stat.value.toUpperCase()}</div>
        </div>
    );
}

/** A countdown's "#3" as a big lime number; any other kicker as the label pill. */
function Rank({kicker}: {kicker: string}) {
    return /^#\d+$/.test(kicker.trim())
        ? <div style={{display: "flex", fontFamily: "Barlow", fontWeight: 800, fontSize: 150, color: LIME, lineHeight: 0.9}}>{kicker.trim()}</div>
        : <Kicker text={kicker} />;
}

function headlineSize(text: string, base: number) {
    const length = text.length;
    return length > 48 ? Math.round(base * 0.68) : length > 34 ? Math.round(base * 0.8) : length > 22 ? Math.round(base * 0.9) : base;
}

type Frame = {width: number; height: number; safeBottom: number; safeRight: number; logo: string; counter: string | null};

function Chrome({frame, children, background}: {frame: Frame; children: React.ReactNode; background: React.ReactNode}) {
    return (
        <div style={{width: frame.width, height: frame.height, display: "flex", position: "relative", background: INK, fontFamily: "Onest, Noto Sans", color: "#ffffff"}}>
            {background}
            <div style={{position: "absolute", top: 44, left: 0, right: 0, display: "flex", justifyContent: "center"}}>
                <img alt="" src={frame.logo} width={250} height={52} style={{objectFit: "contain", opacity: 0.92}} />
            </div>
            {frame.counter ? (
                <div style={{position: "absolute", top: 50, right: 48, display: "flex", fontFamily: "Barlow", fontWeight: 600, fontSize: 32, color: "rgba(255,255,255,0.75)"}}>{frame.counter}</div>
            ) : null}
            {children}
        </div>
    );
}

function Body({text, size = 40}: {text: string; size?: number}) {
    if (!text) return null;
    return <div style={{display: "flex", fontSize: size, fontWeight: 500, lineHeight: 1.3, color: "rgba(255,255,255,0.9)"}}>{text}</div>;
}

async function slideElement(slide: Slide, picture: Picture | null, frame: Frame) {
    const {width, height} = frame;
    const pad = 72;
    const bottom = frame.safeBottom + 64;
    const right = pad + frame.safeRight;

    if (slide.layout === "cover") {
        const art = picture
            ? picture.cutout
                ? (
                    <div style={{position: "absolute", top: 0, left: 0, width, height, display: "flex", alignItems: "flex-start", justifyContent: "center", background: "radial-gradient(circle at 50% 35%, #24451f 0%, #0E0F0E 70%)", paddingTop: 140}}>
                        <img alt="" src={await fitted(picture, width - 120, Math.round(height * 0.5))} width={width - 120} height={Math.round(height * 0.5)} />
                    </div>
                )
                : <img alt="" src={await fitted(picture, width, height)} width={width} height={height} style={{position: "absolute", top: 0, left: 0}} />
            : null;
        return (
            <Chrome frame={frame} background={(
                <div style={{position: "absolute", top: 0, left: 0, width, height, display: "flex"}}>
                    {art}
                    <div style={{position: "absolute", top: 0, left: 0, width, height, display: "flex", background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0.25) 48%, rgba(0,0,0,0.9) 78%, rgba(0,0,0,0.96) 100%)"}} />
                </div>
            )}>
                <div style={{position: "absolute", left: pad, right, bottom, display: "flex", flexDirection: "column", gap: 22}}>
                    <Kicker text={slide.kicker} />
                    <Headline text={slide.title} size={headlineSize(slide.title, 128)} />
                    <Body text={slide.body} size={42} />
                    <div style={{display: "flex", fontFamily: "Barlow", fontWeight: 800, fontSize: 38, color: LIME, marginTop: 6}}>SWIPE →</div>
                </div>
            </Chrome>
        );
    }

    if (slide.layout === "item" && picture && !picture.cutout) {
        return (
            <Chrome frame={frame} background={(
                <div style={{position: "absolute", top: 0, left: 0, width, height, display: "flex"}}>
                    <img alt="" src={await fitted(picture, width, height)} width={width} height={height} style={{position: "absolute", top: 0, left: 0}} />
                    <div style={{position: "absolute", top: 0, left: 0, width, height, display: "flex", background: "linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 18%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.82) 76%, rgba(0,0,0,0.94) 100%)"}} />
                </div>
            )}>
                <div style={{position: "absolute", left: pad, right, bottom, display: "flex", flexDirection: "column", gap: 16}}>
                    <Rank kicker={slide.kicker} />
                    <Headline text={slide.title} size={headlineSize(slide.title, 112)} />
                    <Body text={slide.body} size={40} />
                    <Stat stat={slide.stat} size={84} />
                </div>
            </Chrome>
        );
    }

    if (slide.layout === "item" && picture) {
        const photoHeight = Math.round(height * (frame.safeBottom ? 0.56 : 0.62));
        return (
            <Chrome frame={frame} background={(
                <div style={{position: "absolute", top: 0, left: 0, width, height, display: "flex", flexDirection: "column"}}>
                    <div style={{display: "flex", width, height: photoHeight, position: "relative", background: picture.cutout ? "radial-gradient(circle at 50% 55%, #24451f 0%, #0E0F0E 72%)" : INK, alignItems: "center", justifyContent: "center"}}>
                        <img alt="" src={await fitted(picture, picture.cutout ? width - 160 : width, picture.cutout ? photoHeight - 140 : photoHeight)} width={picture.cutout ? width - 160 : width} height={picture.cutout ? photoHeight - 140 : photoHeight} style={picture.cutout ? {marginTop: 70} : {}} />
                        <div style={{position: "absolute", left: 0, right: 0, bottom: 0, height: 220, display: "flex", background: "linear-gradient(180deg, rgba(14,15,14,0) 0%, rgba(14,15,14,1) 100%)"}} />
                    </div>
                </div>
            )}>
                <div style={{position: "absolute", left: pad, right, top: photoHeight - 70, display: "flex", flexDirection: "column", gap: 18}}>
                    <Rank kicker={slide.kicker} />
                    <Headline text={slide.title} size={headlineSize(slide.title, 96)} />
                    <Body text={slide.body} size={38} />
                    <Stat stat={slide.stat} />
                </div>
            </Chrome>
        );
    }

    // "text", "cta", and an "item" whose photo could not be loaded: a photo, when given, is the blurred backdrop.
    const backdrop = picture && !picture.cutout ? await blurred(picture, width, height) : null;
    const center = slide.layout === "cta";
    return (
        <Chrome frame={frame} background={(
            <div style={{position: "absolute", top: 0, left: 0, width, height, display: "flex", background: "radial-gradient(circle at 80% 10%, rgba(167,244,50,0.22) 0%, rgba(14,15,14,0) 45%), radial-gradient(circle at 10% 95%, rgba(167,244,50,0.14) 0%, rgba(14,15,14,0) 40%)"}}>
                {backdrop ? <img alt="" src={backdrop} width={width} height={height} style={{position: "absolute", top: 0, left: 0}} /> : null}
            </div>
        )}>
            <div style={{position: "absolute", left: pad, right, top: 0, bottom, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: center ? "center" : "flex-start", gap: 28}}>
                {center ? <div style={{display: "flex", alignSelf: "center"}}><Kicker text={slide.kicker} /></div> : <Rank kicker={slide.kicker} />}
                <Headline text={slide.title} size={headlineSize(slide.title, center ? 120 : 110)} align={center ? "center" : "left"} />
                {center
                    ? <div style={{display: "flex", textAlign: "center", fontSize: 42, fontWeight: 500, lineHeight: 1.3, color: "rgba(255,255,255,0.9)"}}>{slide.body}</div>
                    : <Body text={slide.body} size={44} />}
                <Stat stat={slide.stat} />
                {center ? <div style={{display: "flex", marginTop: 20, fontFamily: "Barlow", fontWeight: 800, fontSize: 46, color: LIME}}>ANIMALDEX.APP</div> : null}
            </div>
        </Chrome>
    );
}

/** One slide as a JPEG. On a "text" or "cta" slide, `picture` is the blurred backdrop. */
export async function renderSlide(slide: Slide, picture: Picture | null, size: SlideSize, position: {index: number; total: number}) {
    const {width, height} = SLIDE_SIZES[size];
    const frame: Frame = {
        width,
        height,
        // TikTok's caption, buttons and progress bar cover the bottom and the right edge.
        safeBottom: size === "tall" ? 300 : 0,
        safeRight: size === "tall" ? 110 : 0,
        logo: await loadLogo(),
        counter: size === "pin" || position.index === 0 ? null : `${position.index + 1}/${position.total}`
    };
    const svg = await satori(await slideElement(slide, picture, frame), {width, height, fonts: await loadFonts()});
    return sharp(Buffer.from(svg)).jpeg({quality: 86, mozjpeg: true}).toBuffer();
}
