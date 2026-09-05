import {remark} from "remark";
import html from "remark-html";
import policy from "@/data/refund-policy.md";
import logo from "@/app/[locale]/_assets/logos/logo.svg";
import Image from "next/image";
import {Metadata} from "next";
import {getLocalePath, getMetadataLocale} from "@/lib/site";
import {localeConfig} from "@/i18n";
import {DatabaseIcon, ShieldUserIcon} from "@/app/[locale]/_components/icons";
import {loadLocaleMessages} from "@/loaders/locale";
import {getScopedTranslator} from "@/loaders/translation";

export const revalidate = 3600;

export function generateStaticParams() {
    return [{locale: "en"}, {locale: "id"}];
}

export default async function RefundPolicy() {
    const processedContent = await remark().use(html).process(policy);

    return (
        <div className="mx-auto my-16 w-full max-w-3xl px-4 text-center text-ink-200">
            <aside className="mb-8 flex items-center justify-center gap-4 text-primary-500">
                <Image src={logo} alt="AnimalDex logo" width={64} height={64} />
                <ShieldUserIcon size={64} />
                <DatabaseIcon size={64} />
            </aside>
            <div
                className="prose prose-invert rounded-4xl border border-line-300 bg-surface-900/80 px-6 py-8 prose-headings:font-display prose-headings:font-bold prose-headings:text-white prose-a:text-primary-200 prose-a:underline prose-strong:text-white prose-li:text-left marker:text-ink-200 backdrop-blur"
                dangerouslySetInnerHTML={{__html: processedContent.toString()}}
            />
        </div>
    );
}

export async function generateMetadata({params}: {params: {locale: string}}): Promise<Metadata> {
    const locale = params.locale;
    const t = await getScopedTranslator(locale, "meta");
    const messages = await loadLocaleMessages(locale);
    const keywords = Array.isArray(messages.meta?.keywords) ? messages.meta.keywords : [];
    const title = t("refundTitle");
    const description = t("refundDescription");

    return {
        title,
        description,
        keywords,
        alternates: {
            canonical: getLocalePath(locale, "/legal/refunds"),
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = getLocalePath(localeItem, "/legal/refunds");
                return acc;
            }, {"x-default": getLocalePath(localeConfig.defaultLocale, "/legal/refunds")} as Record<string, string>)
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            title: `${title} | AnimalDex`,
            description,
            url: getLocalePath(locale, "/legal/refunds"),
            images: [{url: "/images/og.png", width: 1200, height: 630, alt: `${title} | AnimalDex`}]
        },
        twitter: {
            card: "summary_large_image",
            title: `${title} | AnimalDex`,
            description,
            images: ["/images/og.png"]
        },
        robots: {index: true, follow: true}
    };
}
