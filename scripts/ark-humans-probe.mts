// p5 (humans): where the town's people are at a pinned moment (for the frames' views). Prints JSON.
const {TownHumans, townHumanSites} = await import("../src/ark-scene/humans/town-humans.ts");
const {TrafficSim, townTraffic, roadHeight} = await import("../src/ark-scene/islands/town/render/vehicles.ts");
const day = Number(process.argv[2] ?? 20406);
const hours = Number(process.argv[3] ?? 11);
const epochMs = ((day - 4) * 24 + hours) * 3600 * 1000;
const sites = townHumanSites();
const sim = new TrafficSim(townTraffic(), () => []);
const cars = sim.at_(epochMs / 1000);
const humans = new TownHumans({origin: {x: 0, z: 0}, roadHeight});
humans.setRoster(Array.from({length: 112}, (_, i) => ({id: `fixture-human-${String(i).padStart(3, "0")}`})));
const list = humans.frame(epochMs, cars, townTraffic().cars.length);
const by: Record<string, number> = {};
for (const h of list) by[String(h.what)] = (by[String(h.what)] ?? 0) + 1;
console.log(JSON.stringify({seats: sites.seats.length, beach: sites.beach.length, walks: sites.walks, by, cars: cars?.filter((c) => c.active).map((c) => ({i: c.index, x: +c.x.toFixed(1), z: +c.z.toFixed(1), dx: +c.dx.toFixed(2), dz: +c.dz.toFixed(2)})), drawn: list.map((h) => ({w: h.what, x: +h.x.toFixed(1), y: +h.y.toFixed(2), z: +h.z.toFixed(1)})).slice(0, 80), seatsAt: sites.seats.map((s) => [s.bench, +s.x.toFixed(1), +s.y.toFixed(2), +s.z.toFixed(1), +s.yaw.toFixed(2)])}));
