// Each step of the town's build with the prebuild's data (decision 153): the longest is what a slice can overrun by.
const {townBuildData, townIslandSteps} = await import("@/ark-scene/islands/town/render/index");
const {launchEnclosures} = await import("@/ark-scene/islands/town/areas");
const open = launchEnclosures();
const built = townBuildData(open);
const steps = townIslandSteps({tier: "low", zooOpen: open, built});
const times: number[] = [];
for (;;) {
    const t = performance.now();
    const next = steps.next();
    times.push(performance.now() - t);
    if (next.done) break;
}
const top = times.map((ms, i) => ({i, ms: Math.round(ms * 10) / 10})).sort((a, b) => b.ms - a.ms).slice(0, 8);
console.log("steps", times.length, "total", Math.round(times.reduce((a, b) => a + b, 0)), "longest", JSON.stringify(top));
