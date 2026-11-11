/**
 * The true-scale comparison page (development only; `scripts/ark-true-scale-shots.mjs` builds and serves it,
 * nothing deploys it). Animals stand in a row on flat ground beside things of known size, in real metres: a 1.75 m
 * person, the picket fence (`PICKET_POST_TOP`), the cottage (`COTTAGE`), an oak as the island draws it, a boulder and a
 * 1 m grid. Each animal is drawn exactly as the scene draws it (`arkBody(...).display / bodyAxisExtent(...)`), or, for
 * the "before" pictures, at the old compressed length the harness passes in.
 *
 *   true-scale.html?shot=<name>&mode=after|before
 */

import {AmbientLight, Box3, BoxGeometry, CanvasTexture, Color, ConeGeometry, CylinderGeometry, DirectionalLight, Group, HemisphereLight, Mesh, MeshStandardMaterial, Object3D, PerspectiveCamera, PlaneGeometry, RepeatWrapping, Scene, SphereGeometry, SRGBColorSpace, Vector3, WebGLRenderer, PCFSoftShadowMap, ACESFilmicToneMapping, Fog} from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {arkBody, bodyAxisExtent} from "@/ark-scene/stats";
import {COTTAGE} from "@/ark-scene/micro-decor";
import {PICKET_POST_TOP} from "@/ark-scene/props/home-layout";
import {ASSETS, ASSET_BASE} from "@/ark-scene/tree-assets";

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";

type Item = {slug: string} | {ref: "person" | "fence" | "cottage" | "oak" | "boulder"};
type Shot = {items: Item[]; gap: number; camera: {distance: number; height: number; lookY: number; fov?: number}; grid: number};

/** The shots: a row along +x, seen from the side (+z). */
export const TRUE_SCALE_SHOTS: Record<string, Shot> = {
    giants: {items: [{slug: "blue-whale"}, {slug: "humpback-whale"}, {slug: "sperm-whale"}, {slug: "african-bush-elephant"}, {slug: "giraffe"}, {ref: "person"}, {ref: "cottage"}, {ref: "oak"}], gap: 3, camera: {distance: 78, height: 9, lookY: 3}, grid: 5},
    large: {items: [{ref: "oak"}, {slug: "african-bush-elephant"}, {slug: "giraffe"}, {slug: "domestic-horse"}, {slug: "cow"}, {slug: "rhinoceros"}, {ref: "person"}, {ref: "fence"}], gap: 1.6, camera: {distance: 34, height: 4, lookY: 2.2}, grid: 1},
    human: {items: [{ref: "person"}, {slug: "western-lowland-gorilla"}, {slug: "african-lion"}, {slug: "eurasian-wolf"}, {slug: "red-kangaroo"}, {slug: "emperor-penguin"}, {slug: "domestic-dog"}, {slug: "domestic-sheep"}, {ref: "fence"}], gap: 0.8, camera: {distance: 15, height: 1.6, lookY: 0.8}, grid: 1},
    small: {items: [{ref: "fence"}, {slug: "domestic-cat"}, {slug: "european-rabbit"}, {slug: "domestic-chicken"}, {slug: "house-sparrow"}, {slug: "house-mouse"}, {slug: "common-frog"}], gap: 0.25, camera: {distance: 3.6, height: 0.5, lookY: 0.25}, grid: 0.1},
    insect: {items: [{slug: "house-mouse"}, {slug: "european-rhinoceros-beetle"}, {slug: "western-honey-bee"}, {slug: "seven-spot-ladybird"}, {slug: "black-ant"}, {slug: "house-fly"}, {slug: "red-admiral"}], gap: 0.03, camera: {distance: 0.42, height: 0.05, lookY: 0.02, fov: 30}, grid: 0.01}
};

type Debug = {ready: boolean; error?: string; drawn?: Record<string, {drawn: number; height: number; length: number}>};

function gridTexture(cells: number): CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#8fa86a";
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = "rgba(40,50,30,0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 254, 254);
    const texture = new CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(cells, cells);
    texture.colorSpace = SRGBColorSpace;
    return texture;
}

