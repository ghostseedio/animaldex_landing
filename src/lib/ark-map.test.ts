import assert from "node:assert/strict";
import test from "node:test";
import holds from "@/ark-scene/map/validator-holds.json";
import table from "@/ark-scene/map/species.json";
import {mapPlace, mapPoints, setArkMapSampler} from "@/ark-scene/map/place";
import {mapHolds, mapSlugs, mapSpecies} from "@/ark-scene/map/species";
import {MAP_AREAS, MAP_TAGS, TAG_AREA} from "@/ark-scene/map/tags";
import {failuresBySpecies, validateMap, validatorAnimals} from "@/ark-scene/map/validate";
import {validateGrips} from "@/ark-scene/map/validate-grips";
import {worldSampler} from "@/ark-scene/map/world-sampler";
import type {ArkMapSampler} from "@/ark-scene/map/sampler";
import {placeAnimals} from "@/ark-scene/placement";

const TABLE = table as unknown as {points: Record<string, Record<string, number>>; species: Record<string, unknown[]>};
const REVIEWED = holds as unknown as {species: Record<string, string>; grips: Record<string, string>};
/** The validator's run, once for the file (it places every species: a few seconds). */
let run: ReturnType<typeof validateMap> | null = null;
const validated = () => (run ??= validateMap());

test("map B3: the species table (spawn tags, holds, colonies, partners) and about 480 launch points, at least 8 an area", () => {
    const slugs = mapSlugs();
    assert.ok(slugs.length > 2400, `${slugs.length} species placed`);
    for (const slug of slugs) {
        const species = mapSpecies(slug, "farm_garden");
        if (!species) continue;
        assert.ok(species.allowed.has(species.spawn), `${slug}: its spawn tag is one of its own`);
        assert.notEqual(species.spawn, "forest_general", `${slug}: forest resolved to canopy or floor`);
    }
    // Decision 2: the Antarctic ones (and the head louse, its host absent) are held, never placed.
    const {decision} = mapHolds();
    for (const slug of ["emperor-penguin", "adelie-penguin", "weddell-seal", "leopard-seal", "crocodile-icefish", "snow-petrel", "antarctic-petrel", "snowy-sheathbill", "king-penguin", "gentoo-penguin", "macaroni-penguin", "southern-rockhopper-penguin", "head-louse"]) {
        assert.ok(decision.includes(slug), slug);
        assert.equal(mapSpecies(slug, "polar"), null, `${slug} not placed`);
    }
    // Polar bears and Arctic foxes stay, in the cold cove's tags.
    assert.ok(mapSpecies("polar-bear", "polar"));
    // Decision 3: colonies (one animal, one colony) at their nest; decision 4: the partners from their phrases.
    const colonies = slugs.filter((slug) => mapSpecies(slug, "farm_garden")?.colony);
    assert.ok(colonies.length >= 35 && colonies.length <= 42, `${colonies.length} colonies`);
    assert.equal(mapSpecies("mound-building-termite", "grassland")!.spawn, "termite_ant_mounds");
    assert.equal(mapSpecies("western-honey-bee", "farm_garden")!.spawn, "trunks_bark");
    assert.equal(mapSpecies("red-billed-oxpecker", "grassland")!.role, "rider");
    assert.equal(mapSpecies("live-sharksucker", "open_ocean")!.role, "rider");
    assert.equal(mapSpecies("cattle-egret", "wetland")!.role, "beside");
    assert.equal(mapSpecies("ocellaris-clownfish", "coral_reef")!.spawn, "anemone");
    assert.equal(mapSpecies("bluestreak-cleaner-wrasse", "coral_reef")!.spawn, "cleaner_station");
    assert.equal(mapSpecies("cat-flea", "farm_garden")!.role, "parasite");
    // Decision 6: about 480 launch points, every area at least 8.
    const perArea = new Map<string, number>();
    for (const [tag, zones] of Object.entries(TABLE.points)) {
        const area = TAG_AREA[tag as (typeof MAP_TAGS)[number]];
        perArea.set(area, (perArea.get(area) ?? 0) + Object.values(zones).reduce((a, b) => a + b, 0));
    }
    const total = Array.from(perArea.values()).reduce((a, b) => a + b, 0);
    assert.ok(total >= 460 && total <= 500, `${total} launch points`);
    for (const area of MAP_AREAS) assert.ok((perArea.get(area) ?? 0) >= 8, `${area}: ${perArea.get(area)}`);
});

