/**
 * An animal of the Ark talking: while it answers in the chat beside the Ark,
 * its light ark model (whose jaw was merged away) is swapped for the full
 * talking model — the voice call's g1 GLB, with its jaw hung from the rig's
 * hinge, the dark mouth behind it and its eyes — standing in the same spot.
 *
 * The mouth follows the reply: `TextMouth` turns the text as it arrives into
 * syllables (a vowel group each, open wider on a and o, narrower on i), with
 * the mouth shut on spaces between words that end a sentence; or, when the
 * reply is heard aloud, `pulse(level)` drives it from the voice. The jaw's
 * opening and closing speeds are the call's own (`MouthEnvelope`).
 */

import {
    Color,
    Group,
    Mesh,
    MeshPhysicalMaterial,
    MeshStandardMaterial,
    SphereGeometry,
    SRGBColorSpace,
    Vector3,
    type BufferGeometry,
    type Material
} from "three";
import {loadTalkingModel, type LoadedTalkingModel} from "@/components/ask-animaldex/voice-call/talking-model-renderer";
import {MouthEnvelope} from "@/lib/talking-models/model-math";

// MARK: - Text to syllables

type Syllable = {at: number; level: number};

const VOWELS = /[aeiouyàáâäãåæèéêëìíîïòóôöõøùúûüýœ]+/giu;

/** How wide a syllable opens, by its vowel. */
function openness(vowels: string): number {
    const v = vowels[0]?.toLowerCase() ?? "a";
    if ("aàáâäãåæ".includes(v)) return 1;
    if ("oòóôöõøœ".includes(v)) return 0.9;
    if ("uùúûü".includes(v)) return 0.7;
    if ("eèéêë".includes(v)) return 0.72;
    return 0.55;
}

/** Seconds per syllable while text streams in; quicker when the reply runs ahead. */
const SYLLABLE_SECONDS = 0.13;
const SENTENCE_PAUSE = 0.32;
const COMMA_PAUSE = 0.16;

export class TextMouth {
    private queue: Syllable[] = [];
    private end = 0;
    private pending = "";

    /** More of the reply, as it arrives; `now` in seconds. */
    feed(chunk: string, now: number) {
        this.pending += chunk;
        // Only whole words (a word is whole once something follows it); the rest waits for more.
        const match = /^([\s\S]*[\s.,!?;:…—-])([^\s.,!?;:…—-]*)$/u.exec(this.pending);
        if (!match) return;
        const ready = match[1];
        this.pending = match[2];
        let at = Math.max(now, this.end);
        // Far behind the text: talk faster rather than lag the words on screen.
        const behind = at - now;
        const pace = behind > 1.2 ? 0.6 : behind > 0.6 ? 0.8 : 1;
        for (const token of ready.split(/(\s+|[.,!?;:…—])/u)) {
            if (!token) continue;
            if (/^[.!?…]$/u.test(token)) {
                at += SENTENCE_PAUSE * pace;
                continue;
            }
            if (/^[,;:—]$/u.test(token)) {
                at += COMMA_PAUSE * pace;
                continue;
            }
            if (/^\s+$/u.test(token)) {
                at += 0.03 * pace;
                continue;
            }
            const groups = token.match(VOWELS) ?? [token];
            for (const group of groups) {
                this.queue.push({at, level: openness(group)});
                at += SYLLABLE_SECONDS * pace;
            }
        }
        this.end = at;
    }

    /** The reply is complete: say what is left. */
    flush(now: number) {
        if (this.pending) this.feed(this.pending + " ", now);
        this.pending = "";
    }

    /** How open the mouth wants to be now (0…1): each syllable opens, then closes before the next. */
    level(now: number): number {
        while (this.queue.length && this.queue[0].at + SYLLABLE_SECONDS < now) this.queue.shift();
        const current = this.queue[0];
        if (!current || current.at > now) return 0;
        const t = (now - current.at) / SYLLABLE_SECONDS;
        // Open quickly, hold, close before the next syllable.
        return current.level * (t < 0.55 ? 1 : Math.max(0, 1 - (t - 0.55) / 0.45));
    }

    get speaking(): boolean {
        return this.queue.length > 0 || this.pending.length > 0;
    }

    clear() {
        this.queue = [];
        this.pending = "";
        this.end = 0;
    }
}

// MARK: - The talking model

export type TalkingModelSource = {base: string; manifest: Promise<{models: Record<string, string>; glb?: string} | null>};

/** The talking models' manifest (`<base>/manifest.json`), read once per base. */
export function talkingSource(base: string): TalkingModelSource {
    const clean = base.replace(/\/+$/, "");
    return {
        base: clean,
        manifest: fetch(`${clean}/manifest.json`)
            .then((response) => (response.ok ? response.json() : null))
            .then((raw: unknown) => {
                const row = raw && typeof raw === "object" ? raw as {models?: Record<string, string>; glb?: string} : null;
                return row?.models ? {models: row.models, glb: typeof row.glb === "string" ? row.glb : "g1"} : null;
            })
            .catch(() => null)
    };
}

