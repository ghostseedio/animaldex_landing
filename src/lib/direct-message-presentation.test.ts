import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {
    buildThreadRows,
    canUnsend,
    conversationReportSnapshot,
    conversationTitle,
    dateSeparatorLabel,
    filteredInbox,
    inboxPreview,
    inboxTimestamp,
    isMuted,
    markedRead,
    mergeThreadMessages,
    messageSummary,
    muteEndDate,
    NO_DIRECT_MESSAGE_SETTINGS,
    receiptFor,
    showsUnread,
    sortedInbox,
    unreadDividerLabel,
    type DirectMessage,
    type DirectMessageConversationSummary
} from "@/lib/direct-message-presentation";
import {DIRECT_MESSAGE_WORDS_EN as EN, directMessageKnownErrors, directMessageWords} from "@/lib/direct-message-words";

const ME = "11111111-1111-4111-8111-111111111111";
const ANA = "22222222-2222-4222-8222-222222222222";
const BEN = "33333333-3333-4333-8333-333333333333";
const SUPPORT = "44444444-4444-4444-8444-444444444444";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const locale = (name: string) => JSON.parse(readFileSync(join(repoRoot, `src/data/locales/${name}.json`), "utf8"));

function message(partial: Partial<DirectMessage> & {id: string; createdAt: string}): DirectMessage {
    return {
        senderId: ANA,
        recipientId: ME,
        body: "Hello",
        text: "Hello",
        readAt: null,
        deliveredAt: null,
        deletedAt: null,
        photoReview: null,
        attachment: null,
        sender: null,
        recipient: null,
        ...partial
    };
}

function summary(userId: string, createdAt: string, extra: Partial<DirectMessageConversationSummary> = {}): DirectMessageConversationSummary {
    return {
        otherUser: {userId, displayName: userId === SUPPORT ? "Support" : userId === ANA ? "Ana Reyes" : "Ben", username: userId === ANA ? "ana_r" : null, avatarUrl: null, href: null, isSystem: userId === SUPPORT},
        lastMessage: message({id: `m-${userId}`, createdAt, senderId: userId}),
        unreadCount: 0,
        settings: NO_DIRECT_MESSAGE_SETTINGS,
        ...extra
    };
}

test("inbox order: support first, then pins (newest pin on top), then the latest message", () => {
    const inbox = sortedInbox([
        summary(BEN, "2026-11-06T10:00:00Z"),
        summary(ANA, "2026-11-01T10:00:00Z", {settings: {...NO_DIRECT_MESSAGE_SETTINGS, pinnedAt: "2026-11-02T00:00:00Z"}}),
        summary(SUPPORT, "2026-10-01T10:00:00Z"),
        summary("55555555-5555-4555-8555-555555555555", "2026-11-05T10:00:00Z", {settings: {...NO_DIRECT_MESSAGE_SETTINGS, pinnedAt: "2026-11-03T00:00:00Z"}})
    ]);
    assert.deepEqual(inbox.map((row) => row.otherUser.userId), [SUPPORT, "55555555-5555-4555-8555-555555555555", ANA, BEN]);
});

test("inbox search matches the name, the @handle with or without @, and the preview", () => {
    const inbox = [summary(ANA, "2026-11-06T10:00:00Z"), summary(BEN, "2026-11-06T09:00:00Z", {lastMessage: message({id: "b", createdAt: "2026-11-06T09:00:00Z", senderId: BEN, body: "Saw a heron today"})})];
    assert.deepEqual(filteredInbox(inbox, "reyes", EN).map((row) => row.otherUser.userId), [ANA]);
    assert.deepEqual(filteredInbox(inbox, "@ana_", EN).map((row) => row.otherUser.userId), [ANA]);
    assert.deepEqual(filteredInbox(inbox, "HERON", EN).map((row) => row.otherUser.userId), [BEN]);
    assert.equal(filteredInbox(inbox, "  ", EN).length, 2);
    assert.equal(filteredInbox(inbox, "zebra", EN).length, 0);
});

