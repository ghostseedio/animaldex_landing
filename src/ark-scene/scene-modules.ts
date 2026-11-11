/**
 * A small hook for scenery modules that live outside `index.ts` (the props
 * lane's nests, homes and area details, `src/ark-scene/props`): each is
 * built once with the scene, told when the tier, the snapshot, the hour or
 * its on/off setting changes, and stepped every frame with the camera. The
 * scene knows nothing else about them; a module adds and removes its own
 * objects under `root`.
 *
 * Visual only: a module reads the snapshot and the placements, and never
 * decides anything that happens in the Ark.
 */

import type {Group, PerspectiveCamera, Scene, Vector3, WebGLRenderer} from "three";
import type {Placement} from "@/ark-scene/placement";
import type {QualityTier} from "@/ark-scene/post";
import type {ArkSnapshot} from "@/ark-scene/types";
import {createPropsModule} from "@/ark-scene/props";

export type ArkSceneModuleContext = {
    scene: Scene;
    renderer: WebGLRenderer;
    tier: QualityTier;
    snapshot: ArkSnapshot;
    hours: number;
    /** Where an animal stands (the scene's own placement, the same for every viewer), or null. */
    placeOf: (id: string) => Placement | null;
    /** A species' rig body plan ("bird", "four-legged"…) once its model is in; undefined before. */
    planOf: (slug: string) => string | null | undefined;
    /** Prefers-reduced-motion: nothing drifts or flickers. */
    reducedMotion: boolean;
};

export interface ArkSceneModule {
    readonly name: string;
    readonly root: Group;
    setTier(tier: QualityTier, lite: boolean): void;
    setShadows(on: boolean): void;
    /** A newer snapshot (placements already updated). */
    setSnapshot(snapshot: ArkSnapshot): void;
    setHours(hours: number): void;
    setEnabled(on: boolean): void;
    setReducedMotion(reduced: boolean): void;
    /** Every frame: seconds since the scene started, the camera and what it looks at. */
    step(elapsed: number, camera: PerspectiveCamera, target: Vector3): void;
    /** How near the camera may come when it looks at this point (a nest, a web: less than the usual 4 m), or null. */
    closeUp?(x: number, y: number, z: number): number | null;
    dispose(): void;
}

export type ArkSceneModuleFactory = (context: ArkSceneModuleContext) => ArkSceneModule;

/** The modules the scene builds, in order. */
export const ARK_SCENE_MODULES: ArkSceneModuleFactory[] = [createPropsModule];
