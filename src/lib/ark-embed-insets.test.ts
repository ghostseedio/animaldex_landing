import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const html = readFileSync("public/ark/embed.html", "utf8");
const BOTTOM = /env\(safe-area-inset-bottom, 0px\)\s*\+\s*var\(--ark-inset-bottom, 0px\)/;

test("embed: ?insetTop / ?insetBottom become the --ark-inset-* variables (whole px, 0 to 400, anything else 0)", () => {
    assert.ok(/:root\s*\{[^}]*--ark-inset-top:\s*0px;[^}]*--ark-inset-bottom:\s*0px;/.test(html), "defaults of 0");
    const fn = html.match(/function insetPx\(name\) \{[\s\S]*?\n {2}\}/)?.[0];
    assert.ok(fn, "the parser");
    assert.ok(/setProperty\("--ark-inset-top", insetPx\("insetTop"\)\)/.test(html));
    assert.ok(/setProperty\("--ark-inset-bottom", insetPx\("insetBottom"\)\)/.test(html));
    const parse = (query: string) => vm.runInNewContext(`var params = new URLSearchParams(${JSON.stringify(query)}); ${fn}; insetPx("insetTop")`, {URLSearchParams}) as string;
    assert.equal(parse("insetTop=52"), "52px", "the iOS panel's");
    assert.equal(parse("insetTop=52.6"), "53px");
    assert.equal(parse(""), "0px");
    assert.equal(parse("insetTop=-20"), "0px");
    assert.equal(parse("insetTop=abc"), "0px");
    assert.equal(parse("insetTop=9000"), "400px");
    assert.equal(parse("insetTop=1px;color:red"), "0px", "never CSS from the query");
});

test("embed: the top overlays keep clear of the safe area and the host's top inset, in both directions", () => {
    const sound = html.match(/^\s*#ark-sound\s*\{[^}]*\}/m)?.[0] ?? "";
    assert.ok(/top:\s*calc\(10px \+ env\(safe-area-inset-top\) \+ var\(--ark-inset-top, 0px\)\)/.test(sound), sound);
    // Right to left only moves the button's side (runtime's layout test); its top is the same rule.
    assert.ok(!/\[dir="rtl"\]\s*#ark-sound\s*\{[^}]*top:/.test(html));
    const bars = readFileSync("src/ark-scene/live/bars-view.ts", "utf8");
    assert.ok(/top: "calc\(10px \+ env\(safe-area-inset-top, 0px\) \+ var\(--ark-inset-top, 0px\)\)"/.test(bars));
    const height = bars.match(/maxHeight: "[^"]*"/)?.[0] ?? "";
    for (const part of ["env(safe-area-inset-top, 0px)", "var(--ark-inset-top, 0px)", "env(safe-area-inset-bottom, 0px)", "var(--ark-inset-bottom, 0px)"]) {
        assert.ok(height.includes(`- ${part}`), `the panel's height leaves ${part} out: ${height}`);
    }
    assert.ok(!/\b(top|bottom): "\d+px"/.test(bars), "no bare pixel top or foot");
});

test("embed: the foot overlays (the log, the reset button) keep clear of the home indicator and the host's bottom inset", () => {
    const log = readFileSync("src/ark-scene/live/log-view.ts", "utf8");
    assert.ok(BOTTOM.test(log.match(/ARK_BOTTOM_CLEAR = "[^"]*"/)?.[0] ?? ""));
    assert.ok(/bottom: ARK_BOTTOM_CLEAR/.test(log));
    assert.ok(/insetInlineStart: "12px"/.test(log), "the start side, logical: right in right-to-left");
    const ui = readFileSync("src/ark-scene/runtime/ui.ts", "utf8");
    assert.ok(BOTTOM.test(ui.match(/RESET_BOTTOM = "[^"]*"/)?.[0] ?? ""));
    assert.ok(/bottom: RESET_BOTTOM/.test(ui));
    assert.ok(/next > 0 \? `\$\{12 \+ next\}px` : RESET_BOTTOM/.test(ui), "over a tap band the band keeps the safe area; without one the button does");
    assert.ok(/insetInlineEnd: "12px"/.test(ui), "the end side, logical");
});
