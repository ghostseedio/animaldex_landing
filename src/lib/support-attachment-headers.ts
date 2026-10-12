/**
 * Anyone can email support, so an attachment is attacker-controlled bytes
 * served from this origin to a signed-in operator. Only raster images may
 * render inline; everything else (HTML, SVG, PDF, scripts, unknown types) is
 * a download with a declared type the browser will not reinterpret, and the
 * sandbox policy keeps even an inline file from running script here.
 */
const INLINE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

export function attachmentResponseHeaders(upstreamType: string | null, upstreamDisposition: string | null) {
    const mediaType = (upstreamType ?? "").split(";")[0].trim().toLowerCase();
    const inline = INLINE_TYPES.has(mediaType);
    const filename = (upstreamDisposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)?.[1] ?? "attachment")
        .replace(/[^\w.\-]+/g, "_")
        .slice(0, 120);

    return {
        "Content-Type": inline ? mediaType : "application/octet-stream",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
        "Content-Security-Policy": "sandbox; default-src 'none'",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store"
    };
}
