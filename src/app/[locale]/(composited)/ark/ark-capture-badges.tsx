"use client";

import React from "react";
import BattleTierChip from "@/app/[locale]/(composited)/animals/battle-tier-chip";
import {ArkHeartIcons} from "@/app/[locale]/(composited)/ark/ark-heart-icons";
import {SHOWS_BATTLE_TIER_AND_POWER} from "@/lib/battle-visibility";
import {arkHeartsWords} from "@/lib/ark-hearts";
import type {ArkLife} from "@/lib/ark-life";
import {ARK_SIMPLE_ENGLISH, fillArkWords, type ArkWords} from "@/lib/ark-words";

/**
 * The battle tier chip and the hearts beside the index number (owner 2026-11-21): the tier of the capture that brought it
 * aboard (the server's letter, never one worked out here) and that card's hearts, its lives in the Ark, read-only for
 * everyone (the restore stays on the owner's lives row). An animal born on the Ark has neither: nothing shows.
 * The tier chip is behind THE ONE SWITCH (`SHOWS_BATTLE_TIER_AND_POWER`, off while battles are off), as on the apps'
 * cards (iOS `BattleVisibility.showsTierAndPower`, Android `BattleVisibility.SHOWS_TIER_AND_POWER`); the hearts are not.
 */
export function ArkCaptureBadges({life, words, ownHearts = null}: {life: ArkLife | null; words: ArkWords; /** The owner's own count (/api/ark/hearts): shown here, once, and current after a restore. */ ownHearts?: number | null}) {
    if (life && life.origin.kind !== "arrived") return null;
    const tier = SHOWS_BATTLE_TIER_AND_POWER ? life?.capture_tier ?? null : null;
    const hearts = typeof ownHearts === "number" ? ownHearts : typeof life?.capture_hearts === "number" ? life.capture_hearts : null;
    if (!tier && hearts === null) return null;
    const simple = {...ARK_SIMPLE_ENGLISH, ...(words.simple ?? {})};
    const heartsLabel = fillArkWords(arkHeartsWords(words.hearts).label, {n: hearts ?? 0});
    return (
        <>
            {tier ? <BattleTierChip tier={tier} compact square label={simple.tier} title={fillArkWords(simple.tierHint, {tier})} testId="ark-card-tier" labelClassName="hidden sm:inline" className="!h-[17px] !gap-0.5 !px-1.5" /> : null}
            {hearts !== null ? (
                <span role="img" aria-label={heartsLabel} title={heartsLabel} data-testid="ark-card-hearts" data-hearts={hearts} className="flex shrink-0 items-center">
                    <ArkHeartIcons hearts={hearts} size={12} />
                </span>
            ) : null}
        </>
    );
}
