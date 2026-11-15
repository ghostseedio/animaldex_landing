/**
 * What the box over the selected animal's bars adds under its name (docs/ark/CAPTURE-MEDIA-CONTRACT.md sections 1, 3
 * and 4; owner, 2026-11-15): "Brought by @handle" only when the server names its founder (the founders read's
 * `brought_by`; never a Voyager label, never a display name or nickname), "Born on the Ark" for one born aboard, and a
 * Talk link for any talkable species. The same for /ark and the apps' embed: each host passes its founders and words.
 */

import type {ArkAnimal, ArkSelectionExtras} from "@/ark-scene/types";
import {isArkPlaceholderSlug} from "@/ark-scene/placeholder-icon";
import type {ArkFounder} from "@/lib/ark-founders";
import {arkProfileHref} from "@/lib/ark-profile-link";

/** The words it uses, each optional (the embed has none until its words read lands: English then). */
export type ArkSelectionWords = {
    /** `ark.founders.card.broughtBy`, "Brought by {name}". */
    broughtBy?: string | null;
    /** `ark.life.bornAboard`, "Born on the Ark". */
    bornAboard?: string | null;
    /** `talkPage.animalTitleA|An`, "Talk to a {animal}" / "Talk to an {animal}". */
    talkA?: string | null;
    talkAn?: string | null;
};

const HANDLE = /^[a-z0-9](?:[a-z0-9._-]{0,28}[a-z0-9])?$/i;

/** A site path with the site's locale prefix off English (`/id/talk/zebra`), as `arkProfileHref` does it. */
export function arkLocalePath(path: string, locale?: string | null): string {
    return locale && locale !== "en" ? `/${locale}${path}` : path;
}

/** The existing Talk page for a species (the one "Talk to an animal" opens): `/talk/<model slug>`. */
export function arkTalkHref(slug: string, locale?: string | null): string {
    return arkLocalePath(`/talk/${encodeURIComponent(slug)}`, locale);
}

/** Whether the species has a Talk page: an Ark model of its own (not the placeholder figure). */
export function arkTalkable(animal: Pick<ArkAnimal, "model_slug" | "placeholder">): boolean {
    return animal.placeholder !== true && Boolean(animal.model_slug) && !isArkPlaceholderSlug(animal.model_slug);
}

function talkLabel(name: string, words: ArkSelectionWords): string {
    const an = /^[aeiou]/i.test(name) && !/^(uni|eu|one|use|usu|ura)/i.test(name);
    const template = (an ? words.talkAn : words.talkA) || (an ? "Talk to an {animal}" : "Talk to a {animal}");
    return template.replace("{animal}", name);
}

export function arkSelectionExtras(input: {
    animal: Pick<ArkAnimal, "name" | "model_slug" | "placeholder" | "origin">;
    /** The animal's named founder (the founders read's `brought_by`), or null (a Voyager, or the names switch off). */
    founder: Pick<ArkFounder, "handle"> | null | undefined;
    words?: ArkSelectionWords | null;
    /** The site locale for the links (`/id/u/…`); null or "en": no prefix. */
    locale?: string | null;
}): ArkSelectionExtras {
    const words = input.words ?? {};
    const {animal} = input;
    let byline: ArkSelectionExtras["byline"] = null;
    if (animal.origin === "born") {
        byline = {kind: "text", text: words.bornAboard || "Born on the Ark"};
    } else {
        const handle = input.founder?.handle?.replace(/^@+/, "") ?? "";
        if (HANDLE.test(handle)) {
            byline = {kind: "founder", template: words.broughtBy || "Brought by {name}", handle, href: arkProfileHref(handle, input.locale)};
        }
    }
    const talk = arkTalkable(animal) ? {label: talkLabel(animal.name, words), href: arkTalkHref(animal.model_slug, input.locale)} : null;
    return {byline, talk};
}
