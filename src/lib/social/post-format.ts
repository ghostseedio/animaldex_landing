import {formatOfPost, type FormatKey} from "@/lib/social-lab/format-board";
import type {SocialPostOptions} from "@/lib/social/types";

// The format lab key a share row carries in options.format, pure. Stamped when
// the row is queued (the admin share dialog and the auto-share), so the format
// board (src/lib/social-lab/format-board*.ts) separates a real clip someone
// filmed and uploaded (`real_footage`) from the generated videos even when the
// row is read on its own. A page video is stamped from its plan where known;
// the board still falls back to the media kind and page family for older rows
// without a stamp.

/** The key for uploaded real clips (FORMATS.real_footage). */
export const REAL_FOOTAGE_FORMAT: FormatKey = "real_footage";

/** The format to stamp on a share of `mediaKind`, or null when nothing can be said yet. */
export function formatForShare(mediaKind: string, videoFormat: string | null = null, sourceType: string | null = null): FormatKey | null {
    return formatOfPost({mediaKind, videoFormat, sourceType});
}

/** `options` with the format stamped in (an existing stamp is kept); null options become {format} when a format is known. */
export function withShareFormat(options: SocialPostOptions | null, mediaKind: string, videoFormat: string | null = null, sourceType: string | null = null): SocialPostOptions | null {
    if (options?.format) return options;
    const format = formatForShare(mediaKind, videoFormat, sourceType);
    if (!format) return options;
    return {...(options ?? {}), format};
}
