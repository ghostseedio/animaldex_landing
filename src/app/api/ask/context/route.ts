import {NextResponse} from "next/server";

/**
 * What the drawer needs before a single question is asked: which animal it is
 * about, honest opening suggestions, and the material the waiting line is
 * derived from.
 *
 * This exists so the suggestions are never generic. On iOS the app already
 * holds the species' System Dynamics when it opens the sheet, which is what
 * lets the openers name real operating states and failure modes. The web drawer
 * holds nothing until it asks, so it asks here.
 *
 * It also says who the animal is to this reader, as the apps' chat header and
 * hero show it: the canonical species (its recorded sounds and its voice are
 * filed under it), how many people have talked to it, the name the owner gave
 * it on their own card, and whose animal it is on someone else's.
 */

import {buildAskHints, buildAskSubjectGrounding} from "@/data/ask-grounding";
import {
    loadAskCaptureContext,
    loadAskOwnerName,
    loadAskTalkCount,
    resolveAskCanonicalSpeciesId
} from "@/data/ask-capture-context";
import {getAskWildProfile} from "@/data/ask-wild-profile";
import {
    ASK_RESPONSE_HEADERS,
    peekAskAllowance,
    resolveAskSubject,
    resolveAskViewer
} from "@/lib/ask-animaldex/request";
import {askSuggestions, EMPTY_ASK_HINTS} from "@/lib/ask-animaldex/subject";
import {availableAskProviders} from "@/lib/ask-animaldex/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    let body: Record<string, unknown>;
    try {
        body = await request.json() as Record<string, unknown>;
    } catch {
        body = {};
    }

    const subject = resolveAskSubject(body.subject ?? body);
    const viewer = await resolveAskViewer(request);

    const [species, wildProfile, allowance, card] = await Promise.all([
        buildAskSubjectGrounding(subject),
        getAskWildProfile(viewer.userId),
        peekAskAllowance(request, viewer),
        subject.scope === "species" ? loadAskCaptureContext(subject.captureId) : Promise.resolve(null)
    ]);
    const hints = species ? buildAskHints(species) : EMPTY_ASK_HINTS;
    const speciesProfileId = species ? await resolveAskCanonicalSpeciesId(species.speciesProfileId ?? null) : null;
    // A card someone else holds: the animal is theirs, and says so.
    const isVisit = Boolean(card && card.ownerId !== viewer.userId);
    const [talkCount, ownerName] = await Promise.all([
        loadAskTalkCount(speciesProfileId),
        isVisit && card ? loadAskOwnerName(card.ownerId) : Promise.resolve(null)
    ]);

    // A slug that resolves to nothing is a species page for an animal the
    // catalogue has dropped. The drawer still opens; the question just decides
    // the subject, the same as anywhere else.
    const resolvedSubject = species
        ? {...subject, name: species.name, title: subject.title ?? species.name}
        : {...subject, scope: "general" as const};

    return NextResponse.json({
        ok: true,
        subject: resolvedSubject,
        hints,
        suggestions: askSuggestions(resolvedSubject, hints),
        limit: allowance.limit,
        remaining: allowance.remaining,
        signedIn: viewer.signedIn,
        isPro: allowance.isPro,
        hasWildProfile: wildProfile.hasWildProfile,
        speciesProfileId,
        talkCount,
        // The owner's own name for the animal, on their own card only.
        nickname: card && !isVisit ? card.nickname : null,
        ownerName: isVisit ? ownerName : null,
        // Claude counts on a species page, where the animal itself speaks.
        available: availableAskProviders({animalVoice: resolvedSubject.scope === "species"}).length > 0
    }, {headers: ASK_RESPONSE_HEADERS});
}
