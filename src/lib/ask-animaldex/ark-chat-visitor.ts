/**
 * Talking to an Ark animal on the website (Ark player control, phase 2: AnimalDex
 * docs/ark/player-control-design.md section 6; owner decisions F1, F2, D13, D14). The web port of
 * AnimalDex `supabase/functions/_shared/ark-chat-visitor.ts`; keep the two in step.
 *
 * A turn whose subject names `arkAnimalId` (the Talk page's `?ark=<animal id>`) is decided on the
 * server, from the Ark animal, never from what the browser sends:
 *
 * - F1: `ark_chat_visitor_v1` (migration 20261119110000) says who the turn is with. Its owner is the
 *   owner's chat; anyone else visits that owner's animal; an animal born aboard, one whose owner
 *   deleted their account, or a capture arrival whose capture was deleted, is nobody's: a public chat.
 *   The subject's `captureId` and slug are replaced by the Ark animal's species (its card stays
 *   private). Only a signed-in reader reaches it (F4: the Ark's Talk needs an account).
 * - The private capture that brought the animal keys the owner's thread and the visitor notes. It is
 *   never sent to the browser: a visitor's turns are not kept in their synced history, and a visitor's
 *   prompt gets nothing from that capture (no nickname, no where or when it was found).
 * - F2: the owner is named by the Ark's label ('@handle' when named, else 'Voyager N'), never their
 *   display name; owner_username goes when not named.
 * - D13: a sleeping animal is talked to; only a dead animal or an egg cannot talk.
 * - D14: a note from an Ark visit names the visitor by their own Ark label (Postgres, per read).
 */

export type ArkChatAudience = "owner" | "visitor" | "public";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The request's own ids: RFC 4122, as the apps' function reads them. */
const REQUEST_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuid(value: unknown): string | null {
    return typeof value === "string" && UUID.test(value.trim()) ? value.trim().toLowerCase() : null;
}

function text(value: unknown, max = 80): string | null {
    if (typeof value !== "string") return null;
    const clean = value.replace(/\s+/g, " ").trim().slice(0, max);
    return clean || null;
}

/** "a Voyager": how a visitor with no label of their own is named (D14). */
export const ARK_ANONYMOUS_VISITOR = "a Voyager";

/**
 * The Ark animal a request's subject names (`subject.arkAnimalId`). Present with any value but null,
 * the turn is the Ark's; an id that is not one is `invalid` (refused, never read as a card or species).
 */
export function askArkRequest(rawSubject: unknown): {arkAnimalId: string | null; invalid: boolean} {
    const subject = rawSubject && typeof rawSubject === "object" ? rawSubject as Record<string, unknown> : {};
    const raw = subject.arkAnimalId;
    if (raw === undefined || raw === null) return {arkAnimalId: null, invalid: false};
    const clean = typeof raw === "string" ? raw.trim().slice(0, 80) : "";
    const arkAnimalId = REQUEST_UUID.test(clean) ? clean.toLowerCase() : null;
    return {arkAnimalId, invalid: !arkAnimalId};
}

export type ArkChatLabel = {label: string; named: boolean; handle: string | null};

/** `ark_chat_visitor_v1`, checked. Service-role data: never sent to the browser as it is. */
export type ArkChatAnimal = {
    animalId: string;
    voyageId: string;
    speciesProfileId: string;
    speciesSlug: string | null;
    alive: boolean;
    origin: "arrived" | "born";
    audience: ArkChatAudience;
    ownerId: string | null;
    captureId: string | null;
    ownerLabel: ArkChatLabel | null;
    visitorLabel: string | null;
};

function parseLabel(raw: unknown): ArkChatLabel | null {
    const row = raw && typeof raw === "object" ? raw as Record<string, unknown> : null;
    const label = text(row?.label);
    if (!label) return null;
    const handle = text(row?.handle)?.replace(/^@+/, "") || null;
    const named = row?.named === true && Boolean(handle);
    return named
        ? {label: `@${handle}`, named: true, handle}
        : {label: label.startsWith("@") ? ARK_ANONYMOUS_VISITOR : label, named: false, handle: null};
}

