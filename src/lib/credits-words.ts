/**
 * The Credits page's words (`appCredits` in the locale files), as iOS
 * `CreditsAndProStoreView` and `CreditHistoryView` word them.
 */
export const CREDITS_WORD_KEYS = [
    "eyebrow", "titlePro", "titleFree", "bodyPro", "bodyFree", "yourAnimalDex", "balanceOne", "balanceMany",
    "subscribedWeb", "subscribedApple", "subscribedGoogle", "subscribedOther", "creditsNote", "refresh", "refreshed",
    "manage", "manageWeb", "opening", "manageApple", "manageGoogle", "purchaseDone", "purchaseCancelled",
    "signedInAs", "purchasesGoHere", "nothingOnSale", "membership", "recommended", "yourMembership", "membershipActive",
    "choosePlan", "yearly", "monthly", "save", "unavailable", "openingCheckout", "startTrial", "goPro", "trialTerms",
    "packsTitle", "creditPack", "buy", "earnTitle", "earnDetail", "yourAccount", "history", "historyDetail",
    "historyEmptyTitle", "historyEmptyDetail", "historyFailed", "tryAgain", "credits"
] as const;

export type CreditsWords = Record<(typeof CREDITS_WORD_KEYS)[number], string>;

/** "{count} Credits" with the count in, "1 Credit" for one. */
export function creditBalanceLine(words: Pick<CreditsWords, "balanceOne" | "balanceMany">, balance: number) {
    return balance === 1 ? words.balanceOne : words.balanceMany.replace("{count}", String(balance));
}
