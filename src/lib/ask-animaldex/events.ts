/**
 * The event any page uses to start a conversation.
 *
 * It predates the drawer: species pages already dispatched it to hand an inline
 * "Why?" link's question to the Ask section on the same page. Keeping the same
 * name means every existing call site opens the conversation instead, with no
 * change to the pages that fire it.
 */
export const SPECIES_ASK_EVENT = "animaldex:ask";

/** Opens Ask AnimalDex on the current page, optionally with a question to send. */
export function askAboutAnimal(question?: string) {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(SPECIES_ASK_EVENT, {detail: {question}}));
}
