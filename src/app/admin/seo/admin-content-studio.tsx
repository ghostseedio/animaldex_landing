"use client";

import Link from "next/link";
import NextImage from "next/image";
import {useSearchParams} from "next/navigation";
import {FormEvent, PointerEvent, useCallback, useEffect, useRef, useState} from "react";
import {
    AddCircle,
    CheckCircle,
    Code,
    Copy,
    DangerCircle,
    Diskette,
    Eye,
    Gallery,
    Monitor,
    Magnifer,
    Smartphone,
    Tablet,
    TrashBinMinimalistic,
    Upload
} from "solar-icon-set";
import {canRenderCodeBlock, getRenderedCodeDocument} from "@/lib/rendered-code-block";
import RenderedCodeFrame from "@/app/_components/rendered-code-frame";
import {AdminPage, Alert, Badge, Button, buttonVariants, cn, EmptyState, Field, fieldClass, PageHeader, Segmented, Skeleton, Spinner} from "@/components/admin/ui";

type ImageValue = {src: string; alt: string; width: number; height: number; caption?: string; displayHeight?: number};
type CodeBlock = {language?: string; code: string; caption?: string; render?: boolean};
type BlogSection = {kicker?: string; headingLevel?: 2 | 3; html?: string; title: string; paragraphs: string[]; codeBlocks?: CodeBlock[]; media?: {type: string; image?: ImageValue; images?: ImageValue[]}};
type BlogPost = {
    slug: string;
    headerHtml?: string;
    title: string;
    description: string;
    publishedAt: string;
    updatedAt?: string;
    featuredImage: ImageValue;
    readingMinutes: number;
    author?: string;
    tags: string[];
    searchIntents: string[];
    speciesSlugs: string[];
    sections: BlogSection[];
    [key: string]: unknown;
};
type Summary = {slug: string; title: string; description: string; featuredImage: ImageValue; updatedAt: string; views?: number};
type ImageSlot = {label: string; path: Array<string | number>; image: ImageValue};
type Asset = {path: string; url: string; filename: string; createdAt?: string};
type ContentType = "blog" | "page";
type PreviewWidth = "mobile" | "tablet" | "desktop";

/** Compact totals so a five-figure count cannot push the slug out of the row. */
function formatViews(views: number) {
    if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(views >= 10_000_000 ? 0 : 1)}M`;
    if (views >= 1_000) return `${(views / 1_000).toFixed(views >= 10_000 ? 0 : 1)}k`;
    return String(views);
}

/**
 * Parses an admin API response, or explains why it could not be parsed.
 *
 * These endpoints answer JSON on every path they control, including errors —
 * but a response can still arrive as HTML when it never reached the handler: a
 * dev-server error page mid-recompile, a proxy timeout, a platform body-size
 * refusal. Calling `.json()` on that throws `Unexpected token '<'`, which tells
 * the person nothing. Read the content type first and report the status.
 */
async function readJson(response: Response, action: string) {
    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
        throw new Error(
            response.status >= 500
                ? `${action} failed: the server returned an error page (${response.status}). Try again in a moment.`
                : `${action} failed (${response.status}).`
        );
    }

    return await response.json();
}

const emptyPost = (): BlogPost => ({
    slug: "",
    title: "Untitled article",
    description: "",
    headerHtml: `<style data-section-styles>
/* Add header-specific CSS overrides here. */
</style>
<header class="py-10 text-center sm:py-14">
  <h1 class="mx-auto max-w-4xl font-display text-4xl leading-[1.05] text-white sm:text-5xl">Untitled article</h1>
  <p class="mx-auto mt-5 max-w-3xl text-base leading-7 text-ink-300 sm:text-lg">Add the page introduction here.</p>
</header>`,
    publishedAt: new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString().slice(0, 10),
    featuredImage: {src: "/images/placeholders/blog-image-slot.svg", alt: "Article image", width: 1600, height: 900},
    readingMinutes: 5,
    author: "AnimalDex Editorial Team",
    tags: [],
    searchIntents: [],
    speciesSlugs: [],
    sections: [{
        title: "Introduction",
        paragraphs: [],
        html: `<style data-section-styles>
/* Add section-specific CSS overrides here. */
</style>
<section class="flex flex-col gap-4">
  <h2 class="font-display text-3xl font-bold text-white md:text-4xl">Introduction</h2>
  <p class="text-lg leading-8 text-ink-200 md:text-xl">Start writing here.</p>
