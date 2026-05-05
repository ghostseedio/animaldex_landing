import '@/app/[locale]/_assets/globals.css'
import React, {ReactNode} from "react";
import localFont from "next/font/local";
import {notFound} from "next/navigation";
import {localeConfig} from "@/i18n";
import {Metadata} from "next";
import Cursor from "@/app/[locale]/_components/cursor";
import {loadLocaleMessages} from "@/loaders/locale";
import {getLocalePath, getMetadataLocale, getSiteUrl} from "@/lib/site";

const appStoreUrl = "https://apps.apple.com/app/6761607780";
const brandIconUrl = "/images/logo.webp";
const socialImageUrl = "/images/og.png";

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
    if (!localeConfig.locales.includes(reqLocale)) {
        notFound();
    }

    const locale = reqLocale;

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

export async function generateMetadata({params: {locale: reqLocale}}: RootLayoutProps): Promise<Metadata> {
    const locale = localeConfig.locales.includes(reqLocale) ? reqLocale : localeConfig.defaultLocale;
    const messages = await loadLocaleMessages(locale);
    const meta = (messages.meta || {}) as Record<string, unknown>;
    const fullTitle = typeof meta.fullTitle === "string" ? meta.fullTitle : "AnimalDex";
    const title = typeof meta.title === "string" ? meta.title : "AnimalDex";
    const description = typeof meta.description === "string" ? meta.description : fullTitle;
    const keywords = Array.isArray(meta.keywords) ? meta.keywords : [];
    const canonicalPath = getLocalePath(locale);

    return {
        metadataBase: new URL(getSiteUrl()),
        title: {
            default: fullTitle,
            template: `%s | ${title}`
        },
        description,
        keywords,
        generator: "Next.js",
        colorScheme: "dark",
        themeColor: "#1BC451",
        category: "education",
        applicationName: title,
        appLinks: {
            ios: {
                url: appStoreUrl,
                app_store_id: "6761607780",
                app_name: "AnimalDex"
            }
        },
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
            icon: [
                {url: '/favicon.ico'},
                {url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png'},
                {url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png'}
            ],
            shortcut: '/favicon.ico',
            apple: '/apple-touch-icon.png',
            other: [
                {
                    rel: "icon",
                    url: brandIconUrl,
                    type: "image/webp"
                }
            ]
        },
        manifest: "/site.webmanifest",
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            title: fullTitle,
            description,
            siteName: title,
            url: canonicalPath,
            images: [
                {
                    url: socialImageUrl,
                    width: 1200,
                    height: 630,
                    alt: fullTitle
                }
            ],
        },
        twitter: {
            card: "summary_large_image",
            title: fullTitle,
            description,
            images: [socialImageUrl],
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
