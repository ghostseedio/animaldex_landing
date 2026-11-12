import "server-only";
import type {MetadataRoute} from "next";
import {buildSitemapEntries} from "@/lib/build-sitemap";

/**
 * One build of every sitemap URL per process per hour, shared by the index
 * (/sitemap.xml) and its section sitemaps (/sitemaps/<section>.xml), so a
 * crawler fetching all of them builds the list once.
 */
const TTL_MS = 3_600_000;
let memo: {at: number; promise: Promise<MetadataRoute.Sitemap>} | null = null;

export function cachedSitemapEntries(): Promise<MetadataRoute.Sitemap> {
    const now = Date.now();
    if (memo && now - memo.at < TTL_MS) return memo.promise;
    const promise = buildSitemapEntries().catch((error) => {
        memo = null;
        throw error;
    });
    memo = {at: now, promise};
    return promise;
}
