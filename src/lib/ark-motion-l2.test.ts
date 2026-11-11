import assert from "node:assert/strict";
import test from "node:test";
import {
    bankAngle,
    beatHeave,
    CLIP_BANK,
    displayBeat,
    dartPose,
    FLAP_DISPLAY_HZ,
    flightPaces,
    flightRhythm,
    flightRigFrame,
    flightSpec,
    flightSpecOf,
    G,
    newFlightMemory,
    stoopPose,
    strokeToClipPhase,
    upstrokeFold,
    wingbeatHz,
    type FlightRigInput,
    type FlightSpec
} from "@/ark-scene/locomotion/flight";
import {decodeFlight, decodeStyleRow, locoStyle, locoStyleSlugs} from "@/ark-scene/locomotion/styles";
import {readWaveChannel, swimBend, swimSurfaceGuard, SWIM_SURFACE_CLEAR, swimCycles, swimEnvelope, swimHeadroom, swimPaces, SWIM, SWIM_DISPLAY_HZ, tailBeatHz, waveChannel, newSwimMemory} from "@/ark-scene/locomotion/swim";
import {LEGLESS, leglessCycles, leglessMode, leglessPoint, leglessShape, leglessSlip, newLeglessMemory, sidewindYaw} from "@/ark-scene/locomotion/legless";
import {arkBody} from "@/ark-scene/stats";
import {MOTION_L2_THRESHOLDS} from "@/lib/ark-motion-l2-thresholds";

// Lane L2 of the motion pass (flight, swimming, legless): the CI metrics. Thresholds: src/lib/ark-motion-l2-thresholds.ts.

const bird = (style: string, lengthM: number) => flightSpecOf(decodeFlight(style), lengthM)!;

// MARK: Wing-beat rate against size

test("L2 metric: wing-beat rate falls with size (birds), within the literature for reference species", () => {
    const refs: Array<[string, string, number, number, number]> = [
        // [name, code, length m, low Hz, high Hz] (Pennycuick 1996/2001; Greenewalt 1962)
        ["house sparrow", "b", 0.15, 10, 20],
        ["feral pigeon", "c1.15", 0.32, 5, 9],
        ["mallard", "c1.35", 0.58, 4.5, 8],
        ["atlantic puffin", "c1.3", 0.28, 8, 14],
        ["barn owl", "g0.75", 0.36, 2.5, 5],
        ["grey heron", "g0.8", 0.95, 1.8, 3.5],
        ["golden eagle", "s0.8d", 0.85, 1.5, 3.5],
        ["mute swan", "c1.35", 1.42, 2, 4],
        ["ruby-throated hummingbird", "h", 0.08, 30, 80],
        ["vampire bat", "t", 0.08, 8, 16],
        ["flying fox", "t", 0.3, 2.5, 5.5]
    ];
    for (const [name, code, L, lo, hi] of refs) {
        const hz = wingbeatHz(decodeFlight(code)!, L);
        assert.ok(hz >= lo && hz <= hi, `${name}: ${hz.toFixed(2)} Hz, expected ${lo}-${hi}`);
    }
    // Monotonic: a longer bird of the same style beats slower.
    let last = Infinity;
    for (let L = 0.08; L <= 2; L *= 1.15) {
        const hz = wingbeatHz(decodeFlight("c")!, L);
        assert.ok(hz < last, `continuous flapper at ${L.toFixed(2)} m: ${hz} < ${last}`);
        last = hz;
    }
    // The fitted exponent over the catalogue's birds: f ∝ L^k with k near -0.96 (m^-0.33 with m ∝ L^2.9).
    const xs: number[] = [];
    const ys: number[] = [];
    for (const slug of locoStyleSlugs()) {
        const f = locoStyle(slug).flight;
        if (!f || f.kind !== "bird" || f.style === "hover") continue;
        const L = arkBody({model_slug: slug}).metres;
        xs.push(Math.log(L));
        ys.push(Math.log(wingbeatHz(f, L) / f.factor));
    }
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    assert.ok(n > 400, `${n} birds measured`);
    assert.ok(slope < MOTION_L2_THRESHOLDS.wingbeatSlopeMax && slope > MOTION_L2_THRESHOLDS.wingbeatSlopeMin, `wing-beat slope against length ${slope.toFixed(3)}`);
});

