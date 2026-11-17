/**
 * The giant waterfall as a scene module (`scene-modules.ts`; p4 WATERFALL): built with the scene when the world is the
 * bigger wild island (`world.ts` arkWorld() "v2", what islands mode shows), nothing otherwise. Its tier follows the
 * scene's (the lighter view draws it as the low tier), its shadows the scene's; reduced motion holds it still through the
 * shared clock (`glsl.ts` ARK_TIME, which the scene stops). Scenery, not a prop: the props switch leaves it drawn.
 */

import {Group} from "three";
import {arkWorld} from "@/ark-scene/world";
import type {ArkSceneModule, ArkSceneModuleContext} from "@/ark-scene/scene-modules";
import {buildWildFalls, type WildFalls} from "@/ark-scene/islands/wild/render/falls";

export function createFallsModule(context: ArkSceneModuleContext): ArkSceneModule {
    const root = new Group();
    root.name = "wild-falls";
    let falls: WildFalls | null = null;
    if (arkWorld() === "v2") {
        falls = buildWildFalls(context.tier);
        root.add(falls.group);
        context.scene.add(root);
    }
    return {
        name: "wild-falls",
        root,
        setTier: (tier, lite) => falls?.setTier(lite ? "low" : tier),
        setShadows: (on) => falls?.setShadows(on),
        setSnapshot: () => {},
        setHours: () => {},
        setEnabled: () => {},
        setReducedMotion: () => {},
        step: (_elapsed, camera) => falls?.update(camera.position),
        dispose: () => {
            falls?.dispose();
            root.removeFromParent();
        }
    };
}
