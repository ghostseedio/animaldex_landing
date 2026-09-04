import {NextResponse} from "next/server";
import {buildSpeciesAskGrounding} from "@/data/species-ask-grounding";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {checkRateLimit, getRequestIdentifier} from "@/lib/rate-limit";
import {hasAuthCookie} from "@/lib/viewer";
import {
    askLimitForViewer,
    buildCatalogFallbackAnswer,
    clampAskLayerBody,
    inferAskProductRoutes,
    serializeGroundingForModel,
    SPECIES_ASK_LAYER_META,
    SPECIES_ASK_WINDOW_MS,
    type SpeciesAskGrounding,
    type SpeciesAskLayer,
    type SpeciesAskLayerKind,
    type SpeciesAskRouteIntent
} from "@/lib/species-ask";

export const runtime = "nodejs";

const ASK_RESPONSE_HEADERS = {
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow"
};

function askJson(body: unknown, status = 200) {
    return NextResponse.json(body, {status, headers: ASK_RESPONSE_HEADERS});
}

const MODEL = "gpt-4o-mini";

type AskBody = {
    slug?: string;
    question?: string;
};

const LAYER_KINDS = new Set<SpeciesAskLayerKind>(["biology", "why", "lesson", "symbolism"]);
const ROUTE_INTENTS = new Set<SpeciesAskRouteIntent>([
    "compare", "power", "locations", "experiences", "instagram", "collect", "lesson"
]);

async function resolveAskViewer(request: Request) {
    if (!hasAuthCookie() && !request.headers.get("authorization")) {
        return {signedIn: false, isPro: false, userId: null as string | null};
    }

    const supabase = createSupabaseServerClient();
    if (!supabase) return {signedIn: false, isPro: false, userId: null as string | null};

    const authHeader = request.headers.get("authorization");
    const jwt = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : null;
    const {data: {user}} = jwt
        ? await supabase.auth.getUser(jwt)
        : await supabase.auth.getUser();

    if (!user) return {signedIn: false, isPro: false, userId: null as string | null};

    const {data: profile} = await supabase
        .from("profiles")
        .select("is_pro")
        .eq("id", user.id)
        .maybeSingle();

    return {
        signedIn: true,
        isPro: profile?.is_pro === true,
        userId: user.id
    };
}

function parseModelLayers(value: unknown): SpeciesAskLayer[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        const kind = typeof row.kind === "string" && LAYER_KINDS.has(row.kind as SpeciesAskLayerKind)
            ? row.kind as SpeciesAskLayerKind
            : null;
        const body = typeof row.body === "string" ? row.body.trim() : "";
        if (!kind || !body) return [];
        return [{
            kind,
            title: SPECIES_ASK_LAYER_META[kind].title,
            body: clampAskLayerBody(body)
        }];
    }).slice(0, 4);
}

async function generateModelAnswer(question: string, grounding: SpeciesAskGrounding) {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return null;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: MODEL,
            temperature: 0.3,
            response_format: {type: "json_object"},
            messages: [
                {
                    role: "system",
                    content: [
                        "You are AnimalDex's species expert, not a generic chatbot.",
                        "Answer from the grounding packet first. Use general biological knowledge only to fill a narrow gap, and never invent IUCN status, medical advice, or capture-specific claims.",
                        "Keep biology, evolutionary why, AnimalDex lesson, and cultural symbolism in separate layers. Never blur them.",
                        "Biology = established facts and behavior. Why = biological/evolutionary explanation. AnimalDex Lesson = AnimalDex interpretation, not science. Symbolism = cultural/historical interpretation, only if asked.",
                        "Keep the whole answer short: 2–4 short paragraphs total. Each layer is one short paragraph (2–4 sentences). Prefer biology + why. Add lesson only if asked about teaching, learning, or power. Add symbolism only if asked about meaning, culture, or spirit.",
                        "Return JSON: { layers: [{ kind: 'biology'|'why'|'lesson'|'symbolism', title, body }], routeIntents: ['compare'|'power'|'locations'|'experiences'|'instagram'|'collect'|'lesson'] }",
                        "routeIntents are optional product next steps, not URLs. Do not invent question permalinks."
                    ].join(" ")
                },
                {
                    role: "user",
                    content: JSON.stringify({
                        question,
                        grounding: serializeGroundingForModel(grounding)
                    })
                }
            ]
        })
    });

    if (!response.ok) return null;
    const payload = await response.json() as {choices?: Array<{message?: {content?: string}}>};
    const raw = payload.choices?.[0]?.message?.content;
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as {layers?: unknown; routeIntents?: unknown};
        const layers = parseModelLayers(parsed.layers);
        const intents = Array.isArray(parsed.routeIntents)
            ? parsed.routeIntents.filter((item): item is SpeciesAskRouteIntent => typeof item === "string" && ROUTE_INTENTS.has(item as SpeciesAskRouteIntent))
            : [];
        return {layers, intents};
    } catch {
        return null;
    }
}

export async function POST(request: Request) {
    let body: AskBody;
    try {
        body = await request.json() as AskBody;
    } catch {
        return askJson({error: "invalid_request"}, 400);
    }

    const slug = String(body.slug ?? "").trim().toLowerCase();
    const question = String(body.question ?? "").replace(/\s+/g, " ").trim();
    if (!slug || question.length < 3 || question.length > 280) {
        return askJson({error: "invalid_question"}, 400);
    }

    const viewer = await resolveAskViewer(request);
    const limit = askLimitForViewer(viewer);
    const rateKey = `species-ask:${viewer.userId ?? getRequestIdentifier(request)}`;
    const rate = checkRateLimit(rateKey, limit, SPECIES_ASK_WINDOW_MS);
    if (!rate.allowed) {
        return askJson({
            error: "limit_reached",
            remaining: 0,
            limit,
            retryAfterSeconds: rate.retryAfterSeconds,
            signedIn: viewer.signedIn,
            isPro: viewer.isPro
        }, 429);
    }

    const grounding = await buildSpeciesAskGrounding(slug);
    if (!grounding) {
        return askJson({error: "unknown_species"}, 404);
    }

    const fallback = buildCatalogFallbackAnswer(question, grounding);
    const generated = await generateModelAnswer(question, grounding);
    const layers = generated?.layers?.length ? generated.layers : fallback.layers;
    const routes = inferAskProductRoutes(question, grounding);

    return askJson({
        ok: true,
        remaining: rate.remaining,
        signedIn: viewer.signedIn,
        isPro: viewer.isPro,
        limit,
        layers,
        routes
    });
}