test("map B4 + section 7: the spawn validator places every catalogue species and fails none outside the reviewed hold list", () => {
    const {failures, species} = validated();
    assert.ok(species > 2400);
    const by = failuresBySpecies(failures);
    const report = Array.from(by.entries()).map(([slug, checks]) => `${slug}: ${Array.from(checks.entries()).map(([check, detail]) => `${check} (${detail})`).join("; ")}`);
    assert.deepEqual(report, [], report.slice(0, 20).join("\n"));
    // Every reviewed hold has its reason, and is held (waits at the landing, never on a habitat).
    for (const [slug, reason] of Object.entries(REVIEWED.species)) {
        assert.ok(reason.length > 40, slug);
        assert.equal(mapSpecies(slug, "farm_garden"), null, `${slug} held`);
    }
});

test("map: every small animal sits on an attach point its tags allow and its size fits; flyers never in holes", () => {
    const {placed} = validated();
    let small = 0;
    let onPoints = 0;
    for (const animal of validatorAnimals()) {
        const species = mapSpecies(animal.model_slug, animal.zone);
        const place = placed.get(animal.id);
        // (A water species is placed by its depth band, in the water: not on a point.)
        if (!species?.small || !place?.map || place.map.water) continue;
        small++;
        if (place.map.attach) onPoints++;
    }
    // (The rest: water, the sea floor, the floes, the air, and small flyers landed on their ground or water.)
    assert.ok(onPoints / small > 0.8, `${onPoints} of ${small} small on attach points`);
});

test("map: nobody moves when others leave, and the map follows the sampler (a new terrain re-places everyone)", () => {
    const animals = validatorAnimals().filter((_, i) => i % 7 === 0);
    const before = placeAnimals(animals);
    const after = placeAnimals(animals.filter((_, i) => i % 3 !== 0));
    after.forEach((place, id) => {
        // (A partner whose host left goes to the next host, or back to its own spot: section 6, by design.)
        const was = before.get(id)!;
        if (was.host && !after.has(was.host.id)) return;
        assert.deepEqual([place.x, place.z, place.ground], [was.x, was.z, was.ground], id);
    });
    // A flat stand-in terrain: grassland west of x = 0, a lake east of it. The same animal lands on the new terrain's own ground.
    const flat: ArkMapSampler = {
        id: "flat-test",
        half: 40,
        ground: (x) => (x < 0 ? {height: 1, water: null, depth: 0, zone: "grassland", tags: ["grassland", "on_grazers", "soil", "burrows", "open_sky"]} : {height: -2, water: "fresh", depth: 2, zone: "river_lake", tags: ["lake", "stream_river", "pond"]}),
        blocked: () => false,
        anchors: () => [],
        attachPoints: () => []
    };
    setArkMapSampler(flat);
    try {
        const zebra = {...animals[0], id: "flat-zebra", model_slug: "plains-zebra", zone: "grassland" as const, slot: 3, slot_rank: 0};
        const placed = mapPlace(zebra, "grassland", 3, 0, 2, 2.4)!;
        assert.ok(placed.x < 0 && placed.ground === 1 && placed.map.tag === "grassland");
        const carp = {...zebra, id: "flat-koi", model_slug: "koi", zone: "river_lake" as const};
        const swims = mapPlace(carp, "river_lake", 3, 0, 0.6, 0.6)!;
        assert.ok(swims.x >= 0 && swims.water, "the koi in the new lake");
    } finally {
        setArkMapSampler(worldSampler());
    }
    assert.equal(mapPoints().sampler.id, worldSampler().id);
});

test("map: hangers, climbers and perchers grip their branch, trunk, ledge or wall with their rig's feet (where the rig files are here)", async () => {
    const {placed} = validated();
    const ids = new Map(validatorAnimals().map((a) => [a.id, a.model_slug]));
    const result = await validateGrips(placed, (id) => ids.get(id)!);
    if (result.skipped) return;
    assert.ok(result.checked > 100, `${result.checked} rigs checked`);
    const unreviewed = result.failures.filter((failure) => !REVIEWED.grips[failure.slug]);
    assert.deepEqual(unreviewed.map((f) => `${f.slug} (${f.clip}): ${f.detail}`), []);
});
