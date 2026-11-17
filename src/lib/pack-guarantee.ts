/**
 * What a sealed pack promises (animal_packs.guaranteed_minimum_tier).
 *
 * New packs promise a minimum RARITY tier (Uncommon ... Mythic) of their species rarity; the server decides
 * (`animal_pack_min_rarity_tier()`, migration 20261130110000) and PACK_MIN_RARITY is the web's copy of that choice,
 * used only to word the builder: change both together. Packs sealed before the change carry "B": they were checked
 * against battle Tier B+ and keep saying so.
 */

import {rarityKey} from "@/lib/capture-card-chips";

export type PackRarityTier = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary" | "Mythic";

export const PACK_MIN_RARITY: PackRarityTier = "Epic";

const RARITY_ORDER: readonly PackRarityTier[] = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic"];

/** The rarity tier of a species rarity stat (iOS `RarityTier(rarityValue:)`), as the label users see. */
export function rarityTierLabel(rarity: number | null | undefined): PackRarityTier | null {
    const key = rarityKey(rarity);
    return key ? RARITY_ORDER.find((tier) => tier.toLowerCase() === key) ?? null : null;
}

export function rarityTierRank(rarity: number | null | undefined): number {
    const tier = rarityTierLabel(rarity);
    return tier ? RARITY_ORDER.indexOf(tier) : -1;
}

export type PackGuarantee =
    | {kind: "rarity"; tier: PackRarityTier}
    | {kind: "legacyBattleTier"; tier: string};

export function parsePackGuarantee(raw: string | null | undefined): PackGuarantee {
    const value = raw?.trim() ?? "";
    const tier = RARITY_ORDER.find((candidate) => candidate === value);
    // Common is never a promise; the legacy "B" (and anything unreadable) keeps the old wording.
    if (tier && tier !== "Common") return {kind: "rarity", tier};
    return {kind: "legacyBattleTier", tier: /^[EDCBAS]$/.test(value) ? value : "B"};
}

/** "Epic or better guaranteed" (a pack sealed under the old rule: "Tier B+ guaranteed"). */
export function packGuaranteeBadge(raw: string | null | undefined): string {
    const guarantee = parsePackGuarantee(raw);
    return guarantee.kind === "rarity" ? `${guarantee.tier} or better guaranteed` : `Tier ${guarantee.tier}+ guaranteed`;
}

/** "Epic+", the short pill in the builder. */
export function packBuilderPill(): string {
    return `${PACK_MIN_RARITY}+`;
}

/** "Your pack needs at least 1 animal of Epic rarity or better." */
export function packRarityRequirementMessage(): string {
    return `Your pack needs at least 1 animal of ${PACK_MIN_RARITY} rarity or better.`;
}

/** Best first for the guarantee: the rarest captures lead, then value, then newest. */
export function comparePackBuilderCaptures(
    left: {rarity: number; tradeValue: number; capturedAt: string | null},
    right: {rarity: number; tradeValue: number; capturedAt: string | null}
): number {
    const rarityDelta = rarityTierRank(right.rarity) - rarityTierRank(left.rarity);
    if (rarityDelta !== 0) return rarityDelta;
    const valueDelta = right.tradeValue - left.tradeValue;
    if (valueDelta !== 0) return valueDelta;
    return (right.capturedAt ?? "").localeCompare(left.capturedAt ?? "");
}