</section>`
    }]
});

function commaList(value: string) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function syncEditorUrl(type: ContentType, slug?: string) {
    const params = new URLSearchParams();
    params.set("type", type);
    if (slug) params.set("slug", slug);
    window.history.replaceState(window.history.state, "", `/admin/seo?${params.toString()}`);
}

async function formatDocumentCode(code: string) {
    const [prettier, htmlPlugin, babelPlugin, estreePlugin, postcssPlugin] = await Promise.all([
        import("prettier/standalone"),
        import("prettier/plugins/html"),
        import("prettier/plugins/babel"),
        import("prettier/plugins/estree"),
        import("prettier/plugins/postcss")
    ]);
    return prettier.format(code, {
        parser: "html",
        plugins: [htmlPlugin.default, babelPlugin.default, estreePlugin.default, postcssPlugin.default],
        printWidth: 100,
        tabWidth: 2,
        useTabs: false
    });
}

function replaceAtPath(post: BlogPost, path: Array<string | number>, value: ImageValue) {
    const clone = structuredClone(post) as Record<string, unknown>;
    let target: any = clone;
    path.slice(0, -1).forEach((part) => { target = target[part]; });
    target[path[path.length - 1]] = value;
    return clone as BlogPost;
}

function imageDisplayStyle(image: ImageValue) {
    return image.displayHeight ? {height: `${image.displayHeight}px`} : undefined;
}

function parseDisplayHeight(value: string) {
    const height = Number(value);
    return Number.isFinite(height) && height > 0 ? Math.max(80, Math.min(1600, Math.round(height))) : undefined;
}

function SeoGuidance({post}: {post: BlogPost}) {
    const text = post.sections.flatMap((section) => [section.title, ...section.paragraphs, section.html?.replace(/<[^>]+>/g, " ") ?? ""]).join(" ");
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const primaryKeyword = post.searchIntents[0]?.toLowerCase();
    const firstParagraph = post.sections[0]?.paragraphs[0]?.toLowerCase() ?? "";
    const hasH2 = post.sections.some((section) => (section.headingLevel ?? 2) === 2 && section.title.trim());
    const hierarchyValid = !post.sections.some((section, index) => (section.headingLevel ?? 2) === 3 && !post.sections.slice(0, index).some((previous) => (previous.headingLevel ?? 2) === 2));
    const checks = [
        {label: "One clear H1 page title", pass: Boolean(post.title.trim()), hint: "The page title is the only H1."},
        {label: "Title is 30–60 characters", pass: post.title.length >= 30 && post.title.length <= 60, hint: `${post.title.length}/60 characters`},
        {label: "Meta description is 120–160 characters", pass: post.description.length >= 120 && post.description.length <= 160, hint: `${post.description.length}/160 characters`},
        {label: "Primary keyword is defined", pass: Boolean(primaryKeyword), hint: primaryKeyword || "Add it in Page & SEO settings."},
        {label: "Primary keyword appears in H1", pass: Boolean(primaryKeyword && post.title.toLowerCase().includes(primaryKeyword)), hint: "Use it naturally, not repeatedly."},
        {label: "Primary keyword appears early", pass: Boolean(primaryKeyword && firstParagraph.includes(primaryKeyword)), hint: "Include it naturally in the opening paragraph."},
        {label: "At least one H2 section", pass: hasH2, hint: "H2s define the main topics."},
        {label: "Valid H2 → H3 hierarchy", pass: hierarchyValid, hint: "An H3 must follow an H2."},
        {label: "Featured image has alt text", pass: post.featuredImage.alt.trim().length > 5, hint: "Describe the image for accessibility and search."},
        {label: "Substantial page content", pass: words >= 600, hint: `${words} words; aim for 600+ when the topic warrants it.`}
    ];
    const passed = checks.filter((check) => check.pass).length;
    return (
        <details className="border border-line-300 bg-surface-900" open>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3">
                <span className="text-[11px] font-black uppercase tracking-[.12em] text-primary-200">Google SEO guidance</span>
                <Badge tone={passed >= 8 ? "good" : "warn"} className="tabular-nums">{passed}/{checks.length} ready</Badge>
            </summary>
            <div className="grid gap-px border-t border-line-300 bg-line-300 sm:grid-cols-2">
                {checks.map((check) => <div key={check.label} className="flex gap-3 bg-canvas-950/70 p-3">
                    <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${check.pass ? "bg-primary-500 text-canvas-950" : "bg-amber-400/15 text-amber-200"}`}>{check.pass ? <CheckCircle size={14} iconStyle="Bold" /> : <DangerCircle size={14} iconStyle="Bold" />}</span>
                    <div><p className="text-xs font-bold text-white">{check.label}</p><p className="mt-1 text-[11px] leading-4 text-ink-500">{check.hint}</p></div>
                </div>)}
            </div>
        </details>
    );
}

