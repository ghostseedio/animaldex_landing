import Header from "@/app/[locale]/(composited)/_components/header";
import Footer from "@/app/[locale]/(composited)/_components/footer";
import React from "react";
import AdminEditShortcut from "@/app/[locale]/(composited)/_components/admin-edit-shortcut";
import {HeaderAuthProvider} from "@/app/[locale]/(composited)/_components/header-auth-provider";
import {answerPages} from "@/data/answer-pages";
import {getScopedTranslator} from "@/loaders/translation";

export const revalidate = 3600;

export default async function CompositedLayout(
    {children, params}: { children: React.ReactNode; params: {locale: string} },
) {
    const t = await getScopedTranslator(params.locale, "nav");

    return (
        <HeaderAuthProvider>
            <Header locale={params.locale} t={t} />
            <main className="min-h-screen w-full">
                {children}
            </main>
            <Footer t={t} />
            <AdminEditShortcut editablePageSlugs={answerPages.map((page) => page.slug)} />
        </HeaderAuthProvider>
    )
}
