import assert from "node:assert/strict";
import test from "node:test";
import {clearOfBoxes} from "@/ark-scene/selection-bars";

// The selected animal's bars never under a chip or a button over the view (the "aboard" chip, the sound button).

const view = {width: 360, height: 700};
const size = {w: 76, h: 44};

test("selection bars: beside the chip they would cover, on the nearer side that fits; below it when neither does", () => {
    const chip = {left: 4, top: 46, right: 206, bottom: 102};
    assert.deepEqual(clearOfBoxes({left: 150, top: 60}, size, [chip], view), {left: 206, top: 60}, "to its end side: the nearer");
    assert.deepEqual(clearOfBoxes({left: 250, top: 60}, size, [chip], view), {left: 250, top: 60}, "clear of it already: as it was");
    assert.deepEqual(clearOfBoxes({left: 150, top: 120}, size, [chip], view), {left: 150, top: 120}, "below it already");
    // The same chip at the other side, as in a right-to-left page.
    const mirrored = {left: 154, top: 46, right: 356, bottom: 102};
    assert.deepEqual(clearOfBoxes({left: 140, top: 60}, size, [mirrored], view), {left: 78, top: 60}, "to its start side");
    // A chip as wide as a 320 px view leaves no room beside it: below.
    const wide = {left: 4, top: 46, right: 300, bottom: 102};
    assert.deepEqual(clearOfBoxes({left: 150, top: 60}, size, [wide], {width: 320, height: 700}), {left: 150, top: 102});
    // Two things in the top corners (the chip and the sound button): clear of both.
    const sound = {left: 308, top: 46, right: 356, bottom: 94};
    const at = clearOfBoxes({left: 150, top: 60}, size, [chip, sound], view);
    for (const box of [chip, sound]) assert.ok(!(at.left < box.right && at.left + size.w > box.left && at.top < box.bottom && at.top + size.h > box.top), JSON.stringify(at));
    assert.deepEqual(clearOfBoxes({left: 150, top: 60}, size, [], view), {left: 150, top: 60});
});
