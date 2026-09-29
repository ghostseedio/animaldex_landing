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
 */

import {buildAskHints, buildAskSubjectGrounding} from "@/data/ask-grounding";
import {getAskWildProfile} from "@/data/ask-wild-profile";
import {
    ASK_RESPONSE_HEADERS,
    resolveAskSubject,
    resolveAskViewer
} from "@/lib/ask-animaldex/request";
import {askSuggestions, EMPTY_ASK_HINTS} from "@/lib/ask-animaldex/subject";
import {askLimitForViewer} from "@/lib/species-ask";
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

    const [species, wildProfile] = await Promise.all([
        buildAskSubjectGrounding(subject),
        getAskWildProfile(viewer.userId)
    ]);
    const hints = species ? buildAskHints(species) : EMPTY_ASK_HINTS;

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
        limit: askLimitForViewer(viewer),
        signedIn: viewer.signedIn,
        isPro: viewer.isPro,
        hasWildProfile: wildProfile.hasWildProfile,
        available: availableAskProviders().length > 0
    }, {headers: ASK_RESPONSE_HEADERS});
}
