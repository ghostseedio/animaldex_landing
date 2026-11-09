import "server-only";

/**
 * Life Sim on the web's own chat, the server's glue (AnimalDex
 * docs/life-sim/CONTRACT.md, sections 4 to 6). The logic and every prompt
 * are the edge lane's (`ark-sim.ts`, ported verbatim); this file only gives
 * them the website's fast JSON model call, which stands in for the apps'
 * `fastJSON`.
 */

import {requestAskJSONObject} from "@/lib/ask-animaldex/providers";
import type {FastJSONCall} from "@/lib/ask-animaldex/ark-sim";

/**
 * The apps' `fastJSON` (debate-models.ts): one prompt in, one JSON object
 * out. The website's JSON call (Gemini, then OpenAI) carries the prompt as
 * the user turn; the system turn only asks for JSON. An empty object when no
 * model answered, which `parseStepSimTags` reads as unusable.
 */
export const askFastJSON: FastJSONCall = async (params) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), params.timeoutMs * 2);
    try {
        const raw = await requestAskJSONObject({
            systemPrompt: "Return JSON only, exactly as the user's message asks.",
            userPrompt: params.prompt,
            signal: controller.signal
        });
        return raw ?? {};
    } catch (error) {
        console.warn(`[ark] ${params.feature} failed`, error instanceof Error ? error.message.slice(0, 200) : "unknown");
        return {};
    } finally {
        clearTimeout(timer);
    }
};
