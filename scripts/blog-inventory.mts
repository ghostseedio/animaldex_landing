// Inventory every blog post (code + Content Studio): words, images, sections, FAQ, sources, links.
// Run: NODE_OPTIONS=--conditions=react-server npx tsx scripts/blog-inventory.mts  (writes tmp/blog-inventory.json)
import {writeFileSync, readFileSync} from "node:fs";
import {blogPosts} from "../src/data/blog.ts";

function env(name: string) {
    for (const f of [".env.local", ".env"]) {
        try {
            const m = readFileSync(f, "utf8").match(new RegExp(`^${name}=(.*)$`, "m"));
            if (m?.[1]) return m[1].trim();
        } catch {}
    }
    return "";
}

const strip = (html: string) => html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ");
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

function measure(post: any, source: string) {
    let text = `${post.title ?? ""} ${post.description ?? ""}`;
    let images = post.featuredImage?.src ? 1 : 0;
    let placeholder = post.featuredImage?.src?.includes("/images/placeholders/") ? 1 : 0;
    let htmlSections = 0;
    let tables = 0, cards = 0, links = 0;
    const countMedia = (media: any) => {
        if (!media) return;
        if (media.type === "image") images += 1;
        if (media.type === "gallery") images += media.images?.length ?? 0;
        const srcs = media.type === "image" ? [media.image?.src] : media.type === "gallery" ? (media.images ?? []).map((i: any) => i.src) : [];
        placeholder += srcs.filter((s: string) => s?.includes("/images/placeholders/")).length;
    };
    for (const s of post.sections ?? []) {
        text += ` ${s.title ?? ""} ${(s.paragraphs ?? []).join(" ")} ${s.pullQuote ?? ""}`;
        if (s.html) {
            htmlSections += 1;
            text += ` ${strip(s.html)}`;
            images += (s.html.match(/<img\b/gi) ?? []).length;
            links += (s.html.match(/<a\b/gi) ?? []).length;
        }
        for (const c of s.cards ?? []) { cards += 1; text += ` ${c.label ?? ""} ${c.body ?? ""}`; if (c.image?.src) images += 1; links += c.links?.length ?? 0; }
        if (s.table) { tables += 1; text += ` ${s.table.rows.map((r: any) => r.cells.join(" ")).join(" ")}`; }
        links += s.inlineLinks?.length ?? 0;
        countMedia(s.media);
        for (const sub of s.subsections ?? []) { text += ` ${sub.title ?? ""} ${(sub.paragraphs ?? []).join(" ")}`; countMedia(sub.media); }
    }
    if (post.headerHtml) { text += ` ${strip(post.headerHtml)}`; images += (post.headerHtml.match(/<img\b/gi) ?? []).length; }
    for (const f of post.faq ?? []) text += ` ${f.question} ${f.answer}`;
    return {
        slug: post.slug, source, title: post.title,
        words: words(text), images, placeholder, sections: (post.sections ?? []).length, htmlSections,
        faq: (post.faq ?? []).length, sources: (post.sources ?? []).length, tables, cards, links,
        related: (post.relatedSlugs ?? []).length, species: (post.speciesSlugs ?? []).length,
        publishedAt: post.publishedAt, descLen: (post.description ?? "").length, titleLen: (post.title ?? "").length
    };
}

const rows = new Map<string, any>();
for (const p of blogPosts) rows.set(p.slug, measure(p, "code"));

const SB = env("SUPABASE_URL"), KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const res = await fetch(`${SB}/rest/v1/admin_content_entries?content_type=eq.blog&select=slug,payload,is_published`, {headers: {apikey: KEY, Authorization: `Bearer ${KEY}`}});
const entries: any[] = await res.json();
let overrides = 0, drafts = 0;
for (const e of entries) {
    if (!e.is_published) { drafts += 1; continue; }
    const had = rows.has(e.slug);
    rows.set(e.slug, {...measure(e.payload, had ? "db-override" : "db"), shadowsCode: had});
    if (had) overrides += 1;
}
const list = [...rows.values()].sort((a, b) => a.words - b.words);
writeFileSync("tmp/blog-inventory.json", JSON.stringify(list, null, 1));
console.log(`posts=${list.length} code=${blogPosts.length} db-published=${entries.length - drafts} (overriding code: ${overrides}) db-drafts=${drafts}`);
console.log("words  img ph sec html faq src tbl lnk  source       slug");
for (const r of list) console.log(`${String(r.words).padStart(5)} ${String(r.images).padStart(4)} ${String(r.placeholder).padStart(2)} ${String(r.sections).padStart(3)} ${String(r.htmlSections).padStart(4)} ${String(r.faq).padStart(3)} ${String(r.sources).padStart(3)} ${String(r.tables).padStart(3)} ${String(r.links).padStart(3)}  ${r.source.padEnd(11)}  ${r.slug}`);
