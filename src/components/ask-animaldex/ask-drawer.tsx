"use client";

/**
 * The conversation as the drawer: a docked panel on desktop, a bottom sheet
 * on mobile, over whatever page the reader is on. The conversation itself
 * (its thread, special messages, composer and streaming) is
 * `AskConversation`, which the full-screen Talk page renders too
 * (docs/rich-chat/SPEC.md, section 4.2); this is only its presentation.
 */

import AskConversation, {type AskDrawerLabels} from "@/components/ask-animaldex/ask-conversation";

export type {AskDrawerLabels};

export default function AskDrawer({labels}: {labels: AskDrawerLabels}) {
    return <AskConversation labels={labels} presentation="drawer" />;
}
