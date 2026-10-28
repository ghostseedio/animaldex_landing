import "server-only";

/**
 * What a Speak to [Animal] turn reads and writes besides the reply, with the
 * service role, as the apps' `generate-applied-insight` does it:
 *
 *   - the owner's side: who visited (pending visitor notes, marked delivered
 *     once a reply names them), a check-in they asked for (due, then raised),
 *     the day they talked (`animal_companion_days`, the bond), the
 *     visitor-safe journey note, and the stories the animal has told;
 *   - the visitor's side: what the animal may say about its owner
 *     (`animal_chat_owner_context`), whether it may pass the visit on, and
 *     the gist it passes on;
 *   - everyone signed in: that they talked to this animal today
 *     (`animal_chat_species_days`, for how many people have talked to it).
 *
 * Every call fails quietly: a missing migration or a refusal leaves the
 * animal without that part, never without an answer.
 */

import {createSupabaseServiceClient} from "@/lib/supabase/server";
import {requestAskJSONObject} from "@/lib/ask-animaldex/providers";
import {parseAskOwnStories, type AskOwnStory} from "@/lib/ask-animaldex/stories";
import {
    buildAskVisitorNotePrompts,
    deliveredAskVisitorNoteIds,
    historyShowsAskVisitorNotice,
    parseAskPendingVisitorNotes,
    parseAskVisitorNote,
    type AskPendingVisitorNote
} from "@/lib/ask-animaldex/visitor-notes";

type Service = NonNullable<ReturnType<typeof createSupabaseServiceClient>>;

function warn(what: string, error: unknown) {
    const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error
        ? String((error as {message: unknown}).message)
        : String(error);
    console.warn(`[ask-animaldex] ${what} failed`, message.slice(0, 200));
}

function service(): Service | null {
    return createSupabaseServiceClient();
}

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

// MARK: - Everyone signed in

/**
 * Notes that this person talked to this animal today, for how popular it is
 * to talk to (`species_chat_popularity`): any answered turn, their own animal
 * or someone else's. Unlike the companion day it is not the bond, so short
 * messages count too. The primary key makes a retry count once.
 */
export async function recordAskTalkDay(userId: string, speciesProfileId: string): Promise<void> {
    const admin = service();
    if (!admin) return;
    const {error} = await admin
        .from("animal_chat_species_days")
        .upsert({species_profile_id: speciesProfileId, user_id: userId, day: today()}, {
            onConflict: "species_profile_id,user_id,day",
            ignoreDuplicates: true
        });
    // Missing before migration 20261027120000 is applied: harmless.
    if (error && error.code !== "42P01") warn("animal_chat_species_days insert", error);
}

// MARK: - The owner

/** One row per day the owner had a real exchange with this animal (the bond counts it). */
export async function recordAskCompanionDay(userId: string, speciesProfileId: string, userMessage: string): Promise<void> {
    if (userMessage.trim().length < 20) return;
    const admin = service();
    if (!admin) return;
    const {error} = await admin
        .from("animal_companion_days")
        .upsert({user_id: userId, species_profile_id: speciesProfileId, day: today()}, {
            onConflict: "user_id,species_profile_id,day",
            ignoreDuplicates: true
        });
    if (error) warn("animal_companion_days insert", error);
}

/** Something the owner asked this animal to check back on, now due. */
export async function loadAskDueFollowUp(
    userId: string,
    speciesProfileId: string
): Promise<{id: string; topic: string; invitedAt: string | null} | null> {
    const admin = service();
    if (!admin) return null;
    try {
        const {data, error} = await admin.rpc("due_animal_follow_up", {p_user_id: userId, p_species_profile_id: speciesProfileId});
        if (error || !data || typeof data !== "object") return null;
        const row = data as Record<string, unknown>;
        if (typeof row.id !== "string" || typeof row.topic !== "string") return null;
        return {id: row.id, topic: row.topic, invitedAt: typeof row.invited_at === "string" ? row.invited_at : null};
    } catch (error) {
        warn("due_animal_follow_up", error);
        return null;
    }
}

export async function markAskFollowUpRaised(userId: string, id: string): Promise<void> {
    const admin = service();
    if (!admin) return;
    const {error} = await admin.rpc("mark_animal_follow_up_raised", {p_user_id: userId, p_id: id});
    if (error) warn("mark_animal_follow_up_raised", error);
}

