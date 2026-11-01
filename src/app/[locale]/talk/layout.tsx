import React from "react";
import {HeaderAuthProvider} from "@/app/[locale]/(composited)/_components/header-auth-provider";
import {loadLocaleMessages} from "@/loaders/locale";
import {talkWords} from "@/lib/ask-animaldex/talk";
import TalkShell from "@/app/[locale]/talk/talk-shell";
import {getTalkPickerRows} from "@/data/talk-animals";
import {getSupabaseUrl} from "@/lib/supabase-http";

/**
 * Talk on the web (docs/rich-chat/SPEC.md, section 4): a full-screen chat
 * like an LLM app's, with no site header or footer. The sidebar (New chat,
 * Your animals, Recent chats) stays put while the reader moves between the
 * picker (/talk) and an animal's chat (/talk/<slug>).
 */
export default async function TalkLayout({children, params}: {children: React.ReactNode; params: {locale: string}}) {
    const [messages, rows] = await Promise.all([
        loadLocaleMessages(params.locale).catch(() => null),
        getTalkPickerRows().catch(() => ({popular: [], disagree: []}))
    ]);
    const words = talkWords(messages?.talkPage);
    // The animals' faces come from storage: the connection opens with the page, not with the first face (WEB-18).
    const storage = (() => {
        try {
            return new URL(getSupabaseUrl() ?? "").origin;
        } catch {
            return null;
        }
    })();
    return (
        <HeaderAuthProvider>
            {storage ? <link rel="preconnect" href={storage} /> : null}
            <TalkShell locale={params.locale} words={words} starters={rows.popular.slice(0, 3)}>
                {children}
            </TalkShell>
        </HeaderAuthProvider>
    );
}
