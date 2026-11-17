/**
 * THE ONE SWITCH for battle tier (E to S) and battle power on screen.
 *
 * Battles have been off since 2026-10-30, so nothing a person sees names a battle tier or a battle power:
 * not on cards, share cards, the profile, location pages, packs or the sign-in animation. The data is
 * kept (`getBattleTier`, `getBattlePower`, the server's stats and the admin catalog still compute it);
 * only the display is held back. Set this to `true` to bring all of it back in one change.
 *
 * Not behind this switch: rarity (Common to Mythic), the photo Grade, conservation status, and the
 * editorial tier lists at /tier-list and /rankings, whose S to E tiers come from a ranking's own order.
 */
export const SHOWS_BATTLE_TIER_AND_POWER = false;