export async function createAskFollowUp(params: {
    userId: string;
    speciesProfileId: string;
    topic: string;
    revisitAfterDays: number;
}): Promise<void> {
    const admin = service();
    if (!admin) return;
    const {error} = await admin.rpc("create_animal_follow_up", {
        p_user_id: params.userId,
        p_species_profile_id: params.speciesProfileId,
        p_topic: params.topic,
        p_revisit_after_days: params.revisitAfterDays
    });
    if (error) warn("create_animal_follow_up", error);
}

/** The visitor-safe note so far, carried forward by the memory model. */
export async function loadAskJourneyNote(userId: string, speciesProfileId: string): Promise<string | null> {
    const admin = service();
    if (!admin) return null;
    const {data} = await admin
        .from("animal_chat_capture_journey")
        .select("note")
        .eq("user_id", userId)
        .eq("species_profile_id", speciesProfileId)
        .maybeSingle();
    return typeof data?.note === "string" ? data.note : null;
}

/**
 * One more exchange between the owner and this animal, and the note a
 * visitor's animal may repeat. An empty note keeps the previous one. The
 * apps' `saveAnimalChatJourney`.
 */
export async function saveAskJourney(params: {
    userId: string;
    speciesProfileId: string;
    animalName: string;
    note: string | null;
}): Promise<void> {
    const admin = service();
    if (!admin) return;
    const {data: existing} = await admin
        .from("animal_chat_capture_journey")
        .select("note, exchanges")
        .eq("user_id", params.userId)
        .eq("species_profile_id", params.speciesProfileId)
        .maybeSingle();
    const exchanges = Number(existing?.exchanges ?? 0) + 1;
    const note = params.note ?? (typeof existing?.note === "string" ? existing.note : "");
    const {error} = await admin
        .from("animal_chat_capture_journey")
        .upsert({
            user_id: params.userId,
            species_profile_id: params.speciesProfileId,
            animal_name: params.animalName,
            note,
            exchanges,
            updated_at: new Date().toISOString()
        }, {onConflict: "user_id,species_profile_id"});
    if (error) warn("animal_chat_capture_journey save", error);
}

/** The stories the owner's animal of this species has told; empty on any error. */
export async function loadAskOwnStories(ownerId: string, speciesProfileId: string): Promise<AskOwnStory[]> {
    const admin = service();
    if (!admin) return [];
    try {
        const {data, error} = await admin
            .from("animal_chat_capture_journey")
            .select("own_stories")
            .eq("user_id", ownerId)
            .eq("species_profile_id", speciesProfileId)
            .maybeSingle();
        if (error) return [];
        return parseAskOwnStories(data?.own_stories);
    } catch {
        return [];
    }
}

export async function saveAskOwnStory(params: {
    ownerId: string;
    speciesProfileId: string;
    animalName: string;
    story: string;
}): Promise<void> {
    const admin = service();
    if (!admin) return;
    const {error} = await admin.rpc("append_animal_own_story", {
        p_owner: params.ownerId,
        p_species_profile_id: params.speciesProfileId,
        p_animal_name: params.animalName,
        p_story: params.story
    });
    if (error) warn("append_animal_own_story", error);
}

/** Who visited this animal on the owner's card and has not been passed on yet. */
export async function loadAskPendingVisitorNotes(ownerId: string, speciesProfileId: string): Promise<AskPendingVisitorNote[]> {
    const admin = service();
    if (!admin) return [];
    try {
        const {data, error} = await admin.rpc("animal_chat_pending_visitor_notes", {
            p_owner: ownerId,
            p_species_profile_id: speciesProfileId
        });
        if (error) {
            warn("animal_chat_pending_visitor_notes", error);
            return [];
        }
        return parseAskPendingVisitorNotes(data);
    } catch {
        return [];
    }
}

/** The notes this answer passed on (it named the visitor) are delivered. */
export async function markAskVisitorNotesDelivered(ownerId: string, notes: AskPendingVisitorNote[], answer: string): Promise<void> {
    const ids = deliveredAskVisitorNoteIds(notes, answer);
    if (ids.length === 0) return;
    const admin = service();
    if (!admin) return;
    const {error} = await admin.rpc("mark_animal_chat_visitor_notes_delivered", {p_owner: ownerId, p_ids: ids});
    if (error) warn("mark_animal_chat_visitor_notes_delivered", error);
}

