import {readFile} from "node:fs/promises";
import path from "node:path";
import {NextResponse} from "next/server";
import {talkingModelSlug} from "@/lib/talking-models/catalog";

/**
 * Development only: a local talking-models build served in the bucket's own
 * layout, so the call can be built and tried before the GLBs are uploaded.
 *
 * `TALKING_MODELS_DEV_DIR` is the build folder (`~/animaldex-talking-models`:
 * `assets/<slug>.glb|.talking.jpg|.talking.json`, `published.json`,
 * `species.json`, `habitats.json`, `backgrounds/<name>.jpg`), and
 * `NEXT_PUBLIC_TALKING_MODELS_URL=/api/dev/talking-models/v1` points the
 * client here. The manifest names the glTF format, as `publish_models.py`
 * will once the GLBs are up, and its aliases are built the way that script
 * builds them. In production this route answers 404 whatever is set.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9][a-z0-9-]{0,120}$/;
const SCENE = /^[a-z_]{2,40}$/;
const VERSION = /^[A-Za-z0-9_-]{1,40}$/;

function notFound() {
    return new NextResponse("Not found", {status: 404});
}

async function readJson(file: string): Promise<unknown> {
    return JSON.parse(await readFile(file, "utf8"));
}

async function file(at: string, contentType: string) {
    try {
        const body = await readFile(at);
        return new NextResponse(body, {headers: {"Content-Type": contentType, "Cache-Control": "no-store"}});
    } catch {
        return notFound();
    }
}

function json(body: unknown) {
    return NextResponse.json(body, {headers: {"Cache-Control": "no-store"}});
}

export async function GET(_request: Request, {params}: {params: {path: string[]}}) {
    const root = process.env.TALKING_MODELS_DEV_DIR?.trim();
    if (process.env.NODE_ENV === "production" || !root) return notFound();
    const parts = params.path ?? [];
    if (parts[0] !== "v1") return notFound();
    const assets = path.join(root, "assets");

    if (parts.length === 2 && parts[1] === "manifest.json") {
        const models = await readJson(path.join(root, "published.json")).catch(() => ({})) as Record<string, string>;
        const species = await readJson(path.join(root, "species.json")).catch(() => []) as Array<{slug: string; key?: string; name?: string; aliases?: string[]}>;
        const aliases: Record<string, string> = {};
        for (const animal of species) {
            for (const name of [animal.key, animal.name, ...(animal.aliases ?? [])]) {
                const alias = talkingModelSlug(name ?? "");
                if (models[animal.slug] && alias && alias !== animal.slug && !models[alias] && !aliases[alias]) aliases[alias] = animal.slug;
            }
        }
        return json({version: 1, models, aliases, glb: "g1"});
    }

    if (parts.length === 2 && parts[1] === "habitats.json") {
        const animals = await readJson(path.join(root, "habitats.json")).catch(() => ({})) as Record<string, string>;
        const backgrounds: Record<string, string> = {};
        for (const scene of Array.from(new Set(Object.values(animals)))) {
            if (SCENE.test(scene)) backgrounds[scene] = "local";
        }
        return json({version: 1, backgrounds, animals});
    }

    if (parts.length === 4 && parts[1] === "backgrounds" && SCENE.test(parts[2]) && parts[3].endsWith(".jpg")) {
        return file(path.join(root, "backgrounds", `${parts[2]}.jpg`), "image/jpeg");
    }

    if (parts.length === 3 && SLUG.test(parts[1])) {
        const slug = parts[1];
        const [version, ...extension] = parts[2].split(".");
        if (!VERSION.test(version)) return notFound();
        switch (extension.join(".")) {
            case "g1.glb":
                return file(path.join(assets, `${slug}.glb`), "model/gltf-binary");
            case "jpg":
                return file(path.join(assets, `${slug}.talking.jpg`), "image/jpeg");
            case "json":
                return file(path.join(assets, `${slug}.talking.json`), "application/json");
        }
    }
    return notFound();
}