test("the preview line: photos, cards, unsends, a photo kept back, and You: for your own", () => {
    const base = {body: "📷 Photo", deletedAt: null, photoReview: null} as const;
    assert.equal(messageSummary({...base, attachment: {kind: "image", bubbleUrl: null, fullUrl: null, width: null, height: null, caption: null}}, EN), "📷 Photo");
    assert.equal(messageSummary({...base, attachment: {kind: "image", bubbleUrl: null, fullUrl: null, width: null, height: null, caption: " Look "}}, EN), "📷 Look");
    assert.equal(messageSummary({...base, attachment: {kind: "capture", captureId: "c", title: "Red Fox", animalName: null, grade: 7, imageUrl: null}}, EN), "🐾 Red Fox");
    assert.equal(messageSummary({...base, attachment: null, deletedAt: "2026-11-06T00:00:00Z"}, EN), "This message was deleted");
    assert.equal(messageSummary({...base, attachment: null, photoReview: "removed"}, EN), "Photo not delivered");
    assert.equal(messageSummary({...base, body: "  ", attachment: null}, EN), "Message");

    const mine = summary(ANA, "2026-11-06T10:00:00Z", {lastMessage: message({id: "x", createdAt: "2026-11-06T10:00:00Z", senderId: ME, body: "On my way"})});
    assert.equal(inboxPreview(mine, ME, EN), "You: On my way");
    assert.equal(inboxPreview(mine, ANA, EN), "On my way");
    const unsent = {...mine, lastMessage: {...mine.lastMessage, deletedAt: "2026-11-06T10:01:00Z"}};
    assert.equal(inboxPreview(unsent, ME, EN), "This message was deleted");
});

test("unread: a count or a hand-made mark; reading clears both; mute only while it lasts", () => {
    const now = new Date("2026-11-06T12:00:00Z");
    const marked = summary(ANA, "2026-11-06T10:00:00Z", {settings: {...NO_DIRECT_MESSAGE_SETTINGS, markedUnreadAt: "2026-11-06T11:00:00Z"}});
    assert.equal(showsUnread(marked), true);
    assert.equal(showsUnread(summary(BEN, "2026-11-06T10:00:00Z", {unreadCount: 2})), true);
    const [read] = markedRead([{...marked, unreadCount: 3}], ANA);
    assert.equal(showsUnread(read), false);
    assert.equal(isMuted({...NO_DIRECT_MESSAGE_SETTINGS, mutedUntil: "2026-11-06T13:00:00Z"}, now), true);
    assert.equal(isMuted({...NO_DIRECT_MESSAGE_SETTINGS, mutedUntil: "2026-11-06T11:00:00Z"}, now), false);
    assert.equal(muteEndDate("eightHours", now).toISOString(), "2026-11-06T20:00:00.000Z");
    assert.equal(muteEndDate("oneWeek", now).toISOString(), "2026-11-13T12:00:00.000Z");
    assert.equal(muteEndDate("always", now).toISOString(), "9999-01-01T00:00:00.000Z");
});

test("unsend: your own message, not unsent yet, inside 48 hours", () => {
    const now = new Date("2026-11-06T12:00:00Z");
    const mine = message({id: "a", createdAt: "2026-11-05T12:00:01Z", senderId: ME});
    assert.equal(canUnsend(mine, ME, now), true);
    assert.equal(canUnsend({...mine, createdAt: "2026-11-04T11:59:59Z"}, ME, now), false);
    assert.equal(canUnsend({...mine, deletedAt: "2026-11-06T00:00:00Z"}, ME, now), false);
    assert.equal(canUnsend(mine, ANA, now), false);
    assert.equal(receiptFor({readAt: null, deliveredAt: null}), "sent");
    assert.equal(receiptFor({readAt: null, deliveredAt: "x"}), "delivered");
    assert.equal(receiptFor({readAt: "x", deliveredAt: "x"}), "read");
});

