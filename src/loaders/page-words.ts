import "server-only";
import {localeConfig} from "@/i18n";
import {loadLocaleMessages} from "@/loaders/locale";
import {ARK_FOOD_CHAIN_WORD_KEYS, type ArkFoodChainWords} from "@/components/ark/ark-food-chain-panel";

/**
 * The SEO lane's page words (`pages.*`, `seo.*` in the locale files), in the
 * page's locale, English key by key where the locale lacks one, so a page never
 * shows a raw key while a translation is pending.
 */

type Tree = {[key: string]: string | Tree};

function pick(tree: unknown, path: string): unknown {
    return path.split(".").reduce<unknown>((node, key) => (node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined), tree);
}

function mergeTrees(english: unknown, local: unknown): Tree {
    const out: Tree = {};
    const base = english && typeof english === "object" ? (english as Record<string, unknown>) : {};
    const over = local && typeof local === "object" ? (local as Record<string, unknown>) : {};
    for (const key of Object.keys(base)) {
        const a = base[key];
        const b = over[key];
        if (a && typeof a === "object") out[key] = mergeTrees(a, b);
        else out[key] = typeof b === "string" && b.trim() ? b : String(a ?? "");
    }
    return out;
}

/** A namespace path ("pages.howItWorks", "seo") as a tree of strings. */
export async function getPageWords(locale: string, path: string): Promise<Tree> {
    const resolved = localeConfig.locales.includes(locale) ? locale : localeConfig.defaultLocale;
    const [english, local] = await Promise.all([
        loadLocaleMessages(localeConfig.defaultLocale),
        resolved === localeConfig.defaultLocale ? Promise.resolve(null) : loadLocaleMessages(resolved)
    ]);
    return mergeTrees(pick(english, path), local ? pick(local, path) : null);
}

/** A string of a words tree, or "" (a page renders nothing rather than a key). */
export function word(tree: Tree, path: string, values?: Record<string, string | number>): string {
    const value = pick(tree, path);
    const text = typeof value === "string" ? value : "";
    if (!values) return text;
    return text.replace(/\{(\w+)\}/g, (match, key) => (values[key] === undefined ? match : String(values[key])));
}

export type PageWords = Tree;

export async function getFoodChainWords(locale: string): Promise<{words: ArkFoodChainWords; page: Tree}> {
    const page = await getPageWords(locale, "pages.foodChain");
    const words = Object.fromEntries(ARK_FOOD_CHAIN_WORD_KEYS.map((key) => [key, word(page, key)])) as ArkFoodChainWords;
    return {words, page};
}
