import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";

test("embed: the sound button sits at the end side (logical inset), so in right-to-left it moves clear of the app's close button", () => {
    const html = readFileSync("public/ark/embed.html", "utf8");
    const rules = html.match(/[^\n}]*#ark-sound\s*\{[^}]*\}/g) ?? [];
    assert.ok(rules.length >= 2, "the button's rules");
    for (const rule of rules) assert.ok(!/(^|[\s;{])(right|left)\s*:/.test(rule), `no physical side: ${rule}`);
    assert.ok(rules.some((rule) => /^\s*#ark-sound\s*\{[^}]*inset-inline-end:\s*calc\(10px \+ env\(safe-area-inset-right\)\)/.test(rule)));
    assert.ok(rules.some((rule) => /\[dir="rtl"\]\s*#ark-sound\s*\{[^}]*inset-inline-end:\s*calc\(10px \+ env\(safe-area-inset-left\)\)/.test(rule)));
    // The embed sets dir from the app's language for the four right-to-left languages.
    assert.ok(/RTL = \/\^\(ar\|he\|iw\|fa\|ur\)/.test(html));
});
