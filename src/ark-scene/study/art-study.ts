/**
 * The art-direction studies' entry for the golden-shot page (`golden.html?study=natural|toon|real`).
 * The scene itself is `art-study-scene.ts`.
 */
import {mountStudyScene, type ArtStudyHandle} from "@/ark-scene/study/art-study-scene";

export type {ArtStudyHandle};

export function mountArtStudy(el: HTMLElement, direction: string): Promise<ArtStudyHandle> {
    return mountStudyScene(el, direction);
}
