import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseHeaders,
  getSupabaseServiceKey,
  getSupabaseUrl,
} from "@/lib/supabase-http";
import { isSupportAdminRequestAuthorized } from "@/lib/support-admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: NextRequest) {
  if (!(await isSupportAdminRequestAuthorized(request))) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const form = await request.formData();
    const campaignId = String(form.get("campaignId") ?? "").trim();
    const altText = String(form.get("altText") ?? "").trim();
    const file = form.get("file");
    if (!/^[0-9a-f-]{36}$/i.test(campaignId)) {
      return NextResponse.json(
        { ok: false, error: "A valid campaign is required" },
        { status: 400 },
      );
    }
    if (!altText) {
      return NextResponse.json(
        { ok: false, error: "Image alt text is required" },
        { status: 400 },
      );
    }
    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Choose an image" },
        { status: 400 },
      );
    }
    const extension = ALLOWED_TYPES.get(file.type);
    if (!extension || file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Use a JPG, PNG, or WebP image up to 8 MB" },
        { status: 400 },
      );
    }

    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase access is not configured");
    const storagePath = `${campaignId}/primary-${Date.now()}.${extension}`;
    const upload = await fetch(
      `${url}/storage/v1/object/sponsored-challenges/${storagePath}`,
      {
        method: "POST",
        headers: getSupabaseHeaders(key, {
          "Content-Type": file.type,
          "cache-control": "3600",
          "x-upsert": "false",
        }),
        body: await file.arrayBuffer(),
        cache: "no-store",
      },
    );
    if (!upload.ok) throw new Error(`Image upload failed (${upload.status})`);

    const metadata = await fetch(
      `${url}/rest/v1/rpc/admin_set_sponsored_campaign_thumbnail`,
      {
        method: "POST",
        headers: getSupabaseHeaders(key, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          p_campaign_id: campaignId,
          p_storage_path: storagePath,
          p_alt_text: altText,
        }),
        cache: "no-store",
      },
    );
    if (!metadata.ok)
      throw new Error(`Image metadata update failed (${metadata.status})`);

    return NextResponse.json({
      ok: true,
      thumbnail: {
        storagePath,
        publicUrl: `${url}/storage/v1/object/public/sponsored-challenges/${storagePath}`,
        altText,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Unable to upload image",
      },
      { status: 400 },
    );
  }
}
