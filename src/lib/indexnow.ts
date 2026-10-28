import {getSiteUrl} from "@/lib/site";

// IndexNow (https://www.indexnow.org): tells Bing, Yandex, Seznam and others
// the moment a page is new or changed, instead of waiting for a crawl. Bing
// was the fastest-growing search source in Oct 2026 (+137% sessions). The key
// is public by design; its file is public/7c17c43006b7fa980251ffeaff208f33.txt.

export const INDEXNOW_KEY = "7c17c43006b7fa980251ffeaff208f33";

/** Submits absolute or site-relative URLs; never throws (a missed ping only means a later crawl). */
export async function submitIndexNow(urls: string[]) {
    if (process.env.INDEXNOW_DISABLED?.trim() === "1" || !urls.length) return false;
    const site = getSiteUrl();
    const host = new URL(site).host;
    if (/localhost|127\.0\.0\.1/.test(host)) return false;
    const urlList = Array.from(new Set(urls.map((url) => new URL(url, site).toString()))).slice(0, 10_000);
    try {
        const response = await fetch("https://api.indexnow.org/indexnow", {
            method: "POST",
            headers: {"Content-Type": "application/json; charset=utf-8"},
            body: JSON.stringify({host, key: INDEXNOW_KEY, keyLocation: `${site.replace(/\/$/, "")}/${INDEXNOW_KEY}.txt`, urlList}),
            signal: AbortSignal.timeout(15_000)
        });
        if (!response.ok && response.status !== 202) console.warn(`[indexnow] ${response.status} for ${urlList.length} URL(s)`);
        return response.ok;
    } catch (error) {
        console.warn("[indexnow] ping failed", error instanceof Error ? error.message : error);
        return false;
    }
}