test("L2 metric: a beat faster than the display cap is shown at the cap with a smaller stroke, never aliased", () => {
    assert.deepEqual(displayBeat(6), {hz: 6, stroke: 1});
    const bee = displayBeat(190);
    assert.equal(bee.hz, FLAP_DISPLAY_HZ);
    assert.ok(bee.stroke >= 0.35 && bee.stroke < 0.5);
    const sparrow = displayBeat(12.4);
    assert.equal(sparrow.hz, FLAP_DISPLAY_HZ);
    assert.ok(sparrow.stroke > 0.85);
    // Every flyer in the table: a shown rate at most the cap, at least 6 frames a beat at 60 fps.
    for (const slug of locoStyleSlugs()) {
        const spec = flightSpec(slug, arkBody({model_slug: slug}).metres);
        if (!spec) continue;
        assert.ok(spec.hz <= FLAP_DISPLAY_HZ + 1e-9 && spec.hz > 0.5, `${slug}: shown ${spec.hz} Hz`);
        assert.ok(Number.isFinite(spec.trueHz) && spec.trueHz > 0.5, `${slug}: true ${spec.trueHz} Hz`);
    }
});

// MARK: The beat's shape

test("L2: the downstroke is the slower, fuller stroke; the hand flexes only on the upstroke; the body rises on the downstroke", () => {
    const d = 0.58;
    // The flap clip: 0 wings up, 0.5 wings down. The downstroke spans the first 58% of the beat.
    assert.ok(Math.abs(strokeToClipPhase(0, d)) < 1e-9);
    assert.ok(Math.abs(strokeToClipPhase(d - 1e-9, d) - 0.5) < 1e-6);
    assert.ok(Math.abs(strokeToClipPhase(1 - 1e-9, d) - 1) < 1e-6);
    let last = -1;
    for (let b = 0; b < 1; b += 0.01) {
        const q = strokeToClipPhase(b, d);
        assert.ok(q >= last - 1e-9, `monotonic at ${b}`);
        last = q;
    }
    // A smaller stroke stays near the middle of the clip's stroke.
    const half = strokeToClipPhase(0, d, 0.4);
    assert.ok(half > 0.15 && half < 0.25, `whir top ${half}`);
    for (let b = 0; b < d; b += 0.02) assert.equal(upstrokeFold(b, d), 0, `no fold on the downstroke at ${b}`);
    assert.ok(upstrokeFold(d + (1 - d) / 2, d) > 0.99);
    assert.ok(beatHeave(0, d) < -0.99 && beatHeave(d, d) > 0.99, "low at the top of the stroke, high at its bottom");
});

// MARK: Bank against turn rate

test("L2 metric: the bank angle is the coordinated turn's, tan φ = v ω / g, within the limits", () => {
    for (const v of [3, 8, 15]) {
        for (const w of [-1.2, -0.4, 0, 0.3, 0.9]) {
            const phi = bankAngle(v, w);
            const want = Math.max(Math.min(Math.atan((v * w) / G), 1.05), -1.05);
            assert.ok(Math.abs(phi - want) < 1e-12);
        }
    }
    // The rig frame flies with it: flapping, the instance rolls the whole bank; on a bank clip, the clip's 25° plus the rest.
    const spec = bird("g", 0.5);
    const base = (turn: number, extra: Partial<FlightRigInput> = {}): FlightRigInput => ({spec, has: () => true, clipHz: () => 4, current: "flap", phase: 0, climb: 0, turn, speed: 9, agl: 30, clock: 100, seed: 0.3, dt: 1 / 60, ...extra});
    const memory = newFlightMemory();
    memory.takeoffAt = -100;
    let worst = 0;
    for (const turn of [-0.8, -0.3, 0.2, 0.6]) {
        const frame = flightRigFrame(base(turn, {beat: "glide"}), memory);
        const phi = bankAngle(9, turn, spec.bankMax);
        const total = -frame.roll + (frame.clip === "bank_l" ? CLIP_BANK : frame.clip === "bank_r" ? -CLIP_BANK : 0);
        worst = Math.max(worst, Math.abs(total - phi));
    }
    assert.ok(worst < MOTION_L2_THRESHOLDS.bankErrorMax + 0.09, `bank error ${worst}`);
});

// MARK: Take-off, flight, landing

const inputFor = (spec: FlightSpec, extra: Partial<FlightRigInput>): FlightRigInput => ({spec, has: () => true, clipHz: () => 5, current: null, phase: 0, climb: 0, turn: 0, speed: 8, agl: 20, clock: 50, seed: 0.42, dt: 1 / 60, ...extra});

