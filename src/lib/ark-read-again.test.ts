import assert from "node:assert/strict";
import test from "node:test";
import {ModelFileError, readIsFinal, readNowOrLater, readUntilIn} from "@/ark-scene/model-files";

// Every read the scene makes outside the model library (the ground's and the town's textures, the sky, trees, rocks,
// props, sound, icons): one that only failed to arrive is made again; one that cannot be helped is done without.

const quiet = async <T>(run: () => Promise<T>): Promise<T> => {
    const warn = console.warn;
    console.warn = () => undefined;
    try {
        return await run();
    } finally {
        console.warn = warn;
    }
};

test("reads: which failures asking again cannot help", () => {
    assert.equal(readIsFinal(new TypeError("Failed to fetch")), false, "Chromium's dropped connection (also net::ERR_NETWORK_CHANGED)");
    assert.equal(readIsFinal(new TypeError("Load failed")), false, "Safari's");
    assert.equal(readIsFinal(new TypeError("NetworkError when attempting to fetch resource.")), false, "Firefox's");
    assert.equal(readIsFinal(new TypeError("undefined is not a function")), true, "a fault in the code is not the network");
    // three's loaders reject with the answer on the error.
    assert.equal(readIsFinal(Object.assign(new Error("fetch responded with 404"), {response: {status: 404}})), true);
    assert.equal(readIsFinal(Object.assign(new Error("fetch responded with 503"), {response: {status: 503}})), false);
    assert.equal(readIsFinal(new ModelFileError("HTTP 400", true)), true);
    assert.equal(readIsFinal(new ModelFileError("HTTP 502", false)), false);
    assert.equal(readIsFinal(new SyntaxError("Unexpected token")), true, "it arrived and does not parse");
    assert.equal(readIsFinal(new Error("THREE.KTX2Loader: bad container")), true);
    assert.equal(readIsFinal(Object.assign(new Error("aborted"), {name: "AbortError"})), true, "the page going away");
});

test("reads: made again after a wait that grows until it is in; given up when final or no longer wanted", async () => {
    const waits: number[] = [];
    const wait = async (seconds: number) => {
        waits.push(seconds);
    };
    let tries = 0;
    const value = await quiet(() => readUntilIn("town paving", async () => {
        if (++tries < 6) throw new TypeError("Failed to fetch");
        return "in";
    }, () => true, wait));
    assert.equal(value, "in");
    assert.deepEqual(waits, [1, 3, 8, 20, 30]);

    tries = 0;
    await assert.rejects(quiet(() => readUntilIn("sky", async () => {
        tries++;
        throw new ModelFileError("HTTP 404", true);
    }, () => true, wait)));
    assert.equal(tries, 1, "a file that is not there is asked for once");

    tries = 0;
    let wanted = true;
    await assert.rejects(quiet(() => readUntilIn("skin", async () => {
        if (++tries === 2) wanted = false;
        throw new TypeError("Failed to fetch");
    }, () => wanted, wait)));
    assert.equal(tries, 2, "not asked for again once nothing wants it");
});

test("reads: a set is not held up by one file that is slow to come; it joins when it is in", async () => {
    const used: string[] = [];
    let tries = 0;
    const first = Date.now();
    await quiet(() => Promise.all([
        readNowOrLater("tree a", async () => "a", (value, late) => used.push(`${value}${late ? " late" : ""}`)),
        readNowOrLater("tree b", async () => {
            if (++tries === 1) throw new TypeError("Failed to fetch");
            return "b";
        }, (value, late) => used.push(`${value}${late ? " late" : ""}`)),
        readNowOrLater("tree c", async () => {
            throw new ModelFileError("HTTP 404", true);
        }, (value: string, late) => used.push(`${value}${late ? " late" : ""}`))
    ]));
    assert.deepEqual(used, ["a"], "the set's first picture has what arrived");
    assert.ok(Date.now() - first < 500, "and did not wait for the rest");
    for (let i = 0; i < 300 && used.length < 2; i++) await new Promise((resolve) => setTimeout(resolve, 10));
    assert.deepEqual(used, ["a", "b late"], "the one that failed to arrive came a second later; the one that is not there never");
});