function LiveContentEditor({
    post,
    contentType,
    width,
    setPost,
    chooseImage,
    uploadingPath
}: {
    post: BlogPost;
    contentType: ContentType;
    width: PreviewWidth;
    setPost: (post: BlogPost) => void;
    chooseImage: (slot: ImageSlot) => void;
    uploadingPath: string;
}) {
    const widthClass = width === "mobile" ? "max-w-[390px]" : width === "tablet" ? "max-w-[760px]" : "max-w-5xl";
    const updateSection = (sectionIndex: number, update: (section: BlogSection) => BlogSection) => {
        setPost({...post, sections: post.sections.map((section, index) => index === sectionIndex ? update(section) : section)});
    };
    const moveSection = (sectionIndex: number, direction: -1 | 1) => {
        const nextIndex = sectionIndex + direction;
        if (nextIndex < 0 || nextIndex >= post.sections.length) return;
        const sections = [...post.sections];
        const [section] = sections.splice(sectionIndex, 1);
        sections.splice(nextIndex, 0, section);
        setPost({...post, sections});
        if (editingHtmlSection === sectionIndex) setEditingHtmlSection(nextIndex);
        else if (editingHtmlSection === nextIndex) setEditingHtmlSection(sectionIndex);
    };
    const featuredSlot: ImageSlot = {label: "Featured image", path: ["featuredImage"], image: post.featuredImage};
    const [editingHtmlSection, setEditingHtmlSection] = useState<number | null>(null);
    const [editingHeader, setEditingHeader] = useState(false);
    const [formattingTarget, setFormattingTarget] = useState<string | null>(null);
    const featuredFigureRef = useRef<HTMLElement | null>(null);
    const insertCodeSection = (sectionIndex = post.sections.length) => {
        const section: BlogSection = {
            title: "Custom section",
            paragraphs: [],
            html: `<style data-section-styles>
/* Add section-specific CSS overrides here. */
</style>
<section class="flex flex-col gap-4">
  <h2 class="font-display text-3xl font-bold text-white md:text-4xl">Section heading</h2>
  <p class="text-lg leading-8 text-ink-200 md:text-xl">Build the complete section here.</p>
</section>`
        };
        setPost({...post, sections: [...post.sections.slice(0, sectionIndex), section, ...post.sections.slice(sectionIndex)]});
        setEditingHtmlSection(sectionIndex);
    };
    const startFeaturedHeightDrag = (event: PointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        const pointerId = event.pointerId;
        const startY = event.clientY;
        const startHeight = post.featuredImage.displayHeight ?? featuredFigureRef.current?.getBoundingClientRect().height ?? 360;
        event.currentTarget.setPointerCapture(pointerId);
        const target = event.currentTarget;
        const onMove = (moveEvent: globalThis.PointerEvent) => {
            const nextHeight = parseDisplayHeight(String(startHeight + moveEvent.clientY - startY));
            setPost({...post, featuredImage: {...post.featuredImage, displayHeight: nextHeight}});
        };
        const onUp = () => {
            target.releasePointerCapture(pointerId);
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onUp);
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);
    };

    return (
        <div className={`mx-auto w-full ${widthClass} overflow-hidden border border-line-300 bg-canvas-950 shadow-2xl transition-[max-width]`}>
            <div className="flex items-center justify-between border-b border-line-300 bg-surface-900 px-4 py-3">
                <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300" /><span className="h-2.5 w-2.5 rounded-full bg-primary-300" /></div>
                <p className="max-w-[65%] truncate text-[10px] text-ink-500">animaldex.com/{contentType === "blog" ? "blog/" : ""}{post.slug || "new-page"}</p>
            </div>
            <article className="px-4 pb-16 sm:px-8">
                <section className="pt-6">
                    <div className="mb-3 flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1.5 rounded-full border border-primary-400/25 bg-primary-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-primary-100"><Code size={14} />Header section</span><button type="button" onClick={() => setEditingHeader((current) => !current)} className="inline-flex items-center gap-1.5 border border-line-300 px-3 py-2 text-xs font-bold text-white"><Code size={14} />{editingHeader ? "View preview" : "Edit code"}</button></div>
                    {editingHeader ? <div className="overflow-hidden border border-line-300 bg-[#080d0a]"><div className="flex items-center justify-between gap-3 border-b border-line-300 px-4 py-2"><span className="text-[10px] font-black uppercase tracking-[.16em] text-ink-400">Header · HTML, CSS & JavaScript</span><button type="button" disabled={formattingTarget === "header"} onClick={async () => {setFormattingTarget("header"); try {setPost({...post, headerHtml: await formatDocumentCode(post.headerHtml ?? "")});} finally {setFormattingTarget(null);}}} className="border border-line-300 px-2.5 py-1.5 text-[10px] font-bold text-white disabled:opacity-50">{formattingTarget === "header" ? "Formatting…" : "Format code"}</button></div><textarea value={post.headerHtml ?? ""} onChange={(event) => setPost({...post, headerHtml: event.target.value})} rows={24} spellCheck={false} className="min-h-[38rem] w-full resize-y bg-transparent p-4 font-mono text-sm leading-6 text-primary-100 outline-none" /></div> : null}
                    <div className={`${editingHeader ? "hidden" : "block"} overflow-hidden`}><RenderedCodeFrame title="Page header preview" documentHtml={getRenderedCodeDocument({language: "html+css+js", code: post.headerHtml ?? ""})} minHeight={240} /></div>
                </section>
                <figure ref={featuredFigureRef} className="group relative overflow-hidden border border-line-300 bg-surface-900">
                    <NextImage src={post.featuredImage.src} alt={post.featuredImage.alt} width={post.featuredImage.width || 1600} height={post.featuredImage.height || 900} unoptimized style={imageDisplayStyle(post.featuredImage)} className={`${post.featuredImage.displayHeight ? "" : "aspect-video"} h-auto w-full object-cover`} />
                    <button type="button" onClick={() => chooseImage(featuredSlot)} className="absolute right-3 top-3 cursor-pointer bg-canvas-950 px-3 py-2 text-xs font-black text-white opacity-100 shadow-lg sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                        <span className="inline-flex items-center gap-1.5"><Gallery size={15} />{uploadingPath === "featuredImage" ? "Uploading…" : "Replace image"}</span>
                    </button>
                    <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2 border border-line-300 bg-canvas-950 p-2 shadow-lg sm:left-auto sm:right-3">
                        <label className="flex items-center gap-2 text-[11px] font-black text-white">
                            Height
                            <input type="number" min={80} max={1600} value={post.featuredImage.displayHeight ?? ""} onChange={(event) => setPost({...post, featuredImage: {...post.featuredImage, displayHeight: parseDisplayHeight(event.target.value)}})} placeholder="Auto" className="h-8 w-20 border border-line-300 bg-surface-900 px-2 text-xs font-normal text-white outline-none focus:border-primary-300" />
                        </label>
                        {post.featuredImage.displayHeight ? <button type="button" onClick={() => setPost({...post, featuredImage: {...post.featuredImage, displayHeight: undefined}})} className="h-8 border border-line-300 px-2 text-[10px] font-bold text-ink-200">Auto</button> : null}
                    </div>
                    <button type="button" onPointerDown={startFeaturedHeightDrag} aria-label="Drag to resize featured image height" title="Drag to resize image height" className="absolute inset-x-6 bottom-1 z-10 h-4 cursor-ns-resize rounded-full bg-primary-300/0 transition group-hover:bg-primary-300/45 focus:bg-primary-300/60"><span className="mx-auto mt-1 block h-1 w-16 rounded-full bg-white/70" /></button>
                    {post.featuredImage.caption && <figcaption className="border-t border-line-300 px-4 py-3 text-xs text-ink-400">{post.featuredImage.caption}</figcaption>}
                </figure>
                <div className="mt-6 flex justify-end">
                    <button type="button" onClick={() => insertCodeSection(0)} className="inline-flex items-center gap-2 border border-primary-400/35 bg-primary-500/10 px-4 py-2.5 text-sm font-bold text-primary-100 hover:bg-primary-500/15"><AddCircle size={17} />Add section</button>
                </div>
                <div className="mt-12 space-y-12">
                    {post.sections.map((section, sectionIndex) => section.html !== undefined ? <section key={sectionIndex} className="group/section relative pt-8">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-400/25 bg-primary-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-primary-100"><Code size={14} />Custom section</span>
                            <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => moveSection(sectionIndex, -1)} disabled={sectionIndex === 0} className="inline-flex items-center border border-line-300 px-3 py-2 text-xs font-bold text-white disabled:opacity-35">Up</button><button type="button" onClick={() => moveSection(sectionIndex, 1)} disabled={sectionIndex === post.sections.length - 1} className="inline-flex items-center border border-line-300 px-3 py-2 text-xs font-bold text-white disabled:opacity-35">Down</button><button type="button" onClick={() => insertCodeSection(sectionIndex + 1)} className="inline-flex items-center gap-1.5 border border-primary-400/25 px-3 py-2 text-xs font-bold text-primary-100"><AddCircle size={14} />Insert below</button><button type="button" onClick={() => setEditingHtmlSection(editingHtmlSection === sectionIndex ? null : sectionIndex)} className="inline-flex items-center gap-1.5 border border-line-300 px-3 py-2 text-xs font-bold text-white"><Code size={14} />{editingHtmlSection === sectionIndex ? "View preview" : "Edit code"}</button><button type="button" onClick={() => setPost({...post, sections: post.sections.filter((_, index) => index !== sectionIndex)})} className="inline-flex items-center gap-1 border border-red-400/20 px-2.5 py-2 text-xs font-bold text-red-300"><TrashBinMinimalistic size={14} />Delete</button></div>
                        </div>
                        {editingHtmlSection === sectionIndex ? <div className="overflow-hidden border border-line-300 bg-[#080d0a]"><div className="flex items-center justify-between gap-3 border-b border-line-300 px-4 py-2"><span className="text-[10px] font-black uppercase tracking-[.16em] text-ink-400">Entire section · HTML, CSS & JavaScript</span><button type="button" disabled={formattingTarget === `section-${sectionIndex}`} onClick={async () => {const target = `section-${sectionIndex}`; setFormattingTarget(target); try {const formatted = await formatDocumentCode(section.html ?? ""); updateSection(sectionIndex, (item) => ({...item, html: formatted}));} finally {setFormattingTarget(null);}}} className="border border-line-300 px-2.5 py-1.5 text-[10px] font-bold text-white disabled:opacity-50">{formattingTarget === `section-${sectionIndex}` ? "Formatting…" : "Format code"}</button></div><textarea value={section.html} onChange={(event) => updateSection(sectionIndex, (item) => ({...item, html: event.target.value}))} rows={24} spellCheck={false} className="min-h-[38rem] w-full resize-y bg-transparent p-4 font-mono text-sm leading-6 text-primary-100 outline-none" /></div> : null}
                        <div className={`${editingHtmlSection === sectionIndex ? "hidden" : "block"} overflow-hidden`}><RenderedCodeFrame title={section.title || `Custom section ${sectionIndex + 1}`} documentHtml={getRenderedCodeDocument({language: "html+css+js", code: section.html})} minHeight={320} /></div>
                    </section> : <section key={sectionIndex} className="group/section relative space-y-5 border-t border-line-300 pt-8">
                        <div className="absolute right-0 top-2 flex gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover/section:opacity-100"><button type="button" onClick={() => moveSection(sectionIndex, -1)} disabled={sectionIndex === 0} className="px-2 py-1 text-[10px] font-bold text-ink-300 disabled:opacity-35">Up</button><button type="button" onClick={() => moveSection(sectionIndex, 1)} disabled={sectionIndex === post.sections.length - 1} className="px-2 py-1 text-[10px] font-bold text-ink-300 disabled:opacity-35">Down</button><button onClick={() => setPost({...post, sections: post.sections.filter((_, index) => index !== sectionIndex)})} className="px-2 py-1 text-[10px] font-bold text-red-300">Remove</button></div>
                        <input aria-label="Section kicker" value={section.kicker ?? ""} onChange={(event) => updateSection(sectionIndex, (item) => ({...item, kicker: event.target.value}))} placeholder="SECTION LABEL" className="block w-full bg-transparent text-xs font-black uppercase tracking-[.2em] text-primary-200 outline-none placeholder:text-ink-600 focus:ring-1 focus:ring-primary-400" />
                        <div className="flex items-start gap-2">
                            <select aria-label="Heading level" value={section.headingLevel ?? 2} onChange={(event) => updateSection(sectionIndex, (item) => ({...item, headingLevel: Number(event.target.value) as 2 | 3}))} className="mt-1 border border-primary-400/25 bg-primary-500/10 px-2 py-1 text-[10px] font-black text-primary-100 outline-none focus:border-primary-300"><option value={2}>H2</option><option value={3}>H3</option></select>
                            <input aria-label={`${section.headingLevel ?? 2 === 2 ? "H2" : "H3"} section heading`} value={section.title} onChange={(event) => updateSection(sectionIndex, (item) => ({...item, title: event.target.value}))} placeholder="Section title" className={`block w-full bg-transparent font-display leading-tight text-white outline-none placeholder:text-ink-600 focus:ring-1 focus:ring-primary-400 ${(section.headingLevel ?? 2) === 3 ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"}`} />
                        </div>
                        <div className="space-y-5">{section.paragraphs.map((paragraph, paragraphIndex) => <div key={paragraphIndex} className="group/paragraph relative">
                            <textarea aria-label={`Paragraph ${paragraphIndex + 1}`} value={paragraph} onChange={(event) => updateSection(sectionIndex, (item) => ({...item, paragraphs: item.paragraphs.map((value, index) => index === paragraphIndex ? event.target.value : value)}))} rows={Math.max(3, Math.ceil(paragraph.length / 90))} placeholder="Start writing…" className="block w-full resize-y bg-transparent pr-24 text-base leading-8 text-ink-200 outline-none placeholder:text-ink-600 focus:ring-1 focus:ring-primary-400 sm:text-lg" />
                            <button type="button" onClick={() => updateSection(sectionIndex, (item) => ({...item, paragraphs: item.paragraphs.filter((_, index) => index !== paragraphIndex)}))} aria-label={`Delete paragraph ${paragraphIndex + 1}`} className="absolute right-2 top-2 inline-flex items-center gap-1 border border-red-400/20 bg-canvas-950/90 px-2.5 py-1.5 text-[10px] font-bold text-red-300 shadow-md sm:opacity-0 sm:transition-opacity sm:group-hover/paragraph:opacity-100 sm:focus:opacity-100"><TrashBinMinimalistic size={13} />Delete</button>
                        </div>)}</div>
                        <button onClick={() => updateSection(sectionIndex, (item) => ({...item, paragraphs: [...item.paragraphs, ""]}))} className="inline-flex items-center gap-1.5 border border-dashed border-line-300 px-3 py-2 text-xs font-bold text-ink-400 hover:border-primary-400 hover:text-white"><AddCircle size={15} />Paragraph</button>
                        {section.codeBlocks?.map((block, blockIndex) => <figure key={blockIndex} className="overflow-hidden border border-line-300 bg-[#080d0a]">
                            <div className="flex items-center gap-2 border-b border-line-300 px-3 py-2">
                                <input list="code-languages" value={block.language ?? ""} onChange={(event) => updateSection(sectionIndex, (item) => ({...item, codeBlocks: (item.codeBlocks ?? []).map((value, index) => index === blockIndex ? {...value, language: event.target.value} : value)}))} placeholder="html, css, javascript…" className="min-w-0 flex-1 bg-transparent text-[10px] font-bold uppercase tracking-[.16em] text-ink-400 outline-none" />
                                <datalist id="code-languages"><option value="html" /><option value="html+css+js" /><option value="css" /><option value="javascript" /><option value="typescript" /><option value="jsx" /><option value="tsx" /><option value="json" /><option value="bash" /><option value="sql" /><option value="python" /><option value="markdown" /></datalist>
                                <label className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-[10px] font-bold ${canRenderCodeBlock(block.language) ? "text-ink-300" : "text-ink-600"}`}><input type="checkbox" disabled={!canRenderCodeBlock(block.language)} checked={Boolean(block.render)} onChange={(event) => updateSection(sectionIndex, (item) => ({...item, codeBlocks: (item.codeBlocks ?? []).map((value, index) => index === blockIndex ? {...value, render: event.target.checked} : value)}))} className="accent-emerald-400" />Run in sandbox</label>
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary-200"><Eye size={13} />LIVE</span>
                                <button type="button" onClick={() => updateSection(sectionIndex, (item) => ({...item, codeBlocks: (item.codeBlocks ?? []).filter((_, index) => index !== blockIndex)}))} className="inline-flex items-center gap-1 border border-red-400/20 bg-red-500/10 px-2.5 py-1.5 text-[10px] font-bold text-red-300 hover:bg-red-500/20"><TrashBinMinimalistic size={13} />Delete code block</button>
                            </div>
                            <div className="grid lg:grid-cols-2">
                                <textarea value={block.code} onChange={(event) => updateSection(sectionIndex, (item) => ({...item, codeBlocks: (item.codeBlocks ?? []).map((value, index) => index === blockIndex ? {...value, code: event.target.value} : value)}))} rows={10} spellCheck={false} className="min-h-[14rem] w-full resize-y border-b border-line-300 bg-black/20 p-4 font-mono text-sm leading-6 text-primary-100 outline-none focus:bg-black/35 lg:border-b-0 lg:border-r" />
                                {block.render && canRenderCodeBlock(block.language) ? <RenderedCodeFrame title={`Rendered content preview ${blockIndex + 1}`} documentHtml={getRenderedCodeDocument(block)} minHeight={224} className="bg-white" /> : <pre className="min-h-[14rem] overflow-auto p-4 text-sm leading-6 text-primary-100"><code>{block.code || "Live code preview"}</code></pre>}
                            </div>
                            <input value={block.caption ?? ""} onChange={(event) => updateSection(sectionIndex, (item) => ({...item, codeBlocks: (item.codeBlocks ?? []).map((value, index) => index === blockIndex ? {...value, caption: event.target.value} : value)}))} placeholder="Optional caption" className="w-full border-t border-line-300 bg-transparent px-4 py-3 text-xs text-ink-400 outline-none" />
                        </figure>)}
                        <div className="flex flex-wrap gap-2">
                            <button onClick={() => updateSection(sectionIndex, (item) => ({...item, codeBlocks: [...(item.codeBlocks ?? []), {language: "html", code: "<div>Preview me</div>", caption: "", render: false}]}))} className="inline-flex items-center gap-1.5 border border-line-300 px-3 py-2 text-xs font-bold text-ink-300 hover:text-white"><Code size={15} />Code block</button>
                        </div>
                        {section.media?.type === "image" && section.media.image && <div className="group/image relative"><NextImage src={section.media.image.src} alt={section.media.image.alt} width={section.media.image.width || 1600} height={section.media.image.height || 900} unoptimized style={imageDisplayStyle(section.media.image)} className="h-auto w-full border border-line-300 object-cover" /><button type="button" onClick={() => chooseImage({label: section.title, path: ["sections", sectionIndex, "media", "image"], image: section.media!.image!})} className="absolute right-3 top-3 bg-canvas-950 px-3 py-2 text-xs font-black text-white opacity-100 sm:opacity-0 sm:group-hover/image:opacity-100">Replace image</button></div>}
                        {section.media?.type === "gallery" && section.media.images && <div className="grid gap-3 sm:grid-cols-2">{section.media.images.map((image, imageIndex) => <div key={imageIndex} className="group/image relative"><NextImage src={image.src} alt={image.alt} width={image.width || 1600} height={image.height || 900} unoptimized style={imageDisplayStyle(image)} className="h-full w-full border border-line-300 object-cover" /><button type="button" onClick={() => chooseImage({label: `${section.title} image ${imageIndex + 1}`, path: ["sections", sectionIndex, "media", "images", imageIndex], image})} className="absolute right-2 top-2 bg-canvas-950 px-2.5 py-2 text-[10px] font-black text-white opacity-100 sm:opacity-0 sm:group-hover/image:opacity-100">Replace</button></div>)}</div>}
                    </section>)}
                    <button onClick={() => insertCodeSection()} className="flex w-full items-center justify-center gap-2 border border-dashed border-primary-400/40 bg-primary-500/[0.04] px-4 py-4 text-sm font-bold text-primary-100 hover:bg-primary-500/[0.08]"><Code size={18} />Add code section</button>
                </div>
            </article>
        </div>
    );
}

export default function AdminContentStudio() {
    const searchParams = useSearchParams();
    const requestedType: ContentType = searchParams.get("type") === "page" ? "page" : "blog";
    const [authorized, setAuthorized] = useState<boolean | null>(null);
    const [password, setPassword] = useState("");
    const [summaries, setSummaries] = useState<Summary[]>([]);
    const [contentType, setContentType] = useState<ContentType>(requestedType);
    const [post, setPost] = useState<BlogPost | null>(null);
    const [query, setQuery] = useState("");
    const [saving, setSaving] = useState(false);
    const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [isPublished, setIsPublished] = useState(false);
    const lastSavedPost = useRef("");
    const [uploadingPath, setUploadingPath] = useState("");
    const [pickerSlot, setPickerSlot] = useState<ImageSlot | null>(null);
    const [pickerAltText, setPickerAltText] = useState("");
    const [pickerDisplayHeight, setPickerDisplayHeight] = useState("");
    const [assets, setAssets] = useState<Asset[]>([]);
    const [assetsLoading, setAssetsLoading] = useState(false);
    const [assetQuery, setAssetQuery] = useState("");
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [previewWidth, setPreviewWidth] = useState<PreviewWidth>("desktop");
    const filtered = summaries.filter((item) => `${item.title} ${item.slug}`.toLowerCase().includes(query.toLowerCase()));

    const loadList = useCallback(async (type: ContentType) => {
        setError(null);
        const response = await fetch(`/api/admin/content?type=${type}`, {cache: "no-store"});
        if (response.status === 401) {
            setAuthorized(false);
            return;
        }
        const body = await readJson(response, "Loading content");
        if (!response.ok || !body.ok) throw new Error(body.error || "Unable to load content");
        const overrideMap = new Map((body.entries ?? []).map((entry: any) => [entry.slug, entry.payload]));
        const viewsBySlug = (body.views ?? {}) as Record<string, number>;
        const compiled = (body.compiled ?? []).map((item: Summary) => {
            const override = overrideMap.get(item.slug) as BlogPost | undefined;
            const withViews = {...item, views: viewsBySlug[item.slug] ?? 0};
            return override ? {...withViews, title: override.title, description: override.description, featuredImage: override.featuredImage, updatedAt: override.updatedAt ?? override.publishedAt} : withViews;
        });
        const compiledSlugs = new Set(compiled.map((item: Summary) => item.slug));
        const custom = (body.entries ?? [])
            .map((entry: any) => entry.payload as BlogPost)
            .filter((item: BlogPost) => item?.slug && !compiledSlugs.has(item.slug))
            .map((item: BlogPost): Summary => ({
                slug: item.slug,
                title: item.title,
                description: item.description,
                featuredImage: item.featuredImage,
                updatedAt: item.updatedAt ?? item.publishedAt,
                views: viewsBySlug[item.slug] ?? 0
            }));
        setSummaries([...custom, ...compiled]);
        setAuthorized(true);
    }, []);

    const openPost = useCallback(async function openContent(slug: string, type: ContentType, allowTypeFallback = true): Promise<void> {
        setMessage(null);
        setError(null);
        const response = await fetch(`/api/admin/content?type=${type}&slug=${encodeURIComponent(slug)}`, {cache: "no-store"});
        const body = await readJson(response, "Loading the article");
        if (!response.ok || !body.ok) throw new Error(body.error || "Unable to load article");
        if (!body.content && allowTypeFallback) {
            const fallbackType: ContentType = type === "blog" ? "page" : "blog";
            await loadList(fallbackType);
            await openContent(slug, fallbackType, false);
            return;
        }
        if (!body.content) throw new Error(`No blog or page found for “${slug}”.`);
        setContentType(type);
        setPost(body.content);
        setIsPublished(Boolean(body.entry?.is_published));
        lastSavedPost.current = JSON.stringify(body.content);
        setAutosaveStatus("saved");
        syncEditorUrl(type, slug);
    }, [loadList]);

    useEffect(() => {
        const slug = searchParams.get("slug")?.trim();
        loadList(requestedType)
            .then(() => slug ? openPost(slug, requestedType) : undefined)
            .catch((caught) => setError(caught.message));
    }, [loadList, openPost, requestedType, searchParams]);

    useEffect(() => {
        if (!post || saving) return;
        const serialized = JSON.stringify(post);
        if (!lastSavedPost.current || serialized === lastSavedPost.current) return;
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)) {
            setAutosaveStatus("idle");
            return;
        }

        setAutosaveStatus("saving");
        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            try {
                const response = await fetch("/api/admin/content", {
                    method: "PUT",
                    signal: controller.signal,
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({
                        type: contentType,
                        slug: post.slug,
                        payload: post,
                        isPublished
                    })
                });
                const body = await readJson(response, "Autosave");
                if (!response.ok || !body.ok) throw new Error(body.error || "Unable to autosave");
                lastSavedPost.current = serialized;
                setAutosaveStatus("saved");
                syncEditorUrl(contentType, post.slug);
            } catch (caught) {
                if (caught instanceof DOMException && caught.name === "AbortError") return;
                setAutosaveStatus("error");
                setError(caught instanceof Error ? caught.message : "Unable to autosave");
            }
        }, 1200);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [contentType, isPublished, post, saving]);

    async function login(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const response = await fetch("/api/admin/support/login", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({password})
            });
            const body = await readJson(response, "Signing in");
            if (!response.ok || !body.ok) throw new Error(body.error || "Unable to sign in");
            setPassword("");
            await loadList(contentType);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to sign in");
        } finally {
            setSaving(false);
        }
    }

    async function save() {
        if (!post) return;
        setSaving(true);
        setMessage(null);
        setError(null);
        try {
            const response = await fetch("/api/admin/content", {
                method: "PUT",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    type: contentType,
                    slug: post.slug,
                    payload: {...post, updatedAt: new Date().toISOString().slice(0, 10)},
                    isPublished: true
                })
            });
            const body = await readJson(response, "Publishing");
            if (!response.ok || !body.ok) throw new Error(body.error || "Unable to publish article");
            const updatedPost = {...post, updatedAt: new Date().toISOString().slice(0, 10)};
            lastSavedPost.current = JSON.stringify(updatedPost);
            setPost(updatedPost);
            setIsPublished(true);
            setAutosaveStatus("saved");
            syncEditorUrl(contentType, post.slug);
            setMessage("Published successfully.");
            await loadList(contentType);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to publish article");
        } finally {
            setSaving(false);
        }
    }

    async function uploadImage(file: File, slot: ImageSlot) {
        if (!post) return;
        const pathKey = slot.path.join(".");
        setUploadingPath(pathKey);
        setError(null);
        try {
            const dimensions = await new Promise<{width: number; height: number}>((resolve) => {
                const image = new Image();
                const url = URL.createObjectURL(file);
                image.onload = () => { resolve({width: image.naturalWidth, height: image.naturalHeight}); URL.revokeObjectURL(url); };
                image.onerror = () => { resolve({width: 1600, height: 900}); URL.revokeObjectURL(url); };
                image.src = url;
            });
            const form = new FormData();
            form.set("file", file);
            const response = await fetch("/api/admin/assets", {method: "POST", body: form});
            const body = await readJson(response, "Uploading the image");
            if (!response.ok || !body.ok) throw new Error(body.error || "Unable to upload image");
            setPost(replaceAtPath(post, slot.path, {
                ...slot.image,
                src: body.asset.url,
                alt: pickerAltText.trim() || slot.image.alt,
                width: body.asset.width ?? dimensions.width,
                height: body.asset.height ?? dimensions.height,
                displayHeight: parseDisplayHeight(pickerDisplayHeight),
                caption: slot.image.caption?.replace(/^Image slot:\s*/i, "")
            }));
            setPickerSlot(null);
            setMessage("Image uploaded. Publish to make the replacement live.");
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to upload image");
        } finally {
            setUploadingPath("");
        }
    }

    async function openAssetPicker(slot: ImageSlot) {
        setPickerSlot(slot);
        setPickerAltText(slot.image.alt);
        setPickerDisplayHeight(slot.image.displayHeight ? String(slot.image.displayHeight) : "");
        setAssetQuery("");
        setAssetsLoading(true);
        setError(null);
        try {
            const response = await fetch("/api/admin/assets", {cache: "no-store"});
            const body = await readJson(response, "Loading the image library");
            if (!response.ok || !body.ok) throw new Error(body.error || "Unable to load image library");
            setAssets(body.assets ?? []);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to load image library");
        } finally {
            setAssetsLoading(false);
        }
    }

    async function selectExistingAsset(asset: Asset) {
        if (!post || !pickerSlot) return;
        const dimensions = await new Promise<{width: number; height: number}>((resolve) => {
            const image = new Image();
            image.onload = () => resolve({width: image.naturalWidth, height: image.naturalHeight});
            image.onerror = () => resolve({width: pickerSlot.image.width || 1600, height: pickerSlot.image.height || 900});
            image.src = asset.url;
        });
            setPost(replaceAtPath(post, pickerSlot.path, {
                ...pickerSlot.image,
                src: asset.url,
                alt: pickerAltText.trim() || pickerSlot.image.alt,
                displayHeight: parseDisplayHeight(pickerDisplayHeight),
                ...dimensions
            }));
        setPickerSlot(null);
        setMessage("Existing image selected. Publish to make the replacement live.");
    }

    function savePickerAltText(closePicker = false) {
        if (!post || !pickerSlot) {
            if (closePicker) setPickerSlot(null);
            return;
        }
        const alt = pickerAltText.trim();
        const displayHeight = parseDisplayHeight(pickerDisplayHeight);
        const nextImage = {
            ...pickerSlot.image,
            ...(alt ? {alt} : {}),
            displayHeight
        };
        if (nextImage.alt !== pickerSlot.image.alt || nextImage.displayHeight !== pickerSlot.image.displayHeight) {
            setPost(replaceAtPath(post, pickerSlot.path, nextImage));
            setPickerSlot({...pickerSlot, image: nextImage});
            setMessage("Image settings updated. Publish to make the change live.");
        }
        if (closePicker) setPickerSlot(null);
    }

    function duplicatePost() {
        if (!post) return;
        const baseSlug = `${post.slug || (contentType === "blog" ? "new-article" : "new-page")}-copy`;
        let slug = baseSlug;
        let suffix = 2;
        const existing = new Set(summaries.map((item) => item.slug));
        while (existing.has(slug)) {
            slug = `${baseSlug}-${suffix}`;
            suffix += 1;
        }
        setPost({
            ...structuredClone(post),
            slug,
            title: `${post.title} (Copy)`,
            publishedAt: new Date().toISOString().slice(0, 10),
            updatedAt: new Date().toISOString().slice(0, 10)
        });
        setIsPublished(false);
        lastSavedPost.current = "";
        setAutosaveStatus("idle");
        setMessage(`Duplicated as /${slug}. Update the title and slug, then publish when ready.`);
        setError(null);
    }

    if (authorized === false) {
        return (
            <AdminPage width="narrow" className="grid min-h-[70vh] place-items-center">
                <form onSubmit={login} className="w-full max-w-sm border border-line-300 bg-surface-900 p-6">
                    <p className="text-[11px] font-black uppercase tracking-[.16em] text-primary-200">AnimalDex admin</p>
                    <h1 className="mt-2 font-display text-3xl text-white">Content studio</h1>
                    <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Admin password" className={cn(fieldClass, "mt-6 py-2.5")} />
                    {error && <Alert tone="bad" className="mt-3">{error}</Alert>}
                    <Button type="submit" variant="primary" size="lg" loading={saving} disabled={!password} className="mt-4 w-full">{saving ? "Signing in…" : "Sign in"}</Button>
                </form>
            </AdminPage>
        );
    }

    const pickerMatches = assets.filter((asset) => `${asset.filename} ${asset.path}`.toLowerCase().includes(assetQuery.toLowerCase()));
    const listLoading = authorized === null && !error;

    return (
        <AdminPage width="wide" className="flex h-[calc(100dvh-3.5rem)] max-w-none flex-col overflow-hidden px-0 pb-0 pt-0 sm:px-0 lg:px-0 lg:pt-0">
            <PageHeader
                className="shrink-0 px-4 pb-4 pt-5 sm:px-6"
                eyebrow="Content"
                title="SEO & Blog Studio"
                description="Live content overrides"
                actions={
                    <>
                        {post && (
                            <span className={cn("hidden items-center gap-1.5 px-1 text-[11px] font-bold sm:inline-flex", autosaveStatus === "error" ? "text-red-300" : "text-ink-400")}>
                                {autosaveStatus === "saving" ? <Spinner size={12} /> : autosaveStatus === "saved" ? <CheckCircle size={13} className="text-primary-300" /> : autosaveStatus === "error" ? <DangerCircle size={13} /> : null}
                                {autosaveStatus === "saving" ? "Saving…" : autosaveStatus === "error" ? "Autosave failed" : autosaveStatus === "saved" ? "Saved" : "Not saved yet"}
                            </span>
                        )}
                        <Link href="/admin/assets" className={buttonVariants({size: "sm"})}><Gallery size={15} /><span className="hidden sm:inline">Assets</span></Link>
                        {post && <a href={contentType === "blog" ? `/blog/${post.slug}` : `/${post.slug}`} target="_blank" className={buttonVariants({size: "sm"})}><Eye size={15} />Preview</a>}
                        {post && <Button size="sm" variant="primary" onClick={save} loading={saving} disabled={!post.slug}>{saving ? null : <Diskette size={15} />}{saving ? "Publishing…" : "Publish"}</Button>}
                    </>
                }
            />
            {(error || message) && <Alert tone={error ? "bad" : "good"} className="shrink-0 border-x-0 border-t-0 py-2">{error || message}</Alert>}
            <div className="grid min-h-0 flex-1 lg:grid-cols-[320px_minmax(0,1fr)]">
                <aside className={`${post ? "hidden lg:block" : "block"} min-h-0 overflow-y-auto border-r border-line-300`}>
                    <div className="sticky top-0 z-10 border-b border-line-300 bg-canvas-950 p-3">
                        <Segmented
                            className="mb-3 grid w-full grid-cols-2"
                            label="Content type"
                            value={contentType}
                            onChange={(type) => { setContentType(type); setPost(null); setSummaries([]); syncEditorUrl(type); loadList(type).catch((caught) => setError(caught.message)); }}
                            options={[{value: "blog", label: "Blog posts"}, {value: "page", label: "Pages"}]}
                        />
                        <div className="relative"><Magnifer size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${contentType === "blog" ? "articles" : "pages"}…`} className={cn(fieldClass, "pl-9")} /></div>
                        <Button onClick={() => {const nextPost = emptyPost(); setPost(nextPost); setIsPublished(false); lastSavedPost.current = JSON.stringify(nextPost); setAutosaveStatus("idle"); syncEditorUrl(contentType);}} className="mt-2 w-full border-primary-400/30 bg-primary-500/10 text-primary-100"><AddCircle size={17} />New {contentType === "blog" ? "article" : "page"}</Button>
                    </div>
                    <div className="divide-y divide-line-300">
                        {listLoading && Array.from({length: 7}, (_, index) => (
                            <div key={index} aria-hidden="true" className="flex gap-3 p-3" style={{opacity: 1 - index * 0.11}}>
                                <Skeleton className="h-14 w-20 shrink-0" />
                                <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                                    <Skeleton className="h-3 w-full" />
                                    <Skeleton className="h-3 w-2/3" />
                                    <Skeleton className="h-2.5 w-1/3" />
                                </div>
                            </div>
                        ))}
                        {filtered.map((item) => (
                            <button key={item.slug} onClick={() => openPost(item.slug, contentType).catch((caught) => setError(caught.message))} className={cn("flex w-full gap-3 p-3 text-left transition hover:bg-white/[0.035]", post?.slug === item.slug && "bg-primary-500/[.07] shadow-[inset_2px_0_0_theme(colors.primary.300)]")}>
                                <NextImage src={item.featuredImage.src} alt="" width={80} height={56} unoptimized className="h-14 w-20 shrink-0 border border-line-300 bg-surface-900 object-cover" />
                                <div className="min-w-0 flex-1">
                                    <p className="line-clamp-2 text-sm font-bold text-white">{item.title}</p>
                                    <p className="mt-1 truncate text-[11px] text-ink-500">/{item.slug}</p>
                                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] tabular-nums text-ink-500" title={`${(item.views ?? 0).toLocaleString()} ${item.views === 1 ? "view" : "views"}`}>
                                        <Eye size={12} aria-hidden="true" />
                                        <span>{formatViews(item.views ?? 0)}</span>
                                    </p>
                                </div>
                            </button>
                        ))}
                        {!filtered.length && !listLoading && <EmptyState className="m-3 py-8" title={`No ${contentType === "blog" ? "articles" : "pages"} found`} description={`Create a new ${contentType === "blog" ? "article" : "page"} to get started.`} />}
                    </div>
                </aside>
                <section className={`${post ? "block" : "hidden lg:grid"} min-h-0 overflow-y-auto lg:place-items-start`}>
                    {!post ? <EmptyState className="m-6 w-[calc(100%-3rem)] self-stretch border-0" icon={<Code size={20} />} title="Choose an article to edit." description="Pick one from the list, or start a new one." /> : (
                        <div className="mx-auto w-full max-w-5xl space-y-6 p-4 pb-24 sm:p-7">
                            <Button variant="ghost" size="sm" onClick={() => {setPost(null); syncEditorUrl(contentType);}} className="lg:hidden">← All articles</Button>
                            <div className="sticky top-0 z-20 flex flex-col gap-3 border border-line-300 bg-canvas-950 p-3 shadow-xl sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-xs font-bold text-primary-100">Live editor <span className="font-normal text-ink-500">· click any text to edit</span></p>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Segmented
                                        label="Canvas width"
                                        value={previewWidth}
                                        onChange={setPreviewWidth}
                                        options={(["mobile", "tablet", "desktop"] as PreviewWidth[]).map((width) => {
                                            const DeviceIcon = width === "mobile" ? Smartphone : width === "tablet" ? Tablet : Monitor;
                                            return {value: width, label: <span title={`${width} canvas`} className="inline-flex items-center gap-1 capitalize"><DeviceIcon size={14} /><span className="hidden sm:inline">{width}</span></span>};
                                        })}
                                    />
                                    <Button size="sm" onClick={duplicatePost}><Copy size={15} />Duplicate</Button>
                                </div>
                            </div>
                            <details className="border border-line-300 bg-surface-900">
                                <summary className="cursor-pointer px-4 py-3 text-[11px] font-black uppercase tracking-[.12em] text-primary-200">Page & SEO settings</summary>
                                <div className="grid gap-4 border-t border-line-300 p-4 sm:grid-cols-2">
                                    <Field label="SEO title"><input value={post.title} onChange={(event) => setPost({...post, title: event.target.value})} className={fieldClass} /></Field>
                                    <Field label="Slug"><input value={post.slug} onChange={(event) => setPost({...post, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-")})} className={fieldClass} /></Field>
                                    <Field label="Meta description" className="sm:col-span-2"><textarea value={post.description} onChange={(event) => setPost({...post, description: event.target.value})} rows={3} className={fieldClass} /></Field>
                                    <Field label="Tags"><input value={post.tags.join(", ")} onChange={(event) => setPost({...post, tags: commaList(event.target.value)})} className={fieldClass} /></Field>
                                    <Field label="Author"><input value={post.author ?? ""} onChange={(event) => setPost({...post, author: event.target.value})} className={fieldClass} /></Field>
                                    <Field label="SEO keywords"><input value={post.searchIntents.join(", ")} onChange={(event) => setPost({...post, searchIntents: commaList(event.target.value)})} className={fieldClass} /></Field>
                                    <Field label="Featured image alt text" className="sm:col-span-2"><input value={post.featuredImage.alt} onChange={(event) => setPost({...post, featuredImage: {...post.featuredImage, alt: event.target.value}})} className={fieldClass} /></Field>
                                    <Field label="Featured image height"><input type="number" min={80} max={1600} value={post.featuredImage.displayHeight ?? ""} onChange={(event) => setPost({...post, featuredImage: {...post.featuredImage, displayHeight: parseDisplayHeight(event.target.value)}})} placeholder="Auto" className={fieldClass} /></Field>
                                </div>
                            </details>
                            <SeoGuidance post={post} />
                            <LiveContentEditor key={`${contentType}:${post.slug}`} post={post} contentType={contentType} width={previewWidth} setPost={setPost} chooseImage={openAssetPicker} uploadingPath={uploadingPath} />
                        </div>
                    )}
                </section>
            </div>
            {pickerSlot && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={`Choose ${pickerSlot.label}`}>
                    <div className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden border border-line-300 bg-surface-900 shadow-2xl">
                        <div className="flex items-center justify-between gap-4 border-b border-line-300 px-4 py-4 sm:px-6">
                            <div><p className="text-[11px] font-black uppercase tracking-[.16em] text-primary-200">Asset library</p><h2 className="mt-1 font-display text-2xl text-white">Choose {pickerSlot.label.toLowerCase()}</h2></div>
                            <Button onClick={() => savePickerAltText(true)}>Close</Button>
                        </div>
                        <div className="grid gap-3 border-b border-line-300 p-4 sm:grid-cols-[minmax(0,1fr)_12rem] sm:px-6">
                            <Field label="Alt text">
                                <input value={pickerAltText} onChange={(event) => setPickerAltText(event.target.value)} placeholder="Describe the image for screen readers and search" className={fieldClass} />
                            </Field>
                            <Field label="Display height">
                                <input type="number" min={80} max={1600} value={pickerDisplayHeight} onChange={(event) => setPickerDisplayHeight(event.target.value)} placeholder="Auto" className={fieldClass} />
                            </Field>
                            <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row">
                                <div className="relative min-w-0 flex-1"><Magnifer size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" /><input value={assetQuery} onChange={(event) => setAssetQuery(event.target.value)} placeholder="Search existing images…" className={cn(fieldClass, "pl-9")} /></div>
                                <Button type="button" onClick={() => savePickerAltText(false)}>Save alt text</Button>
                                <label className={cn(buttonVariants({variant: "primary"}), "cursor-pointer", uploadingPath && "pointer-events-none opacity-70")} aria-busy={Boolean(uploadingPath) || undefined}>
                                    {uploadingPath ? <Spinner /> : <Upload size={17} />}{uploadingPath ? "Uploading…" : "Upload new image"}
                                    <input type="file" accept="image/*" disabled={Boolean(uploadingPath)} className="hidden" onChange={(event) => event.target.files?.[0] && uploadImage(event.target.files[0], pickerSlot)} />
                                </label>
                            </div>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                            {assetsLoading ? (
                                <div role="status" aria-label="Loading image library" className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                                    {Array.from({length: 8}, (_, index) => (
                                        <div key={index} aria-hidden="true" className="border border-line-300 bg-canvas-900">
                                            <Skeleton className="aspect-[4/3] w-full" />
                                            <div className="px-3 py-2.5"><Skeleton className="h-3 w-3/4" /></div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                                    {pickerMatches.map((asset) => (
                                        <button key={asset.path} onClick={() => selectExistingAsset(asset)} className="group overflow-hidden border border-line-300 bg-canvas-900 text-left transition hover:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-300">
                                            <div className="relative aspect-[4/3] overflow-hidden bg-canvas-950"><NextImage src={asset.url} alt="" fill unoptimized sizes="(min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw" className="object-cover transition-transform group-hover:scale-105" /></div>
                                            <p className="truncate border-t border-line-300 px-3 py-2 text-xs font-bold text-ink-200">{asset.filename}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {!assetsLoading && !pickerMatches.length && <EmptyState icon={<Gallery size={20} />} title="No matching images." description="Upload a new one to add it to the library." />}
                        </div>
                    </div>
                </div>
            )}
        </AdminPage>
    );
}
