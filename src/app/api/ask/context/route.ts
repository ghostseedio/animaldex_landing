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
import {askOpenerWords, askSuggestions, EMPTY_ASK_HINTS} from "@/lib/ask-animaldex/subject";
import {availableAskProviders} from "@/lib/ask-animaldex/providers";
import {getScopedTranslator} from "@/loaders/translation";
import {localeConfig} from "@/i18n";
import {talkSlugForSpeciesPage} from "@/data/talk-animals";
import {arkChatTurn, arkForClient} from "@/lib/ask-animaldex/ark-chat-visitor";
import {loadAskArkAnimal} from "@/lib/ask-animaldex/chat-records-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    let body: Record<string, unknown>;
    try {
        body = await request.json() as Record<string, unknown>;
    } catch {
        body = {};
    }

    const asked = resolveAskSubject(body.subject ?? body);
    const viewer = await resolveAskViewer(request);
    // Ark Talk (F1, `ark-chat-visitor.ts`): an Ark animal is resolved on the
    // server for the signed-in reader; its species is the Ark animal's, and its
    // card stays private (the owner's own, on their own chat, for its name).
    const arkRead = asked.arkAnimalId && viewer.userId ? await loadAskArkAnimal(asked.arkAnimalId, viewer.userId) : null;
    const arkTurn = arkRead?.ok ? arkChatTurn(arkRead.animal, viewer.userId) : null;
    const subject = asked.arkAnimalId
        ? {...asked, scope: arkTurn?.speciesSlug ? "species" as const : "general" as const, slug: arkTurn?.speciesSlug ?? null, captureId: null}
        : asked;

    const [species, wildProfile, allowance, card] = await Promise.all([
        buildAskSubjectGrounding(subject),
        getAskWildProfile(viewer.userId),
        peekAskAllowance(request, viewer),
        arkTurn
            ? arkTurn.promptCaptureId ? loadAskCaptureContext(arkTurn.promptCaptureId) : Promise.resolve(null)
            : subject.scope === "species" ? loadAskCaptureContext(subject.captureId) : Promise.resolve(null)
    ]);
    const hints = species ? buildAskHints(species) : EMPTY_ASK_HINTS;
    const speciesProfileId = species ? await resolveAskCanonicalSpeciesId(species.speciesProfileId ?? null) : null;
    // A card someone else holds: the animal is theirs, and says so.
    const isVisit = arkTurn ? arkTurn.audience === "visitor" : Boolean(card && card.ownerId !== viewer.userId);
    // The openers in the reader's language (WEB-21).
    const locale = typeof body.locale === "string" && (localeConfig.locales as readonly string[]).includes(body.locale) ? body.locale : localeConfig.defaultLocale;
    const [talkCount, ownerName, openerTranslate, talkSlug] = await Promise.all([
        loadAskTalkCount(speciesProfileId),
        // On the Ark, the Ark's label (F2), never the display name.
        arkTurn ? Promise.resolve(isVisit ? arkTurn.ownerLabel?.label ?? null : null)
            : isVisit && card ? loadAskOwnerName(card.ownerId) : Promise.resolve(null),
        getScopedTranslator(locale, "askAnimalDex").catch(() => null),
        // This animal's chat on the Talk page, by the catalog's slug (WEB-1): where Full screen goes.
        species && subject.slug ? talkSlugForSpeciesPage(subject.slug).catch(() => subject.slug) : Promise.resolve(null)
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
        suggestions: askSuggestions(resolvedSubject, hints, {words: askOpenerWords(openerTranslate)}),
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
        // An Ark turn: who it is with and the header's label; never a person's or a capture's id.
        ...(arkTurn ? {ark: arkForClient(arkTurn)} : {}),
        talkSlug,
        // Claude counts on a species page, where the animal itself speaks.
        available: availableAskProviders({animalVoice: resolvedSubject.scope === "species"}).length > 0
    }, {headers: ASK_RESPONSE_HEADERS});
}
