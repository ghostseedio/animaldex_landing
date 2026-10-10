// Charts and interactive widgets for generated articles. The writer supplies
// DATA only; the markup and script come from these templates, so every embed
// looks the same, works in both themes and carries no model-written code.
// They render inside the sandboxed RenderedCodeFrame (allow-scripts only).

export type BarChartSpec = {
    kind: "bar";
    title: string;
    unit: string;
    bars: Array<{label: string; value: number; highlight?: boolean; note?: string}>;
    caption: string;
};

export type DuelChartSpec = {
    kind: "duel";
    title: string;
    left: string;
    right: string;
    /** Each metric is scored 0–10 for both sides, with the real figures in the labels. */
    metrics: Array<{label: string; left: number; right: number; leftLabel?: string; rightLabel?: string}>;
    caption: string;
};

export type TimelineSpec = {
    kind: "timeline";
    title: string;
    events: Array<{when: string; title: string; body: string}>;
    caption: string;
};

export type QuizSpec = {
    kind: "quiz";
    title: string;
    questions: Array<{question: string; options: string[]; answer: number; explanation: string}>;
};

export type FlipCardsSpec = {
    kind: "flipcards";
    title: string;
    cards: Array<{front: string; back: string}>;
};

export type EmbedSpec = BarChartSpec | DuelChartSpec | TimelineSpec | QuizSpec | FlipCardsSpec;

export const EMBED_KINDS = ["bar", "duel", "timeline", "quiz", "flipcards"] as const;

function esc(value: unknown) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatNumber(value: number) {
    if (!Number.isFinite(value)) return "0";
    const abs = Math.abs(value);
    if (abs >= 100) return Math.round(value).toLocaleString("en-US");
    if (abs >= 10) return (Math.round(value * 10) / 10).toLocaleString("en-US");
    return (Math.round(value * 100) / 100).toLocaleString("en-US");
}

const BASE_CSS = `
.adx{--ad-accent:#7fd41f;--ad-accent-2:#36b37e;--ad-soft:color-mix(in srgb,currentColor 7%,transparent);--ad-line:color-mix(in srgb,currentColor 16%,transparent);--ad-muted:color-mix(in srgb,currentColor 62%,transparent);font:15px/1.55 var(--font-sans),system-ui,sans-serif;border:1px solid var(--ad-line);border-radius:6px;padding:22px 20px 18px;background:var(--ad-soft)}
.adx *{box-sizing:border-box}
.adx-k{font:700 11px/1 var(--font-sans),system-ui;letter-spacing:.16em;text-transform:uppercase;color:var(--ad-accent);margin:0 0 8px}
.adx-t{font:700 20px/1.25 var(--font-display),var(--font-sans),system-ui;margin:0 0 16px}
.adx-c{margin:16px 0 0;font-size:13px;color:var(--ad-muted)}
.adx button{font:inherit;color:inherit;cursor:pointer}
@media (prefers-reduced-motion:reduce){.adx *{transition:none!important;animation:none!important}}
`;

function frame(kicker: string, title: string, body: string, css: string, script = "", caption = "") {
    return `<style>${BASE_CSS}${css}</style><div class="adx" role="figure" aria-label="${esc(title)}"><p class="adx-k">${esc(kicker)}</p><h3 class="adx-t">${esc(title)}</h3>${body}${caption ? `<p class="adx-c">${esc(caption)}</p>` : ""}</div>${script ? `<script>${script}</script>` : ""}`;
}

