/**
 * Settings & activity (/app/settings and its screens) in the reader's
 * language: English here, word for word with iOS `ProfileSettingsView` and
 * friends, and the locale's `appSettings` namespace over it key by key
 * (en.json's `appSettings` mirrors this object; a test keeps them equal).
 * `{name}` placeholders are filled with `fillSettingsWords`.
 */

export const SETTINGS_WORDS_EN = {
    title: "Settings & activity",
    settings: "Settings",
    backTo: "Back to {label}",
    selected: "Selected",
    on: "On",
    off: "Off",
    cancel: "Cancel",
    somethingWrong: "Something went wrong. Try again.",

    missions: "Missions",
    creditsUnlocks: "Credits & unlocks",
    earnings: "Earnings",
    earningsSubtitle: "See how earning with AnimalDex works",
    shop: "Shop",
    locations: "Locations",
    wildlifeGuides: "Wildlife Guides",
    gifts: "Gifts",
    trades: "Trades & offers",

    sectionPreferences: "PREFERENCES",
    notifications: "Notifications",
    language: "Language",
    currency: "Currency",
    soundEffects: "Sound Effects",
    sectionPrivacy: "PRIVACY & DATA",
    locationPrivacy: "Location privacy",
    recordPrivacy: "Record privacy",
    sectionConnected: "CONNECTED SERVICES",
    sectionSupport: "SUPPORT & ABOUT",
    footerWeb: "AnimalDex for web",
    help: "Help & support",
    rate: "Rate AnimalDex",
    privacyPolicy: "Privacy Policy",
    terms: "Terms of Use",
    sectionAccount: "ACCOUNT",
    account: "Account",
    accountStanding: "Account standing",

    allLanguages: "ALL LANGUAGES",
    languageFooter: "Choose the language used for AnimalDex controls and labels.",

    currencySystem: "System ({currency})",
    currencyFooter: "Price estimates are shown in this currency. Values are converted from a fixed reference rate, not a live exchange rate.",
    allCurrencies: "ALL CURRENCIES",

    notificationsFooter: "You will hear about updates to your captures, people you follow, new messages, and Credit bonuses in the AnimalDex app.",
    notificationsRowSubtitle: "Recent AnimalDex notifications and account activity.",
    alertTypes: "ALERT TYPES",
    alertTypesFooter: "Turning these off stops the alert only. Capture, activity, and Credit bonus updates still appear in your notifications list. Messages stay in Messages.",
    pushCaptureUpdates: "Your captures",
    pushCaptureUpdatesNote: "Merges and corrections to animals you have captured.",
    pushSocialActivity: "Activity",
    pushSocialActivityNote: "New captures from people you follow.",
    pushDirectMessages: "Messages",
    pushDirectMessagesNote: "New messages from collectors and AnimalDex Support.",
    pushAnimalMessages: "Animal messages",
    pushAnimalMessagesNote: "When an animal you talk with writes to you.",

    whoCanSeeLocations: "WHO CAN SEE CAPTURE LOCATIONS",
    locationFooter: "This controls the place shown on your public captures. It does not change what AnimalDex stores for your own collection.",
    visibilityEveryone: "Everyone",
    visibilityFollowing: "People I follow",
    visibilityFriends: "Friends",
    visibilityPrivate: "Only me",
    visibilityCustom: "Custom",

    recordPowersHeader: "WHO CAN SEE MY POWERS",
    recordPowersFooter: "Covers the Powers on your profile and their posts on Explore.",
    recordTrialsHeader: "WHO CAN SEE MY TRIALS",
    recordTrialsFooter: "Covers Trials you completed earlier and their posts on Explore, including your proof. Failed attempts are never shown to anyone.",
    recordBattlesHeader: "WHO CAN SEE MY DEBATES",
    recordBattlesFooter: "Covers your debates and past battles on your profile. A public debate is on Explore while people vote.",

    chatHistory: "Chat history",
    chatKeep: "Keep my chats on all my devices",
    chatNote: "Your conversations with animals are saved to your account so they're on every device. Turn this off to keep new chats on this device only.",
    chatConfirm: "Delete every conversation with your animals? This can't be undone.",
    chatDelete: "Delete chat history",
    chatDeleteDone: "Delete chat history · Done",

    instagram: "Instagram",
    instagramChecking: "Checking…",
    instagramNotConnected: "Not connected",
    instagramReauthorize: "Reauthorization required",
    instagramConnected: "Connected",
    instagramConnectedAs: "Connected as @{name}",

    signInEmailHeader: "SIGN-IN EMAIL",
    signInMethodHeader: "SIGN-IN METHOD",
    email: "Email",
    signInMethod: "Sign-in method",
    status: "Status",
    signedIn: "Signed in",
    noEmailOnFile: "No email is on file for this account.",
    methodApple: "Sign in with Apple",
    methodEmail: "Email and password",
    footnoteAppleOnly: "This account uses Sign in with Apple. Manage access and privacy in Settings → Apple ID on your device.",
    footnoteAppleMixed: "Password changes apply only to the email-and-password sign-in method. Apple sign-in is managed in Settings → Apple ID.",
    footnoteProvider: "In-app password changes apply to accounts that use email and password. Other sign-in methods use that provider’s account security.",
    noEmailApple: "No email is stored for this account. If you used Hide My Email, Apple may show a private relay address only in your Apple ID settings.",
    noEmailProvider: "No email is on file for this account. Sign-in is managed by your provider.",
    changePassword: "Change password",
    userId: "USER ID",
    userIdFooter: "Support may ask for this if you report a problem.",
    passwordIntro: "Enter your current password, then choose a new one.",
    currentPassword: "Current password",
    newPassword: "New password",
    confirmPassword: "Confirm new password",
    passwordRule: "Use {min}–{max} characters. Avoid obvious passwords.",
    passwordEnterCurrent: "Enter your current password.",
    passwordMismatch: "New passwords don’t match.",
    passwordSame: "New password must be different from your current password.",
    passwordUpdated: "Password updated.",
    updating: "Updating…",
    updatePassword: "Update password",
    signingOut: "Signing out...",
    signOut: "Sign Out",
    deleteFooter: "Deleting your account removes your profile, captures, community content, messages, and associated AnimalDex data from our records unless retention is legally required.",
    deleting: "Deleting Account...",
    deleteAccount: "Delete Account",
    deleteTitle: "Delete your AnimalDex account?",
    deleteBody: "This permanently deletes your profile and associated AnimalDex data. Active App Store subscriptions must be cancelled from your Apple account. A web subscription can be cancelled from Credits & Unlocks → Manage subscription.",

    standingGood: "Good standing",
    standingAtRisk: "{count} of {max} strikes",
    standingSuspended: "Suspended",
    statusOneMore: "One more strike suspends your account.",
    statusTwoMore: "Two more strikes suspend your account.",
    statusSuspended: "New captures can't be identified while the account is suspended.",
    statusGood: "No strikes. Keep capturing real animals with your own camera.",
    strikes: "Strikes",
    removedAfterReview: "Removed after review",
    howStrikesWork: "How strikes work",
    strike1Title: "First strike",
    strike1Detail: "A warning. The photo comes off Discover.",
    strike2Title: "Second strike",
    strike2Detail: "A final warning.",
    strike3Title: "Third strike",
    strike3Detail: "Your account is suspended.",
    ifWeGetItWrong: "If we get it wrong",
    strikeFootnote: "Contact Support with other shots from the same moment or proof you were there. A person looks at every message.",

    giftsEmpty: "Gifts you send and ratings you leave will appear here.",
    ratings: "Ratings",
    endorsements: "Endorsements",
    giftSentLabel: "{animal}. Sent a Gift",
    ratedLabel: "{animal}. Rated {stars} stars",
    endorsedLabel: "{animal}. Endorsed {stat}"
};

export type SettingsWords = typeof SETTINGS_WORDS_EN;

/** English, with the locale's `appSettings` strings laid over it key by key (an empty one keeps the English). */
export function settingsWords(raw: unknown): SettingsWords {
    const given = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    return Object.fromEntries(Object.entries(SETTINGS_WORDS_EN).map(([key, value]) => {
        const candidate = given[key];
        return [key, typeof candidate === "string" && candidate.trim() ? candidate : value];
    })) as SettingsWords;
}

/** `{name}` placeholders filled from `values`; an unknown one stays as written. */
export function fillSettingsWords(template: string, values: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match));
}
