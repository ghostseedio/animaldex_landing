import Link from "@/app/[locale]/_components/link";
import {getSupportArticleById, getSupportArticlePath} from "@/lib/support-articles";

export default function SupportArticleCard({
    articleId,
    readLabel = "Read article"
}: {
    articleId: string;
    readLabel?: string;
}) {
    const article = getSupportArticleById(articleId);
    if (!article) {
        return (
            <div className="rounded-2xl border border-white/10 bg-[#101010] px-4 py-3 text-sm text-white/60">
                Help article unavailable
            </div>
        );
    }

    return (
        <Link
            href={getSupportArticlePath(article)}
            className="block overflow-hidden rounded-2xl border border-primary-200/20 bg-[#071B0F] p-4 transition-colors hover:border-primary-200/40 hover:bg-[#0A2112]"
        >
            <p className="text-[0.62rem] font-black uppercase tracking-[0.24em] text-primary-200">Help article</p>
            <p className="mt-2 font-display text-lg font-bold leading-snug text-white">{article.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-300">{article.summary}</p>
            <p className="mt-3 font-display text-xs font-bold uppercase tracking-[0.16em] text-primary-200">{readLabel} →</p>
        </Link>
    );
}
