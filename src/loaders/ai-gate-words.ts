import "server-only";
import {getScopedTranslator} from "@/loaders/translation";
import type {AiGateWords} from "@/components/ai-gate/ai-chat-gate";

/** The chat gate's words (the age check, the AI consent, the under-13 block) in the reader's language. */
export async function getAiGateWords(locale: string): Promise<AiGateWords> {
    const t = await getScopedTranslator(locale, "askAnimalDex");
    return {
        consentTitle: t("consentTitle"),
        consentBody: t("consentBody"),
        consentPoints: [t("consentPointAi"), t("consentPointMemory"), t("consentPointCare")],
        consentMore: t("consentMore"),
        consentPrivacy: t("consentPrivacy"),
        consentSafety: t("consentSafety"),
        consentAgree: t("consentAgree"),
        consentNotNow: t("consentNotNow"),
        ageTitle: t("ageTitle"),
        ageBody: t("ageBody"),
        ageYearLabel: t("ageYearLabel"),
        ageContinue: t("ageContinue"),
        ageNote: t("ageNote"),
        ageFailed: t("ageFailed"),
        under13Title: t("under13Title"),
        under13Body: t("under13Body"),
        under13Closing: t("under13Closing"),
        under13Failed: t("under13Failed"),
        under13Retry: t("under13Retry"),
        under13Support: t("under13Support"),
        close: t("gateClose")
    };
}
