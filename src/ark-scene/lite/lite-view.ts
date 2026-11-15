/**
 * Ark Lite's page (`src/lib/ark-lite.ts` says what and for whom): the Ark without the 3D world. Plain DOM, as the live
 * log and bars are, so the apps' embed and /ark draw the same thing. The live log is mounted into it by its page
 * (`mountArkLiveHud` with no scene: the server's record), floating at its foot as over the world.
 *
 * Privacy: the reader's own animals only (the snapshot's `mine`); everyone else's as kinds and counts.
 */

import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import {ARK_PLACEHOLDER_ICON, isArkPlaceholderSlug} from "@/ark-scene/placeholder-icon";
import {arkLiteModel, arkLiteWords, type ArkLiteMine, type ArkLiteModel, type ArkLiteViewWords} from "@/lib/ark-lite";
import {arkAgoText} from "@/lib/ark-loading";
import {arkSelectionExtras} from "@/lib/ark-selection-extras";
import {fillArkWords} from "@/lib/ark-words";

type Loose = Record<string, unknown> | null | undefined;

export type ArkLiteOptions = {
    /** The Ark's words (`ark` of /api/ark/words, or the page's); null: English. */
    words: Loose;
    locale: string;
    /** The icon of a model slug (the species icons). */
    iconUrl: (slug: string) => string;
    /** The poster behind it (the 3D Ark's own opening view). */
    posterUrl: string | null;
    /** "Open the 3D Ark" (or, once it has loaded behind, "The 3D Ark is ready"). */
    onOpen3d: () => void;
    /** A Talk tap; true when the host handled it (the link then does not navigate). */
    onTalk?: ((animal: Pick<ArkAnimal, "id" | "model_slug" | "name">) => boolean) | null;
    /** The site locale for the Talk links (`/id/talk/…`); null or "en": no prefix. */
    linkLocale?: string | null;
    /** The Talk pages' "Talk to a {animal}" / "Talk to an {animal}" (the words read's `talkPage`). */
    talk?: {a?: string | null; an?: string | null} | null;
};

export type ArkLiteHandle = {
    root: HTMLElement;
    update: (snapshot: ArkSnapshot) => void;
    setHearts: (hearts: Readonly<Record<string, number>> | null) => void;
    setWords: (words: Loose, locale: string, talk?: {a?: string | null; an?: string | null} | null) => void;
    /** The 3D Ark loading behind: "Open the 3D Ark" becomes "The 3D Ark is ready". */
    set3dReady: (ready: boolean) => void;
    setShown: (shown: boolean) => void;
    dispose: () => void;
};

const STYLE_ID = "ark-lite-style";
const FONT = "var(--font-sans, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif)";
const CSS = `
.arkl{position:absolute;inset:0;z-index:3;overflow:hidden;background:#0e140e;color:rgba(255,252,244,.96);font:500 13px/1.35 ${FONT};-webkit-tap-highlight-color:transparent}
.arkl[hidden]{display:none}
.arkl-bg{position:absolute;inset:0;background-size:cover;background-position:center;opacity:.55}
.arkl-bg::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(14,20,14,.25) 0,rgba(14,20,14,.82) 38%,rgba(14,20,14,.94) 100%)}
.arkl-scroll{position:absolute;inset:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.arkl-col{box-sizing:border-box;max-width:34rem;margin:0 auto;padding:calc(16px + env(safe-area-inset-top,0px)) 16px calc(150px + env(safe-area-inset-bottom,0px) + var(--ark-inset-bottom,0px))}
.arkl-head{display:flex;flex-direction:column;gap:6px;margin-bottom:18px}
.arkl-title{margin:0;font:700 22px/1.15 ${FONT};letter-spacing:-.01em}
.arkl-sub{margin:0;color:rgba(255,252,244,.66);font-size:12.5px}
.arkl-chip{align-self:flex-start;margin-top:4px;padding:4px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(14,20,14,.6);font-weight:600;font-size:12px;font-variant-numeric:tabular-nums}
.arkl-open{display:flex;flex-direction:column;align-items:flex-start;gap:4px;margin-top:10px}
.arkl-btn{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:8px 14px;border-radius:12px;border:1px solid rgba(200,250,99,.5);background:rgba(200,250,99,.1);color:#e7fdb8;font:700 13.5px/1.2 ${FONT};cursor:pointer}
.arkl-btn .dot{width:7px;height:7px;border-radius:4px;background:#c8fa63;display:none}
.arkl-btn.ready{background:#c8fa63;color:#14200c;border-color:#c8fa63}
.arkl-btn.ready .dot{display:inline-block;background:#14200c}
.arkl-note{margin:0;color:rgba(255,252,244,.55);font-size:11.5px}
.arkl-h{margin:20px 0 8px;font:700 12px/1.2 ${FONT};letter-spacing:.08em;text-transform:uppercase;color:#c8fa63}
.arkl-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.arkl-card{display:flex;align-items:flex-start;gap:12px;padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.1);background:rgba(14,20,14,.72);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.arkl-icon{flex:none;width:40px;height:40px;border-radius:20px;background:#f6f1e7;display:flex;align-items:center;justify-content:center;overflow:hidden}
.arkl-icon img{width:34px;height:34px;object-fit:contain}
.arkl-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}
.arkl-name{font:700 14px/1.25 ${FONT};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.arkl-meta{color:rgba(255,252,244,.66);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.arkl-hearts{color:#ff6b7a;font-size:12px;letter-spacing:1px}
.arkl-hearts .off{color:rgba(255,255,255,.25)}
.arkl-talk{align-self:flex-start;margin-top:6px;max-width:100%;overflow:hidden;text-overflow:ellipsis;display:inline-flex;align-items:center;min-height:32px;padding:6px 12px;border-radius:999px;background:#c8fa63;color:#14200c;font:700 12px/1 ${FONT};text-decoration:none;white-space:nowrap}
.arkl-region{padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,.1);background:rgba(14,20,14,.72);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.arkl-rtop{display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-weight:700}
.arkl-rtop .n{font-variant-numeric:tabular-nums;color:rgba(255,252,244,.8)}
.arkl-bar{height:4px;margin:8px 0 10px;border-radius:2px;background:rgba(255,255,255,.12);overflow:hidden}
.arkl-bar span{display:block;height:100%;border-radius:2px;background:#c8fa63}
.arkl-kinds{display:flex;flex-wrap:wrap;gap:8px}
.arkl-kind{display:flex;align-items:center;gap:6px;padding:3px 9px 3px 3px;border-radius:999px;background:rgba(255,255,255,.07);font-size:12px;max-width:100%}
.arkl-kind.mine{box-shadow:inset 0 0 0 1.5px #c8fa63}
.arkl-kind .i{flex:none;width:26px;height:26px;border-radius:13px;background:#f6f1e7;display:flex;align-items:center;justify-content:center;overflow:hidden}
.arkl-kind .i img{width:22px;height:22px;object-fit:contain}
.arkl-kind .t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.arkl-kind .c{color:rgba(255,252,244,.6);font-variant-numeric:tabular-nums}
.arkl-more{align-self:center;color:rgba(255,252,244,.55);font-size:11.5px}
`;

