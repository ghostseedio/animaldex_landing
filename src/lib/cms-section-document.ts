import type {BlogPost, BlogSection} from "@/data/blog/types";

function escapeHtml(value: string) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function ensureEditableStyleBlock(html: string) {
    if (/<style\b[^>]*data-section-styles/i.test(html)) return html;
    return `<style data-section-styles>
/* Section-specific CSS overrides.
   The existing design also uses AnimalDex utility classes directly in the HTML. */
</style>
${html}`;
}

function hasRenderableDocumentContent(html: string | undefined) {
    if (!html?.trim()) return false;
    return html
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<!--[\s\S]*?-->/g, "")
        .trim().length > 0;
}

function imageHtml(image: {src: string; alt: string; caption?: string}, className = "h-auto w-full object-cover") {
    return `<figure class="overflow-hidden rounded-2xl border border-line-300 bg-surface-900"><img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" class="${className}">${image.caption ? `<figcaption class="border-t border-line-300 px-4 py-3 text-sm text-ink-400">${escapeHtml(image.caption)}</figcaption>` : ""}</figure>`;
}

function mediaHtml(media: BlogSection["media"]) {
    if (!media) return "";
    if (media.type === "image") return imageHtml(media.image);
    if (media.type === "gallery") return `<div class="grid gap-4 sm:grid-cols-2">${media.images.map((image) => imageHtml(image, "h-full w-full object-cover")).join("")}</div>`;
    return `<figure class="overflow-hidden rounded-2xl border border-line-300 bg-surface-900"><div class="aspect-video"><iframe src="${escapeHtml(media.embedUrl)}" title="${escapeHtml(media.title || "Video")}" class="h-full w-full" allowfullscreen></iframe></div>${media.caption ? `<figcaption class="border-t border-line-300 px-4 py-3 text-sm text-ink-400">${escapeHtml(media.caption)}</figcaption>` : ""}</figure>`;
}

