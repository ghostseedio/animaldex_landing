/**
 * Close-up skins (the animal-look pass): the Ark set's near model carries a
 * 512² skin, soft when the camera comes right up to an animal. Each species'
 * full-resolution skin (1024², the size the talking model was textured at)
 * is built offline as a GPU-compressed KTX2 (Basis ETC1S, AnimalDex
 * `scripts/talking-models/ark/export_closeup.py`) and swapped in for its near
 * model only while the camera is close to one of its animals, then let go.
 *
 *   <base>/manifest.json                     {"kind": "ark-closeup", "models": {slug: version}}
 *   <base>/<slug>/<version>.near.ktx2        the skin, same UV layout as the 512² one
 *
 * Nothing is fetched until an animal is close; with no manifest (nothing
 * published yet), a failed file or no KTX2 support, every animal simply keeps
 * its 512² skin. The transcoder (`basis_transcoder.js`/`.wasm`, three.js's
 * copy of Basis Universal) is loaded with the first skin.
 */

import {fetchOk, readUntilIn} from "@/ark-scene/model-files";
import {type Texture, type WebGLRenderer} from "three";
import type {KTX2Loader} from "three/examples/jsm/loaders/KTX2Loader.js";

type Settings = {within: number; cap: number} | null;
type Entry = {texture: Texture | null; loading: boolean; failed: boolean; usedAt: number};

/** Seconds a skin is kept once no animal of its species is close. */
const KEEP_SECONDS = 8;

export class CloseUpTextures {
    private manifest: Record<string, string> | null = null;
    private manifestAsked = false;
    private loader: KTX2Loader | null = null;
    private readonly entries = new Map<string, Entry>();
    private wanted = new Map<string, number>();
    private disposed = false;
    private now = 0;

    constructor(
        private readonly base: string | null,
        private readonly basisBase: string,
        private readonly renderer: WebGLRenderer,
        private readonly onChange: (slug: string, texture: Texture | null) => void
    ) {}

    /** The close-up skin in use for a species, if any. */
    texture(slug: string): Texture | null {
        return this.entries.get(slug)?.texture ?? null;
    }

    /** How many close-up skins are on the GPU now. */
    get loaded(): number {
        let n = 0;
        this.entries.forEach((entry) => {
            if (entry.texture) n++;
        });
        return n;
    }

    begin() {
        this.wanted = new Map();
    }

    want(slug: string, distance: number) {
        const known = this.wanted.get(slug);
        if (known === undefined || distance < known) this.wanted.set(slug, distance);
    }

    update(now: number, settings: Settings) {
        this.now = now;
        if (!this.base || this.disposed) return;
        if (!settings) {
            this.releaseAll();
            return;
        }
        if (this.wanted.size && !this.manifestAsked) this.readManifest();
        // Keep the ones still close; let the others go after a while (and the farthest first when over the cap).
        this.wanted.forEach((distance, slug) => {
            const entry = this.entries.get(slug);
            if (entry && distance < settings.within * 1.6) entry.usedAt = now;
        });
        this.entries.forEach((entry, slug) => {
            if (entry.texture && now - entry.usedAt > KEEP_SECONDS) this.release(slug);
        });
        if (!this.manifest) return;
        const closest = Array.from(this.wanted.entries()).filter(([slug, distance]) => distance < settings.within && this.manifest?.[slug]).sort((a, b) => a[1] - b[1]);
        for (const [slug] of closest.slice(0, settings.cap)) {
            const entry = this.entries.get(slug);
            if (entry?.texture || entry?.loading || entry?.failed) continue;
            if (this.loadedOrLoading() >= settings.cap) this.evictOldest(slug);
            if (this.loadedOrLoading() >= settings.cap) break;
            this.load(slug);
        }
    }

    private loadedOrLoading(): number {
        let n = 0;
        this.entries.forEach((entry) => {
            if (entry.texture || entry.loading) n++;
        });
        return n;
    }

    private evictOldest(keep: string) {
        let oldest: string | null = null;
        let at = Infinity;
        this.entries.forEach((entry, slug) => {
            if (slug !== keep && entry.texture && !this.wanted.has(slug) && entry.usedAt < at) {
                at = entry.usedAt;
                oldest = slug;
            }
        });
        if (oldest) this.release(oldest);
    }

    private readManifest() {
        this.manifestAsked = true;
        // (Read until it is in; a set that is not published answers 400 and is done without, as before.)
        readUntilIn("close-up skins", () => fetchOk(`${this.base!.replace(/\/+$/, "")}/manifest.json`).then((response) => response.json() as Promise<unknown>), () => !this.disposed)
            .then((raw: unknown) => {
                const row = raw && typeof raw === "object" ? raw as {kind?: unknown; models?: unknown} : null;
                if (row?.kind === "ark-closeup" && row.models && typeof row.models === "object") this.manifest = row.models as Record<string, string>;
            })
            .catch(() => undefined);
    }

    private async ktx2(): Promise<KTX2Loader> {
        if (this.loader) return this.loader;
        const {KTX2Loader} = await import("three/examples/jsm/loaders/KTX2Loader.js");
        const loader = new KTX2Loader().setTranscoderPath(this.basisBase.replace(/\/?$/, "/")).setWorkerLimit(1);
        loader.detectSupport(this.renderer);
        this.loader = loader;
        return loader;
    }

    private load(slug: string) {
        const version = this.manifest?.[slug];
        if (!version) return;
        const entry: Entry = {texture: null, loading: true, failed: false, usedAt: this.now};
        this.entries.set(slug, entry);
        // (Read until it is in while this skin is still wanted; a failed read takes the loader with it, which keeps
        // its transcoder's own failed read for good.)
        readUntilIn(
            `close-up skin ${slug}`,
            () =>
                this.ktx2()
                    .then((loader) => loader.loadAsync(`${this.base!.replace(/\/+$/, "")}/${encodeURIComponent(slug)}/${version}.near.ktx2`))
                    .catch((error: unknown) => {
                        this.loader = null;
                        throw error;
                    }),
            () => !this.disposed && this.entries.get(slug) === entry
        )
            .then((texture) => {
                entry.loading = false;
                if (this.disposed || this.entries.get(slug) !== entry) {
                    texture.dispose();
                    return;
                }
                texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
                texture.needsUpdate = true;
                entry.texture = texture;
                this.onChange(slug, texture);
            })
            .catch((error) => {
                entry.loading = false;
                entry.failed = true;
                if (!this.disposed) console.warn(`[ark] close-up skin ${slug}`, error instanceof Error ? error.message : error);
            });
    }

    private release(slug: string) {
        const entry = this.entries.get(slug);
        if (!entry) return;
        this.entries.delete(slug);
        if (entry.texture) {
            this.onChange(slug, null);
            entry.texture.dispose();
        }
    }

    releaseAll() {
        for (const slug of Array.from(this.entries.keys())) {
            if (this.entries.get(slug)?.texture) this.release(slug);
        }
    }

    dispose() {
        this.disposed = true;
        this.releaseAll();
        this.entries.clear();
        this.loader?.dispose();
    }
}
