import library from "@/data/footage-library.json";
import type {PlanScene, VideoPlan, VideoSource} from "@/lib/content-video/plan";

// Our own footage (the founder's phone and camera clips, Apr–Oct 2026),
// trimmed to vertical 1080x1920 shots with no sound and no metadata (the
// GPS is stripped), uploaded to the content-videos bucket under footage/ and
// indexed in src/data/footage-library.json (scripts/build-footage-library.mts).
// Real footage beats AI on every platform's originality rules and costs
// nothing per use, so a plan's shots of an animal we have filmed are swapped
// for our clips before any AI clip is ordered (applyFootage), and the scan
// reveal format is built from them.

/**
 * scan: the app pointed at a real animal, analysing. result: the result
 * card, species readable. reaction: the presenter's face meeting an animal.
 * animal: the animal alone. intro: the presenter talking to camera.
 */
export type FootageKind = "scan" | "result" | "reaction" | "animal" | "intro";

export type FootageClip = {
    id: string;
    kind: FootageKind;
    /** Catalog slug of the animal, when the clip shows one we could name. */
    species: string | null;
    label: string | null;
    seconds: number;
    /** Path in the content-videos bucket. */
    path: string;
    poster: string;
    /** When it was filmed (month), for the record. */
    filmed: string | null;
};

export const FOOTAGE: readonly FootageClip[] = (library as {clips: FootageClip[]}).clips;

export function footageFor(species: string | null | undefined, kinds: readonly FootageKind[], clips: readonly FootageClip[] = FOOTAGE) {
    if (!species) return [];
    return clips.filter((clip) => clip.species === species && kinds.includes(clip.kind));
}

/** Species we have both a scan or result shot and the animal itself for: what a scan reveal can be made of. */
export function scanRevealSpecies(clips: readonly FootageClip[] = FOOTAGE) {
    const by = new Map<string, Set<FootageKind>>();
    for (const clip of clips) {
        if (!clip.species) continue;
        by.set(clip.species, (by.get(clip.species) ?? new Set()).add(clip.kind));
    }
    return Array.from(by, ([species, kinds]) => ({species, kinds: Array.from(kinds)}))
        .filter((entry) => entry.kinds.includes("result") || entry.kinds.includes("scan"));
}

/** A scene that plays one of our clips instead of an AI clip or a still. */
export function footageScene(scene: PlanScene, clip: FootageClip): PlanScene {
    return {
        ...scene,
        visual: "image",
        motionPrompt: "",
        keyframePrompt: undefined,
        chain: undefined,
        clipSeconds: undefined,
        footage: {id: clip.id, path: clip.path, seconds: clip.seconds}
    };
}

/** Longest first: a longer take leaves the edit room. */
function ranked(clips: FootageClip[]) {
    return [...clips].sort((a, b) => b.seconds - a.seconds);
}

/**
 * Swaps a plan's shots of an animal we have filmed for our own clips, before
 * any AI clip is paid for:
 * - lesson: every drawn shot of the animal (the hook first), one clip each;
 * - guess: only the payoff after the reveal (a clip before it would give the
 *   answer away);
 * - editorial (rankings, places, blog): a scene about one species;
 * - battles and imagined creatures keep their AI shots (two animals in one
 *   fight, or an animal that does not exist).
 * Pure; the library is injectable for tests.
 */
export function applyFootage(plan: VideoPlan, source: Pick<VideoSource, "lesson" | "guess" | "species">, clips: readonly FootageClip[] = FOOTAGE): VideoPlan {
    if (plan.format === "battle" || plan.format === "creature" || plan.format === "scan") return plan;
    const used = new Set<string>();
    const take = (species: string | null | undefined) => {
        const clip = ranked(footageFor(species, ["animal"], clips)).find((candidate) => !used.has(candidate.id));
        if (clip) used.add(clip.id);
        return clip ?? null;
    };
    const scenes = plan.scenes.map((scene, index) => {
        if (scene.footage || scene.reuseClip !== undefined || scene.card) return scene;
        if (plan.format === "lesson") {
            const clip = scene.visual === "ai_clip" ? take(source.lesson?.animal.slug) : null;
            return clip ? footageScene(scene, clip) : scene;
        }
        if (plan.format === "guess") {
            const clip = index === 4 && scene.visual === "ai_clip" ? take(source.guess?.animal.slug) : null;
            return clip ? footageScene(scene, clip) : scene;
        }
        const clip = scene.species ? take(scene.species) : null;
        return clip ? footageScene(scene, clip) : scene;
    });
    return {...plan, scenes};
}

/** Whether a video shows AI-generated imagery (TikTok's AI label): any AI clip or drawn frame. */
export function planHasAiImagery(plan: Pick<VideoPlan, "scenes" | "format"> | null | undefined) {
    if (!plan) return true;
    return plan.scenes.some((scene) => !scene.footage && (scene.visual === "ai_clip" || Boolean(scene.keyframePrompt)))
        || plan.format === "battle" || plan.format === "creature";
}
