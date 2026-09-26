import Header from "@/app/[locale]/(composited)/_components/header";
import Footer from "@/app/[locale]/(composited)/_components/footer";
import React from "react";
import AdminEditShortcut from "@/app/[locale]/(composited)/_components/admin-edit-shortcut";
import ContentViewBeacon from "@/app/[locale]/(composited)/_components/content-view-beacon";
import {HeaderAuthProvider} from "@/app/[locale]/(composited)/_components/header-auth-provider";
import {answerPages} from "@/data/answer-pages";
import {getCompiledPageSummaries} from "@/lib/admin-content";
import {getScopedTranslator} from "@/loaders/translation";

export const revalidate = false;

export default async function CompositedLayout(
    {children, params}: { children: React.ReactNode; params: {locale: string} },
) {
    const t = await getScopedTranslator(params.locale, "nav");
    // Local compiled data, so naming the countable page routes costs nothing.
    const pageSlugs = getCompiledPageSummaries().map((page) => page.slug);

    return (
        <HeaderAuthProvider>
            <Header locale={params.locale} t={t} />
            <main className="min-h-screen w-full">
                {children}
            </main>
            <Footer t={t} />
            <AdminEditShortcut editablePageSlugs={answerPages.map((page) => page.slug)} />
            <ContentViewBeacon pageSlugs={pageSlugs} />
        </HeaderAuthProvider>
    )
}
