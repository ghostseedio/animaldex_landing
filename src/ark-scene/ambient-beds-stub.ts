/**
 * A stand-in for the ambient lane's `selectAmbientBeds` (`ambient-beds.ts`,
 * branch `ark-ambient`), with the same signature, so the sound player can be
 * wired and heard before that lands. When it does, `index.ts` imports the
 * real one instead (one line) and this file goes.
 *
 * It plays only the habitat banks already published with the chat's sounds
 * (`animal-chat-sounds/v1/habitat/…`), with their credits as listed in
 * docs/ark-credits.md ("Habitat beds used as ambience"), mixed by the pure
 * `ambientMix` (zone, shore, river, pond, hour, weather). Rain, night insects,
 * the dawn chorus and thunder have no bank yet: those are the ambient lane's.
 *
 * Its URLs are relative to the sound bucket's `v1/` folder; the player
 * resolves them against the storage host.
 */

import {ambientMix, type ArkSoundCredit} from "@/lib/ark-sound";
import {sunElevation} from "@/lib/ark-daylight";
import type {ArkTide, ArkWeather} from "@/lib/ark-clock";

export type AmbientBedsInput = {
    /** The zone round the camera's target (`ArkZone` or a land zone). */
    zone: string;
    weather: Pick<ArkWeather, "rain" | "wind" | "storm" | "insects">;
    /** The island's hour, 0–24. */
    hour: number;
    tide: Pick<ArkTide, "height">;
    cameraPos: {x: number; y: number; z: number};
    /** 0–1 how near open water the camera is (the shore, the river, the lake). */
    nearWater: number | boolean;
    /** The scene's finer split of `nearWater`, when it has one. */
    water?: {shore: number; river: number; pond: number};
    /** The camera is under the sea's surface. */
    underwater?: boolean;
};

export type AmbientBed = {id: string; url: string; gain: number; pan?: number; credits?: ArkSoundCredit[]};

const WIKI = "Wikimedia Commons";
const c = (recordist: string, license: string, source = WIKI): ArkSoundCredit => ({recordist, license, source, page: null});

/** The published habitat banks the beds may use (docs/ark-credits.md, from `published-habitats.csv`). */
const BANKS: Record<string, {path: string; credits: ArkSoundCredit[]}> = {
    shore: {path: "habitat/shore/sprite-9f77a0de.m4a", credits: [c("Jarrod stanley", "CC0"), c("Ganesh Mohan T", "CC BY-SA 4.0"), c("earthcalling", "Public domain"), c("Dsw4", "CC BY 3.0"), c("me", "CC BY-SA 3.0")]},
    grassland: {path: "habitat/grassland/sprite-5cea18c0.m4a", credits: [c("Beeld en Geluid", "CC BY-SA 3.0")]},
    river: {path: "habitat/river/sprite-6be9222a.m4a", credits: [c("Dirtslayer", "Public domain"), c("Amada44", "CC BY-SA 4.0"), c("Thomas Bresson", "CC BY 4.0"), c("stephan", "Public domain"), c("Dsw4", "Public domain"), c("National Park Service", "Public domain", "National Park Service")]},
    pond: {path: "habitat/pond/sprite-b8de66d4.m4a", credits: [c("Burkhard Mücke", "CC BY-SA 4.0"), c("thoschi", "CC0"), c("Andrew Migneault", "CC BY-SA 4.0"), c("Amuzujoe", "CC BY-SA 4.0")]},
    "forest-canopy": {path: "habitat/forest-canopy/sprite-a6e8f999.m4a", credits: [c("Robert EA Harvey", "CC BY-SA 4.0"), c("luc de bruijn", "CC BY 3.0"), c("Gravity Sound", "CC BY 4.0"), c("W.carter", "CC BY-SA 4.0")]},
    rainforest: {path: "habitat/rainforest/sprite-124204c6.m4a", credits: [c("Robert EA Harvey", "CC BY-SA 4.0"), c("Mijesty", "CC BY-SA 4.0"), c("Gravity Sound", "CC BY 4.0"), c("Beeld en Geluid", "CC BY-SA 3.0")]},
    "open-ocean": {path: "habitat/open-ocean/sprite-0809ccac.m4a", credits: [c("L. Ginzkey", "CC BY 2.5"), c("Crone T, Wilcock W, Barclay A, Parsons J", "CC BY 2.5")]},
    reef: {path: "habitat/reef/sprite-8e0e78d2.m4a", credits: [c("H.dav.are", "CC BY-SA 4.0"), c("Caldas-Morgan M, Alvarez-Rosario A, Rodrigues Padovese L", "CC BY 4.0")]},
    "snow-ice": {path: "habitat/snow-ice/sprite-e229331d.m4a", credits: [c("Beeld en Geluid", "CC BY-SA 3.0"), c("National Park Service", "Public domain", "National Park Service"), c("Ludwig Berger", "CC BY-SA 4.0")]},
    desert: {path: "habitat/desert/sprite-5e750224.m4a", credits: [c("Tvabutzku1234", "CC0"), c("Beeld en Geluid", "CC BY-SA 3.0"), c("胡蘿蔔", "CC0")]}
};

/** The beds round the camera now: the published banks only, by the pure mix. */
export function selectAmbientBeds(input: AmbientBedsInput): AmbientBed[] {
    const near = typeof input.nearWater === "number" ? input.nearWater : input.nearWater ? 1 : 0;
    const water = input.water ?? {shore: near, river: 0, pond: 0};
    const zone = input.zone;
    const mix = ambientMix({
        zones: {[zone === "rainforest" ? "rainforest" : zone]: 1},
        shore: water.shore,
        river: water.river,
        pond: water.pond,
        underwater: Boolean(input.underwater),
        altitude: Math.min(Math.max((input.cameraPos.y - 6) / 40, 0), 1) * (zone === "mountains" || zone === "polar" ? 1 : 0.4),
        hours: input.hour,
        elevation: sunElevation(input.hour),
        weather: input.weather
    });
    const windBank = zone === "polar" ? "snow-ice" : zone === "desert" ? "desert" : "grassland";
    const pick: Array<[string, string, number]> = [
        ["waves", "shore", mix.waves],
        ["wind", windBank, mix.wind],
        ["river", "river", mix.river],
        ["pond", "pond", mix.pond],
        ["forest_day", zone === "rainforest" ? "rainforest" : "forest-canopy", mix.forest_day],
        ["underwater", zone === "coral_reef" ? "reef" : "open-ocean", mix.underwater]
    ];
    return pick.filter(([, , gain]) => gain > 0.01).map(([id, bank, gain]) => ({id, url: BANKS[bank].path, gain, credits: BANKS[bank].credits}));
}
