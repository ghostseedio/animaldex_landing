/**
 * The messages the admin sends members, in one place.
 *
 * These were defined inside the notifications page, which was fine while that
 * page was the only thing that sent anything. The maintenance panel now offers
 * the matching message at the moment it performs the action, and two copies of
 * the wording would drift the first time one was edited.
 */

export type NotificationTemplate = {
    id: string;
    label: string;
    scope: "user" | "both";
    title: string;
    body: string;
};

export const notificationTemplates: NotificationTemplate[] = [
    {
        id: "indexed",
        label: "We just indexed…",
        scope: "both",
        title: "{animal} is now in AnimalDex",
        body: "We just indexed {animal}. Open the app to see its card, stats and field guide."
    },
    {
        id: "merged",
        label: "We merged your captures…",
        scope: "user",
        title: "We tidied up your {animal} captures",
        body: "Several photos of the same {animal} are now grouped into one card, so your collection reads cleanly."
    },
    {
        id: "reidentified",
        label: "We updated the ID on your…",
        scope: "user",
        title: "We updated the ID on your {animal}",
        body: "A closer look says this one is {animal}. Your card and its stats have been corrected."
    },
    {
        // The grade drives a capture's standing, so a member who looks at a card
        // and finds a different number than they remember deserves to be told
        // rather than left to wonder whether the app changed its mind.
        id: "regraded",
        label: "We adjusted the grade on your…",
        scope: "user",
        title: "We adjusted the grade on your {animal}",
        body: "We reviewed this capture and its grade is now {grade}. Your card and collection stats have been updated to match."
    },
    {
        id: "screen",
        label: "We believe your capture is from a screen…",
        scope: "user",
        title: "About your recent capture",
        body: "This one looks like a photo of a screen or a printed image rather than a live animal, so it has not been added to your collection."
    },
    {
        id: "credits",
        label: "We added credits…",
        scope: "user",
        title: "Credits added to your account",
        body: "We have added credits to your AnimalDex account. Open the app and your next scan is ready to go."
    },
    {
        id: "upload-failed",
        label: "A capture did not upload…",
        scope: "user",
        title: "One of your captures did not upload",
        body: "The photo never finished uploading, so we could not analyse it and it has not been added to your collection. No credits were charged. Please take the photo again."
    },
    {
        id: "blank",
        label: "Blank message",
        scope: "both",
        title: "",
        body: ""
    }
];

export function getNotificationTemplate(id: string) {
    return notificationTemplates.find((template) => template.id === id) ?? null;
}

/**
 * Substitutes the placeholders a template carries. An unknown placeholder is
 * left alone rather than blanked, so a typo shows up in the preview instead of
 * silently sending a sentence with a hole in it.
 */
export function fillTemplate(text: string, values: {animal?: string | null; grade?: number | string | null; count?: number | null}) {
    return text
        .replaceAll("{animal}", values.animal?.toString().trim() || "your animal")
        .replaceAll("{grade}", values.grade == null ? "updated" : String(values.grade))
        .replaceAll("{count}", values.count == null ? "several" : String(values.count));
}
