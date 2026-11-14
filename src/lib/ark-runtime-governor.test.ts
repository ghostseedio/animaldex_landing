import assert from "node:assert/strict";
import test from "node:test";
import {CALM_AFTER, displayCap, refreshPeriod, DROWSY_AFTER, powerCap, POWER_DEFAULT, RenderGovernor} from "@/ark-scene/runtime/governor";
import {lowBattery, parsePowerMessage, parseVisibleMessage, pressureThermal} from "@/ark-scene/runtime/power";

const idle = {busy: false, reducedMotion: false};

test("runtime governor: full while touched or busy, calm then drowsy when left alone, still under reduced motion", () => {
    const governor = new RenderGovernor(0);
    governor.setActivity(idle);
    assert.equal(governor.mode(1), "full");
    assert.equal(governor.mode(CALM_AFTER + 0.1), "calm");
    assert.equal(Math.round(governor.interval(CALM_AFTER + 0.1)), 33);
    assert.equal(governor.mode(DROWSY_AFTER + 1), "drowsy");
    assert.equal(governor.interval(DROWSY_AFTER + 1), 50);
    // A flight, a follow, a replay, a talking animal: every frame, whatever the input.
    governor.setActivity({busy: true, reducedMotion: false});
    assert.equal(governor.mode(DROWSY_AFTER + 1), "full");
    assert.equal(governor.interval(DROWSY_AFTER + 1), 0);
    // Input brings it back to full at once.
    governor.setActivity(idle);
    governor.input(500);
    assert.equal(governor.mode(500.5), "full");
    // Reduced motion and nothing moving: a few frames a second.
    governor.setActivity({busy: false, reducedMotion: true});
    assert.equal(governor.mode(500 + CALM_AFTER + 1), "still");
    assert.equal(governor.interval(500 + CALM_AFTER + 1), 250);
});

test("runtime governor: paused when the page is hidden, scrolled away or covered in the app; wakes the loop once", () => {
    const governor = new RenderGovernor(0);
    let wakes = 0;
    governor.onWake = () => wakes++;
    assert.equal(governor.visible(), true);
    governor.setHostVisible(false);
    assert.equal(governor.visible(), false);
    assert.equal(governor.mode(1), "paused");
    assert.equal(governor.shouldDraw(1000, 900), false);
    assert.equal(governor.uncapped(1), false);
    governor.setDocumentHidden(true);
    governor.setHostVisible(true);
    assert.equal(wakes, 0, "still hidden: the document is");
    governor.setDocumentHidden(false);
    assert.equal(wakes, 1);
    governor.setOnScreen(false);
    governor.setOnScreen(true);
    assert.equal(wakes, 2);
    governor.setOnScreen(true);
    assert.equal(wakes, 2, "no wake without a pause");
});

test("runtime governor: draws on the frame the cap allows (a little early is fine), every frame when uncapped", () => {
    const governor = new RenderGovernor(0);
    governor.setActivity(idle);
    assert.equal(governor.shouldDraw(500, 490), true, "full: every display frame");
    const t = (CALM_AFTER + 1) * 1000;
    assert.equal(governor.shouldDraw(t, t - 16.7), false, "calm: not the next 60 Hz frame");
    assert.equal(governor.shouldDraw(t, t - 33.4), true, "calm: the one after");
    assert.equal(governor.shouldDraw(t, t - 30), true, "display jitter: up to 4 ms early");
    assert.equal(governor.shouldDraw(t, 0), true, "the first frame always draws");
});