function renderBar(spec: BarChartSpec) {
    const bars = spec.bars.filter((bar) => Number.isFinite(bar.value)).slice(0, 14);
    const max = Math.max(...bars.map((bar) => Math.abs(bar.value)), 1);
    const rows = bars.map((bar, index) => {
        const pct = Math.max(2, (Math.abs(bar.value) / max) * 100);
        return `<li class="adx-row${bar.highlight ? " is-hi" : ""}" style="--d:${index * 60}ms"><span class="adx-l">${esc(bar.label)}${bar.note ? `<small>${esc(bar.note)}</small>` : ""}</span><span class="adx-track"><span class="adx-fill" data-w="${pct.toFixed(1)}"></span></span><span class="adx-v">${esc(formatNumber(bar.value))}<em>${esc(spec.unit)}</em></span></li>`;
    }).join("");
    const css = `.adx-bars{list-style:none;margin:0;padding:0;display:grid;gap:10px}.adx-row{display:grid;grid-template-columns:minmax(90px,34%) 1fr auto;align-items:center;gap:12px}.adx-l{font-weight:600;font-size:14px;line-height:1.25}.adx-l small{display:block;font-weight:400;font-size:12px;color:var(--ad-muted)}.adx-track{height:14px;border-radius:3px;background:var(--ad-line);overflow:hidden}.adx-fill{display:block;height:100%;width:0;border-radius:3px;background:var(--ad-accent-2);transition:width .9s cubic-bezier(.2,.8,.2,1) var(--d)}.is-hi .adx-fill{background:var(--ad-accent)}.adx-v{font-variant-numeric:tabular-nums;font-weight:700;font-size:14px;white-space:nowrap}.adx-v em{font-style:normal;font-weight:400;color:var(--ad-muted);margin-left:3px;font-size:12px}.adx-sort{margin:0 0 14px;border:1px solid var(--ad-line);background:transparent;border-radius:999px;padding:5px 12px;font-size:12px}@media (max-width:480px){.adx-row{grid-template-columns:1fr auto}.adx-track{grid-column:1/-1;grid-row:2}}`;
    const script = `(()=>{const list=document.querySelector(".adx-bars");const grow=()=>list.querySelectorAll(".adx-fill").forEach(el=>el.style.width=el.dataset.w+"%");const io=new IntersectionObserver(e=>{if(e.some(x=>x.isIntersecting)){grow();io.disconnect()}});io.observe(list);setTimeout(grow,1200);let asc=false;document.querySelector(".adx-sort").addEventListener("click",ev=>{asc=!asc;const rows=[...list.children].sort((a,b)=>{const va=parseFloat(a.querySelector(".adx-fill").dataset.w),vb=parseFloat(b.querySelector(".adx-fill").dataset.w);return asc?va-vb:vb-va});rows.forEach(r=>list.appendChild(r));ev.currentTarget.textContent=asc?"Sort: highest first":"Sort: lowest first"})})()`;
    return frame("Chart", spec.title, `<button type="button" class="adx-sort">Sort: lowest first</button><ul class="adx-bars">${rows}</ul>`, css, script, spec.caption);
}

function clampScore(value: number) {
    return Math.max(0, Math.min(10, Number.isFinite(value) ? value : 0));
}

function renderDuel(spec: DuelChartSpec) {
    const metrics = spec.metrics.slice(0, 10);
    const leftTotal = metrics.reduce((sum, metric) => sum + clampScore(metric.left), 0);
    const rightTotal = metrics.reduce((sum, metric) => sum + clampScore(metric.right), 0);
    const rows = metrics.map((metric) => {
        const left = clampScore(metric.left);
        const right = clampScore(metric.right);
        return `<li><span class="adx-dv adx-dl">${esc(metric.leftLabel || formatNumber(left))}</span><span class="adx-dbar adx-dbl"><i style="width:${left * 10}%"${left >= right ? ' class="win"' : ""}></i></span><span class="adx-dm">${esc(metric.label)}</span><span class="adx-dbar"><i style="width:${right * 10}%"${right >= left ? ' class="win"' : ""}></i></span><span class="adx-dv">${esc(metric.rightLabel || formatNumber(right))}</span></li>`;
    }).join("");
    const css = `.adx-dh{display:grid;grid-template-columns:1fr auto 1fr;align-items:end;gap:10px;margin-bottom:14px}.adx-dh b{font:700 17px/1.2 var(--font-display),var(--font-sans),system-ui}.adx-dh b:last-child{text-align:right}.adx-dh span{font-size:12px;color:var(--ad-muted)}.adx-duel{list-style:none;margin:0;padding:0;display:grid;gap:10px}.adx-duel li{display:grid;grid-template-columns:minmax(52px,auto) 1fr minmax(84px,auto) 1fr minmax(52px,auto);align-items:center;gap:8px;font-size:13px}.adx-dm{text-align:center;font-weight:600}.adx-dv{font-variant-numeric:tabular-nums;color:var(--ad-muted);font-size:12px}.adx-dl{text-align:right}.adx-dbar{height:10px;background:var(--ad-line);border-radius:3px;overflow:hidden;display:flex}.adx-dbl{justify-content:flex-end}.adx-dbar i{display:block;height:100%;background:color-mix(in srgb,currentColor 38%,transparent)}.adx-dbar i.win{background:var(--ad-accent)}.adx-score{margin-top:16px;display:flex;justify-content:space-between;font-weight:700;border-top:1px solid var(--ad-line);padding-top:12px}@media (max-width:480px){.adx-duel li{grid-template-columns:1fr 1fr;row-gap:4px}.adx-dm{grid-column:1/-1;grid-row:1}.adx-dv{display:none}}`;
    const body = `<div class="adx-dh"><b>${esc(spec.left)}</b><span>vs</span><b>${esc(spec.right)}</b></div><ul class="adx-duel">${rows}</ul><div class="adx-score"><span>${esc(spec.left)}: ${esc(formatNumber(leftTotal))}</span><span>${esc(spec.right)}: ${esc(formatNumber(rightTotal))}</span></div>`;
    return frame("Head to head", spec.title, body, css, "", spec.caption);
}