function person(): Group {
    // 1.75 m: a plain grey figure (legs, body, head), the scale every viewer knows.
    const material = new MeshStandardMaterial({color: "#6b6f78", roughness: 0.8});
    const group = new Group();
    const legs = new Mesh(new CylinderGeometry(0.13, 0.11, 0.85, 12), material);
    legs.position.y = 0.425;
    const body = new Mesh(new CylinderGeometry(0.2, 0.15, 0.65, 14), material);
    body.position.y = 0.85 + 0.325;
    const head = new Mesh(new SphereGeometry(0.12, 16, 12), material);
    head.position.y = 1.75 - 0.12;
    group.add(legs, body, head);
    return group;
}

function fence(): Group {
    // The island's picket fence: posts PICKET_POST_TOP (0.95 m) high, 1.2 m apart, two rails.
    const wood = new MeshStandardMaterial({color: "#e9e1cf", roughness: 0.9});
    const group = new Group();
    for (let k = 0; k < 3; k++) {
        const post = new Mesh(new BoxGeometry(0.07, PICKET_POST_TOP, 0.07), wood);
        post.position.set(k * 1.2, PICKET_POST_TOP / 2, 0);
        group.add(post);
    }
    for (const y of [0.3, 0.75]) {
        const rail = new Mesh(new BoxGeometry(2.4, 0.06, 0.03), wood);
        rail.position.set(1.2, y, 0.04);
        group.add(rail);
    }
    return group;
}

function cottage(): Group {
    // COTTAGE: 5.2 × 4 m, eaves 2.6 m, the ridge 1.7 m above them.
    const group = new Group();
    const walls = new Mesh(new BoxGeometry(COTTAGE.width, COTTAGE.wall, COTTAGE.depth), new MeshStandardMaterial({color: "#efe6d6", roughness: 0.9}));
    walls.position.y = COTTAGE.wall / 2;
    const roof = new Mesh(new ConeGeometry(Math.hypot(COTTAGE.width, COTTAGE.depth) / 2 * 1.02, COTTAGE.ridge, 4, 1), new MeshStandardMaterial({color: "#8a4b3a", roughness: 0.8}));
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 1, COTTAGE.depth / COTTAGE.width);
    roof.position.y = COTTAGE.wall + COTTAGE.ridge / 2;
    const door = new Mesh(new BoxGeometry(0.9, 2, 0.05), new MeshStandardMaterial({color: "#5b3a2a"}));
    door.position.set(0, 1, COTTAGE.depth / 2 + 0.03);
    group.add(walls, roof, door);
    return group;
}

async function asset(id: string, loader: GLTFLoader): Promise<Object3D | null> {
    const info = ASSETS[id];
    const file = info?.lods?.[0]?.file;
    if (!file) return null;
    const gltf = await loader.loadAsync(`${ASSET_BASE}/${file}`);
    return gltf.scene;
}

