import {parseSupportArticleMessage} from "@/lib/support-article-messages";
import SupportArticleCard from "@/app/[locale]/(composited)/support/_components/support-article-card";

export default function SupportMessageBody({
    body,
    readLabel = "Read article"
}: {
    body: string;
    readLabel?: string;
}) {
    const {articleIds, cleanBody} = parseSupportArticleMessage(body);

    return (
        <div className="space-y-3">
            {articleIds.map((articleId) => (
                <SupportArticleCard key={articleId} articleId={articleId} readLabel={readLabel} />
            ))}
            {cleanBody ? <p className="whitespace-pre-wrap text-sm leading-6 text-inherit">{cleanBody}</p> : null}
        </div>
    );
}
