import {coastRadius, sampleGround} from "@/ark-scene/world";
import {sampleTownGround} from "@/ark-scene/islands/town/ground";
const theta = (-22.5 * Math.PI) / 180;
// Wild: the furthest land (height > 0) along theta from the origin.
let wild = 0;
for (let r = 0; r < 260; r += 0.25) if (sampleGround(Math.cos(theta) * r, Math.sin(theta) * r).height > 0) wild = r;
let town = 0;
const back = theta + Math.PI;
for (let r = 0; r < 237; r += 0.25) if (sampleTownGround(Math.cos(back) * r, Math.sin(back) * r).height > 0) town = r;
console.log({coastRadius: coastRadius(theta), wild, town, distance: wild + 250 + town});
