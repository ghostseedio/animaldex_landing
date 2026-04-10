import '@/app/[locale]/_assets/globals.css'
import React, {ReactNode} from "react";
import localFont from "next/font/local";
import {useLocale} from 'next-intl';
import {notFound} from "next/navigation";
import {getLocale, getTranslations} from "next-intl/server";
import {localeConfig} from "@/i18n";
import {Metadata} from "next";
import Cursor from "@/app/[locale]/_components/cursor";
import {loadLocaleMessages} from "@/loaders/locale";
import {getLocalePath, getMetadataLocale, getSiteUrl} from "@/lib/site";

const calSans = localFont({
    src: '_assets/fonts/CalSans-SemiBold.woff2',
    variable: '--font-cal-sans',
    display: "swap"
})
const onest = localFont({
    src: [
        {
            path: '_assets/fonts/Onest-Regular.woff',
            weight: '400',
        },
        {
            path: '_assets/fonts/Onest-Medium.woff',
            weight: '500',
        },
        {
            path: '_assets/fonts/Onest-Bold.woff',
            weight: '700'
        }
    ],
    variable: '--font-onest',
    display: "swap"
})

type RootLayoutProps = {
    children: ReactNode;
    params: { locale: string };
};

export default function RootLayout(
    {children, params: {locale: reqLocale}}: RootLayoutProps
) {
    const locale = useLocale();
    if (reqLocale !== locale) notFound();

    // noinspection HtmlRequiredTitleElement
    return (
        <html lang={locale} className="scroll-smooth selection:bg-primary-200 selection:text-canvas-950">
        <head/>
        <body className={`${onest.variable} ${calSans.variable} font-sans overscroll-none`} style={{
            '--font-sans': 'var(--font-onest)',
            '--font-display': 'var(--font-cal-sans)',
        } as any}>
            <Cursor />
            {children}
        </body>
        </html>
    )
}

export async function generateMetadata(): Promise<Metadata> {
    const locale = await getLocale();
    const t = await getTranslations('meta');
    const messages = await loadLocaleMessages(locale);
    const keywords = Array.isArray(messages.meta?.keywords) ? messages.meta.keywords : [];
    const canonicalPath = getLocalePath(locale);

    return {
        metadataBase: new URL(getSiteUrl()),
        title: {
            default: t('fullTitle'),
            template: "%s | " + t('title')
        },
        description: t('description'),
        keywords,
        generator: "Next.js",
        colorScheme: "dark",
        themeColor: "#1BC451",
        category: "education",
        applicationName: t('title'),
        robots: {
            index: true,
            follow: true,
            googleBot: {
                index: true,
                follow: true,
                "max-image-preview": "large",
                "max-snippet": -1,
                "max-video-preview": -1
            }
        },
        formatDetection: {
            telephone: false,
            email: false,
            address: false
        },
        icons: {
            icon: '/favicon.svg',
            shortcut: '/favicon.svg',
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            title: t('fullTitle'),
            description: t('description'),
            siteName: t('title'),
            url: canonicalPath,
            images: [
                {
                    url: "/images/og-animaldex.svg",
                    width: 1200,
                    height: 630,
                    alt: t('fullTitle')
                }
            ],
        },
        twitter: {
            card: "summary_large_image",
            title: t('fullTitle'),
            description: t('description'),
            images: ["/images/og-animaldex.svg"],
        },
        alternates: {
            canonical: canonicalPath,
            languages: localeConfig.locales.reduce((acc, locale) => {
                acc[locale] = "/" + locale;
                return acc;
            }, {
                "x-default": "/" + localeConfig.defaultLocale
            } as Record<string, string>)
        }
    };
}