test("inbox times and day pills: today's time, Yesterday, a weekday, then a date", () => {
    const now = new Date(2026, 10, 6, 15, 0);
    const at = (day: number, hour = 9, minute = 5, month = 10, year = 2026) => new Date(year, month, day, hour, minute).toISOString();
    assert.equal(inboxTimestamp(at(6, 14, 2), now, "en", EN), "14:02");
    assert.equal(inboxTimestamp(at(5), now, "en", EN), "Yesterday");
    assert.equal(inboxTimestamp(at(2), now, "en", EN), "Monday");
    assert.equal(inboxTimestamp(at(20, 9, 5, 9), now, "en", EN), "Oct 20");
    assert.equal(inboxTimestamp(at(20, 9, 5, 9, 2025), now, "en", EN), "Oct 20, 25");
    assert.equal(inboxTimestamp("1970-01-01T00:00:00.000Z", now, "en", EN), "");
    assert.equal(dateSeparatorLabel(at(6), now, "en", EN), "Today");
    assert.equal(dateSeparatorLabel(at(5), now, "en", EN), "Yesterday");
    assert.equal(dateSeparatorLabel(at(20, 9, 5, 9), now, "en", EN), "Tue, Oct 20");
    assert.equal(dateSeparatorLabel(at(20, 9, 5, 9, 2025), now, "en", EN), "Oct 20, 2025");
    assert.equal(unreadDividerLabel(1, EN), "1 unread message");
    assert.equal(unreadDividerLabel(4, EN), "4 unread messages");
});

test("thread rows: a pill per day, the unread line where the run began, and five-minute groups", () => {
    const rows = buildThreadRows([
        message({id: "1", createdAt: new Date(2026, 10, 5, 9, 0).toISOString()}),
        message({id: "2", createdAt: new Date(2026, 10, 6, 9, 0).toISOString()}),
        message({id: "3", createdAt: new Date(2026, 10, 6, 9, 3).toISOString()}),
        message({id: "4", createdAt: new Date(2026, 10, 6, 9, 4).toISOString()}),
        message({id: "5", createdAt: new Date(2026, 10, 6, 9, 5).toISOString(), senderId: ME, recipientId: ANA})
    ], ME, "4", 1);
    assert.deepEqual(rows.map((row) => row.kind === "bubble" ? `${row.id}:${row.isGroupStart ? "S" : ""}${row.isGroupEnd ? "E" : ""}${row.showsAvatar ? "A" : ""}` : row.kind), [
        "day", "1:SEA", "day", "2:S", "3:EA", "unread", "4:SEA", "5:SE"
    ]);
});

test("merging a sync replaces by id and keeps send order", () => {
    const a = message({id: "a", createdAt: "2026-11-06T10:00:00Z"});
    const b = message({id: "b", createdAt: "2026-11-06T10:01:00Z"});
    const merged = mergeThreadMessages([a, b], [{...a, deletedAt: "2026-11-06T10:02:00Z"}, message({id: "c", createdAt: "2026-11-06T10:00:30Z"})]);
    assert.deepEqual(merged.map((row) => row.id), ["a", "c", "b"]);
    assert.equal(merged[0].deletedAt, "2026-11-06T10:02:00Z");
});

test("a conversation report names their latest message, else the last lines", () => {
    const thread = [
        message({id: "a", createdAt: "2026-11-06T10:00:00Z", body: "rude"}),
        message({id: "b", createdAt: "2026-11-06T10:01:00Z", senderId: ME, recipientId: ANA, body: "hi"})
    ];
    assert.deepEqual(conversationReportSnapshot(thread, ANA, EN), {contentId: "a", snapshot: "rude"});
    assert.deepEqual(conversationReportSnapshot(thread.slice(1), ANA, EN), {contentId: null, snapshot: "hi"});
});

test("titles: support by its name, a collector by name or @handle", () => {
    assert.equal(conversationTitle({userId: SUPPORT, displayName: "x", username: null, avatarUrl: null, href: null, isSystem: true}, EN), "AnimalDex Support");
    assert.equal(conversationTitle({userId: ANA, displayName: " ", username: "ana_r", avatarUrl: null, href: null}, EN), "@ana_r");
});

test("every Messages word is in en.json and id.json, en as iOS wrote it", () => {
    const en = locale("en").appMessages;
    const id = locale("id").appMessages;
    for (const [key, value] of Object.entries(EN)) {
        assert.equal(en[key], value, key);
        assert.ok(typeof id[key] === "string" && id[key].trim(), `id ${key}`);
        const slots = (value.match(/\{\w+\}/g) ?? []).sort();
        assert.deepEqual((id[key].match(/\{\w+\}/g) ?? []).sort(), slots, `id slots ${key}`);
    }
    const indonesian = directMessageWords(id);
    assert.equal(indonesian.emptyTitle, "Belum ada pesan");
    assert.equal(directMessageKnownErrors(indonesian).pin_limit_reached, indonesian.errorPinLimit);
});
