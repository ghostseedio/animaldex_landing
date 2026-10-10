/* eslint-disable @next/next/no-img-element -- rendered by Satori into a PNG, not served as HTML */
import "server-only";

import {readFile} from "node:fs/promises";
import path from "node:path";
import satori from "satori";
import sharp from "sharp";
import {getSpeciesArtworkUrl} from "@/data/species-artwork";
import {resolveSpeciesArtworkFile} from "@/data/species-artwork-index";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** Where a tile's picture comes from: catalog artwork by slug, or a file under public/. */
export type OgTileImage = {artwork: string} | {publicPath: string};

export type OgTile = {
    image: OgTileImage;
    label?: string;
    caption?: string;
};

export type OgCardSpec = {
    kicker: string;
    title: string;
    subtitle?: string;
    /** 0–3 pictures. None renders the app icon instead. */
    tiles?: OgTile[];
    /** Drawn between two tiles, e.g. "+" for a hybrid or "→" for a Pokémon match. */
    joiner?: string;
};

const LIME = "#a3e635";
const TILE_ACCENTS = ["#a3e635", "#f59e0b", "#a78bfa"];
const PUBLIC_DIR = path.join(process.cwd(), "public");

type OgFont = {name: string; data: Buffer; weight: 400 | 500 | 700; style: "normal"};

let fontsPromise: Promise<OgFont[]> | null = null;

function loadFonts() {
    fontsPromise ??= Promise.all([
        readFile(path.join(PUBLIC_DIR, "og-fonts/Onest-Medium.woff")),
        readFile(path.join(PUBLIC_DIR, "og-fonts/Onest-Bold.woff")),
        // Glyph fallback: the Onest subset has no lowercase accents ("Pokémon").
        readFile(path.join(PUBLIC_DIR, "og-fonts/NotoSans-Regular.ttf"))
    ]).then(([medium, bold, noto]): OgFont[] => [
        {name: "Onest", data: medium, weight: 500, style: "normal"},
        {name: "Onest", data: bold, weight: 700, style: "normal"},
        {name: "Noto Sans", data: noto, weight: 400, style: "normal"}
    ]).catch((error) => {
        fontsPromise = null;
        throw error;
    });
    return fontsPromise;
}

/** Satori cannot decode WebP, so every picture is re-encoded as a PNG data URI. */
async function toPngDataUri(input: Buffer, size: number) {
    const png = await sharp(input, {failOn: "none"})
        .resize({width: size, height: size, fit: "contain", background: {r: 0, g: 0, b: 0, alpha: 0}, kernel: "lanczos3"})
        .png()
        .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
}

async function loadTileImage(image: OgTileImage, size: number): Promise<string | null> {
    try {
        if ("publicPath" in image) {
            const resolved = path.join(PUBLIC_DIR, image.publicPath.replace(/^\/+/, ""));
            if (!resolved.startsWith(PUBLIC_DIR)) return null;
            return await toPngDataUri(await readFile(resolved), size);
        }
        const file = await resolveSpeciesArtworkFile(image.artwork);
        if (!file) return null;
        const response = await fetch(getSpeciesArtworkUrl(image.artwork, file), {next: {revalidate: 86400}});
        if (!response.ok) return null;
        return await toPngDataUri(Buffer.from(await response.arrayBuffer()), size);
    } catch {
        return null;
    }
}

function titleSize(title: string, wide: boolean) {
    const length = title.length;
    // Wide titles sit above the tile row, so they shrink to stay on one line where they can.
    if (wide) return length > 44 ? 44 : length > 34 ? 52 : 62;
    return length > 70 ? 46 : length > 48 ? 54 : length > 30 ? 62 : 70;
}

function Background({children}: {children: React.ReactNode}) {
    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                position: "relative",
                fontFamily: "Onest, Noto Sans",
                color: "#ffffff",
                background: "linear-gradient(135deg, #07170c 0%, #0b2414 45%, #101418 100%)"
            }}
        >
            <div
                style={{
                    position: "absolute",
                    top: -220,
                    right: -160,
                    width: 640,
                    height: 640,
                    borderRadius: 640,
                    background: "radial-gradient(circle, rgba(34,197,94,0.28) 0%, rgba(34,197,94,0) 70%)"
                }}
            />
            {children}
        </div>
    );
}

function Brand({icon}: {icon: string | null}) {
    return (
        <div style={{display: "flex", alignItems: "center", gap: 14}}>
            {icon ? <img alt="" src={icon} width={40} height={40} style={{borderRadius: 10}} /> : null}
            <div style={{display: "flex", fontSize: 26, fontWeight: 700, color: "#e5e7eb"}}>AnimalDex</div>
            <div style={{display: "flex", fontSize: 22, fontWeight: 500, color: "#6b7280"}}>animaldex.app</div>
        </div>
    );
}

function Kicker({text}: {text: string}) {
    return (
        <div style={{display: "flex", fontSize: 24, fontWeight: 700, letterSpacing: 5, color: LIME, textTransform: "uppercase"}}>
            {text}
        </div>
    );
}

