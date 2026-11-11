/**
 * The layers, drawn (docs/ark-micro.md, "Layers"):
 *
 * - **Underground:** burrow entrances (a dark mouth in a ring of dug earth)
 *   and molehills by the animals that dig, and their tunnels. The cutaway
 *   opens the ground in front of what the camera looks at (clipping planes on
 *   the ground and the grass), and a pit of soil with strata shows the
 *   tunnels, the chambers and who is in them.
 * - **Under the sea:** below the water's surface the camera is underwater:
 *   a blue-green haze, the surface seen from below, shafts of light from it,
 *   and caustics on the sea floor (the ground shader's, `terrain.ts`).
 *   Plankton clouds drift in the open water, where the filter feeders feed.
 *   At night the animals that glow (their text says so) glow.
 *
 * Everything here is cosmetic, built from the animals' places.
 */

import {
    AdditiveBlending,
    BackSide,
    BufferAttribute,
    BufferGeometry,
    CanvasTexture,
    CatmullRomCurve3,
    Color,
    CircleGeometry,
    DoubleSide,
    Group,
    IcosahedronGeometry,
    InstancedMesh,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    Plane,
    PlaneGeometry,
    Points,
    PointsMaterial,
    Quaternion,
    TubeGeometry,
    Vector3,
    type Material
} from "three";
import {mergeGeometries} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {tunnelPoint, type Burrow} from "@/ark-scene/layers";
import {heightAt, seeded, ZONE_SITES} from "@/ark-scene/world";

const SOIL = new Color("#7b5b3c");
const SOIL_DARK = new Color("#4a3423");
const TUNNEL = new Color("#9a7a58");

function radialTexture(inner: string, outer: string): CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const context = canvas.getContext("2d")!;
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(1, outer);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    return new CanvasTexture(canvas);
}

/** The plankton clouds: where in the open water the filter feeders feed (deterministic). */
export function planktonClouds(): Array<{x: number; y: number; z: number; radius: number}> {
    const ocean = ZONE_SITES.open_ocean;
    const reef = ZONE_SITES.coral_reef;
    return [
        {x: ocean.x - 9, y: -2.2, z: ocean.z + 4, radius: 5},
        {x: ocean.x + 10, y: -3, z: ocean.z - 3, radius: 6},
        {x: reef.x + 6, y: -1.4, z: reef.z + 8, radius: 4}
    ];
}

export type CutawayView = {target: Vector3; towardCamera: Vector3};

export type LayersScene = {
    group: Group;
    /** The burrows and molehills of the animals aboard (built again with the snapshot). */
    setBurrows: (burrows: Burrow[], molehills: Array<{x: number; z: number}>, entrances: Array<{x: number; z: number; size: number}>) => void;
    /** Open the ground in front of the target (or close it with null). Returns whether it is open. */
    setCutaway: (view: CutawayView | null) => boolean;
    /** Underwater or not: the haze, the surface from below, the light shafts. */
    setUnderwater: (under: boolean, cameraPosition: Vector3, daylight: number) => void;
    /** The glowing animals' points this frame (night only), each with its strength. */
    setGlow: (points: Array<{x: number; y: number; z: number; strength: number}>) => void;
    /** The materials the cutaway clips (the ground's, the grass's). */
    clip: (materials: Material[]) => void;
    step: (time: number) => void;
    dispose: () => void;
};

