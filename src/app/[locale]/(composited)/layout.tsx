import Header from "@/app/[locale]/(composited)/_components/header";
import Footer from "@/app/[locale]/(composited)/_components/footer";
import React from "react";
import AdminEditShortcut from "@/app/[locale]/(composited)/_components/admin-edit-shortcut";
import {HeaderAuthProvider} from "@/app/[locale]/(composited)/_components/header-auth-provider";
import {answerPages} from "@/data/answer-pages";

export default function CompositedLayout(
    {children, params}: { children: React.ReactNode; params: {locale: string} },
) {

    return (
        <HeaderAuthProvider>
            <Header locale={params.locale} />
            <main className="min-h-screen w-full">
                {children}
            </main>
            <Footer />
            <AdminEditShortcut editablePageSlugs={answerPages.map((page) => page.slug)} />
        </HeaderAuthProvider>
    )
}
