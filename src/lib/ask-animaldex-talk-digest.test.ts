import assert from "node:assert/strict";
import test from "node:test";

// The Talk sidebar keeps its rows while a reply types out: only a message
// landing, going or changing status changes what it shows.
import {talkThreadsDigest} from "@/lib/ask-animaldex/talk";
import {createAskMessage, type AskThreads} from "@/lib/ask-animaldex/thread";

const at = "2026-11-01T10:00:00.000Z";
const user = createAskMessage("user", "My manager keeps adding work.", {id: "u1", createdAt: at});
const reply = (text: string, status: "streaming" | "complete") => createAskMessage("assistant", text, {id: "a1", status, createdAt: at});

test("a reply typing out does not change the digest", () => {
    const before: AskThreads = {"species:gray-wolf": [user, reply("A wolf", "streaming")]};
    const during: AskThreads = {"species:gray-wolf": [user, reply("A wolf doesn't take every scrap", "streaming")]};
    assert.equal(talkThreadsDigest(before), talkThreadsDigest(during));
});

test("a reply landing, a message arriving or a thread going changes it", () => {
    const streaming: AskThreads = {"species:gray-wolf": [user, reply("A wolf", "streaming")]};
    const complete: AskThreads = {"species:gray-wolf": [user, reply("A wolf", "complete")]};
    const longer: AskThreads = {"species:gray-wolf": [user, reply("A wolf", "complete"), createAskMessage("user", "And then?", {id: "u2", createdAt: at})]};
    const two: AskThreads = {...complete, "species:red-fox": [user]};
    assert.notEqual(talkThreadsDigest(streaming), talkThreadsDigest(complete));
    assert.notEqual(talkThreadsDigest(complete), talkThreadsDigest(longer));
    assert.notEqual(talkThreadsDigest(complete), talkThreadsDigest(two));
    assert.notEqual(talkThreadsDigest(two), talkThreadsDigest({}));
});

test("empty threads count for nothing", () => {
    assert.equal(talkThreadsDigest({"species:gray-wolf": []}), talkThreadsDigest({}));
});