test("runtime governor: battery saver and heat cap the frame rate and ask for the low tier; the app's word wins", () => {
    assert.deepEqual(powerCap(POWER_DEFAULT), {interval: 0, lowTier: false, pixelRatio: null});
    assert.equal(powerCap({...POWER_DEFAULT, saver: true}).lowTier, true);
    assert.equal(Math.round(powerCap({...POWER_DEFAULT, saver: true}).interval), 33);
    assert.equal(powerCap({...POWER_DEFAULT, thermal: "fair"}).lowTier, false);
    assert.equal(powerCap({...POWER_DEFAULT, thermal: "serious"}).lowTier, true);
    assert.deepEqual(powerCap({...POWER_DEFAULT, thermal: "critical"}), {interval: 50, lowTier: true, pixelRatio: 1});
    // A low battery, not charging, counts as saver; charging it does not.
    assert.equal(powerCap({...POWER_DEFAULT, battery: 0.15, charging: false}).lowTier, true);
    assert.equal(powerCap({...POWER_DEFAULT, battery: 0.15, charging: true}).lowTier, false);
    assert.equal(powerCap({...POWER_DEFAULT, battery: 0.15, charging: null}).lowTier, false, "unknown charging: no guess");

    const governor = new RenderGovernor(0);
    const told: string[] = [];
    governor.onPower = (power) => told.push(`${power.saver}/${power.thermal}`);
    governor.setBrowserPower({thermal: "serious"});
    assert.equal(governor.tierCap(), "low");
    assert.equal(governor.interval(0.5), 1000 / 30, "the cap applies even while touched");
    governor.setHostPower({thermal: "nominal", saver: false});
    assert.equal(governor.tierCap(), null, "the app's nominal beats the browser's pressure");
    governor.setHostPower(null);
    assert.equal(governor.tierCap(), "low", "the app stopped saying: the browser's again");
    governor.setBrowserPower({thermal: "serious"});
    assert.deepEqual(told, ["false/serious", "false/nominal", "false/serious"], "told only when the cap changes");
});

test("runtime bridge: ark:visible and ark:power are read strictly; anything malformed is ignored", () => {
    assert.equal(parseVisibleMessage({type: "ark:visible", visible: false}), false);
    assert.equal(parseVisibleMessage({type: "ark:visible", value: true}), true);
    assert.equal(parseVisibleMessage({type: "ark:visible", visible: "no"}), null);
    assert.equal(parseVisibleMessage({type: "ark:select"}), null);
    assert.equal(parseVisibleMessage(null), null);

    assert.equal(parsePowerMessage({type: "ark:lite"}), undefined);
    assert.equal(parsePowerMessage({type: "ark:power", power: null}), null);
    assert.deepEqual(parsePowerMessage({type: "ark:power", saver: true, thermal: "serious"}), {saver: true, thermal: "serious"});
    assert.deepEqual(parsePowerMessage({type: "ark:power", power: {thermal: "critical", battery: 0.4, charging: false}}), {thermal: "critical", battery: 0.4, charging: false});
    // Android reports the battery in percent; an unknown heat word is dropped, not guessed.
    assert.deepEqual(parsePowerMessage({type: "ark:power", battery: 35, thermal: "hot", saver: 1}), {battery: 0.35});
    assert.equal(lowBattery({battery: 0.1, charging: false}), true);
    assert.equal(lowBattery({battery: 0.1}), false);
    // CPU pressure is not only heat: critical counts as serious, serious as fair (no change).
    assert.equal(pressureThermal("critical"), "serious");
    assert.equal(pressureThermal("serious"), "fair");
    assert.equal(pressureThermal("whatever"), "nominal");
});

test("runtime governor: the visibility hook fires on every flip, the app's ark:visible included (the sound follows it)", () => {
    const governor = new RenderGovernor(0);
    const seen: boolean[] = [];
    governor.onVisibility = (visible) => seen.push(visible);
    governor.setHostVisible(false);
    governor.setHostVisible(false);
    governor.setDocumentHidden(true);
    governor.setHostVisible(true);
    governor.setDocumentHidden(false);
    assert.deepEqual(seen, [false, true], "only real flips: hidden by the app, shown again once both allow");
});

