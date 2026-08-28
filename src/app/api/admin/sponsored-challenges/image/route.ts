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

async function ensureArtworkBucket(url: string, key: string) {
  const response = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers: getSupabaseHeaders(key, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      id: "sponsored-challenges",
      name: "sponsored-challenges",
      public: true,
      file_size_limit: MAX_BYTES,
      allowed_mime_types: Array.from(ALLOWED_TYPES.keys()),
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const reason = (await response.text()).trim();
    if (response.status === 409 || reason.includes("BucketAlreadyExists")) return;
    throw new Error(
      `Artwork bucket setup failed (${response.status})${reason ? `: ${reason}` : ""}`,
    );
  }
}

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
    const sourceUrl = String(form.get("sourceUrl") ?? "").trim();
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
    if (!(file instanceof File) && !sourceUrl) {
      return NextResponse.json(
        { ok: false, error: "Choose an image or asset" },
        { status: 400 },
      );
    }
    let contentType: string;
    let imageBytes: ArrayBuffer;
    if (file instanceof File) {
      contentType = file.type;
      imageBytes = await file.arrayBuffer();
    } else {
      let assetUrl: URL;
      try {
        assetUrl = new URL(sourceUrl, request.nextUrl.origin);
      } catch {
        return NextResponse.json(
          { ok: false, error: "Invalid asset URL" },
          { status: 400 },
        );
      }
      const supabaseUrl = getSupabaseUrl();
      const allowedSupabaseAsset = supabaseUrl
        ? assetUrl.toString().startsWith(
            `${supabaseUrl}/storage/v1/object/public/admin-assets/blog/`,
          )
        : false;
      const allowedLocalAsset =
        assetUrl.origin === request.nextUrl.origin &&
        assetUrl.pathname.startsWith("/images/");
      if (!allowedSupabaseAsset && !allowedLocalAsset) {
        return NextResponse.json(
          { ok: false, error: "Asset must come from the AnimalDex asset library" },
          { status: 400 },
        );
      }
      const assetResponse = await fetch(assetUrl, { cache: "no-store" });
      if (!assetResponse.ok) {
        return NextResponse.json(
          { ok: false, error: "Unable to read the selected asset" },
          { status: 400 },
        );
      }
      contentType = assetResponse.headers.get("content-type")?.split(";")[0] ?? "";
      if (contentType === "application/octet-stream" || !contentType) {
        const extension = assetUrl.pathname.split(".").pop()?.toLowerCase();
        contentType =
          extension === "jpg" || extension === "jpeg"
            ? "image/jpeg"
            : extension === "png"
              ? "image/png"
              : extension === "webp"
                ? "image/webp"
                : contentType;
      }
      imageBytes = await assetResponse.arrayBuffer();
    }
    const extension = ALLOWED_TYPES.get(contentType);
    if (!extension || imageBytes.byteLength <= 0 || imageBytes.byteLength > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Use a JPG, PNG, or WebP image up to 8 MB" },
        { status: 400 },
      );
    }

    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase access is not configured");
    await ensureArtworkBucket(url, key);
    const storagePath = `${campaignId}/primary-${Date.now()}.${extension}`;
    const upload = await fetch(
      `${url}/storage/v1/object/sponsored-challenges/${storagePath}`,
      {
        method: "POST",
        headers: getSupabaseHeaders(key, {
          "Content-Type": contentType,
          "cache-control": "3600",
          "x-upsert": "false",
        }),
        body: imageBytes,
        cache: "no-store",
      },
    );
    if (!upload.ok) {
      const reason = (await upload.text()).trim();
      throw new Error(
        `Image upload failed (${upload.status})${reason ? `: ${reason}` : ""}`,
      );
    }

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
    if (!metadata.ok) {
      const reason = (await metadata.text()).trim();
      const missingFunction =
        metadata.status === 404 && reason.includes("PGRST202");
      if (!missingFunction) {
        throw new Error(
          `Image metadata update failed (${metadata.status})${reason ? `: ${reason}` : ""}`,
        );
      }

      const now = new Date().toISOString();
      const fallback = await fetch(
        `${url}/rest/v1/sponsored_campaigns?id=eq.${encodeURIComponent(campaignId)}`,
        {
          method: "PATCH",
          headers: getSupabaseHeaders(key, {
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          }),
          body: JSON.stringify({
            thumbnail_storage_path: storagePath,
            thumbnail_alt_text: altText.slice(0, 240),
            thumbnail_updated_at: now,
            updated_at: now,
          }),
          cache: "no-store",
        },
      );
      if (!fallback.ok) {
        const fallbackReason = (await fallback.text()).trim();
        throw new Error(
          `Image metadata update failed (${fallback.status})${fallbackReason ? `: ${fallbackReason}` : ""}`,
        );
      }
    }

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