// MARK: - The visitor

/**
 * What a visitor's animal may say about its owner: the owner's name, whether
 * they have spoken, the visitor-safe journey note (while the owner shares it)
 * and the Play records this viewer may already see. Decided in Postgres by
 * the profile's privacy sections for the named viewer.
 */
export async function loadAskOwnerContext(params: {
    viewerId: string;
    ownerId: string;
    speciesProfileId: string;
}): Promise<Record<string, unknown> | null> {
    const admin = service();
    if (!admin) return null;
    try {
        const {data, error} = await admin.rpc("animal_chat_owner_context", {
            p_viewer: params.viewerId,
            p_owner: params.ownerId,
            p_species_profile_id: params.speciesProfileId
        });
        if (error) {
            warn("animal_chat_owner_context", error);
            return null;
        }
        return data && typeof data === "object" ? data as Record<string, unknown> : null;
    } catch {
        return null;
    }
}

/**
 * Whether this animal may pass on what this visitor says: they have been
 * told (on record, or the notice is in the messages they sent back, which is
 * then recorded), and neither has blocked the other. Any error counts as
 * blocked: no notice, nothing passed on.
 */
export async function resolveAskVisitorRelay(params: {
    visitorId: string;
    ownerId: string;
    speciesProfileId: string;
    history: Array<{role: string; content: string}>;
}): Promise<{blocked: boolean; noticed: boolean}> {
    const admin = service();
    if (!admin) return {blocked: true, noticed: false};
    try {
        const args = {p_visitor: params.visitorId, p_owner: params.ownerId, p_species_profile_id: params.speciesProfileId};
        const [blocked, noticed] = await Promise.all([
            admin.rpc("animal_chat_users_blocked", {p_a: params.visitorId, p_b: params.ownerId}),
            admin.rpc("animal_chat_visitor_noticed", args)
        ]);
        if (blocked.error || noticed.error) throw blocked.error ?? noticed.error;
        if (blocked.data === true) return {blocked: true, noticed: false};
        if (noticed.data === true) return {blocked: false, noticed: true};
        if (!historyShowsAskVisitorNotice(params.history)) return {blocked: false, noticed: false};
        const recorded = await admin.rpc("record_animal_chat_visitor_notice", args);
        if (recorded.error) throw recorded.error;
        return {blocked: false, noticed: true};
    } catch (error) {
        warn("animal_chat_visitor_relay", error);
        return {blocked: true, noticed: false};
    }
}

/** The gist of this visitor's exchange, merged into today's note for the owner. */
export async function saveAskVisitorNote(params: {
    visitorId: string;
    ownerId: string;
    ownerName: string;
    speciesProfileId: string;
    captureId: string | null;
    animalName: string;
    visitorMessage: string;
    answer: string;
}): Promise<void> {
    // "hi", "ok": nothing to pass on, no call to make.
    if (params.visitorMessage.trim().length < 8) return;
    const admin = service();
    if (!admin) return;
    try {
        const args = {p_visitor: params.visitorId, p_owner: params.ownerId, p_species_profile_id: params.speciesProfileId};
        const [visitorRow, todayNote] = await Promise.all([
            admin.from("profiles").select("display_name, username").eq("id", params.visitorId).maybeSingle(),
            admin.rpc("animal_chat_visitor_note_today", args)
        ]);
        const name = (value: unknown) => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 60) || null : null;
        const visitorName = name(visitorRow.data?.display_name) ?? name(visitorRow.data?.username) ?? "";
        if (!visitorName) return;
        const existing = typeof todayNote.data === "string" ? todayNote.data : null;
        const prompts = buildAskVisitorNotePrompts({
            ownerName: params.ownerName,
            animalName: params.animalName,
            visitorName,
            existingNote: existing,
            visitorMessage: params.visitorMessage,
            answer: params.answer
        });
        const raw = await requestAskJSONObject({systemPrompt: prompts.system, userPrompt: prompts.user});
        if (!raw) return;
        const note = parseAskVisitorNote(raw, visitorName);
        if (note === (existing ?? "")) return;
        const {error} = await admin.rpc("save_animal_chat_visitor_note", {...args, p_capture_id: params.captureId, p_note: note});
        if (error) throw error;
    } catch (error) {
        warn("animal_chat_visitor_note", error);
    }
}
