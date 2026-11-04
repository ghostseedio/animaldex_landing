import {remark} from "remark";
import html from "remark-html";
import policy from "@/data/ai-and-safety.md";
import {Metadata} from "next";
import {getLocalePath, getMetadataLocale} from "@/lib/site";
import {localeConfig} from "@/i18n";
import {withOgCard} from "@/lib/og/og-image";

export const revalidate = 86400;

export function generateStaticParams() {
    return [{locale: "en"}, {locale: "id"}];
}

const title = "AnimalDex AI and Safety";
const description = "The animals on AnimalDex are AI. How conversations work, what happens to what you write, how we handle a crisis, and teen mode.";

/** /<locale>/legal/ai-and-safety: the same page as /legal/ai-and-safety, in the site's frame (the footer links here). */
export default async function AiAndSafety() {
    const contentHtml = (await remark().use(html).process(policy)).toString();
    return (
        <div className="mx-auto my-16 w-full max-w-3xl px-4 text-ink-200">
            <div
                className="prose prose-invert light:prose-stone prose-headings:font-bold prose-headings:font-display prose-headings:text-white
                prose-a:text-primary-200 prose-a:underline prose-strong:text-white marker:text-ink-200
                border border-line-300 bg-surface-900/80 px-6 py-8"
                dangerouslySetInnerHTML={{__html: contentHtml}}
            />
        </div>
    );
}

export async function generateMetadata({params}: {params: {locale: string}}): Promise<Metadata> {
    const locale = params.locale;
    return withOgCard({
        title,
        description,
        alternates: {
            canonical: getLocalePath(locale, "/legal/ai-and-safety"),
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = getLocalePath(localeItem, "/legal/ai-and-safety");
                return acc;
            }, {"x-default": getLocalePath(localeConfig.defaultLocale, "/legal/ai-and-safety")} as Record<string, string>)
        },
        openGraph: {type: "website", locale: getMetadataLocale(locale), title: `${title} | AnimalDex`, description, url: getLocalePath(locale, "/legal/ai-and-safety")},
        twitter: {card: "summary_large_image", title: `${title} | AnimalDex`, description},
        robots: {index: true, follow: true}
    }, title, "page", "legal", "ai-and-safety");
}