function tableHtml(table: NonNullable<BlogSection["table"]>) {
    return `<div class="overflow-hidden rounded-2xl border border-line-300/80 bg-surface-800/60"><div class="overflow-x-auto"><table class="w-full min-w-[560px] border-collapse text-left"><thead><tr class="border-b border-line-300/80 bg-surface-700/70">${table.columns.map((column) => `<th scope="col" class="px-5 py-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary-200">${escapeHtml(column)}</th>`).join("")}</tr></thead><tbody>${table.rows.map((row) => `<tr class="border-b border-line-300/60 last:border-b-0">${row.cells.map((cell, index) => index === 0 ? `<th scope="row" class="px-5 py-4 align-top text-base font-semibold text-white">${escapeHtml(cell)}</th>` : `<td class="px-5 py-4 align-top text-base leading-7 text-ink-200">${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`;
}

function cardsHtml(cards: NonNullable<BlogSection["cards"]>) {
    return `<ul class="grid grid-cols-1 gap-4 md:grid-cols-2">${cards.map((card) => `<li class="list-none overflow-hidden rounded-2xl border border-line-300/80 bg-surface-800/60">${card.image ? `<div class="border-b border-line-300/80 bg-surface-700/60"><img src="${escapeHtml(card.image.src)}" alt="${escapeHtml(card.image.alt)}" class="h-auto w-full object-cover"></div>` : ""}<div class="flex flex-col gap-3 p-5"><p class="text-xs font-semibold uppercase tracking-[0.22em] text-primary-200">${escapeHtml(card.label)}</p><p class="text-base leading-7 text-ink-200 md:text-lg">${escapeHtml(card.body)}</p></div></li>`).join("")}</ul>`;
}

function codeBlocksHtml(blocks: BlogSection["codeBlocks"]) {
    if (!blocks?.length) return "";
    return `<div class="space-y-4">${blocks.map((block) => `<figure class="overflow-hidden rounded-2xl border border-line-300 bg-[#080d0a]"><div class="flex items-center justify-between border-b border-line-300 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400"><span>${escapeHtml(block.language || "Text")}</span><span>Code</span></div><pre class="max-w-full overflow-x-auto p-4 text-sm leading-6 text-primary-100"><code>${escapeHtml(block.code)}</code></pre>${block.caption ? `<figcaption class="border-t border-line-300 px-4 py-3 text-xs text-ink-400">${escapeHtml(block.caption)}</figcaption>` : ""}</figure>`).join("")}</div>`;
}

export function sectionToDocument(section: BlogSection) {
    if (hasRenderableDocumentContent(section.html)) return {...section, html: ensureEditableStyleBlock(section.html!)};
    const Heading = (section.headingLevel ?? 2) === 3 ? "h3" : "h2";
    const headingClass = Heading === "h3" ? "font-display text-2xl font-bold text-white md:text-3xl" : "font-display text-3xl font-bold text-white md:text-4xl";
    const body = section.table
        ? tableHtml(section.table)
        : section.cards
            ? cardsHtml(section.cards)
            : section.paragraphs.map((paragraph) => `<p class="text-lg leading-8 text-ink-200 md:text-xl">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`).join("");
    const subsections = section.subsections?.map((subsection) => `<section class="flex flex-col gap-4 rounded-3xl border border-line-300/80 bg-surface-800/50 p-5 md:p-6"><h3 class="font-display text-2xl font-bold text-white md:text-3xl">${escapeHtml(subsection.title)}</h3>${mediaHtml(subsection.media)}${subsection.paragraphs.map((paragraph) => `<p class="text-lg leading-8 text-ink-200">${escapeHtml(paragraph)}</p>`).join("")}${subsection.pullQuote ? `<blockquote class="border-l-2 border-primary-400 pl-5 text-xl italic text-ink-100">${escapeHtml(subsection.pullQuote)}</blockquote>` : ""}</section>`).join("") ?? "";
    return {
        title: section.title,
        paragraphs: [],
        html: ensureEditableStyleBlock(`<section class="flex flex-col gap-4">${section.kicker ? `<p class="text-sm font-semibold uppercase tracking-[0.22em] text-primary-200">${escapeHtml(section.kicker)}</p>` : ""}<${Heading} class="${headingClass}">${escapeHtml(section.title)}</${Heading}>${body}${section.pullQuote ? `<blockquote class="border-l-2 border-primary-400 pl-5 text-xl italic text-ink-100">${escapeHtml(section.pullQuote)}</blockquote>` : ""}${codeBlocksHtml(section.codeBlocks)}${mediaHtml(section.media)}${subsections}</section>`)
    } satisfies BlogSection;
}

export function normalizePostToDocumentSections(post: BlogPost): BlogPost {
    const sourceMigrated = typeof (post as BlogPost & {cmsSourceMigrated?: unknown}).cmsSourceMigrated === "string";
    const fallbackHeaderHtml = sourceMigrated ? undefined : `<header class="py-10 text-center sm:py-14">
  <div class="flex flex-wrap justify-center gap-2">${post.tags.map((tag) => `<span class="rounded-full border border-primary-400/30 bg-primary-500/10 px-3 py-1 text-xs font-bold text-primary-100">${escapeHtml(tag)}</span>`).join("")}</div>
  <h1 class="mx-auto mt-5 max-w-4xl font-display text-4xl leading-[1.05] text-white sm:text-5xl">${escapeHtml(post.title)}</h1>
  <p class="mx-auto mt-5 max-w-3xl text-base leading-7 text-ink-300 sm:text-lg">${escapeHtml(post.description)}</p>
  ${post.author ? `<p class="mt-4 text-xs text-ink-500">${escapeHtml(post.author)} · ${post.readingMinutes} min read</p>` : ""}
</header>`;
    const headerHtml = post.headerHtml || fallbackHeaderHtml ? ensureEditableStyleBlock(post.headerHtml || fallbackHeaderHtml || "") : undefined;
    return {...post, headerHtml, sections: post.sections.map(sectionToDocument)};
}
