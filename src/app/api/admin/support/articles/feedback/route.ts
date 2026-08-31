import {NextRequest, NextResponse} from "next/server";
import {listSupportArticleFeedbackStats} from "@/lib/support-article-feedback";
import {getSupportArticleById} from "@/lib/support-articles";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    const articleId = request.nextUrl.searchParams.get("articleId")?.trim() || undefined;
    const stats = await listSupportArticleFeedbackStats(articleId);

    const enriched = stats.map((entry) => {
        const article = getSupportArticleById(entry.articleId);
        return {
            ...entry,
            title: article?.title ?? entry.articleId,
            categoryTitle: article?.categoryTitle ?? null,
            href: article ? `/support/${article.categorySlug}/${article.slug}` : null
        };
    });

    return NextResponse.json({ok: true, stats: enriched});
}