function ensureStyle() {
    if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function str(value: unknown, fallback: string): string {
    return typeof value === "string" && value.trim() ? value : fallback;
}

function sub(words: Loose, key: string): Record<string, unknown> {
    const value = words?.[key];
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function icon(className: string, slug: string | null, iconUrl: (slug: string) => string): HTMLElement {
    // (No icon of its own, or one that fails or is known missing: the placeholder figure, as the bars show.)
    const box = el("span", className);
    const img = el("img");
    img.alt = "";
    img.decoding = "async";
    img.loading = "lazy";
    img.onerror = () => {
        if (!img.src.endsWith(ARK_PLACEHOLDER_ICON)) img.src = ARK_PLACEHOLDER_ICON;
    };
    const url = slug && !isArkPlaceholderSlug(slug) ? iconUrl(slug) : "";
    img.src = url || ARK_PLACEHOLDER_ICON;
    box.appendChild(img);
    return box;
}

export function mountArkLite(host: HTMLElement, options: ArkLiteOptions): ArkLiteHandle {
    ensureStyle();
    let words: Loose = options.words;
    let locale = options.locale || "en";
    let lite: ArkLiteViewWords = arkLiteWords(sub(words, "liteView"));
    let snapshot: ArkSnapshot | null = null;
    let hearts: Readonly<Record<string, number>> | null = null;
    let ready = false;
    let talk = options.talk ?? null;

    const root = el("div", "arkl");
    root.dataset.arkLite = "1";
    const bg = el("div", "arkl-bg");
    if (options.posterUrl) bg.style.backgroundImage = `url("${options.posterUrl}")`;
    const scroll = el("div", "arkl-scroll");
    const col = el("div", "arkl-col");
    scroll.appendChild(col);
    root.appendChild(bg);
    root.appendChild(scroll);
    host.appendChild(root);

    const number = (n: number) => n.toLocaleString(locale);

    function header(model: ArkLiteModel): HTMLElement {
        const head = el("header", "arkl-head");
        head.appendChild(el("h1", "arkl-title", lite.title));
        head.appendChild(el("p", "arkl-sub", lite.subtitle));
        const loader = sub(words, "loader");
        const chipText = fillArkWords(str(sub(words, "hud").chip ?? loader.chip, "{count} aboard"), {count: number(model.animals)});
        const species = model.species === 1 ? str(words?.speciesOne, "1 species") : fillArkWords(str(words?.speciesOther, "{count} species"), {count: number(model.species)});
        if (snapshot) head.appendChild(el("span", "arkl-chip", `${chipText} · ${species}`));
        const open = el("div", "arkl-open");
        const button = el("button", `arkl-btn${ready ? " ready" : ""}`);
        button.type = "button";
        button.appendChild(el("span", "dot"));
        button.appendChild(el("span", undefined, ready ? lite.ready3d : lite.open3d));
        button.addEventListener("click", () => options.onOpen3d());
        open.appendChild(button);
        if (!ready) open.appendChild(el("p", "arkl-note", lite.slowNote));
        head.appendChild(open);
        return head;
    }

    function heartsRow(count: number): HTMLElement {
        const row = el("span", "arkl-hearts");
        row.setAttribute("role", "img");
        row.setAttribute("aria-label", fillArkWords(str(sub(words, "hearts").label, "{n} of 3 hearts"), {n: String(count)}));
        for (let i = 0; i < 3; i++) row.appendChild(el("span", i < count ? undefined : "off", "♥"));
        return row;
    }

    function mineCard(animal: ArkLiteMine): HTMLElement {
        const item = el("li", "arkl-card");
        item.appendChild(icon("arkl-icon", animal.placeholder ? null : animal.slug, options.iconUrl));
        const main = el("div", "arkl-main");
        main.appendChild(el("span", "arkl-name", animal.name));
        const regions = sub(words, "regions");
        const zones = sub(words, "zones");
        const where = [str(regions[animal.region], ""), str(zones[animal.zone], "")].filter(Boolean).join(" · ");
        if (where) main.appendChild(el("span", "arkl-meta", where));
        const origin = animal.origin === "born"
            ? str(sub(words, "life").bornAboard, "Born on the Ark")
            : `${str(words?.arrived, "Arrived")} ${arkAgoText(animal.arrivedAt, new Date(), locale)}`;
        main.appendChild(el("span", "arkl-meta", origin));
        if (animal.hearts !== null) main.appendChild(heartsRow(animal.hearts));
        item.appendChild(main);
        // (Talk under its words, never beside: "Talk to an Oriental Latrine Fly" would leave the name no room.)
        const extras = arkSelectionExtras({
            animal: {name: animal.name, model_slug: animal.slug, placeholder: animal.placeholder, origin: animal.origin},
            founder: null,
            words: {talkA: talk?.a ?? null, talkAn: talk?.an ?? null},
            locale: options.linkLocale ?? null
        });
        if (extras.talk) {
            const talk = el("a", "arkl-talk", extras.talk.label);
            talk.href = extras.talk.href;
            talk.addEventListener("click", (event) => {
                if (options.onTalk?.({id: animal.id, model_slug: animal.slug, name: animal.name})) event.preventDefault();
            });
            main.appendChild(talk);
        }
        return item;
    }

    function regionCard(region: ArkLiteModel["regions"][number]): HTMLElement {
        const card = el("li", "arkl-region");
        const top = el("div", "arkl-rtop");
        top.appendChild(el("span", undefined, str(sub(words, "regions")[region.region], region.region)));
        top.appendChild(el("span", "n", number(region.animals)));
        card.appendChild(top);
        const bar = el("div", "arkl-bar");
        const fill = el("span");
        fill.style.width = `${Math.round(region.share * 100)}%`;
        bar.appendChild(fill);
        card.appendChild(bar);
        const kinds = el("div", "arkl-kinds");
        for (const kind of region.kinds) {
            const chip = el("span", `arkl-kind${kind.mine > 0 ? " mine" : ""}`);
            chip.appendChild(icon("i", kind.slug || null, options.iconUrl));
            chip.appendChild(el("span", "t", kind.name));
            chip.appendChild(el("span", "c", number(kind.count)));
            kinds.appendChild(chip);
        }
        const more = region.species - region.kinds.length;
        if (more > 0) kinds.appendChild(el("span", "arkl-more", fillArkWords(lite.kindsMore, {count: number(more)})));
        card.appendChild(kinds);
        return card;
    }

    function render() {
        const model = arkLiteModel(snapshot, hearts);
        const top = scroll.scrollTop;
        col.replaceChildren();
        col.appendChild(header(model));
        if (model.mine.length) {
            col.appendChild(el("h2", "arkl-h", str(words?.myAnimals, "My animals")));
            const list = el("ul", "arkl-list");
            for (const animal of model.mine) list.appendChild(mineCard(animal));
            col.appendChild(list);
        }
        if (model.regions.length) {
            col.appendChild(el("h2", "arkl-h", lite.where));
            const list = el("ul", "arkl-list");
            for (const region of model.regions) list.appendChild(regionCard(region));
            col.appendChild(list);
        }
        scroll.scrollTop = top;
    }

    render();
    return {
        root,
        update: (next) => {
            snapshot = next;
            render();
        },
        setHearts: (next) => {
            hearts = next;
            render();
        },
        setWords: (next, nextLocale, nextTalk) => {
            words = next;
            if (nextTalk !== undefined) talk = nextTalk;
            locale = nextLocale || locale;
            lite = arkLiteWords(sub(words, "liteView"));
            render();
        },
        set3dReady: (next) => {
            if (ready === next) return;
            ready = next;
            render();
        },
        setShown: (shown) => {
            root.hidden = !shown;
        },
        dispose: () => root.remove()
    };
}
