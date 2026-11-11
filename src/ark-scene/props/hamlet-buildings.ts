/**
 * The hamlet's buildings (docs/ark/props.md, "Home plots"): a cottage on
 * every house plot and a barn or a smaller farm shed on every smallholding
 * past today's two (which the graphics lane draws: `micro-scene.ts`, the
 * decor's barn). Built with the graphics lane's own builders
 * (`cottageGeometry(style)`, `barnGeometry(style)`), each plot's look from
 * its id (`home-layout.ts` cottageStyle, barnStyle), so no two read as one
 * cloned. Their windows light up at night, as the cottage's do.
 *
 * Two draw calls for the whole hamlet (the buildings, the window glass).
 */

import {Color, Group, Mesh, MeshStandardMaterial, type BufferGeometry} from "three";
import {mergeGeometries} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {cottageGeometry} from "@/ark-scene/micro-scene";
import {barnGeometry} from "@/ark-scene/vegetation";
import {barnStyle, cottageStyle, plotFrame, type HomePlot} from "@/ark-scene/props/home-layout";
import {sampleGround} from "@/ark-scene/world";

/** The plots the graphics lane draws itself (today's cottage and barn). */
export const DRAWN_ELSEWHERE = new Set(["house-0", "smallholding-0"]);

export type HamletBuildings = {
    group: Group;
    /** 0 by day, 1 at full night: the windows come on, as the cottage's do (micro-scene.ts setNight). */
    setNight: (night: number) => void;
    setShadows: (on: boolean) => void;
    triangles: number;
    dispose: () => void;
};

/** A barn's ground: the lowest corner of its footprint, a little under, so a slope never shows a gap. */
export function barnBase(plot: HomePlot, size: [number, number, number]): number {
    const frame = plotFrame(plot);
    let low = Infinity;
    for (const [lx, lz] of [[-3.3, -2.3], [3.3, -2.3], [3.3, 2.3], [-3.3, 2.3], [0, 0]] as const) low = Math.min(low, frame.ground(lx * size[0], lz * size[2]));
    return low - 0.05;
}

/** Geometries of the hamlet's buildings in the world: [the buildings, the glass]. */
export function hamletGeometry(plots: HomePlot[]): {buildings: BufferGeometry | null; glass: BufferGeometry | null} {
    const buildings: BufferGeometry[] = [];
    const glass: BufferGeometry[] = [];
    for (const plot of plots) {
        if (DRAWN_ELSEWHERE.has(plot.id)) continue;
        if (plot.kind === "house") {
            const style = cottageStyle(plot);
            const cottage = cottageGeometry(style);
            const floor = plotFrame(plot).floor;
            for (const [list, geometry] of [[buildings, cottage.house], [glass, cottage.glass]] as const) {
                geometry.scale(style.scale, style.scale, style.scale);
                geometry.rotateY(plot.rotation);
                geometry.translate(plot.x, floor, plot.z);
                list.push(geometry);
            }
        } else if (plot.barn !== false) {
            const style = barnStyle(plot);
            const barn = barnGeometry(style);
            barn.rotateY(plot.rotation);
            barn.translate(plot.x, barnBase(plot, style.size), plot.z);
            // The decor's barn carries the vegetation shader's attributes; only what a standard material reads is kept.
            for (const name of Object.keys(barn.attributes)) if (name !== "position" && name !== "normal" && name !== "color") barn.deleteAttribute(name);
            if (!barn.getAttribute("color")) continue;
            buildings.push(barn.index ? barn.toNonIndexed() : barn);
        }
    }
    const tidy = (list: BufferGeometry[]) => list.map((geometry) => {
        const flat = geometry.index ? geometry.toNonIndexed() : geometry;
        for (const name of Object.keys(flat.attributes)) if (name !== "position" && name !== "normal" && name !== "color") flat.deleteAttribute(name);
        return flat;
    });
    return {buildings: buildings.length ? mergeGeometries(tidy(buildings)) : null, glass: glass.length ? mergeGeometries(tidy(glass)) : null};
}

export function buildHamletBuildings(plots: HomePlot[]): HamletBuildings {
    const group = new Group();
    group.name = "props:hamlet";
    const {buildings, glass} = hamletGeometry(plots);
    const material = new MeshStandardMaterial({vertexColors: true, roughness: 0.86, metalness: 0});
    const glassMaterial = new MeshStandardMaterial({color: new Color("#3a4a55"), roughness: 0.18, metalness: 0.2, emissive: new Color("#ffc679"), emissiveIntensity: 0});
    const meshes: Mesh[] = [];
    if (buildings) {
        const mesh = new Mesh(buildings, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.name = "props:hamlet:buildings";
        group.add(mesh);
        meshes.push(mesh);
    }
    if (glass) {
        // The glass carries no vertex colours: a plain material (the cottage's own glass look).
        glass.deleteAttribute("color");
        const mesh = new Mesh(glass, glassMaterial);
        mesh.name = "props:hamlet:glass";
        group.add(mesh);
    }
    const count = (geometry: BufferGeometry | null) => (geometry ? geometry.getAttribute("position").count / 3 : 0);
    return {
        group,
        setNight: (night) => {
            // As the cottage's (micro-scene.ts): on from a little past dusk, warm.
            const on = Math.min(Math.max((night - 0.15) / 0.5, 0), 1);
            glassMaterial.emissiveIntensity = 1.6 * on;
        },
        setShadows: (on) => {
            for (const mesh of meshes) mesh.castShadow = on;
        },
        triangles: count(buildings) + count(glass),
        dispose: () => {
            buildings?.dispose();
            glass?.dispose();
            material.dispose();
            glassMaterial.dispose();
        }
    };
}
