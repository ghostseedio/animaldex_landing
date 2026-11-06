/**
 * The web app's frame in the reader's language (UX pass): its tabs, its
 * drawer, the capture button and the error lines every screen shares
 * (`user-facing-error.ts`). English here, the locale's `appShell` over it.
 */

export const APP_SHELL_WORDS_EN = {
    companions: "Companions",
    collection: "Collection",
    explore: "Explore",
    profile: "Profile",
    /** The act, a verb (DECISIONS section 1): one label for the round button and the desktop one. */
    capture: "Capture",
    more: "More",
    messages: "Messages",
    notifications: "Notifications",
    missions: "Missions",
    credits: "Credits",
    earnings: "Earnings",
    shop: "Shop",
    locations: "Locations",
    guides: "Wildlife Guides",
    trades: "Trades",
    /** Sponsored campaigns (DECISIONS section 1; JRN-1). */
    events: "Events",
    instagram: "Instagram import",
    settings: "Settings",
    signIn: "Sign in",
    signOut: "Sign out",
    webApp: "Web app",
    openProfile: "Open profile",
    viewProfile: "View profile",
    openMenu: "Open menu",
    search: "Search",
    closeMenu: "Close menu",
    collector: "Collector",
    /** Missions › Events: sponsored and AnimalDex campaigns (DECISIONS section 1). */
    eventsDetail: "Live and upcoming events with clear rules, sponsor disclosure and set rewards.",
    eventsNoneLive: "No live events right now.",
    eventsNone: "No events right now. They appear here when one starts.",
    eventEnded: "This event has ended.",
    eventByAnimalDex: "AnimalDex event",
    eventSponsored: "Sponsored",
    eventPresentedBy: "Presented by {name}",
    eventAppleDisclaimer: "Apple is not a sponsor of this event and is not involved in any way.",
    pastEvents: "Past events",
    pastEventsDetail: "Events whose window has closed.",
    /** UserFacingError (DECISIONS section 4). */
    errorOffline: "You're offline. We'll try again when you're back.",
    errorServer: "Something went wrong on our side. Try again in a moment.",
    tryAgain: "Try again"
};

export type AppShellWords = typeof APP_SHELL_WORDS_EN;

export function appShellWords(raw: unknown): AppShellWords {
    const given = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    return Object.fromEntries(Object.entries(APP_SHELL_WORDS_EN).map(([key, value]) => {
        const candidate = given[key];
        return [key, typeof candidate === "string" && candidate.trim() ? candidate : value];
    })) as AppShellWords;
}