test("L2: take-off snaps up on its clip, then beats hard; level flight beats at the cruise rate; a flare near the ground", () => {
    const spec = bird("c1.35", 0.58);
    const memory = newFlightMemory();
    const t0 = flightRigFrame(inputFor(spec, {oneShot: "takeoff", phase: 0.1, clock: 10}), memory);
    assert.equal(t0.clip, "takeoff");
    assert.ok(t0.rate > 1.2);
    const t1 = flightRigFrame(inputFor(spec, {oneShot: "takeoff", phase: 0.5, clock: 10.4, climb: 0.4}), memory);
    assert.equal(t1.clip, "flap");
    assert.ok(t1.hz > spec.hz * 1.3 - 1e-9, `hard flaps ${t1.hz} vs cruise ${spec.hz}`);
    const cruise = flightRigFrame(inputFor(spec, {clock: 20, climb: 0}), memory);
    assert.equal(cruise.clip, "flap");
    assert.ok(Math.abs(cruise.hz - spec.hz) < 1e-9);
    // Coming down near the ground: the flare pitches the body up (negative pitch) and keeps it beating to brake.
    for (let i = 0; i < 30; i++) flightRigFrame(inputFor(spec, {clock: 30 + i / 60, climb: -0.3, agl: 0.8}), memory);
    const flare = flightRigFrame(inputFor(spec, {clock: 30.5, climb: -0.3, agl: 0.6}), memory);
    assert.equal(flare.flightMode, "flare");
    assert.ok(flare.pitch < -0.4, `flare pitch ${flare.pitch}`);
    const land = flightRigFrame(inputFor(spec, {oneShot: "land", clock: 31}), memory);
    assert.equal(land.clip, "land");
});

test("L2: flight styles: a sparrow bounds, a gull flap-glides, an eagle soars with trims, a hummingbird hovers", () => {
    const sparrow = bird("b", 0.15);
    const modes = new Set<string>();
    const memory = newFlightMemory();
    for (let t = 0; t < 6; t += 1 / 60) modes.add(flightRigFrame(inputFor(sparrow, {clock: 100 + t, dt: 1 / 60}), memory).flightMode);
    assert.ok(modes.has("flap") && modes.has("bound"), `sparrow: ${[...modes]}`);
    const gull = bird("s0.9d", 0.6);
    const gm = newFlightMemory();
    const g1 = flightRigFrame(inputFor(gull, {clock: 200, beat: "glide"}), gm);
    assert.ok(g1.clip === "soar" || g1.clip === "glide", g1.clip);
    const eagle = bird("s0.8d", 0.85);
    const trims = new Set<number>();
    const em = newFlightMemory();
    for (let t = 0; t < 4; t += 0.5) trims.add(Math.round(flightRigFrame(inputFor(eagle, {clock: 300 + t, soaring: true}), em).roll * 1000));
    assert.ok(trims.size > 3, "small wing adjustments: the trim changes");
    const hummer = bird("h", 0.08);
    const hm = newFlightMemory();
    assert.equal(flightRigFrame(inputFor(hummer, {speed: 0.01}), hm).clip, "hover");
    // A flap bout ends on a whole beat: the beat never jumps mid-stroke into a glide.
    const fm = newFlightMemory();
    const spec = bird("g", 0.6);
    let previous = flightRigFrame(inputFor(spec, {clock: 0}), fm);
    for (let t = 1 / 60; t < 20; t += 1 / 60) {
        const frame = flightRigFrame(inputFor(spec, {clock: t}), fm);
        if (previous.clip === "flap" && frame.clip !== "flap") assert.ok(previous.beat > 0.85 || previous.beat < 0.12, `bout ended at beat ${previous.beat}`);
        previous = frame;
    }
});

test("L2: the rhythm is the same for every viewer (closed form on the shared clock)", () => {
    const spec = bird("b", 0.15);
    for (const t of [0, 1.3, 77.7, 12345.6]) assert.deepEqual(flightRhythm(spec, t, 0.3), flightRhythm(spec, t, 0.3));
    assert.deepEqual(dartPose(10, 0.2, spec), dartPose(10, 0.2, spec));
});

test("L2: paces for L7: burst above cruise, a raptor's stoop well above both, a stoop folds then flares", () => {
    const eagle = flightPaces("bird", "soar", 0.85, true);
    assert.ok(eagle.burst > eagle.cruise * 1.5 && eagle.dive > eagle.burst * 1.5 && eagle.dive <= 90);
    const swallow = flightPaces("bird", "flap_glide", 0.18);
    assert.ok(swallow.cruise > 5 && swallow.cruise < 12, `swallow cruise ${swallow.cruise}`);
    const roll = stoopPose(0.05);
    const stoop = stoopPose(0.5);
    const flare = stoopPose(0.99);
    assert.equal(roll.clip, "glide");
    assert.equal(stoop.clip, "plunge");
    assert.ok(stoop.pitch > 0.9 && stoop.fold === 1);
    assert.equal(flare.clip, "flap");
    assert.ok(flare.pitch < -0.4 && flare.fold < 0.1);
});

