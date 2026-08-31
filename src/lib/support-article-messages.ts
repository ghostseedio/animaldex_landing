const ARTICLE_TOKEN_PATTERN = /\[\[adex-article:([a-z0-9-]+\/[a-z0-9-]+)\]\]/gi;

export function encodeSupportArticleAttachment(articleId: string) {
    return `[[adex-article:${articleId}]]`;
}

export function parseSupportArticleMessage(body: string) {
    const articleIds: string[] = [];
    let match: RegExpExecArray | null;
    const pattern = new RegExp(ARTICLE_TOKEN_PATTERN.source, "gi");

    while ((match = pattern.exec(body)) !== null) {
        const articleId = match[1]?.trim();
        if (articleId && !articleIds.includes(articleId)) articleIds.push(articleId);
    }

    const cleanBody = body.replace(pattern, "").replace(/\n{3,}/g, "\n\n").trim();
    return {articleIds, cleanBody};
}

export function buildSupportArticleMessage(articleId: string, message?: string) {
    const token = encodeSupportArticleAttachment(articleId);
    const trimmed = message?.trim();
    return trimmed ? `${token}\n\n${trimmed}` : token;
}
