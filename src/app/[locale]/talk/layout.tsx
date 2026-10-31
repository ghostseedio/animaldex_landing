import React from "react";
import {HeaderAuthProvider} from "@/app/[locale]/(composited)/_components/header-auth-provider";
import {loadLocaleMessages} from "@/loaders/locale";
import {talkWords} from "@/lib/ask-animaldex/talk";
import TalkShell from "@/app/[locale]/talk/talk-shell";

/**
 * Talk on the web (docs/rich-chat/SPEC.md, section 4): a full-screen chat
 * like an LLM app's, with no site header or footer. The sidebar (New chat,
 * Your animals, Recent chats) stays put while the reader moves between the
 * picker (/talk) and an animal's chat (/talk/<slug>).
 */
export default async function TalkLayout({children, params}: {children: React.ReactNode; params: {locale: string}}) {
    const messages = await loadLocaleMessages(params.locale).catch(() => null);
    const words = talkWords(messages?.talkPage);
    return (
        <HeaderAuthProvider>
            <TalkShell locale={params.locale} words={words}>
                {children}
            </TalkShell>
        </HeaderAuthProvider>
    );
}