/** Text on the left, one large picture (or the app icon) on the right. */
function SplitCard({spec, picture, icon, isIcon}: {spec: OgCardSpec; picture: string | null; icon: string | null; isIcon: boolean}) {
    const tile = spec.tiles?.[0];
    return (
        <Background>
            <div style={{display: "flex", flex: 1, padding: "64px 72px 56px", gap: 48}}>
                <div style={{display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between"}}>
                    <div style={{display: "flex", flexDirection: "column", gap: 22}}>
                        <Kicker text={spec.kicker} />
                        <div style={{display: "flex", fontSize: titleSize(spec.title, false), fontWeight: 700, lineHeight: 1.08, letterSpacing: -1}}>
                            {spec.title}
                        </div>
                        {spec.subtitle ? (
                            <div style={{display: "flex", fontSize: 28, fontWeight: 500, lineHeight: 1.3, color: "#cbd5e1"}}>
                                {spec.subtitle}
                            </div>
                        ) : null}
                    </div>
                    <Brand icon={icon} />
                </div>
                {picture ? (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            alignSelf: "center",
                            width: 420,
                            height: 460,
                            borderRadius: 28,
                            border: isIcon ? "none" : "2px solid rgba(163,230,53,0.55)",
                            background: isIcon ? "transparent" : "rgba(10,40,20,0.85)",
                            gap: 10
                        }}
                    >
                        <img alt="" src={picture} width={isIcon ? 300 : 360} height={isIcon ? 300 : 360} style={{borderRadius: isIcon ? 64 : 0}} />
                        {tile?.label ? (
                            <div style={{display: "flex", fontSize: 28, fontWeight: 700, color: "#f8fafc"}}>{tile.label}</div>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </Background>
    );
}

/** Kicker and title across the top, two or three labelled pictures below. */
function TileRowCard({spec, pictures, icon}: {spec: OgCardSpec; pictures: Array<{tile: OgTile; src: string}>; icon: string | null}) {
    const tileWidth = pictures.length === 2 ? 340 : 310;
    const imageSize = pictures.length === 2 ? 210 : 196;
    return (
        <Background>
            <div style={{display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", flex: 1, padding: "40px 60px 32px"}}>
                <div style={{display: "flex", flexDirection: "column", alignItems: "center"}}>
                    <Kicker text={spec.kicker} />
                    <div
                        style={{
                            display: "flex",
                            marginTop: 12,
                            fontSize: titleSize(spec.title, true),
                            fontWeight: 700,
                            lineHeight: 1.08,
                            letterSpacing: -1,
                            textAlign: "center",
                            maxWidth: 1060
                        }}
                    >
                        {spec.title}
                    </div>
                </div>
                <div style={{display: "flex", alignItems: "center", gap: 28}}>
                    {pictures.map(({tile, src}, index) => (
                        <div key={index} style={{display: "flex", alignItems: "center", gap: 28}}>
                            {index > 0 && spec.joiner ? (
                                <div style={{display: "flex", fontSize: 64, fontWeight: 700, color: LIME}}>{spec.joiner}</div>
                            ) : null}
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    width: tileWidth,
                                    height: 300,
                                    paddingTop: 14,
                                    borderRadius: 22,
                                    border: `2px solid ${TILE_ACCENTS[index % TILE_ACCENTS.length]}99`,
                                    borderTop: `6px solid ${TILE_ACCENTS[index % TILE_ACCENTS.length]}`,
                                    background: "rgba(10,40,20,0.85)"
                                }}
                            >
                                {tile.caption ? (
                                    <div style={{display: "flex", fontSize: 18, fontWeight: 700, letterSpacing: 3, color: TILE_ACCENTS[index % TILE_ACCENTS.length], textTransform: "uppercase"}}>
                                        {tile.caption}
                                    </div>
                                ) : null}
                                <img alt="" src={src} width={imageSize} height={imageSize} style={{marginTop: tile.caption ? 6 : 16}} />
                                {tile.label ? (
                                    <div style={{display: "flex", marginTop: 8, fontSize: tile.label.length > 16 ? 22 : 28, lineHeight: 1.15, fontWeight: 700, textAlign: "center", padding: "0 12px"}}>
                                        {tile.label}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    ))}
                </div>
                <Brand icon={icon} />
            </div>
        </Background>
    );
}

const CACHE_CONTROL = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000";
const PARTIAL_CACHE_CONTROL = "public, max-age=3600, s-maxage=3600";

export async function renderOgCard(spec: OgCardSpec) {
    const tiles = (spec.tiles ?? []).slice(0, 3);
    const many = tiles.length >= 2;
    const [fonts, icon, ...loaded] = await Promise.all([
        loadFonts(),
        loadTileImage({publicPath: "/images/logo.webp"}, 120),
        ...tiles.map((tile) => loadTileImage(tile.image, many ? 460 : 720))
    ]);
    const pictures = tiles
        .map((tile, index) => ({tile, src: loaded[index]}))
        .filter((item): item is {tile: OgTile; src: string} => Boolean(item.src));

    let element: React.ReactElement;
    if (pictures.length >= 2) {
        element = <TileRowCard spec={spec} pictures={pictures} icon={icon} />;
    } else if (pictures.length === 1) {
        element = <SplitCard spec={{...spec, tiles: [pictures[0].tile]}} picture={pictures[0].src} icon={icon} isIcon={false} />;
    } else {
        const largeIcon = await loadTileImage({publicPath: "/images/logo.webp"}, 600);
        element = <SplitCard spec={{...spec, tiles: []}} picture={largeIcon} icon={icon} isIcon />;
    }

    // A tile that failed to load may be a transient storage error, so don't pin that card for a week.
    const cacheControl = pictures.length < tiles.length ? PARTIAL_CACHE_CONTROL : CACHE_CONTROL;
    // Not next/server's ImageResponse: the @vercel/og copy bundled with Next 13.4
    // can't load its own default font on Node 22 (ENOTDIR), so lay out with
    // Satori (text becomes paths) and rasterise the SVG with sharp.
    const svg = await satori(element, {width: OG_WIDTH, height: OG_HEIGHT, fonts});
    const png = await sharp(Buffer.from(svg)).png({compressionLevel: 9}).toBuffer();
    return new Response(new Uint8Array(png), {
        headers: {"Content-Type": "image/png", "Cache-Control": cacheControl, "CDN-Cache-Control": cacheControl}
    });
}