// MARK: Tail-beat rate against speed

test("L2 metric: the tail beat follows speed (f = hold + U / stride), the reference swimmers within the literature", () => {
    const refs: Array<[string, "subcarangiform" | "cetacean" | "thunniform" | "anguilliform" | "mobuliform", number, number, number, number]> = [
        // [name, style, length m, speed m/s, low Hz, high Hz]
        ["trout cruising", "subcarangiform", 0.3, 0.6, 2, 5],
        ["trout bursting", "subcarangiform", 0.3, 2.4, 9, 16],
        ["bottlenose dolphin", "cetacean", 2.5, 3, 1, 2.5],
        ["blue whale", "cetacean", 25, 2.5, 0.08, 0.3],
        ["bluefin tuna", "thunniform", 2, 4, 1.8, 3.5],
        ["european eel", "anguilliform", 0.7, 0.4, 1, 2.2],
        ["manta ray", "mobuliform", 4, 1.2, 0.2, 0.6]
    ];
    for (const [name, style, L, U, lo, hi] of refs) {
        const hz = tailBeatHz(U / L, style);
        assert.ok(hz >= lo && hz <= hi, `${name}: ${hz.toFixed(2)} Hz, expected ${lo}-${hi}`);
    }
    // Linear in speed, the slope one over the stride, for every style (below the style's cap).
    for (const [style, p] of Object.entries(SWIM)) {
        const a = tailBeatHz(0.1, style as keyof typeof SWIM);
        const b = tailBeatHz(0.3, style as keyof typeof SWIM);
        assert.ok(Math.abs((b - a) / 0.2 - 1 / p.stride) < 1e-9, `${style} slope`);
    }
    // Played by the distance swum: a burst at 2.2 times cruise beats 2.2 times as often (less the fin beat).
    const style = "cetacean";
    const L = 2.5;
    const run = (speed: number) => {
        const m = newSwimMemory();
        for (let i = 0; i < 600; i++) swimCycles(m, style, (speed * 1) / 60, 1 / 60, L);
        return m.cycles / 10;
    };
    const cruise = swimPaces(L, style).cruise;
    const ratio = (run(cruise * 2.2) - SWIM[style].hold) / (run(cruise) - SWIM[style].hold);
    assert.ok(Math.abs(ratio - 2.2) < MOTION_L2_THRESHOLDS.tailBeatRatioError, `burst/cruise beat ratio ${ratio}`);
    // Never shown faster than the cap.
    const fast = newSwimMemory();
    swimCycles(fast, "subcarangiform", 10, 1 / 60, 0.1);
    assert.ok(fast.cycles <= SWIM_DISPLAY_HZ / 60 + 1e-9);
});

test("L2: each swimming mode bends where it should (eels whole body, tuna only the tail, whales up and down)", () => {
    assert.ok(swimEnvelope("anguilliform", 0) > 0.25, "an eel's head moves");
    assert.ok(swimEnvelope("thunniform", 0.5) < 0.1, "a tuna's middle stays stiff");
    assert.ok(swimEnvelope("subcarangiform", 0.5) > swimEnvelope("carangiform", 0.5), "a trout bends further forward than a jack");
    assert.equal(SWIM.cetacean.axis, "y");
    assert.equal(SWIM.subcarangiform.axis, "x");
    // The wave runs head to tail: a crest moves tailward as the phase grows.
    const crest = (phase: number) => {
        let best = 0;
        let at = 0;
        for (let s = 0; s <= 1; s += 0.01) {
            const b = swimBend("anguilliform", s, phase) / swimEnvelope("anguilliform", s);
            if (b > best) {
                best = b;
                at = s;
            }
        }
        return at;
    };
    assert.ok(crest(0.35) > crest(0.3));
    // The body channel round-trips.
    for (const [phase, gain] of [[0, 0], [0.25, 0.5], [0.999, 1], [3.7, 0.33]]) {
        const back = readWaveChannel(waveChannel(phase, gain))!;
        assert.ok(Math.abs(back.phase - (phase - Math.floor(phase))) < 4e-5);
        assert.ok(Math.abs(back.gain - gain) < 0.003);
    }
    assert.equal(readWaveChannel(0), null);
});

// MARK: Water surface

