import {timingSafeEqual} from "crypto";
import {NextRequest, NextResponse} from "next/server";
import {isClaudeConfigured} from "@/lib/blog-generator/claude-client";
import {createMaterialUploads, type MaterialRef} from "@/lib/blog-generator/materials";
import {listEditablePosts} from "@/lib/blog-generator/edit";
import {generateArticle, getJob, listJobs, startEditJob, startGenerateJob, startTopicsJob, type GenerateInput} from "@/lib/blog-generator/jobs";
import {applyRevision, listRevisions} from "@/lib/blog-generator/revisions";
import {isResearchDepth, type TopicIdea} from "@/lib/blog-generator/pipeline";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

// POST {action: "upload", files: [{name, size}]}   → signed URLs to upload reference files
// POST {action: "topics", mode, focus}            → starts topic discovery
// POST {action: "generate", mode, focus, idea, publish} → starts a generation
// POST {action: "edit", slug, instructions, research, publish} → starts an edit of a live post
// POST {action: "apply-revision", path}           → undo an edit, or apply a proposed one
// GET ?job=<id>                                     → polls one job; no id lists them
// GET ?posts=1 / ?revisions=<slug>                  → posts that can be edited / a post's edit history
//
// A scheduler can call POST with `Authorization: Bearer $BLOG_GENERATOR_CRON_SECRET`
// and `"wait": true` to run one generation to completion in the request.

function hasCronSecret(request: NextRequest) {
    const secret = process.env.BLOG_GENERATOR_CRON_SECRET?.trim();
    const header = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!secret || !header) return false;
    const left = Buffer.from(secret);
    const right = Buffer.from(header);
    return left.length === right.length && timingSafeEqual(left, right);
}

async function authorized(request: NextRequest) {
    return hasCronSecret(request) || await isSupportAdminRequestAuthorized(request);
}

export async function GET(request: NextRequest) {
    if (!(await authorized(request))) return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    try {
        if (request.nextUrl.searchParams.get("posts")) return NextResponse.json({ok: true, posts: await listEditablePosts()});
        const revisionsFor = request.nextUrl.searchParams.get("revisions");
        if (revisionsFor) return NextResponse.json({ok: true, revisions: await listRevisions(revisionsFor)});
    } catch (error) {
        return NextResponse.json({ok: false, error: error instanceof Error ? error.message : "Unable to load"}, {status: 500});
    }
    const id = request.nextUrl.searchParams.get("job");
    if (id) {
        const job = getJob(id);
        return job
            ? NextResponse.json({ok: true, job})
            : NextResponse.json({ok: false, error: "That job is gone (the server may have restarted). Start it again."}, {status: 404});
    }
    return NextResponse.json({ok: true, configured: isClaudeConfigured(), jobs: listJobs().map(({log, topics, ...job}) => ({...job, lastLog: log.at(-1) ?? null, topicCount: topics?.length ?? 0}))});
}

export async function POST(request: NextRequest) {
    if (!(await authorized(request))) return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    if (!isClaudeConfigured()) return NextResponse.json({ok: false, error: "CLAUDE_API_KEY is not set on the server"}, {status: 503});

    const body = await request.json().catch(() => ({})) as {
        action?: string;
        mode?: string;
        focus?: string;
        idea?: TopicIdea;
        publish?: boolean;
        wait?: boolean;
        files?: Array<{name?: unknown; size?: unknown}>;
        slug?: string;
        instructions?: string;
        research?: boolean;
        path?: string;
        depth?: string;
        materials?: Array<{path?: unknown; name?: unknown; size?: unknown}>;
    };
    const mode = body.mode === "catalog" || body.mode === "custom" ? body.mode : "news";
    const focus = typeof body.focus === "string" ? body.focus.slice(0, 600) : "";
    const depth = isResearchDepth(body.depth) ? body.depth : "light";

    if (body.action === "upload") {
        try {
            const files = (body.files ?? []).map((file) => ({name: String(file.name ?? ""), size: Number(file.size) || 0}));
            return NextResponse.json({ok: true, uploads: await createMaterialUploads(files)});
        } catch (error) {
            return NextResponse.json({ok: false, error: error instanceof Error ? error.message : "Upload setup failed"}, {status: 400});
        }
    }

    if (body.action === "edit") {
        const slug = typeof body.slug === "string" ? body.slug.trim() : "";
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return NextResponse.json({ok: false, error: "Pick a post to edit"}, {status: 400});
        return NextResponse.json({ok: true, job: startEditJob({
            slug,
            instructions: typeof body.instructions === "string" ? body.instructions.slice(0, 4000) : "",
            research: body.research !== false,
            depth,
            publish: body.publish !== false
        })});
    }

    if (body.action === "apply-revision") {
        try {
            return NextResponse.json({ok: true, ...await applyRevision(String(body.path ?? ""))});
        } catch (error) {
            return NextResponse.json({ok: false, error: error instanceof Error ? error.message : "Could not apply that version"}, {status: 400});
        }
    }

    if (body.action === "topics") {
        if (mode === "custom") return NextResponse.json({ok: false, error: "Custom topics skip discovery"}, {status: 400});
        return NextResponse.json({ok: true, job: startTopicsJob(mode, focus)});
    }

    if (body.action === "generate") {
        const materials: MaterialRef[] = (body.materials ?? [])
            .filter((ref) => typeof ref.path === "string" && typeof ref.name === "string")
            .map((ref) => ({path: ref.path as string, name: ref.name as string, size: Number(ref.size) || 0}));
        if (mode === "custom" && !focus.trim() && !materials.length) return NextResponse.json({ok: false, error: "Describe the article you want or attach reference material"}, {status: 400});
        const input: GenerateInput = {mode, focus, idea: body.idea && typeof body.idea.title === "string" ? body.idea : undefined, publish: body.publish !== false, materials, depth};
        if (body.wait && hasCronSecret(request)) {
            const log: string[] = [];
            try {
                const result = await generateArticle(input, (line) => log.push(line));
                return NextResponse.json({ok: true, result, log});
            } catch (error) {
                return NextResponse.json({ok: false, error: error instanceof Error ? error.message : "Generation failed", log}, {status: 500});
            }
        }
        return NextResponse.json({ok: true, job: startGenerateJob(input)});
    }

    return NextResponse.json({ok: false, error: "Unknown action"}, {status: 400});
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
