export type FacebookPage = {id: string; name?: string; access_token: string; tasks?: string[]};

/** The configured Page, else the one named AnimalDex, else the only one; must be able to post. */
export function pickFacebookPage(pages: FacebookPage[], preferredId: string | null): FacebookPage | null {
    const canPost = pages.filter((page) => page.access_token && (!page.tasks || page.tasks.includes("CREATE_CONTENT")));
    return canPost.find((page) => page.id === preferredId)
        ?? canPost.find((page) => /animal\s?dex/i.test(page.name ?? ""))
        ?? (canPost.length === 1 ? canPost[0] : null);
}

/** What Facebook handed back, for the error shown when no Page can be picked. */
export function describeFacebookPages(pages: FacebookPage[], directLookup: string | null): string {
    const listed = pages.length
        ? pages.map((page) => `${page.name ?? page.id} (${page.id}${page.access_token && (!page.tasks || page.tasks.includes("CREATE_CONTENT")) ? "" : ", no posting access"})`).join(", ")
        : "none";
    return `Facebook shared these Pages: ${listed}.${directLookup ? ` Direct lookup of the configured Page: ${directLookup}.` : ""}`;
}