test("L2 metric: a swimmer's flukes and tail stay under the surface at the top of its band (the surface guard)", () => {
    // The depth fit keeps the body's top SURFACE_CLEAR under the surface at its shallowest; the up-and-down wave lifts
    // the flukes and the band's own pitch (±0.2) lifts the tail on top of that. Before the guard, every up-and-down
    // swimmer broke the surface with its flukes there; after it, none does (heights: the body plan's aspect).
    const ASPECT: Record<string, number> = {cetacean: 0.22, sirenian: 0.3, flatfish: 0.12, rajiform: 0.12, mobuliform: 0.12};
    let before = 0;
    let after = 0;
    let checked = 0;
    for (const slug of locoStyleSlugs()) {
        const swim = locoStyle(slug).swim;
        if (!swim || SWIM[swim].axis !== "y") continue;
        checked++;
        const length = arkBody({model_slug: slug}).display;
        const height = length * (ASPECT[swim] ?? 0.25);
        const middle = -SWIM_SURFACE_CLEAR - height / 2;
        const base = middle - height / 2;
        const lift = swimHeadroom(swim) * length + Math.abs(Math.sin(0.2)) * length * 0.5;
        if (base + height + lift > -1e-6) before++;
        const guarded = swimSurfaceGuard(base, height, length, swim, 0.2, 0);
        if (guarded + height + lift > -SWIM_SURFACE_CLEAR + 1e-9) after++;
    }
    assert.ok(checked > 25, `${checked} up-and-down swimmers`);
    assert.ok(before > 0, "the metric sees the breach the guard fixes");
    assert.ok(after <= MOTION_L2_THRESHOLDS.surfaceBreachesMax, `${after} of ${checked} break the surface`);
});

// MARK: Legless

test("L2 metric: lateral undulation does not slip (every point on the head's track); sidewinders lie across their way", () => {
    assert.ok(leglessSlip("lateral") < MOTION_L2_THRESHOLDS.leglessSlipMax, `slip ${leglessSlip("lateral")}`);
    assert.equal(locoStyle("sidewinder").legless, "sidewind");
    assert.equal(locoStyle("desert-horned-viper").legless, "sidewind");
    assert.ok(Math.abs(sidewindYaw(0.2)) > 0.8);
    // Sidewinding: only part of the body touches the ground at a time.
    const shape = leglessShape("sidewind");
    let lifted = 0;
    for (let s = 0; s <= 1; s += 0.02) if (leglessPoint(shape, s, 0.37).lift > shape.lift * 0.2) lifted++;
    assert.ok(lifted > 10 && lifted < 40, `${lifted} of 51 points lifted`);
    // A heavy python crawls straight when slow and undulates when faster.
    assert.equal(leglessMode("rectilinear", 0.05).mode, "rectilinear");
    assert.equal(leglessMode("rectilinear", 0.5).mode, "lateral");
    // Played by distance: standing still, no cycles.
    const m = newLeglessMemory(0.5);
    leglessCycles(m, "lateral", 0, 1 / 60, 1);
    assert.equal(m.cycles, 0.5);
    leglessCycles(m, "lateral", 0.1, 1 / 60, 1);
    assert.ok(Math.abs(m.cycles - (0.5 + 0.1 / LEGLESS.lateral.advance)) < 1e-9);
});

// MARK: The table

test("L2: the styles table decodes, covers the flyers and swimmers, and quotes stored text for sidewinding", () => {
    const style = decodeStyleRow("s0.8d|w||");
    assert.equal(style.flight?.style, "soar");
    assert.equal(style.flight?.factor, 0.8);
    assert.equal(style.flight?.stoops, true);
    assert.equal(decodeFlight("w190")?.insectHz, 190);
    assert.equal(decodeFlight("h35")?.kind, "insect");
    assert.equal(decodeFlight("h")?.kind, "bird");
    assert.equal(locoStyle("mallard").ground?.gait, "waddle");
    assert.equal(locoStyle("house-sparrow").ground?.gait, "hop");
    assert.ok(locoStyle("blue-whale").swim === "cetacean");
    assert.ok(locoStyle("great-white-shark").swim === "thunniform");
    assert.ok(locoStyle("reef-manta-ray").swim === "mobuliform");
    assert.equal(locoStyle("not-a-species", "fish").swim, "subcarangiform");
    assert.equal(locoStyle("not-a-species", "fish").fallback, true);
    const counts = {flight: 0, swim: 0, legless: 0};
    for (const slug of locoStyleSlugs()) {
        const s = locoStyle(slug);
        if (s.flight) counts.flight++;
        if (s.swim) counts.swim++;
        if (s.legless) counts.legless++;
    }
    assert.ok(counts.flight > 800 && counts.swim > 250 && counts.legless > 60, JSON.stringify(counts));
});
