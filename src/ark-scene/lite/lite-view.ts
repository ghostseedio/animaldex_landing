/**
 * Ark Lite's page (`src/lib/ark-lite.ts` says what and for whom): the Ark without the 3D world. Plain DOM, as the live
 * log and bars are, so the apps' embed and /ark draw the same thing.
 *
 * - "Latest on the Ark" (`src/lib/ark-lite-feed.ts`): the record as it comes, newest first, with a Live dot; it reads
 *   the server's record every 30 s while shown, and new lines light up as they land.
 * - The reader's own animals.
 * - Where they are: each region's kinds; a tapped kind lists its animals and who brought each one (decision 359).
 *
 * Privacy: the record's lines name species only; a founder is named only as the 3D Ark's box names one (the founders
 * read's @handle, while the server names founders), never a Voyager label or a display name.
 */

import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import type {ArkFounders} from "@/lib/ark-founders";
import {decodeArkEvents} from "@/lib/ark-life";
import {arkLiveLineText} from "@/lib/ark-live-log";
import {arkLiveTextOf, type ArkLiveWordsIn} from "@/ark-scene/live/controller";
import {ARK_LITE_FEED_BACK_MS, ARK_LITE_FEED_LONG, ARK_LITE_FEED_POLL_MS, ARK_LITE_FEED_SHORT, arkLiteFeedFromEvents, arkLiteFeedLines, arkLiteFeedMerge, arkLiteFeedSeed, type ArkLiteFeedEntry} from "@/lib/ark-lite-feed";
import {ARK_PLACEHOLDER_ICON, isArkPlaceholderSlug} from "@/ark-scene/placeholder-icon";
import {arkLiteKindAnimals, arkLiteModel, arkLiteWords, type ArkLiteKind, type ArkLiteMine, type ArkLiteModel, type ArkLiteViewWords} from "@/lib/ark-lite";
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
    /** The server's record (`/api/ark/events`), or null: the snapshot's arrivals and births only. */
    eventsUrl?: string | null;
    /** A bringer's @handle tapped; true when the host handled it (the link then does not navigate). */
    onProfile?: ((handle: string) => boolean) | null;
};