async function main() {
    const debug: Debug = {ready: false};
    (window as unknown as {__trueScale: Debug}).__trueScale = debug;
    const params = new URLSearchParams(location.search);
    const shot = TRUE_SCALE_SHOTS[params.get("shot") ?? "large"];
    const before = params.get("mode") === "before";
    const old = (window as unknown as {__oldDrawn?: Record<string, number>}).__oldDrawn ?? {};
    const width = innerWidth;
    const height = innerHeight;
    const renderer = new WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
    renderer.setPixelRatio(1);
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.toneMapping = ACESFilmicToneMapping;
    document.body.appendChild(renderer.domElement);
    const scene = new Scene();
    scene.background = new Color("#cfe0ec");
    scene.fog = new Fog("#cfe0ec", shot.camera.distance * 3, shot.camera.distance * 8);
    scene.add(new HemisphereLight("#eaf2ff", "#6d7a52", 0.9), new AmbientLight("#ffffff", 0.15));
    const sun = new DirectionalLight("#fff3df", 2.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const reach = shot.camera.distance * 1.4;
    Object.assign(sun.shadow.camera, {left: -reach, right: reach, top: reach, bottom: -reach, near: 0.01, far: reach * 6});
    scene.add(sun, sun.target);

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const manifest = (await (await fetch(`${MODELS}/manifest.json`)).json()) as {models: Record<string, string>};
    const placed: Array<{object: Object3D; length: number}> = [];
    const drawnInfo: NonNullable<Debug["drawn"]> = {};
    for (const item of shot.items) {
        if ("ref" in item) {
            let object: Object3D | null = null;
            let length = 0;
            if (item.ref === "person") [object, length] = [person(), 0.45];
            else if (item.ref === "fence") [object, length] = [fence(), 2.5];
            else if (item.ref === "cottage") [object, length] = [cottage(), COTTAGE.width];
            else {
                object = await asset(item.ref === "oak" ? "oak-a" : "boulder-a", loader);
                const box = object ? new Box3().setFromObject(object) : null;
                length = box ? box.max.x - box.min.x : 1;
                if (object && box) object.position.x -= box.min.x;
            }
            if (object) placed.push({object, length});
            continue;
        }
        const version = manifest.models[item.slug];
        if (!version) continue;
        const [gltf, info] = await Promise.all([loader.loadAsync(`${MODELS}/${item.slug}/${version}.near.glb`), fetch(`${MODELS}/${item.slug}/${version}.ark.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null)]);
        const model = gltf.scene;
        const box = new Box3().setFromObject(model);
        const size = box.getSize(new Vector3());
        const plan = (info as {behaviour?: {plan?: string}} | null)?.behaviour?.plan ?? null;
        const drawn = before ? old[item.slug] ?? arkBody({model_slug: item.slug}, plan).display : arkBody({model_slug: item.slug}, plan).display;
        const scale = drawn / bodyAxisExtent(item.slug, plan, size);
        model.scale.setScalar(scale);
        // Head toward +x (the models face +z), standing on the ground, its tail at the row's mark.
        const holder = new Group();
        model.rotation.y = Math.PI / 2;
        model.position.set(-box.min.z * scale, -box.min.y * scale, 0);
        holder.add(model);
        drawnInfo[item.slug] = {drawn, height: size.y * scale, length: size.z * scale};
        placed.push({object: holder, length: size.z * scale});
    }
    let x = 0;
    for (const {object, length} of placed) {
        object.position.x += x;
        object.traverse((child) => {
            const mesh = child as Mesh;
            if (mesh.isMesh) {
                mesh.castShadow = true;
                mesh.receiveShadow = true;
            }
        });
        scene.add(object);
        x += length + shot.gap;
    }
    const total = x - shot.gap;
    const ground = new Mesh(new PlaneGeometry(total * 4 + 40, total * 4 + 40), new MeshStandardMaterial({map: gridTexture((total * 4 + 40) / shot.grid), roughness: 1}));
    ground.rotation.x = -Math.PI / 2;
    ground.position.x = total / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    sun.position.set(total / 2 - reach * 0.6, reach * 1.6, reach * 1.2);
    sun.target.position.set(total / 2, 0, 0);
    // Far enough back for the whole row (with a margin), never nearer than the shot's own distance.
    const fov = shot.camera.fov ?? 38;
    const distance = Math.max(shot.camera.distance, (total / 2) / (Math.tan((fov * Math.PI) / 360) * (width / height)) * 1.12);
    const camera = new PerspectiveCamera(fov, width / height, Math.max(distance / 500, 0.002), distance * 20);
    camera.position.set(total / 2, shot.camera.height * (distance / shot.camera.distance), distance);
    camera.lookAt(total / 2, shot.camera.lookY, 0);
    renderer.render(scene, camera);
    debug.drawn = drawnInfo;
    debug.ready = true;
}

main().catch((error) => {
    (window as unknown as {__trueScale: Debug}).__trueScale = {ready: true, error: String(error?.stack ?? error)};
});