export class TalkingActor {
    readonly root = new Group();
    /** The model's own extent, as the ark model's (y up, head toward +z, about 1 long). */
    minY = -0.5;
    length = 1;
    height = 1;
    /** Its extent across x (with height and length: what `bodyAxisExtent` measures the drawn size on). */
    width = 1;
    ready = false;
    private readonly hinge = new Group();
    private cavity: Mesh | null = null;
    private cavityRadii = new Vector3(0.02, 0.01, 0.02);
    private maxOpen = 0.35;
    private readonly envelope = new MouthEnvelope();
    private readonly disposables: Array<BufferGeometry | Material | {dispose: () => void}> = [];
    private disposed = false;

    constructor(readonly slug: string, source: TalkingModelSource, onReady: () => void) {
        this.root.visible = false;
        source.manifest.then(async (manifest) => {
            const version = manifest?.models[this.slug];
            if (!version || this.disposed) return;
            const folder = `${source.base}/${encodeURIComponent(this.slug)}/${encodeURIComponent(version)}`;
            const loaded = await loadTalkingModel({slug: this.slug, model: `${folder}.${manifest?.glb ?? "g1"}.glb`, texture: `${folder}.jpg`, rig: `${folder}.json`});
            if (this.disposed) {
                Object.values(loaded.parts).forEach((part) => part.dispose());
                loaded.skin.dispose();
                return;
            }
            this.build(loaded);
            this.ready = true;
            onReady();
        }).catch((error) => {
            if (!this.disposed) console.warn(`[ark] talking ${this.slug}`, error instanceof Error ? error.message : error);
        });
    }

    private build(loaded: LoadedTalkingModel) {
        const {parts, rig, skin} = loaded;
        // A zero-length normal shades to NaN, which the bloom then spreads into a black block: none get through.
        for (const part of Object.values(parts)) {
            const normal = part.getAttribute("normal");
            if (!normal) continue;
            for (let i = 0; i < normal.count; i++) {
                const x = normal.getX(i);
                const y = normal.getY(i);
                const z = normal.getZ(i);
                const length = Math.hypot(x, y, z);
                if (!Number.isFinite(length) || length < 1e-6) normal.setXYZ(i, 0, 1, 0);
            }
            normal.needsUpdate = true;
        }
        skin.flipY = false;
        skin.colorSpace = SRGBColorSpace;
        const skinMaterial = new MeshStandardMaterial({map: skin, roughness: 0.78, metalness: 0, envMapIntensity: 0.9});
        const mouthMaterial = new MeshStandardMaterial({color: new Color("#2b1210"), roughness: 0.6, metalness: 0});
        const eyeMaterial = new MeshPhysicalMaterial({color: new Color(0.09, 0.045, 0.015), roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02});
        this.disposables.push(skinMaterial, mouthMaterial, eyeMaterial, skin, ...Object.values(parts));

        const mesh = (geometry: BufferGeometry, material: Material) => {
            const m = new Mesh(geometry, material);
            m.castShadow = true;
            m.receiveShadow = true;
            return m;
        };
        this.root.add(mesh(parts.body, skinMaterial), mesh(parts.body_inner, mouthMaterial));
        const hingePoint = new Vector3().fromArray(rig.hinge);
        this.hinge.position.copy(hingePoint);
        const jaw = mesh(parts.jaw, skinMaterial);
        const jawInner = mesh(parts.jaw_inner, mouthMaterial);
        jaw.position.copy(hingePoint).negate();
        jawInner.position.copy(hingePoint).negate();
        this.hinge.add(jaw, jawInner);
        this.root.add(this.hinge);

        const sphere = new SphereGeometry(1, 24, 12);
        this.disposables.push(sphere);
        this.cavity = new Mesh(sphere, mouthMaterial);
        this.cavity.position.fromArray(rig.cavity_center);
        this.cavityRadii.fromArray(rig.cavity_radii);
        this.root.add(this.cavity);

        const eyeRadius = Number(rig.eye_radius ?? 0.008) || 0.008;
        const eyeGeometry = new SphereGeometry(eyeRadius, 16, 12);
        this.disposables.push(eyeGeometry);
        for (const at of rig.eyes ?? []) {
            if (at.length !== 3) continue;
            const eye = new Mesh(eyeGeometry, eyeMaterial);
            eye.position.fromArray(at);
            this.root.add(eye);
        }

        this.maxOpen = Number(rig.max_open_degrees) * Math.PI / 180 || 0.35;
        parts.body.computeBoundingBox();
        const box = parts.body.boundingBox!;
        this.minY = box.min.y;
        this.height = box.max.y - box.min.y;
        this.length = Math.max(box.max.z - box.min.z, 0.05);
        this.width = Math.max(box.max.x - box.min.x, 0.05);
        this.setMouth(0, 0);
    }

    /** The mouth toward `level` (0 shut … 1 wide), at the call's own speeds; returns how open it is. */
    setMouth(level: number, elapsed: number): number {
        const decibels = this.envelope.quietDecibels + Math.min(Math.max(level, 0), 1) * (this.envelope.loudDecibels - this.envelope.quietDecibels);
        const open = this.envelope.update(decibels, elapsed);
        this.hinge.rotation.set(open * this.maxOpen, 0, 0);
        this.cavity?.scale.set(this.cavityRadii.x * (0.6 + 0.4 * open), this.cavityRadii.y * (0.05 + 0.95 * open), this.cavityRadii.z);
        return open;
    }

    dispose() {
        this.disposed = true;
        this.root.removeFromParent();
        for (const item of this.disposables) item.dispose();
    }
}
