/**
 * Player control's words on the web page and in the scene's HUD (English).
 *
 * Kept here, not in the Ark's locale namespace, while the wording settles behind the `player_control` switch
 * (DECISIONS.md: one translation pass into all 44 app languages before the switch goes on, as every Ark bundle must
 * carry every English key). `ARK_CONTROL_SCENE_WORDS` is the HUD's (`src/ark-scene/control/hud.ts` CONTROL_WORDS_EN).
 */

import {CONTROL_WORDS_EN, type ControlWords} from "@/ark-scene/control/hud";

export const ARK_CONTROL_SCENE_WORDS: ControlWords = CONTROL_WORDS_EN;

export const ARK_CONTROL_WORDS = {
    control: "Control",
    starting: "Starting…",
    exploringNow: "Exploring now",
    denied: {
        off: "Exploring isn't open yet",
        signed_out: "Sign in to explore as your animal",
        not_yours: "Only your own animals can be controlled",
        age: "Exploring isn't available on this account",
        sessile: "This animal stays where it is: you can watch it",
        cooldown: "It's resting after a long outing: try again in a few minutes",
        daily_limit: "That's enough exploring for this animal today",
        busy: "Someone is already exploring as this animal",
        other_animal: "You're already exploring as another animal",
        no_key: "Exploring is resting right now",
        expired: "That took too long: try again",
        used: "Try again",
        bad_ticket: "Try again",
        wrong_island: "This animal lives on the other island",
        start_pose: "It can't be controlled from where it is now",
        full: "Exploring is full right now: try again soon",
        rate: "Wait a moment and try again",
        store: "Exploring is resting right now",
        slow: "The connection is too slow to explore right now",
        network: "Couldn't reach the Ark: try again",
        other: "Couldn't start exploring: try again"
    } as Record<string, string>,
    ended: CONTROL_WORDS_EN.released
};