function renderTimeline(spec: TimelineSpec) {
    const events = spec.events.slice(0, 12);
    const items = events.map((event, index) => `<li${index === 0 ? ' class="on"' : ""}><button type="button" aria-expanded="${index === 0}"><span class="adx-when">${esc(event.when)}</span><span class="adx-et">${esc(event.title)}</span></button><p>${esc(event.body)}</p></li>`).join("");
    const css = `.adx-tl{list-style:none;margin:0;padding:0 0 0 18px;border-left:2px solid var(--ad-line);display:grid;gap:4px}.adx-tl li{position:relative}.adx-tl li:before{content:"";position:absolute;left:-25px;top:13px;width:12px;height:12px;border-radius:50%;background:var(--ad-line);transition:background .2s}.adx-tl li.on:before{background:var(--ad-accent)}.adx-tl button{all:unset;cursor:pointer;display:block;padding:8px 0;width:100%}.adx-tl button:focus-visible{outline:2px solid var(--ad-accent);outline-offset:2px}.adx-when{display:block;font-size:12px;font-weight:700;letter-spacing:.06em;color:var(--ad-accent)}.adx-et{font-weight:700}.adx-tl p{margin:0;max-height:0;overflow:hidden;opacity:0;transition:max-height .35s,opacity .25s,margin .25s;color:var(--ad-muted)}.adx-tl li.on p{max-height:260px;opacity:1;margin:0 0 10px}`;
    const script = `document.querySelectorAll(".adx-tl button").forEach(b=>b.addEventListener("click",()=>{const li=b.parentElement;const open=!li.classList.contains("on");li.classList.toggle("on",open);b.setAttribute("aria-expanded",String(open))}))`;
    return frame("Timeline · tap to expand", spec.title, `<ol class="adx-tl">${items}</ol>`, css, script, spec.caption);
}

function renderQuiz(spec: QuizSpec) {
    const questions = spec.questions
        .filter((question) => question.options.length >= 2 && question.answer >= 0 && question.answer < question.options.length)
        .slice(0, 8);
    const blocks = questions.map((question, qIndex) => `<fieldset class="adx-q" data-answer="${question.answer}"><legend><span>${qIndex + 1}/${questions.length}</span>${esc(question.question)}</legend><div class="adx-opts">${question.options.slice(0, 5).map((option, oIndex) => `<button type="button" data-i="${oIndex}">${esc(option)}</button>`).join("")}</div><p class="adx-ex" hidden>${esc(question.explanation)}</p></fieldset>`).join("");
    const css = `.adx-q{border:0;margin:0 0 18px;padding:0}.adx-q legend{font-weight:700;margin-bottom:10px;padding:0}.adx-q legend span{display:inline-block;margin-right:8px;font-size:12px;color:var(--ad-accent)}.adx-opts{display:grid;gap:8px}.adx-opts button{text-align:left;border:1px solid var(--ad-line);background:transparent;border-radius:6px;padding:10px 12px;transition:border-color .2s,background .2s}.adx-opts button:hover:not(:disabled){border-color:var(--ad-accent)}.adx-opts button:disabled{cursor:default}.adx-opts .ok{border-color:var(--ad-accent);background:color-mix(in srgb,var(--ad-accent) 18%,transparent)}.adx-opts .no{border-color:#e5484d;background:color-mix(in srgb,#e5484d 14%,transparent)}.adx-ex{margin:8px 0 0;font-size:14px;color:var(--ad-muted)}.adx-res{font-weight:700;border-top:1px solid var(--ad-line);padding-top:12px;margin:0}.adx-res button{margin-left:10px;border:1px solid var(--ad-line);background:transparent;border-radius:999px;padding:4px 12px;font-size:12px}`;
    const script = `(()=>{const qs=[...document.querySelectorAll(".adx-q")];const res=document.querySelector(".adx-res");let done=0,score=0;const msg=()=>{const pct=score/qs.length;const verdict=pct===1?"Perfect score. Field-guide level.":pct>=.6?"Sharp eyes. Most people miss a few.":"Nature is full of surprises.";res.innerHTML="You scored "+score+"/"+qs.length+". "+verdict+' <button type="button">Try again</button>';res.querySelector("button").onclick=reset};const reset=()=>{done=0;score=0;res.textContent="Answer every question to see your score.";qs.forEach(q=>{q.querySelectorAll("button").forEach(b=>{b.disabled=false;b.className=""});q.querySelector(".adx-ex").hidden=true})};qs.forEach(q=>q.querySelectorAll(".adx-opts button").forEach(b=>b.addEventListener("click",()=>{const right=Number(q.dataset.answer);const pick=Number(b.dataset.i);q.querySelectorAll(".adx-opts button").forEach((x,i)=>{x.disabled=true;if(i===right)x.className="ok"});if(pick!==right)b.className="no";else score++;q.querySelector(".adx-ex").hidden=false;done++;if(done===qs.length)msg()})));reset()})()`;
    return frame("Quiz · test yourself", spec.title, `${blocks}<p class="adx-res" aria-live="polite"></p>`, css, script);
}

