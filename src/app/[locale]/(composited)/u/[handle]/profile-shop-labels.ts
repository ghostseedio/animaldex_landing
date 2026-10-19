/**
 * The Shop tab strings (profile.shop.* in the locale files). A plain module,
 * not the client component, so the server page can read the key list.
 */
export type ProfileShopLabels = Record<string, string>;

export const PROFILE_SHOP_LABEL_KEYS = [
    "wildlifeGuides", "noticeTitle", "noticeDetail", "keepSharing", "dontShare",
    "privateTitle", "privateDetail", "soonTitle", "soonDetail",
    "shareMine", "shareOnDetail", "shareOffDetail",
    "noGuidesTitle", "noGuidesOwnerDetail", "noGuidesVisitorDetail",
    "growingTitle", "unnamedPlace", "loadFailedTitle", "loadFailedDetail", "settingsFailed",
    "speciesOne", "speciesMany", "rareMany", "moreOne", "moreMany", "needsPhoto",
    "statusWriting", "statusNotShared", "statusPaused", "statusPublic", "statusNotPublic", "statusReady", "statusHidden",
    "sealedPacks", "sealedPacksDetail", "packsForSale", "noActiveListings", "manage",
    "waysToEarn", "waysToEarnDetail", "nothingListedTitle", "nothingListedDetail"
] as const;

