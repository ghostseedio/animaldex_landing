import {test} from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {DEFAULT_THEME, THEME_STORAGE_KEY, themeBootScript} from "./theme";

function runBoot(stored: string | null, throws = false) {
    const attributes: Record<string, string> = {};
    vm.runInNewContext(themeBootScript, {
        localStorage: {
            getItem: (key: string) => {
                if (throws) throw new Error("blocked");
                return key === THEME_STORAGE_KEY ? stored : null;
            }
        },
        document: {documentElement: {setAttribute: (name: string, value: string) => { attributes[name] = value; }}}
    });
    return attributes["data-theme"];
}

test("the site is dark unless the reader chose light", () => {
    assert.equal(DEFAULT_THEME, "dark");
    assert.equal(runBoot(null), undefined);
    assert.equal(runBoot("dark"), undefined);
    assert.equal(runBoot("system"), undefined);
    assert.equal(runBoot("light"), "light");
});

test("blocked storage leaves the page dark instead of throwing", () => {
    assert.equal(runBoot("light", true), undefined);
});