function renderFlipCards(spec: FlipCardsSpec) {
    const cards = spec.cards.slice(0, 8).map((card) => `<button type="button" class="adx-card" aria-pressed="false"><span class="adx-f">${esc(card.front)}<small>Tap to reveal</small></span><span class="adx-b">${esc(card.back)}</span></button>`).join("");
    const css = `.adx-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}.adx-card{position:relative;min-height:150px;border:1px solid var(--ad-line);border-radius:6px;background:transparent;padding:0;perspective:900px;text-align:left}.adx-card span{position:absolute;inset:0;padding:16px;display:flex;flex-direction:column;justify-content:center;border-radius:6px;backface-visibility:hidden;transition:transform .5s cubic-bezier(.2,.8,.2,1)}.adx-f{font-weight:700;font-size:16px;line-height:1.3}.adx-f small{margin-top:10px;font-weight:400;font-size:12px;color:var(--ad-accent)}.adx-b{transform:rotateY(180deg);font-size:14px;background:color-mix(in srgb,var(--ad-accent) 14%,transparent)}.adx-card.on .adx-f{transform:rotateY(-180deg)}.adx-card.on .adx-b{transform:rotateY(0)}.adx-card:focus-visible{outline:2px solid var(--ad-accent);outline-offset:2px}`;
    const script = `document.querySelectorAll(".adx-card").forEach(c=>c.addEventListener("click",()=>{const on=!c.classList.contains("on");c.classList.toggle("on",on);c.setAttribute("aria-pressed",String(on))}))`;
    return frame("Flip the cards", spec.title, `<div class="adx-cards">${cards}</div>`, css, script);
}

function renderMarkup(spec: EmbedSpec): string {
    switch (spec.kind) {
        case "bar": return renderBar(spec);
        case "duel": return renderDuel(spec);
        case "timeline": return renderTimeline(spec);
        case "quiz": return renderQuiz(spec);
        case "flipcards": return renderFlipCards(spec);
    }
}

// The spec rides along in the markup (base64 in a comment, so no "--" or
// script text can break out), letting an edit read the embed back as data.
const SPEC_MARKER = /<!--adx-spec:([A-Za-z0-9+/=]+)-->/;

export function renderEmbed(spec: EmbedSpec): string {
    return `<!--adx-spec:${Buffer.from(JSON.stringify(spec), "utf8").toString("base64")}-->${renderMarkup(spec)}`;
}

/** The spec of an embed this module rendered, or null for any other HTML. */
export function readEmbedSpec(html: string | undefined): EmbedSpec | null {
    const encoded = html?.match(SPEC_MARKER)?.[1];
    if (!encoded) return null;
    try {
        const spec = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as EmbedSpec;
        return (EMBED_KINDS as readonly string[]).includes(spec.kind) ? spec : null;
    } catch {
        return null;
    }
}

/** Why an embed can't be rendered, or null when it is usable. */
export function embedProblem(spec: EmbedSpec): string | null {
    switch (spec.kind) {
        case "bar":
            return spec.bars.filter((bar) => Number.isFinite(bar.value)).length >= 3 ? null : "bar chart needs at least 3 numeric bars";
        case "duel":
            return spec.metrics.length >= 3 && spec.left && spec.right ? null : "duel needs two sides and at least 3 metrics";
        case "timeline":
            return spec.events.length >= 3 ? null : "timeline needs at least 3 events";
        case "quiz":
            return spec.questions.filter((question) => question.options.length >= 2 && question.answer >= 0 && question.answer < question.options.length).length >= 3
                ? null
                : "quiz needs at least 3 valid questions";
        case "flipcards":
            return spec.cards.length >= 3 ? null : "flip cards need at least 3 cards";
    }
}
