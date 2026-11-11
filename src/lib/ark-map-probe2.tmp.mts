import {mapPoints} from "@/ark-scene/map/place";
import {launchPoints} from "@/ark-scene/map/species";
import {MAP_TAGS} from "@/ark-scene/map/tags";
const pts = mapPoints();
for (const tag of MAP_TAGS) {
  const want = launchPoints()[tag]; if (!want) continue;
  for (const wet of [false, true]) {
    const w = Object.entries(want).filter(([k]) => k.endsWith("~w") === wet).reduce((a, [, n]) => a + n, 0);
    if (!w) continue;
    const got = Array.from(pts.partitions(tag, wet).values()).flat().length;
    const cells = pts.cellsWith(tag, wet).length;
    if (got < w) console.log(tag, wet ? "wet" : "dry", "want", w, "got", got, "cells", cells);
  }
}
