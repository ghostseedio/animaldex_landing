/**
 * BROODS: the last brood read the live controller took (`src/ark-scene/live/controller.ts`), for the parents' cards
 * (`ark-card-brood.tsx`). A store of its own so that neither the Ark page's first JavaScript nor its props carry
 * anything of the broods: the controller and the card are both loaded later, and meet here.
 */

import {ARK_BROODS_OFF, type ArkBroodsRead} from "@/lib/ark-broods";

let current: ArkBroodsRead = ARK_BROODS_OFF;
const listeners = new Set<() => void>();

export const arkBroodsStore = {
    get: (): ArkBroodsRead => current,
    set: (read: ArkBroodsRead) => {
        if (read === current || (!read.on && !current.on)) return;
        current = read;
        listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    }
};
