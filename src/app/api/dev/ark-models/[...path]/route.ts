import {readdir, readFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {NextResponse} from "next/server";

/**
 * Development only: the local "ark" model set served in the bucket's own
 * layout (Ark v1 contract, sections 3 and 5), so /ark can be built and tried
 * before anything is published. Follows `api/dev/talking-models`.
 *
 * The build folder is `TALKING_MODELS_DEV_DIR`, or `~/animaldex-talking-models`:
 *
 *   v1/ark/manifest.json                    ark/manifest.json, plus `fallback`: every
 *                                           species with only its full talking model
 *   v1/ark/<slug>/<version>.near.glb        ark/<slug>/near.glb   (also .far.glb, .ark.json)
 *   v1/ark/<slug>/g1.glb | g1.jpg | g1.json assets/<slug>.glb | .talking.jpg | .talking.json
 *   ark-rig/v1/manifest.json                rig/publish/manifest.json  (publish_rig.py's local build:
 *   ark-rig/v1/<slug>/<version>.rig.glb     rig/publish/<slug>/<version>.rig.glb   the exact bytes it uploads;
 *   ark-rig/vN/…                            rig/publish-vN/…                        a later set, --version vN)
 *
 * The fallback keeps the scene usable while the ark set is still being
 * built: those species load the full model at both levels of detail. In
 * production this route answers 404 whatever is set.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9][a-z0-9-]{0,120}$/;
const VERSION = /^[A-Za-z0-9_-]{1,40}$/;

function notFound() {
    return new NextResponse("Not found", {status: 404});
}

async function file(at: string, contentType: string) {
    try {
        const body = await readFile(at);
        return new NextResponse(body, {headers: {"Content-Type": contentType, "Cache-Control": "no-store"}});
    } catch {
        return notFound();
    }
}

export async function GET(_request: Request, {params}: {params: {path: string[]}}) {
    if (process.env.NODE_ENV === "production") return notFound();
    const root = process.env.TALKING_MODELS_DEV_DIR?.trim() || path.join(os.homedir(), "animaldex-talking-models");
    const parts = params.path ?? [];
    if (parts[0] === "ark-rig" && /^v[0-9]{1,3}$/.test(parts[1] ?? "")) {
        // v1 from rig/publish, a later set from rig/publish-<version> (`publish_rig.py --version`).
        const publish = path.join(root, "rig", parts[1] === "v1" ? "publish" : `publish-${parts[1]}`);
        if (parts.length === 3 && parts[2] === "manifest.json") return file(path.join(publish, "manifest.json"), "application/json");
        const rig = parts.length === 4 && SLUG.test(parts[2]) ? /^([0-9a-f]{12})\.rig\.glb$/.exec(parts[3]) : null;
        return rig ? file(path.join(publish, parts[2], `${rig[1]}.rig.glb`), "model/gltf-binary") : notFound();
    }
    if (parts[0] !== "v1" || parts[1] !== "ark") return notFound();
    const ark = path.join(root, "ark");
    const assets = path.join(root, "assets");

    if (parts.length === 3 && parts[2] === "manifest.json") {
        const manifest = await readFile(path.join(ark, "manifest.json"), "utf8")
            .then((raw) => JSON.parse(raw) as {models?: Record<string, string>})
            .catch(() => ({models: {}} as {models?: Record<string, string>}));
        const models = manifest.models ?? {};
        const fallback: Record<string, string> = {};
        for (const name of await readdir(assets).catch(() => [] as string[])) {
            const slug = name.endsWith(".glb") ? name.slice(0, -4) : null;
            if (slug && SLUG.test(slug) && !models[slug]) fallback[slug] = "g1";
        }
        return NextResponse.json({...manifest, models, fallback}, {headers: {"Cache-Control": "no-store"}});
    }

    if (parts.length === 4 && SLUG.test(parts[2])) {
        const slug = parts[2];
        switch (parts[3]) {
            case "g1.glb":
                return file(path.join(assets, `${slug}.glb`), "model/gltf-binary");
            case "g1.jpg":
                return file(path.join(assets, `${slug}.talking.jpg`), "image/jpeg");
            case "g1.json":
                return file(path.join(assets, `${slug}.talking.json`), "application/json");
        }
        const [version, ...extension] = parts[3].split(".");
        if (!VERSION.test(version)) return notFound();
        switch (extension.join(".")) {
            case "near.glb":
                return file(path.join(ark, slug, "near.glb"), "model/gltf-binary");
            case "far.glb":
                return file(path.join(ark, slug, "far.glb"), "model/gltf-binary");
            case "ark.json":
                return file(path.join(ark, slug, "ark.json"), "application/json");
        }
    }
    return notFound();
}
