import {NextRequest, NextResponse} from "next/server";
import {blogPosts} from "@/data/blog";
import {getCompiledBlogSummaries, getCompiledPage, getCompiledPageSummaries, getContentEntry, listContentEntries, saveContentEntry} from "@/lib/admin-content";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {normalizePostToDocumentSections} from "@/lib/cms-section-document";
import type {BlogPost} from "@/data/blog/types";

const SOURCE_MIGRATION_VERSION = "source-sections-v1";

function normalizeContent(value: unknown) {
    if (!value || typeof value !== "object" || !Array.isArray((value as Partial<BlogPost>).sections)) return value;
    return normalizePostToDocumentSections(value as BlogPost);
}

function stripTags(value: string) {
    return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractPrimaryContentContainer(html: string) {
    const articleStart = html.indexOf("<article");
    const articleEnd = html.lastIndexOf("</article>");
    if (articleStart >= 0 && articleEnd >= 0) return html.slice(articleStart, articleEnd + 10);

    const mainStart = html.indexOf("<main");
    const mainEnd = html.lastIndexOf("</main>");
    if (mainStart >= 0 && mainEnd >= 0) return html.slice(mainStart, mainEnd + 7);

    return "";
}

function extractTopLevelSections(html: string) {
    const container = extractPrimaryContentContainer(html);
    if (!container) return [];
    const tagPattern = /<\/?section\b[^>]*>/gi;
    const sections: Array<{title: string; paragraphs: never[]; html: string}> = [];
    let depth = 0;
    let start = -1;
    let match: RegExpExecArray | null;
    while ((match = tagPattern.exec(container))) {
        const closing = match[0].startsWith("</");
        if (!closing) {
            if (depth === 0) start = match.index;
            depth += 1;
            continue;
        }
        depth -= 1;
        if (depth === 0 && start >= 0) {
            const sectionHtml = container.slice(start, tagPattern.lastIndex);
            const heading = sectionHtml.match(/<h[2-4]\b[^>]*>([\s\S]*?)<\/h[2-4]>/i);
            sections.push({
                title: stripTags(heading?.[1] || `Section ${sections.length + 1}`),
                paragraphs: [],
                html: sectionHtml
            });
            start = -1;
        }
    }
    if (!sections.length) {
        const heading = container.match(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/i);
        sections.push({
            title: stripTags(heading?.[1] || "Page content"),
            paragraphs: [],
            html: container
        });
    }
    return sections;
}

function extractArticleHeader(html: string) {
    return extractPrimaryContentContainer(html).match(/<header\b[^>]*>[\s\S]*?<\/header>/i)?.[0] ?? "";
}

async function loadPageSourceSections(request: NextRequest, slug: string) {
    try {
        const response = await fetch(new URL(`/${slug}?cmsSource=1`, request.nextUrl.origin), {
            headers: {"x-animaldex-cms-source": "1"},
            cache: "no-store"
        });
        if (!response.ok) return {headerHtml: "", sections: []};
        const html = await response.text();
        return {headerHtml: extractArticleHeader(html), sections: extractTopLevelSections(html)};
    } catch {
        return {headerHtml: "", sections: []};
    }
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    try {
        const type = request.nextUrl.searchParams.get("type") === "page" ? "page" : "blog";
        const slug = request.nextUrl.searchParams.get("slug")?.trim();

        if (slug) {
            const entry = await getContentEntry(type, slug);
            const compiled = type === "blog" ? blogPosts.find((post) => post.slug === slug) ?? null : getCompiledPage(slug);
            let content: unknown = entry?.payload ?? compiled;
            if (type === "page" && slug === "best-animal-identification-app" && entry?.payload && compiled) {
                const saved = entry.payload as typeof compiled;
                const compiledCustomSections = compiled.sections.filter((section) => section.html !== undefined);
                const hasQuickAnswer = saved.sections?.some((section) => section.html?.includes('id="quick-answer"'));
                if (!hasQuickAnswer) content = {...saved, sections: [...compiledCustomSections, ...(saved.sections ?? [])]};
            }
            if (type === "page" && compiled) {
                const current = content as BlogPost & {cmsSourceMigrated?: string};
                const migrationKey = `${SOURCE_MIGRATION_VERSION}:${slug}`;
                if (current.cmsSourceMigrated !== migrationKey) {
                    const source = await loadPageSourceSections(request, slug);
                    if (source.sections.length) {
                        content = {...current, headerHtml: source.headerHtml || current.headerHtml, sections: source.sections, cmsSourceMigrated: migrationKey};
                    }
                }
            }
            content = normalizeContent(content);
            return NextResponse.json({
                ok: true,
                entry: entry ? {...entry, payload: entry.payload} : null,
                content
            });
        }

        let entries: Awaited<ReturnType<typeof listContentEntries>> = [];
        try {
            entries = await listContentEntries(type);
        } catch (error) {
            const message = error instanceof Error ? error.message : "";
            if (!message.includes("admin_content_entries") && !message.includes("PGRST205") && !message.includes("404")) {
                throw error;
            }
        }
        return NextResponse.json({
            ok: true,
            entries,
            compiled: type === "blog" ? getCompiledBlogSummaries() : getCompiledPageSummaries()
        });
    } catch (error) {
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to load content"
        }, {status: 500});
    }
}

export async function PUT(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    try {
        const body = await request.json() as {
            type?: "blog" | "page";
            slug?: string;
            payload?: unknown;
            isPublished?: boolean;
        };
        const type = body.type === "page" ? "page" : "blog";
        const slug = body.slug?.trim().toLowerCase();

        if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !body.payload) {
            return NextResponse.json({ok: false, error: "A valid slug and content are required"}, {status: 400});
        }

        const entry = await saveContentEntry(type, slug, normalizeContent(body.payload), body.isPublished !== false);
        return NextResponse.json({ok: true, entry});
    } catch (error) {
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to save content"
        }, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