test("runtime governor: a fast display is drawn every other refresh, a 60 to 90 Hz one at its own rate", () => {
    assert.equal(displayCap(1000 / 60), 0);
    assert.equal(displayCap(1000 / 90), 0);
    assert.ok(Math.abs(displayCap(1000 / 120) - 1000 / 60) < 1e-9);
    assert.ok(Math.abs(displayCap(1000 / 144) - 1000 / 72) < 1e-9);
    assert.ok(Math.abs(displayCap(1000 / 240) - 1000 / 60) < 1e-9);
    assert.equal(displayCap(0), 0);

    // Frames drawn over a second of refreshes, each drawn frame taking `workMs` of the main thread.
    const drawnIn = (hz: number, workMs: number, measured = true) => {
        const governor = new RenderGovernor(0);
        governor.setActivity({busy: true, reducedMotion: false});
        if (measured) governor.setDisplayInterval(1000 / hz);
        const refresh = 1000 / hz;
        const drawn: number[] = [];
        let busyUntil = 0;
        for (let k = 1; k <= hz; k++) {
            const t = k * refresh;
            // (A frame still being worked on misses this refresh.)
            if (t < busyUntil - 0.01) continue;
            if (!governor.shouldDraw(t, drawn[drawn.length - 1] ?? 0)) continue;
            drawn.push(t);
            busyUntil = t + workMs;
        }
        const gaps = drawn.slice(1).map((t, i) => Math.round((t - drawn[i]) * 10) / 10);
        return {frames: drawn.length, gaps: Array.from(new Set(gaps))};
    };
    assert.deepEqual(drawnIn(60, 6), {frames: 60, gaps: [16.7]});
    assert.deepEqual(drawnIn(90, 6), {frames: 90, gaps: [11.1]});
    // 120 Hz: a steady 60, whether a frame takes 4, 9 or 12 ms (uncapped, 9 ms frames alternate 8.3 and 16.7 ms).
    assert.deepEqual(drawnIn(120, 4), {frames: 60, gaps: [16.7]});
    assert.deepEqual(drawnIn(120, 12), {frames: 60, gaps: [16.7]});
    assert.deepEqual(drawnIn(144, 5), {frames: 72, gaps: [13.9]});
    assert.deepEqual(drawnIn(240, 5), {frames: 60, gaps: [16.7]});
    // Not measured yet: every refresh, as before.
    assert.equal(drawnIn(120, 4, false).frames, 120);

    // The idle and pacing caps still hold on a fast display (30 a second: every fourth refresh at 120 Hz).
    const calm = new RenderGovernor(0);
    calm.setActivity(idle);
    calm.setDisplayInterval(1000 / 120);
    const t = (CALM_AFTER + 1) * 1000;
    assert.equal(calm.shouldDraw(t, t - 16.7), false);
    assert.equal(calm.shouldDraw(t, t - 25), false);
    assert.equal(calm.shouldDraw(t, t - 33.3), true);
    // Full rate on a fast display still counts as the display's own rate (the tier check and the pacing measure it).
    const full = new RenderGovernor(0);
    full.setDisplayInterval(1000 / 120);
    assert.equal(full.uncapped(1), true);
    assert.equal(full.drawsFull(1), true);
});

test("runtime governor: the display's refresh period is read off the animation frames, late ones and all", () => {
    const gaps = (list: number[]) => refreshPeriod(Float64Array.from(list), list.length);
    assert.equal(gaps(Array.from({length: 10}, () => 8.3)), 0, "too few to say");
    assert.ok(Math.abs(gaps(Array.from({length: 40}, () => 16.6)) - 1000 / 60) < 1e-9);
    assert.ok(Math.abs(gaps(Array.from({length: 40}, (_, i) => 8.3 + (i % 3) * 0.1)) - 1000 / 120) < 1e-9);
    // A busy main thread: two in three callbacks a refresh or two late; a third on time is enough.
    assert.ok(Math.abs(gaps(Array.from({length: 60}, (_, i) => (i % 3 === 0 ? 8.4 : i % 3 === 1 ? 16.7 : 25))) - 1000 / 120) < 1e-9);
    // Every frame takes two refreshes of a 120 Hz display: it reads as 60 Hz, and is drawn as such (no cap needed).
    assert.ok(Math.abs(gaps(Array.from({length: 60}, () => 16.7)) - 1000 / 60) < 1e-9);
    assert.ok(Math.abs(gaps(Array.from({length: 40}, () => 11.1)) - 1000 / 90) < 1e-9);
    // A throttled page (a 30 Hz low power mode): its own rate.
    assert.ok(Math.abs(gaps(Array.from({length: 40}, () => 33.3)) - 33.3) < 1e-9);
});