export type ArkLiteHandle = {
    root: HTMLElement;
    update: (snapshot: ArkSnapshot) => void;
    setHearts: (hearts: Readonly<Record<string, number>> | null) => void;
    setWords: (words: Loose, locale: string, talk?: {a?: string | null; an?: string | null} | null) => void;
    /** The 3D Ark loading behind: "Open the 3D Ark" becomes "The 3D Ark is ready". */
    set3dReady: (ready: boolean) => void;
    /** The founders read beside the snapshot (who brought which animal, while the server names founders). */
    setFounders: (founders: ArkFounders | null) => void;
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
.arkl-col{box-sizing:border-box;max-width:34rem;margin:0 auto;padding:calc(16px + env(safe-area-inset-top,0px)) 16px calc(40px + env(safe-area-inset-bottom,0px) + var(--ark-inset-bottom,0px))}
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
.arkl-tl{margin-top:6px;padding:6px 8px;border-radius:10px;background:rgba(255,255,255,.06)}
.arkl-tl .hd{margin:0;display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px}
.arkl-tl .tt{font:700 10.5px/1.2 ${FONT};letter-spacing:.08em;text-transform:uppercase;color:rgba(255,252,244,.55)}
.arkl-tl .vv{font:700 13.5px/1.3 ${FONT};color:rgba(255,252,244,.98)}
.arkl-tl ul{list-style:none;margin:4px 0 0;padding:0}
.arkl-tl li{position:relative;padding-left:10px;color:rgba(255,252,244,.72);font-size:11.5px;line-height:1.35}
.arkl-tl li::before{content:"";position:absolute;left:0;top:.55em;width:4px;height:4px;border-radius:2px;background:rgba(255,252,244,.4)}
.arkl-tl .nn{margin:4px 0 0;color:rgba(255,252,244,.5);font-size:11px;font-style:italic;line-height:1.35}
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
button.arkl-kind{border:0;color:inherit;font:inherit;cursor:pointer;text-align:left}
button.arkl-kind.open{background:rgba(200,250,99,.22)}
button.arkl-more{border:0;background:none;padding:6px 4px;font:600 11.5px/1.2 ${FONT};cursor:pointer;text-decoration:underline;text-underline-offset:2px}
.arkl-hint{margin:-2px 0 8px;color:rgba(255,252,244,.55);font-size:11.5px}
.arkl-who{list-style:none;margin:10px 0 0;padding:8px 0 0;border-top:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:6px}
.arkl-who li{display:flex;justify-content:space-between;gap:10px;font-size:12px;line-height:1.3}
.arkl-who .w{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.arkl-who .w b{font-weight:700}
.arkl-who .w .by{color:rgba(255,252,244,.72)}
.arkl-who a{color:#c8fa63;font-weight:700;text-decoration:none}
.arkl-who .you{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;background:#c8fa63;color:#14200c;font-size:10.5px;font-weight:700}
.arkl-who .ago{flex:none;color:rgba(255,252,244,.5);font-variant-numeric:tabular-nums}
.arkl-feedh{display:flex;align-items:center;gap:8px}
.arkl-live{display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border-radius:999px;background:rgba(255,107,122,.16);color:#ff8d98;font-size:10.5px;letter-spacing:.06em}
.arkl-live i{width:7px;height:7px;border-radius:4px;background:#ff5a6c;animation:arkl-pulse 1.6s ease-in-out infinite}
.arkl-live.off{background:rgba(255,255,255,.08);color:rgba(255,252,244,.5)}
.arkl-live.off i{background:rgba(255,255,255,.35);animation:none}
@keyframes arkl-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.7)}}
.arkl-feed{list-style:none;margin:0;padding:4px 0;border-radius:14px;border:1px solid rgba(255,255,255,.1);background:rgba(14,20,14,.72);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.arkl-ev{display:flex;align-items:center;gap:10px;padding:7px 12px;font-size:12.5px;line-height:1.3}
.arkl-ev+.arkl-ev{border-top:1px solid rgba(255,255,255,.06)}
.arkl-ev .i{flex:none;width:28px;height:28px;border-radius:14px;background:#f6f1e7;display:flex;align-items:center;justify-content:center;overflow:hidden}
.arkl-ev .i img{width:24px;height:24px;object-fit:contain}
.arkl-ev .t{flex:1;min-width:0}
.arkl-ev .ago{flex:none;color:rgba(255,252,244,.5);font-size:11px;font-variant-numeric:tabular-nums}
.arkl-ev.new{animation:arkl-new 2.4s ease-out}
@keyframes arkl-new{0%{background:rgba(200,250,99,.32)}100%{background:transparent}}
.arkl-feedmore{display:block;margin:6px auto 0;border:0;background:none;color:rgba(255,252,244,.7);font:600 12px/1.2 ${FONT};padding:6px 10px;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
@media (prefers-reduced-motion:reduce){.arkl-live i,.arkl-ev.new{animation:none}}
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
    let founders: ArkFounders | null = null;
    let shown = true;
    let disposed = false;
    /** The record read so far, newest first; the lines drawn last (new ones light up); "Show more" open. */
    let feed: ArkLiteFeedEntry[] = [];
    const drawn = new Set<string>();
    let feedLong = false;
    let feedOk = true;
    let cursor = Date.now() - ARK_LITE_FEED_BACK_MS;
    let reading = false;
    /** Regions with all their kinds shown; the kind whose animals are listed ("region|key"). */
    const allKinds = new Set<string>();
    let openKind: string | null = null;

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
    const feedBox = el("section");

    function liveText() {
        return arkLiveTextOf({live: sub(words, "live"), replay: sub(words, "replay"), activity: sub(words, "activity")} as ArkLiveWordsIn);
    }

    function renderFeed() {
        const lines = arkLiteFeedLines(feed, feedLong ? ARK_LITE_FEED_LONG : ARK_LITE_FEED_SHORT);
        if (!lines.length) {
            feedBox.replaceChildren();
            return;
        }
        const first = drawn.size === 0;
        const head = el("h2", "arkl-h arkl-feedh");
        head.appendChild(el("span", undefined, lite.latest));
        const live = el("span", `arkl-live${feedOk && options.eventsUrl ? "" : " off"}`);
        live.appendChild(el("i"));
        live.appendChild(el("span", undefined, lite.live));
        head.appendChild(live);
        const list = el("ul", "arkl-feed");
        list.setAttribute("aria-live", "polite");
        const text = liveText();
        const now = new Date();
        for (const line of lines) {
            const fresh = !first && !drawn.has(line.id);
            const item = el("li", `arkl-ev${fresh ? " new" : ""}`);
            item.appendChild(icon("i", line.slug, options.iconUrl));
            item.appendChild(el("span", "t", arkLiveLineText(line.item, text, locale)));
            item.appendChild(el("span", "ago", arkAgoText(line.at, now, locale)));
            list.appendChild(item);
        }
        for (const line of lines) for (const id of line.ids) drawn.add(id);
        const toggle = el("button", "arkl-feedmore", feedLong ? lite.showLess : lite.showMore);
        toggle.type = "button";
        toggle.addEventListener("click", () => {
            feedLong = !feedLong;
            renderFeed();
        });
        feedBox.replaceChildren(head, list);
        if (arkLiteFeedLines(feed, ARK_LITE_FEED_SHORT + 1).length > ARK_LITE_FEED_SHORT) feedBox.appendChild(toggle);
    }

    function addFeed(entries: ArkLiteFeedEntry[]) {
        if (!entries.length) return;
        feed = arkLiteFeedMerge(feed, entries);
        renderFeed();
    }

    function readFeed(again = 0) {
        const url = options.eventsUrl;
        if (!url || reading || disposed) return;
        reading = true;
        const since = new Date(cursor).toISOString();
        let more = false;
        fetch(`${url}?since=${encodeURIComponent(since)}`, {cache: "no-store"})
            .then((response) => (response.ok ? response.json() : null))
            .then((body: {events?: unknown; available?: boolean; more?: boolean} | null) => {
                if (disposed) return;
                feedOk = Boolean(body && body.available !== false);
                if (!body || !feedOk) return;
                const events = decodeArkEvents(body.events ?? [], snapshot);
                let newest = cursor;
                for (const event of events) newest = Math.max(newest, Date.parse(event.at) || 0);
                more = body.more === true && newest > cursor;
                cursor = newest;
                feed = arkLiteFeedMerge(feed, arkLiteFeedFromEvents(events));
            })
            .catch(() => {
                feedOk = false;
            })
            .finally(() => {
                reading = false;
                if (disposed) return;
                renderFeed();
                if (more && again < 3) readFeed(again + 1);
            });
    }

    const visible = () => shown && !disposed && (typeof document === "undefined" || document.visibilityState !== "hidden");
    // Every 30 s while shown: the record since the newest line, and the lines' times moved on.
    const timer = setInterval(() => {
        if (!visible()) return;
        if (options.eventsUrl) readFeed();
        else renderFeed();
    }, ARK_LITE_FEED_POLL_MS);
    const onVisible = () => {
        if (visible()) readFeed();
    };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisible);

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
        // "Estimated time left" (decision 389) for an animal that could be at risk: drawn by a lazily loaded module, nothing otherwise.
        const full = snapshot?.animals.find((candidate) => candidate.id === animal.id);
        if (full && (full.condition === "old" || full.condition === "hungry" || snapshot?.hunt_grace)) {
            const slot = el("div", "arkl-tlslot");
            main.appendChild(slot);
            void import("@/lib/ark-time-left-dom").then(({fillArkTimeLeft}) => fillArkTimeLeft(slot, full, snapshot, words, locale, () => slot.isConnected && !disposed));
        }
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

    function byline(animal: {name: string; origin: "arrived" | "born"; handle: string | null}): HTMLElement | null {
        const extras = arkSelectionExtras({
            animal: {name: animal.name, model_slug: "", placeholder: true, origin: animal.origin},
            founder: animal.handle ? {handle: animal.handle} : null,
            words: {broughtBy: str(sub(sub(words, "founders"), "card").broughtBy, ""), bornAboard: str(sub(words, "life").bornAboard, "")},
            locale: options.linkLocale ?? null
        });
        const by = extras.byline;
        if (!by) return null;
        const span = el("span", "by");
        if (by.kind === "text") {
            span.textContent = by.text;
            return span;
        }
        const [before, after = ""] = by.template.split("{name}");
        span.appendChild(document.createTextNode(before));
        const link = el("a", undefined, `@${by.handle}`);
        link.href = by.href;
        link.addEventListener("click", (event) => {
            if (options.onProfile?.(by.handle)) event.preventDefault();
        });
        span.appendChild(link);
        if (after) span.appendChild(document.createTextNode(after));
        return span;
    }

    function whoList(region: string, kind: ArkLiteKind): HTMLElement {
        const list = el("ul", "arkl-who");
        const {animals, more} = arkLiteKindAnimals(snapshot, founders, region, kind.key);
        const now = new Date();
        for (const animal of animals) {
            const row = el("li");
            const who = el("span", "w");
            who.appendChild(el("b", undefined, animal.name));
            const by = byline(animal);
            if (by) {
                who.appendChild(document.createTextNode(" · "));
                who.appendChild(by);
            }
            if (animal.mine) who.appendChild(el("span", "you", lite.you));
            row.appendChild(who);
            row.appendChild(el("span", "ago", arkAgoText(animal.arrivedAt, now, locale)));
            list.appendChild(row);
        }
        if (more > 0) list.appendChild(el("li", "arkl-more", fillArkWords(lite.animalsMore, {count: number(more)})));
        return list;
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
        const showAll = allKinds.has(region.region);
        let open: ArkLiteKind | null = null;
        for (const kind of showAll ? [...region.kinds, ...region.rest] : region.kinds) {
            const id = `${region.region}|${kind.key}`;
            if (openKind === id) open = kind;
            const chip = el("button", `arkl-kind${kind.mine > 0 ? " mine" : ""}${openKind === id ? " open" : ""}`);
            chip.type = "button";
            chip.setAttribute("aria-expanded", openKind === id ? "true" : "false");
            chip.appendChild(icon("i", kind.slug || null, options.iconUrl));
            chip.appendChild(el("span", "t", kind.name));
            chip.appendChild(el("span", "c", number(kind.count)));
            chip.addEventListener("click", () => {
                openKind = openKind === id ? null : id;
                render();
            });
            kinds.appendChild(chip);
        }
        if (region.rest.length) {
            const more = el("button", "arkl-more", showAll ? lite.showLess : fillArkWords(lite.kindsMore, {count: number(region.rest.length)}));
            more.type = "button";
            more.addEventListener("click", () => {
                if (showAll) allKinds.delete(region.region);
                else allKinds.add(region.region);
                render();
            });
            kinds.appendChild(more);
        }
        card.appendChild(kinds);
        if (open) card.appendChild(whoList(region.region, open));
        return card;
    }

    function render() {
        const model = arkLiteModel(snapshot, hearts);
        const top = scroll.scrollTop;
        col.replaceChildren();
        col.appendChild(header(model));
        col.appendChild(feedBox);
        if (model.mine.length) {
            col.appendChild(el("h2", "arkl-h", str(words?.myAnimals, "My animals")));
            const list = el("ul", "arkl-list");
            for (const animal of model.mine) list.appendChild(mineCard(animal));
            col.appendChild(list);
        }
        if (model.regions.length) {
            col.appendChild(el("h2", "arkl-h", lite.where));
            col.appendChild(el("p", "arkl-hint", lite.tapKind));
            const list = el("ul", "arkl-list");
            for (const region of model.regions) list.appendChild(regionCard(region));
            col.appendChild(list);
        }
        scroll.scrollTop = top;
    }

    render();
    readFeed();
    return {
        root,
        update: (next) => {
            snapshot = next;
            // Its newest arrivals and births at once (the record's own reading of them replaces these as it comes).
            feed = arkLiteFeedMerge(feed, arkLiteFeedSeed(next));
            renderFeed();
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
            renderFeed();
            render();
        },
        set3dReady: (next) => {
            if (ready === next) return;
            ready = next;
            render();
        },
        setFounders: (next) => {
            founders = next;
            if (openKind) render();
        },
        setShown: (next) => {
            const was = shown;
            shown = next;
            root.hidden = !next;
            if (next && !was) readFeed();
        },
        dispose: () => {
            disposed = true;
            clearInterval(timer);
            if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisible);
            root.remove();
        }
    };
}
