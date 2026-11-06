import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {askDeclaredSubject} from "@/lib/ask-animaldex/subject";

/**
 * The Companions chat's refetch loop (perf pass, 2026-11-06). The chat rebuilt
 * its subject from a roster row object whenever the roster recomputed, and the
 * conversation keyed its context read on that object: every recompute reset
 * the context and re-ran each owner fetch, and the animal-messages read
 * reloaded the roster again, for as long as the chat was open.
 */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Source with comments removed, so an explanation of the old shape cannot fail an assertion. */
function readCode(...parts: string[]) {
    return readFileSync(join(repoRoot, ...parts), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("a reloaded roster row declares the same subject, by value", () => {
    const row = () => ({scope: "species" as const, slug: "gray-wolf", name: "Gray Wolf", title: "Luna", captureId: "00000000-0000-4000-8000-000000001000"});
    const first = askDeclaredSubject("/app", row(), null);
    const reloaded = askDeclaredSubject("/app", row(), null);
    assert.notEqual(first, reloaded);
    // What the conversation keys its reads on: equal for an equal row.
    assert.equal(JSON.stringify(first), JSON.stringify(reloaded));
    assert.notEqual(JSON.stringify(first), JSON.stringify(askDeclaredSubject("/app", {...row(), captureId: "00000000-0000-4000-8000-000000001001"}, null)));
});

test("the Companions chat hands the conversation a subject that only changes with its values", () => {
    const chat = readCode("src/app/[locale]/(authenticated)/app/companions/companions-chat.tsx");
    // The page is memoised without the roster row itself: a reload hands back new row objects.
    const pageDeps = chat.match(/useMemo<AskConversationPage \| null>\([\s\S]*?: null\), \[([^\]]*)\]\);/);
    assert.ok(pageDeps, "the page memo is where it was");
    assert.doesNotMatch(pageDeps[1], /\bcurrent\b/);
    // The subject is built from the row's values, never inside the page from the row.
    assert.doesNotMatch(chat, /askDeclaredSubject\([^)]*current\./);
});

test("the conversation keys its context read and owner fetches on the subject's value, not its identity", () => {
    const conversation = readCode("src/components/ask-animaldex/ask-conversation.tsx");
    assert.match(conversation, /const subjectKey = JSON\.stringify\(declaredSubject\);/);
    assert.match(conversation, /const subject = useMemo\(\(\) => declaredSubject, \[subjectKey\]\);/);
    // The context read resets the chat; it runs again only for another subject or language.
    assert.match(conversation, /fetchAskContext\(askContextRequestBody\(locale, subject\)\)[\s\S]{0,400}?\}, \[subject, locale\]\);/);
});
