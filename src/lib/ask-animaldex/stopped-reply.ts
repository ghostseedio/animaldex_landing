/**
 * What stays of a reply whose stream was stopped before it finished.
 *
 * Stopping is a reader action, not a failure: what they already saw is
 * theirs to keep. Stop keeps exactly the words on screen (`kept`). Leaving
 * the chat while the reply is arriving (closing the drawer, opening another
 * animal) keeps what had arrived, as the hello already does: a reply that
 * stops mid-sentence is still an answer to the question that was asked, and
 * the question would otherwise stand alone, answered and charged for but
 * showing nothing. With nothing received, the placeholder goes and the
 * question stays, ready to be sent again.
 */
export function askStoppedReplyText(params: {
    /** The words on screen when Stop was pressed; null when the stop was not the button. */
    kept: string | null;
    /** The chat is going away (unmounting) rather than being stopped by its reader. */
    closing: boolean;
    /** Everything received for the reply so far, with any trailing follow-up block removed. */
    received: string;
}): string | null {
    if (params.kept?.trim()) return params.kept;
    if (params.closing && params.received.trim()) return params.received;
    return null;
}
