import {NextRequest, NextResponse} from "next/server";
import {getSupportArticleFeedbackStatsForArticle, recordSupportArticleFeedback} from "@/lib/support-article-feedback";
import {getSupportArticleById} from "@/lib/support-articles";

export async function GET(request: NextRequest) {
    const articleId = request.nextUrl.searchParams.get("articleId")?.trim();
    if (!articleId) {
        return NextResponse.json({ok: false, error: "articleId is required."}, {status: 400});
    }

    if (!getSupportArticleById(articleId)) {
        return NextResponse.json({ok: false, error: "Article not found."}, {status: 404});
    }

    const stats = await getSupportArticleFeedbackStatsForArticle(articleId);
    return NextResponse.json({ok: true, stats});
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as {articleId?: string; helpful?: boolean; source?: string};
        const articleId = body.articleId?.trim();
        const helpful = body.helpful;

        if (!articleId || typeof helpful !== "boolean") {
            return NextResponse.json({ok: false, error: "articleId and helpful are required."}, {status: 400});
        }

        if (!getSupportArticleById(articleId)) {
            return NextResponse.json({ok: false, error: "Article not found."}, {status: 404});
        }

        const {stats} = await recordSupportArticleFeedback({
            articleId,
            helpful,
            source: body.source?.trim() || "article-page"
        });

        return NextResponse.json({ok: true, stats});
    } catch (error) {
        return NextResponse.json(
            {ok: false, error: error instanceof Error ? error.message : "Feedback could not be saved."},
            {status: 500}
        );
    }
}
