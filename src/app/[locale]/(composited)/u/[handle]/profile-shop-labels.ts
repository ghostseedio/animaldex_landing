/**
 * The Shop tab strings (profile.shop.* in the locale files). A plain module,
 * not the client component, so the server page can read the key list.
 */
export type ProfileShopLabels = Record<string, string>;

export const PROFILE_SHOP_LABEL_KEYS = [
    "wildlifeGuides", "noticeTitle", "noticeDetail", "keepSharing", "dontShare", "closeNotice",
    "privateTitle", "privateDetail", "soonTitle", "soonDetail",
    "shareMine", "shareOnDetail", "shareOffDetail",
    "noGuidesTitle", "noGuidesOwnerDetail", "noGuidesVisitorDetail",
    "growingTitle", "unnamedPlace", "loadFailedTitle", "loadFailedDetail", "settingsFailed",
    "speciesOne", "speciesMany", "rareMany", "moreOne", "moreMany", "needsPhoto",
    "statusWriting", "statusNotShared", "statusPaused", "statusPublic", "statusNotPublic", "statusReady", "statusHidden",
    "sealedPacks", "sealedPacksDetail", "packsForSale", "noActiveListings", "manage",
    "waysToEarn", "waysToEarnDetail", "nothingListedTitle", "nothingListedDetail",
    "termsTitle", "termsLine1", "termsLine2", "termsLine3", "termsLine4", "termsLine5",
    "termsRead", "termsAge", "termsAccept", "termsFailed", "boughtGuides", "refunded", "by",
    "termsIntro", "termsHeld", "salesTitle", "salesMessage", "salesBuyer",
    "saleAwaiting", "saleAwaitingLate", "salePending", "saleHeld", "salePaidOut", "saleRefundedNoReply", "saleRefunded",
    "statusSalesPaused"
] as const;