export function parseArkChatAnimal(raw: unknown): ArkChatAnimal | null {
    const row = raw && typeof raw === "object" ? raw as Record<string, unknown> : null;
    if (!row) return null;
    const animalId = uuid(row.animal_id);
    const voyageId = uuid(row.voyage_id);
    const speciesProfileId = uuid(row.species_profile_id);
    const audience = row.audience === "owner" || row.audience === "visitor" || row.audience === "public" ? row.audience : null;
    if (!animalId || !voyageId || !speciesProfileId || !audience) return null;
    const nobodys = audience === "public";
    return {
        animalId,
        voyageId,
        speciesProfileId,
        speciesSlug: text(row.species_slug, 120),
        alive: row.alive === true,
        origin: row.origin === "born" ? "born" : "arrived",
        audience,
        ownerId: nobodys ? null : uuid(row.owner_user_id),
        captureId: nobodys ? null : uuid(row.capture_id),
        ownerLabel: audience === "visitor" ? parseLabel(row.owner_label) : null,
        visitorLabel: audience === "visitor" ? text(row.visitor_label) : null
    };
}

export type ArkChatTurn = {
    animalId: string;
    voyageId: string;
    audience: ArkChatAudience;
    speciesProfileId: string;
    /** The species page the record is built from (buildAskPacket reads a slug). */
    speciesSlug: string | null;
    /** Whose animal it is: the owner, or null when it is nobody's. */
    ownerId: string | null;
    /** Keys the visitor notes; never sent to the browser. */
    noteCaptureId: string | null;
    /** The capture whose details the prompt may use: the owner's own turn only. */
    promptCaptureId: string | null;
    /** Where the turn is kept in the reader's history; null: not kept (a visit). */
    thread: {captureId: string | null; speciesProfileId: string} | null;
    ownerLabel: ArkChatLabel | null;
    visitorLabel: string | null;
};

/** The turn for this signed-in reader, or null when it cannot be had (gone, an egg, or inconsistent). */
export function arkChatTurn(animal: ArkChatAnimal | null, callerId: string | null): ArkChatTurn | null {
    if (!animal || !animal.alive || !callerId) return null;
    const audience: ArkChatAudience = !animal.ownerId ? "public" : animal.ownerId === callerId ? "owner" : "visitor";
    if (audience !== animal.audience) return null;
    const capture = audience === "public" ? null : animal.captureId;
    return {
        animalId: animal.animalId,
        voyageId: animal.voyageId,
        audience,
        speciesProfileId: animal.speciesProfileId,
        speciesSlug: animal.speciesSlug,
        ownerId: audience === "public" ? null : animal.ownerId,
        noteCaptureId: audience === "visitor" ? capture : null,
        promptCaptureId: audience === "owner" ? capture : null,
        thread: audience === "visitor" ? null : {captureId: audience === "owner" ? capture : null, speciesProfileId: animal.speciesProfileId},
        ownerLabel: audience === "visitor" ? animal.ownerLabel : null,
        visitorLabel: audience === "visitor" ? animal.visitorLabel ?? ARK_ANONYMOUS_VISITOR : null
    };
}

/** F2: the owner context a visitor's animal gets on the Ark: the Ark label, never the display name. */
export function arkVisitorOwnerContext(
    context: Record<string, unknown> | null | undefined,
    label: ArkChatLabel | null | undefined
): Record<string, unknown> | null {
    if (!context) return null;
    const out: Record<string, unknown> = {...context};
    delete out.owner_name;
    delete out.owner_username;
    if (label?.label) out.owner_name = label.label;
    if (label?.named && label.handle) out.owner_username = label.handle;
    return out;
}

/** D14: the visitor's name in the gist prompt for an Ark visit's note. */
export function arkVisitorNoteName(turn: Pick<ArkChatTurn, "visitorLabel">): string {
    return turn.visitorLabel?.trim() || ARK_ANONYMOUS_VISITOR;
}

/** What the browser is told: the animal, who it is with, the header's label. Never a person's or capture's id. */
export function arkForClient(turn: ArkChatTurn): {animal_id: string; audience: ArkChatAudience; owner_label: string | null} {
    return {animal_id: turn.animalId, audience: turn.audience, owner_label: turn.ownerLabel?.label ?? null};
}

/** Why an Ark request is not answered, as the route's error and status. */
export function arkRefusal(reason: "signed_out" | "unavailable" | "gone"): {body: {error: string}; status: number} {
    if (reason === "signed_out") return {body: {error: "ark_sign_in_required"}, status: 401};
    if (reason === "unavailable") return {body: {error: "ark_unavailable"}, status: 503};
    return {body: {error: "ark_animal_unavailable"}, status: 404};
}
