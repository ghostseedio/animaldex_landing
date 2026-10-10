import "server-only";
import type {BlogPost} from "@/data/blog/types";
import {getContentEntry, saveContentEntry} from "@/lib/admin-content";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";

// Edit history for generator edits, kept as JSON files in a private bucket:
// - "backup": the post as it was before an edit was applied (for undo). A
//   backup with no payload means the live post came from code with no Content
//   Studio row, and undo just switches the override off again.
// - "proposed": an edit that was not applied (checks failed, or the editor
//   asked to review first), ready to apply later.

const BUCKET = "blog-revisions";

export type RevisionFile = {
    slug: string;
    kind: "backup" | "proposed";
    savedAt: string;
    payload: BlogPost | null;
    /** For backups: whether the Content Studio row was published. */
    wasPublished?: boolean;
    title: string;
    changeSummary?: string[];
};

function storage() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase storage is not configured");
    return {url, key};
}

function assertSlug(slug: string) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`Invalid slug: ${slug}`);
}

async function put(path: string, body: RevisionFile) {
    const {url, key} = storage();
    const upload = () => fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
        method: "POST",
        headers: getSupabaseHeaders(key, {"Content-Type": "application/json", "x-upsert": "true"}),
        body: JSON.stringify(body)
    });
    let response = await upload();
    if (!response.ok && /bucket/i.test(await response.clone().text())) {
        await fetch(`${url}/storage/v1/bucket`, {
            method: "POST",
            headers: getSupabaseHeaders(key, {"Content-Type": "application/json"}),
            body: JSON.stringify({id: BUCKET, name: BUCKET, public: false})
        });
        response = await upload();
    }
    if (!response.ok) throw new Error(`Saving the revision failed (${response.status}): ${await response.text()}`);
    return path;
}

export async function saveRevision(file: RevisionFile) {
    assertSlug(file.slug);
    return put(`${file.slug}/${file.savedAt.replace(/[:.]/g, "-")}-${file.kind}.json`, file);
}

export async function listRevisions(slug: string) {
    assertSlug(slug);
    const {url, key} = storage();
    const response = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
        method: "POST",
        headers: getSupabaseHeaders(key, {"Content-Type": "application/json"}),
        body: JSON.stringify({prefix: `${slug}/`, limit: 100, sortBy: {column: "name", order: "desc"}})
    });
    if (!response.ok) return [];
    const items = await response.json() as Array<{name: string}>;
    return items
        .filter((item) => item.name.endsWith(".json"))
        .map((item) => ({path: `${slug}/${item.name}`, kind: item.name.includes("-proposed") ? "proposed" as const : "backup" as const, savedAt: item.name.slice(0, 24)}));
}

async function read(path: string): Promise<RevisionFile> {
    if (!/^[a-z0-9-]+\/[\w-]+\.json$/.test(path)) throw new Error("Invalid revision path");
    const {url, key} = storage();
    // Cache-busting: the storage CDN can serve a stale copy of an authenticated read.
    const response = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}?v=${Date.now()}`, {headers: getSupabaseHeaders(key), cache: "no-store"});
    if (!response.ok) throw new Error(`Revision not found (${response.status})`);
    return await response.json() as RevisionFile;
}

/**
 * Applies a revision: a proposed edit goes live; a backup puts the post back
 * as it was. Either way, the version it replaces is backed up first, so this
 * can itself be undone.
 */
export async function applyRevision(path: string) {
    const revision = await read(path);
    if (!path.startsWith(`${revision.slug}/`)) throw new Error("Revision does not match its post");
    const current = await getContentEntry("blog", revision.slug);
    const savedAt = new Date().toISOString();
    await saveRevision({
        slug: revision.slug,
        kind: "backup",
        savedAt,
        payload: current ? current.payload as BlogPost : null,
        wasPublished: current?.is_published ?? false,
        title: (current?.payload as BlogPost | undefined)?.title ?? revision.title
    });

    if (revision.payload) {
        await saveContentEntry("blog", revision.slug, revision.payload, revision.kind === "backup" ? revision.wasPublished !== false : true);
    } else if (current) {
        // The post lives in code: switch the override off so the code version shows again.
        await saveContentEntry("blog", revision.slug, current.payload, false);
    }
    return {slug: revision.slug, applied: revision.kind};
}
