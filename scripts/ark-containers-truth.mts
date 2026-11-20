// Container breeding (AnimalDex docs/ark/container-breeding.md; decision 416): where the town draws every kept animal (house and
// farm), asked of the town's own placement code, as the container ids the database stores (`containers.ts` drawnContainer).
// Run from this repo with its node_modules:
//   ./node_modules/.bin/tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-containers-truth.mts <town-animals.json> <truth.json>
// <town-animals.json>: the living animals of the town island as the public read sends them, plus area, island, enclosure, slot,
//   slot_rank, kind_species_profile_id, status (one read-only SELECT; AnimalDex scripts/ark/web/export-town.sql). Any `container`
//   in it is left off: this is the drawing by the rules, not the server's.
// <truth.json>: {households, rows: [{id, area, species, kind, name, slug, place, where, keeping, display, room, container}]}.
//   AnimalDex scripts/ark/containers_tool.py turns it into the containers the database stores (`container` is the same id it makes).
import {readFileSync, writeFileSync} from "node:fs";
import {placeTownAnimals} from "@/ark-scene/islands/town/placement";
import {townHouseholds} from "@/ark-scene/islands/town/areas";
import {drawnContainer} from "@/ark-scene/islands/town/containers";

const src = process.argv[2];
const out = process.argv[3];
const all = JSON.parse(readFileSync(src, "utf8")) as any[];
const present = all
    .filter((a) => a.status === "present")
    .map((a) => {
        const row = {...a, placeholder: !a.model_slug, model_slug: a.model_slug ?? `placeholder--${a.species_profile_id}`};
        delete row.container;
        return row;
    });
const res = placeTownAnimals(present as any);
const rows: any[] = [];
for (const a of present) {
    if (a.area !== "house" && a.area !== "farm") continue;
    const t = res.town.get(a.id);
    rows.push({
        id: a.id, area: a.area, species: a.species_profile_id, kind: a.kind_species_profile_id ?? a.species_profile_id, name: a.name, slug: a.model_slug,
        place: t?.place ?? null, where: t?.where ?? null, keeping: t?.keeping ?? null,
        display: t?.display?.id ?? null, room: t?.room ? {id: t.room.room.id, kind: t.room.room.kind} : null,
        container: t ? drawnContainer(t) : null
    });
}
writeFileSync(out, JSON.stringify({households: townHouseholds().map((h) => [h.id, h.kind]), rows}));
console.log("house+farm animals", rows.length, "households", townHouseholds().length);