export function buildLayersScene(): LayersScene {
    const group = new Group();
    const disposables: Array<{dispose: () => void}> = [];

    // MARK: Burrows, molehills, tunnels

    const mouthGeometry = new CircleGeometry(0.5, 14);
    mouthGeometry.rotateX(-Math.PI / 2);
    const mouthMaterial = new MeshBasicMaterial({color: new Color("#1d150e"), transparent: true, opacity: 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2});
    const mouths = new InstancedMesh(mouthGeometry, mouthMaterial, 64);
    mouths.count = 0;
    mouths.renderOrder = 1;
    const moundGeometry = new IcosahedronGeometry(0.5, 1);
    moundGeometry.scale(1, 0.38, 1);
    const moundMaterial = new MeshStandardMaterial({color: new Color("#6a4c33"), roughness: 1});
    const mounds = new InstancedMesh(moundGeometry, moundMaterial, 128);
    mounds.count = 0;
    mounds.castShadow = true;
    mounds.receiveShadow = true;
    group.add(mouths, mounds);
    disposables.push(mouthGeometry, mouthMaterial, moundGeometry, moundMaterial);

    // Only the tunnels' inner faces: seen through, like a channel cut open, with whoever is in it.
    const tunnelMaterial = new MeshStandardMaterial({color: TUNNEL, roughness: 1, side: BackSide});
    let tunnels: Mesh | null = null;
    disposables.push(tunnelMaterial);

    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const position = new Vector3();
    const scale = new Vector3();

    const setBurrows: LayersScene["setBurrows"] = (burrows, molehills, entrances) => {
        let m = 0;
        const all = [...burrows.map((burrow) => ({x: burrow.x, z: burrow.z, size: 0.55})), ...entrances];
        for (const mouth of all.slice(0, 64)) {
            position.set(mouth.x, heightAt(mouth.x, mouth.z) + 0.03, mouth.z);
            matrix.compose(position, quaternion.identity(), scale.setScalar(mouth.size));
            mouths.setMatrixAt(m++, matrix);
        }
        mouths.count = m;
        mouths.instanceMatrix.needsUpdate = true;
        let k = 0;
        // Each mouth's ring of dug earth (two low mounds) and the molehills.
        for (const mouth of all) {
            for (const side of [-1, 1]) {
                if (k >= 128) break;
                position.set(mouth.x + side * mouth.size * 0.55, heightAt(mouth.x, mouth.z) - 0.02, mouth.z + mouth.size * 0.2);
                matrix.compose(position, quaternion.identity(), scale.set(mouth.size * 0.7, mouth.size * 0.55, mouth.size * 0.55));
                mounds.setMatrixAt(k++, matrix);
            }
        }
        for (const hill of molehills) {
            if (k >= 128) break;
            position.set(hill.x, heightAt(hill.x, hill.z) - 0.03, hill.z);
            matrix.compose(position, quaternion.identity(), scale.set(0.45, 0.5, 0.45));
            mounds.setMatrixAt(k++, matrix);
        }
        mounds.count = k;
        mounds.instanceMatrix.needsUpdate = true;
        mouths.computeBoundingSphere();
        mounds.computeBoundingSphere();
        // The tunnels: a tube from each mouth down and along, and a round chamber at its end.
        if (tunnels) {
            group.remove(tunnels);
            tunnels.geometry.dispose();
            tunnels = null;
        }
        const pieces: BufferGeometry[] = [];
        for (const burrow of burrows) {
            const points = Array.from({length: 7}, (_, i) => {
                const p = tunnelPoint(burrow, i / 6);
                return new Vector3(p.x, p.y, p.z);
            });
            const tube = new TubeGeometry(new CatmullRomCurve3(points), 24, 0.2, 8, false);
            tube.deleteAttribute("uv");
            pieces.push(tube.index ? tube.toNonIndexed() : tube);
            const chamber = new IcosahedronGeometry(0.34, 1);
            chamber.scale(1.3, 0.75, 1.3);
            const end = points[points.length - 1];
            chamber.translate(end.x, end.y, end.z);
            chamber.deleteAttribute("uv");
            pieces.push(chamber.index ? chamber.toNonIndexed() : chamber);
        }
        if (pieces.length) {
            tunnels = new Mesh(mergeGeometries(pieces)!, tunnelMaterial);
            tunnels.visible = false;
            group.add(tunnels);
        }
    };

    // MARK: The cutaway

    // The pit: the soil's back face and two sides, from the ground down to 3.5 m, with strata (a strip per wall).
    const pitMaterial = new MeshStandardMaterial({vertexColors: true, roughness: 1, side: DoubleSide});
    const pit = new Mesh(new BufferGeometry(), pitMaterial);
    pit.visible = false;
    group.add(pit);
    disposables.push(pitMaterial);
    const planes = [new Plane(), new Plane(), new Plane(), new Plane()];
    const clipped: Material[] = [];
    /** The planes parked: one of them has every point on its outer side, so nothing is inside all four and nothing is clipped. */
    const park = () => {
        planes[0].set(new Vector3(1, 0, 0), -1e6);
        planes[1].set(new Vector3(-1, 0, 0), -1e6);
        planes[2].set(new Vector3(0, 0, 1), -1e6);
        planes[3].set(new Vector3(0, 1, 0), 1e6);
    };
    park();
    const PIT_HALF = 3.2;
    const PIT_FRONT = 4.5;
    const PIT_BACK = 1.4;
    const PIT_DEPTH = 3.2;

    const wall = (from: Vector3, to: Vector3, steps: number): BufferGeometry => {
        // A vertical strip from (from → to) along the ground, down to PIT_DEPTH below the lowest point.
        const positions: number[] = [];
        const colours: number[] = [];
        const bottom = Math.min(heightAt(from.x, from.z), heightAt(to.x, to.z)) - PIT_DEPTH;
        const band = (y: number) => {
            // Strata: darker topsoil, lighter clay, a band of stones.
            const depth = heightAt(from.x, from.z) - y;
            const c = depth < 0.35 ? SOIL_DARK : depth < 1.4 ? SOIL : depth < 1.6 ? new Color("#8d8170") : new Color("#94704a");
            return c;
        };
        for (let i = 0; i < steps; i++) {
            const a = from.clone().lerp(to, i / steps);
            const b = from.clone().lerp(to, (i + 1) / steps);
            const ta = heightAt(a.x, a.z) + 0.02;
            const tb = heightAt(b.x, b.z) + 0.02;
            // Rows down the wall, each row its stratum's colour.
            const rows = 8;
            for (let r = 0; r < rows; r++) {
                const y0a = ta + (bottom - ta) * (r / rows);
                const y1a = ta + (bottom - ta) * ((r + 1) / rows);
                const y0b = tb + (bottom - tb) * (r / rows);
                const y1b = tb + (bottom - tb) * ((r + 1) / rows);
                positions.push(a.x, y0a, a.z, b.x, y0b, b.z, b.x, y1b, b.z, a.x, y0a, a.z, b.x, y1b, b.z, a.x, y1a, a.z);
                const c = band((y0a + y1a) / 2);
                const shade = 0.94 + ((i * 7 + r * 3) % 5) / 60;
                for (let v = 0; v < 6; v++) colours.push(c.r * shade, c.g * shade, c.b * shade);
            }
        }
        const geometry = new BufferGeometry();
        geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
        geometry.setAttribute("color", new BufferAttribute(new Float32Array(colours), 3));
        geometry.computeVertexNormals();
        return geometry;
    };

    const setCutaway: LayersScene["setCutaway"] = (view) => {
        const open = Boolean(view);
        pit.visible = open;
        if (tunnels) tunnels.visible = open;
        if (!view) {
            park();
            return false;
        }
        const f = view.towardCamera.clone().setY(0).normalize();
        const s = new Vector3(f.z, 0, -f.x);
        const c = view.target;
        // Inside the box (negative to every plane) is clipped away: across ±PIT_HALF, from PIT_BACK behind the target to PIT_FRONT in front.
        planes[0].set(s, -s.dot(c) - PIT_HALF);
        planes[1].set(s.clone().negate(), s.dot(c) - PIT_HALF);
        planes[2].set(f, -f.dot(c) - PIT_FRONT);
        planes[3].set(f.clone().negate(), f.dot(c) - PIT_BACK);
        // The pit's walls along the box's back and sides.
        const corner = (across: number, out: number) => c.clone().addScaledVector(s, across).addScaledVector(f, out).setY(0);
        const backLeft = corner(-PIT_HALF, -PIT_BACK);
        const backRight = corner(PIT_HALF, -PIT_BACK);
        const frontLeft = corner(-PIT_HALF, PIT_FRONT);
        const frontRight = corner(PIT_HALF, PIT_FRONT);
        const floorGeometry = new PlaneGeometry(PIT_HALF * 2, PIT_FRONT + PIT_BACK);
        floorGeometry.rotateX(-Math.PI / 2);
        floorGeometry.rotateY(Math.atan2(f.x, f.z));
        const middle = c.clone().addScaledVector(f, (PIT_FRONT - PIT_BACK) / 2);
        floorGeometry.translate(middle.x, heightAt(c.x, c.z) - PIT_DEPTH, middle.z);
        floorGeometry.deleteAttribute("uv");
        const floor = floorGeometry.toNonIndexed();
        const floorColours = new Float32Array(floor.getAttribute("position").count * 3);
        for (let i = 0; i < floorColours.length; i += 3) floorColours.set([0.45, 0.33, 0.22], i);
        floor.setAttribute("color", new BufferAttribute(floorColours, 3));
        const geometry = mergeGeometries([wall(backLeft, backRight, 16), wall(backLeft, frontLeft, 12), wall(backRight, frontRight, 12), floor])!;
        pit.geometry.dispose();
        pit.geometry = geometry;
        return true;
    };

    // MARK: Under the sea

    const undersideMaterial = new MeshBasicMaterial({color: new Color("#7fc4c6"), transparent: true, opacity: 0.55, side: BackSide, depthWrite: false});
    const underside = new Mesh(new PlaneGeometry(600, 600), undersideMaterial);
    underside.rotation.x = -Math.PI / 2;
    underside.position.y = -0.01;
    underside.visible = false;
    underside.renderOrder = 3;
    group.add(underside);
    disposables.push(underside.geometry, undersideMaterial);

    // Shafts of light from the surface: tall soft planes, turned to the camera, drifting.
    const shaftTexture = (() => {
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 128;
        const context = canvas.getContext("2d")!;
        const gradient = context.createLinearGradient(0, 0, 0, 128);
        gradient.addColorStop(0, "rgba(220, 255, 250, 0.55)");
        gradient.addColorStop(1, "rgba(220, 255, 250, 0)");
        context.fillStyle = gradient;
        context.fillRect(0, 0, 32, 128);
        const sides = context.getImageData(0, 0, 32, 128);
        for (let y = 0; y < 128; y++) {
            for (let x = 0; x < 32; x++) {
                const edge = Math.sin(Math.PI * x / 31);
                sides.data[(y * 32 + x) * 4 + 3] *= edge * edge;
            }
        }
        context.putImageData(sides, 0, 0);
        return new CanvasTexture(canvas);
    })();
    const shaftMaterial = new MeshBasicMaterial({map: shaftTexture, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false});
    const shafts = new Group();
    const random = seeded(4410);
    for (let i = 0; i < 9; i++) {
        const shaft = new Mesh(new PlaneGeometry(1.6 + random() * 1.4, 9), shaftMaterial);
        shaft.userData.offset = new Vector3((random() - 0.5) * 22, -4.3, (random() - 0.5) * 22);
        shaft.userData.phase = random() * 10;
        shaft.rotation.z = 0.18;
        shafts.add(shaft);
    }
    shafts.visible = false;
    group.add(shafts);
    disposables.push(shaftTexture, shaftMaterial);

    // Plankton: a drifting cloud of motes at each feeding ground.
    const clouds = planktonClouds();
    const motes: number[] = [];
    for (const cloud of clouds) {
        for (let i = 0; i < 260; i++) {
            const r = cloud.radius * Math.cbrt(random());
            const theta = random() * Math.PI * 2;
            const phi = Math.acos(2 * random() - 1);
            motes.push(cloud.x + r * Math.sin(phi) * Math.cos(theta), Math.min(cloud.y + r * 0.45 * Math.cos(phi), -0.15), cloud.z + r * Math.sin(phi) * Math.sin(theta));
        }
    }
    const planktonGeometry = new BufferGeometry();
    planktonGeometry.setAttribute("position", new BufferAttribute(new Float32Array(motes), 3));
    const moteTexture = radialTexture("rgba(235, 255, 230, 1)", "rgba(235, 255, 230, 0)");
    const planktonMaterial = new PointsMaterial({map: moteTexture, size: 0.09, transparent: true, depthWrite: false, color: new Color("#d8f5d0"), opacity: 0.8});
    const plankton = new Points(planktonGeometry, planktonMaterial);
    group.add(plankton);
    disposables.push(planktonGeometry, planktonMaterial, moteTexture);

    // The glow of the animals that glow, at night.
    const glowTexture = radialTexture("rgba(160, 255, 245, 1)", "rgba(80, 200, 255, 0)");
    const glowMaterial = new PointsMaterial({map: glowTexture, size: 1.4, transparent: true, depthWrite: false, blending: AdditiveBlending, color: new Color("#8ff6ff"), fog: false});
    const glowGeometry = new BufferGeometry();
    glowGeometry.setAttribute("position", new BufferAttribute(new Float32Array(64 * 3), 3));
    glowGeometry.setDrawRange(0, 0);
    const glow = new Points(glowGeometry, glowMaterial);
    glow.frustumCulled = false;
    group.add(glow);
    disposables.push(glowTexture, glowMaterial, glowGeometry);

    let cameraAt = new Vector3();
    return {
        group,
        setBurrows,
        setCutaway,
        setUnderwater: (under, cameraPosition, daylight) => {
            underside.visible = under;
            // The light's shafts by day only.
            shafts.visible = under && daylight > 0.45;
            // Graphics pass: softer shafts, and the water's own underside (terrain.ts: Snell's window) shows through.
            shaftMaterial.opacity = Math.min(Math.max((daylight - 0.45) / 0.4, 0), 1) * 0.32;
            undersideMaterial.opacity = 0.06 + 0.06 * Math.min(Math.max(daylight, 0), 1);
            cameraAt = cameraPosition;
            underside.position.x = cameraPosition.x;
            underside.position.z = cameraPosition.z;
        },
        setGlow: (points) => {
            const attribute = glowGeometry.getAttribute("position") as BufferAttribute;
            const n = Math.min(points.length, 64);
            for (let i = 0; i < n; i++) attribute.setXYZ(i, points[i].x, points[i].y, points[i].z);
            attribute.needsUpdate = true;
            glowGeometry.setDrawRange(0, n);
            glowMaterial.opacity = n ? Math.max(...points.slice(0, n).map((p) => p.strength)) : 0;
            glow.visible = n > 0;
        },
        clip: (materials) => {
            // The clipped materials keep their four planes for good (parked out of the way while the cutaway is
            // closed): opening it then only moves the planes, so no shader is compiled again and nothing hitches.
            for (const material of materials) {
                material.clippingPlanes = planes;
                material.clipIntersection = true;
                material.needsUpdate = true;
                clipped.push(material);
            }
        },
        step: (time) => {
            if (shafts.visible) {
                shafts.children.forEach((shaft) => {
                    const offset = shaft.userData.offset as Vector3;
                    const phase = shaft.userData.phase as number;
                    shaft.position.set(cameraAt.x + offset.x + Math.sin(time * 0.1 + phase) * 1.5, offset.y, cameraAt.z + offset.z);
                    shaft.lookAt(cameraAt.x, offset.y, cameraAt.z);
                    shaft.rotateZ(0.16);
                });
            }
        },
        dispose: () => {
            disposables.forEach((item) => item.dispose());
            pit.geometry.dispose();
            tunnels?.geometry.dispose();
            shafts.children.forEach((shaft) => (shaft as Mesh).geometry.dispose());
        }
    };
}
