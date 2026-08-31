export type SupportFAQ = {
    question: string;
    answer: string;
    linkHref?: string;
    linkLabel?: string;
    searchAliases?: string[];
};

export type SupportSection = {
    id: string;
    title: string;
    description: string;
    items: SupportFAQ[];
};

export type SupportContent = {
    eyebrow: string;
    title: string;
    description: string;
    metaTitle: string;
    metaDescription: string;
    quickHelpTitle: string;
    quickHelpDescription: string;
    sections: SupportSection[];
    safetyTitle: string;
    safetyDescription: string;
    deleteTitle: string;
    deleteDescription: string;
    deleteSteps: string[];
    deleteNote: string;
    contactTitle: string;
    contactDescription: string;
    contactButton: string;
    privacyButton: string;
    businessEnquiryEyebrow: string;
    businessEnquiryTitle: string;
    businessEnquiryDescription: string;
    businessEnquiryButton: string;
    howCanWeHelp: string;
    searchPlaceholder: string;
    searchEmptyTitle: string;
    searchEmptyBody: string;
    talkToSupportLabel: string;
    cantFindHelp: string;
    browseTopicsLabel: string;
    readArticleLabel: string;
    articleUpdatedLabel: string;
    relatedArticlesLabel: string;
    feedbackPrompt: string;
    feedbackYes: string;
    feedbackNo: string;
    feedbackThanksYes: string;
    feedbackThanksNo: string;
    feedbackStillStuck: string;
    feedbackEscalationDescription: string;
    feedbackStatsSummary: string;
    feedbackStatsFirst: string;
};

const en: SupportContent = {
    eyebrow: "Help Center",
    title: "AnimalDex Support",
    description: "Help with scanning animals, AnimalDex numbers, captures, collections, Credits, Earnings, Wildlife Guides, Sponsored Challenges, accounts, privacy, and app troubleshooting.",
    metaTitle: "AnimalDex Support — Scanning, Captures, Credits, Earnings & App Help",
    metaDescription: "Get help with AnimalDex. Learn how Credits differ from Earnings, how Wildlife Guides work, how to join Sponsored Challenges, restore purchases, and fix app issues.",
    quickHelpTitle: "Find the answer you need",
    quickHelpDescription: "Choose a topic below. Most scanning and account issues can be resolved without waiting for support.",
    sections: [
        {
            id: "getting-started",
            title: "Getting started",
            description: "The basics of AnimalDex and your account.",
            items: [
                {question: "What is AnimalDex?", answer: "AnimalDex is an animal scanner, field guide, and wildlife collection app. It uses AI to identify animals from live captures, then turns discoveries into species profiles, collectible cards, and collection progress."},
                {question: "How does AnimalDex work?", answer: "Open the scanner, photograph an animal with the in-app camera, confirm the capture, and wait for analysis. AnimalDex identifies the animal, grades that specific capture, and adds the result to your collection."},
                {question: "Is AnimalDex free?", answer: "You can start free with starter credits. Additional free credits may come from missions, referrals, and first-time wild species captures. Credit packs and AnimalDex Pro are available for people who want more scanning and field-guide access."},
                {question: "Where is AnimalDex available?", answer: "AnimalDex is available from the App Store and Google Play. Features and purchase controls may differ slightly by platform."},
                {question: "Do I need an account?", answer: "An account is required to save captures, credits, collection progress, purchases, and community activity across sessions."}
            ]
        },
        {
            id: "scanning-captures",
            title: "Scanning and captures",
            description: "Camera access, processing, and supported animal sightings.",
            items: [
                {question: "How do I scan an animal?", answer: "Tap the scan action, allow camera and location access, frame the animal clearly, and take a photo or supported loop. Review the result and choose the confirmation button to submit it for analysis."},
                {question: "Can I upload an animal from my photo gallery?", answer: "No. AnimalDex currently uses its in-app camera for animal captures. This keeps collection entries tied to in-the-moment sightings and supports authenticity checks."},
                {question: "Why is my capture still processing?", answer: "Analysis can take a few minutes depending on image quality, network connection, and service demand. Keep the app connected and check the capture again. If it remains stuck, restart the app and contact support with the capture time and app version."},
                {question: "Why does AnimalDex need camera and location access?", answer: "Camera access is required to create a live capture. Location provides habitat and sighting context, such as approximate area and wild-versus-urban context, which can improve analysis and collection records."},
                {question: "What animals can I scan?", answer: "You can scan wild animals, pets, zoo animals, and farm animals. AnimalDex also identifies insects. Plants are outside the app's animal-identification focus."}
            ]
        },
        {
            id: "identification",
            title: "Animal identification",
            description: "Accuracy, confidence, and correcting uncertain results.",
            items: [
                {question: "How accurate is AnimalDex?", answer: "Accuracy depends on lighting, focus, angle, visible body features, and how similar the animal is to related species. The confidence value indicates how certain the analysis is, but no AI identification is perfect."},
                {question: "What should I do if the identification is wrong?", answer: "Retake the photo with better lighting and more of the animal visible, or use re-analysis on the capture. If the result remains wrong, email support with the capture details so the issue can be reviewed."},
                {question: "Can AnimalDex identify rare animals?", answer: "Yes, but rare, juvenile, hybrid, or visually similar species can be harder to identify. Treat low-confidence results as a starting point and compare them with trusted field references."},
                {question: "Can I use AnimalDex for dangerous wildlife decisions?", answer: "No. AnimalDex is designed for learning and discovery. Results may be imperfect and must not be used for safety-critical wildlife, medical, handling, or edibility decisions. Keep a safe distance and follow local guidance."}
            ]
        },
        {
            id: "animaldex-numbers",
            title: "AnimalDex numbers",
            description: "How species, lookalike groups, and domestic animals get indexed.",
            items: [
                {
                    question: "How does AnimalDex decide which AnimalDex number I get?",
                    answer: "AnimalDex indexes at species by default. Distinct wild species can get their own number. Huge lookalike families may share a group card. Domestic breeds and color morphs fold into a base species such as Domestic Dog or Goldfish. The card you collect is the resolved catalog identity, not every nickname mentioned in analysis.",
                    linkHref: "/blog/how-animaldex-indexes-animals",
                    linkLabel: "Read the full indexing guide"
                },
                {
                    question: "What is the difference between a species card and a group card?",
                    answer: "A species card is one named animal line with its own AnimalDex number. A group card is a shared lookalike bucket used when everyday photos cannot reliably separate many near-identical animals — for example ordinary snails, many tree frogs, tilapia forms, or broad insect labels like ant or mosquito.",
                    linkHref: "/blog/how-animaldex-indexes-animals",
                    linkLabel: "See species vs group examples"
                },
                {
                    question: "Why did my dog breed or goldfish morph not get its own number?",
                    answer: "Breeds and morphs never mint parallel AnimalDex numbers. A German Shepherd indexes as Domestic Dog. A Fantail Goldfish indexes as Goldfish. A Lutino Cockatiel indexes as Cockatiel. Analysis may still mention the breed or morph, but the collectible card is the base animal.",
                    linkHref: "/blog/how-animaldex-indexes-animals",
                    linkLabel: "How breeds and morphs are indexed"
                },
                {
                    question: "Why is my garden snail just “Snail”?",
                    answer: "Ordinary garden and pond snails usually share the Snail group card because they are hard to separate from a phone photo. Giant African Land Snail is a deliberate exception and keeps its own species number.",
                    linkHref: "/blog/how-animaldex-indexes-animals",
                    linkLabel: "Read the snail indexing rules"
                },
                {
                    question: "Can the analysis mention a more specific name than the card?",
                    answer: "Yes. Analysis text can mention a breed, morph, or common name for learning, while the indexed AnimalDex card stays on the official catalog identity — the number, display name, and species-or-group kind you collect.",
                    linkHref: "/blog/how-animaldex-indexes-animals",
                    linkLabel: "How AnimalDex indexes animals"
                }
            ]
        },
        {
            id: "collections-cards",
            title: "Collections and cards",
            description: "How captures become collectible AnimalDex entries.",
            items: [
                {question: "How do I add an animal to my collection?", answer: "A successfully analyzed capture is added to your collection automatically. Open the Album or collection area to view its card and field-guide details."},
                {question: "What does “not captured yet” mean?", answer: "The species exists in the AnimalDex field guide, but your account has not yet recorded a successful live capture of it."},
                {question: "What do rarity and grades mean?", answer: "Rarity describes how unusual a species or sighting context is. A grade is a 1–10 quality score for that specific capture, based on factors such as clarity, framing, identification confidence, visible detail, and context. It is not the animal's power tier."},
                {question: "Can I scan the same animal or species again?", answer: "Yes. Separate captures can have different grades, context, media, and collection value. Repeated easy comparison wins are capped so collection quality remains important."},
                {question: "Can animals be upgraded?", answer: "Some card actions use credits, including deeper analysis and supported stat training or health restoration. The options available are shown on the relevant capture."}
            ]
        },
        {
            id: "credits-purchases",
            title: "Credits and purchases",
            description: "When credits are used and how purchases are restored.",
            items: [
                {question: "What are credits?", answer: "Credits are AnimalDex's closed virtual currency. A photo scan, re-analysis, or deeper field-guide unlock on an individual card uses 1 Credit. Other actions show their cost before confirmation. Credits cannot be withdrawn or converted into Earnings.", linkHref: "/earn-on-animaldex", linkLabel: "Credits vs Earnings"},
                {question: "Do failed scans use a credit?", answer: "A successfully completed paid analysis uses its stated credit cost. If AnimalDex charges a scan credit and the analysis then fails, the backend returns that analysis charge to your balance."},
                {question: "How do I restore purchases?", answer: "Sign in to the AnimalDex account you used for the purchase, open Credits & Unlocks, and choose Restore Purchases. Also make sure the device is signed in to the same App Store or Google Play account used originally."},
                {question: "What does AnimalDex Pro include?", answer: "AnimalDex Pro includes unlimited scans and re-analysis plus expanded field-guide details on cards. Instagram Import screening and import are included with Pro. The current purchase screen lists the exact entitlement before you subscribe."},
                {
                    question: "How do I buy Credits or Pro on the website?",
                    searchAliases: ["paddle", "web purchase", "buy credits website", "checkout"],
                    answer: "On animaldex.app, sign in and open Credits. Choose a Credit pack or AnimalDex Pro. Credits and Pro are granted only after AnimalDex confirms the payment — not from the checkout screen alone.\n\nSteps: sign in, open Credits, choose a pack or Pro, complete payment, wait for AnimalDex to update your balance or Pro status, then continue.\n\nWhat can go wrong: checkout cancelled, payment still processing, or a webhook delay so Credits have not appeared yet.\n\nWhat to do next: if you cancelled, your Instagram import is still there. If you paid and Credits are missing, wait a moment and choose Refresh balance. Do not buy again unless the first checkout failed."
                },
                {
                    question: "I paid but Credits are not showing",
                    searchAliases: ["payment pending", "paddle delayed", "credits missing after payment", "webhook"],
                    answer: "A successful web payment can return you to AnimalDex before Credits are posted. AnimalDex grants Credits only from a verified server event, never from the browser.\n\nSteps: stay on the return screen until it says Credits are updated, or open Instagram Import / Credits and tap Refresh balance.\n\nWhat can go wrong: a short delay looks like a missing purchase. Buying again can create a second charge.\n\nWhat to do next: refresh the balance once. If Credits still do not appear after several minutes, contact AnimalDex Support with the time of purchase — not your card number or payment-provider internals."
                },
                {
                    question: "How do I manage my AnimalDex Pro subscription?",
                    searchAliases: ["paddle portal", "cancel pro", "manage subscription", "apple subscription", "google play billing"],
                    answer: "Management depends on where you subscribed. Web Pro is managed through the web billing portal. Apple Pro is managed in the App Store. Google Play Pro is managed in Google Play. AnimalDex will not send an Apple or Google subscriber to web subscription management.\n\nSteps: on the website, open Credits and choose Manage subscription if you subscribed on the web. On iOS, use Subscriptions in Apple ID settings. On Android, use Google Play subscriptions.\n\nWhat can go wrong: opening the wrong store, or buying a second Pro while one is already active. If you already have Pro, AnimalDex blocks another Pro checkout.\n\nWhat to do next: use the same platform you used to subscribe. Contact support if Pro status and the store disagree after a renewal or refund."
                }
            ]
        },
        {
            id: "earnings",
            title: "Earnings and Creator Rewards",
            description: "How Credits differ from real-money Earnings, and what Creator Rewards is.",
            items: [
                {
                    question: "How do I earn on AnimalDex?",
                    answer: "There are two separate economies. Credits are a closed virtual currency from missions, qualified referrals, first-time wild species captures, Sealed Packs, PvP stakes, and Credit Offers. Earnings is the real-money ledger. Today, completed AnimalDex Wildlife Guide outings can record seller net. Creator Rewards is a company-funded program that is currently paused. Sponsored Challenge cash is not live. Credits cannot be withdrawn or converted into Earnings.",
                    linkHref: "/earn-on-animaldex",
                    linkLabel: "Ways to earn on AnimalDex"
                },
                {
                    question: "What are AnimalDex Credits?",
                    answer: "Credits are AnimalDex's closed virtual currency. They pay for scans, re-analysis, field-guide unlocks, stat training, health restores, Packs, Gifts when enabled, and PvP stakes. You can earn free Credits from a starter grant, missions, qualified referrals, and first-time wild species captures. You can also buy Credit packs. Credits cannot be withdrawn, cashed out, or converted into Earnings.",
                    linkHref: "/earn-on-animaldex",
                    linkLabel: "See Credits vs Earnings"
                },
                {
                    question: "What are AnimalDex Earnings?",
                    answer: "Earnings is AnimalDex's real-money ledger. It only records fiat from allowed sources: completed Wildlife Guide settlements, finalized Creator Reward allocations when a period posts, and possible later deterministic Sponsored Challenge cash. Available Earnings stay recorded until a payout is completed. Payouts are reviewed and are not instant. There is no live Withdraw action while payouts are not open.",
                    linkHref: "/earn-on-animaldex",
                    linkLabel: "Ways to earn on AnimalDex"
                },
                {
                    question: "Are AnimalDex Credits worth real money?",
                    answer: "No. Credits cannot be withdrawn, converted, or exchanged for Earnings. Buying Credits never creates a cash claim. Gift Credit prices never determine Creator Rewards. Sealed Packs and PvP pay in Credits only.",
                    linkHref: "/earn-on-animaldex",
                    linkLabel: "Read the Credits vs Earnings explainer"
                },
                {
                    question: "What are Creator Rewards?",
                    answer: "Creator Rewards is a company-funded program designed to reward eligible live wildlife contribution during open reward periods. It looks at genuine live captures, diversity, quality, consistency, and a limited community-support signal. It does not pay from Credits, AnimalDex Score, Capture XP, Gift Credit prices, or imported photos. The program is currently paused and not open for payouts.",
                    linkHref: "/creator-rewards",
                    linkLabel: "Creator Rewards status"
                },
                {
                    question: "Why are Creator Rewards unavailable?",
                    answer: "Reward periods may not be open. AnimalDex can pause Creator Rewards without deleting recorded Earnings. There is no promised reopen date. Keep building a genuine live wild collection. Do not expect a payout from Score or Credits while the program is paused.",
                    linkHref: "/creator-rewards",
                    linkLabel: "Why Creator Rewards is paused"
                }
            ]
        },
        {
            id: "wildlife-guides",
            title: "AnimalDex Wildlife Guides",
            description: "Becoming a Guide seller and how cash-on-the-day bookings work.",
            items: [
                {
                    question: "How do I become a Wildlife Guide?",
                    answer: "Build 45 qualifying wild captures, 20 canonical wild species, and a 30-day-old account. Attest that you are 18+, accept the current Guide Seller Terms, and submit an application. Meeting the numbers lets you apply — it does not approve you automatically. A person reviews every application. You must follow ethical wildlife rules and hold any local permits your activity requires.",
                    linkHref: "/become-a-wildlife-guide",
                    linkLabel: "Become an AnimalDex Wildlife Guide"
                },
                {
                    question: "How do Wildlife Guide bookings and payments work?",
                    answer: "A collector requests a date and guest count on a published listing. The Guide accepts. The collector pays the Guide in cash on the day. AnimalDex does not collect, hold, or process that cash, and Credits are never used. When the Guide marks the outing complete, seller net is recorded on Earnings. The listed price is not money owed by itself.",
                    linkHref: "/become-a-wildlife-guide",
                    linkLabel: "How Guide payments work"
                }
            ]
        },
        {
            id: "sponsored-challenges",
            title: "Sponsored Challenges",
            description: "Free-to-join campaigns in the app, and how a business can enquire.",
            items: [
                {
                    question: "What are Sponsored Challenges?",
                    answer: "A Sponsored Challenge is a time-boxed campaign in the AnimalDex app. Collectors join free, follow published rules, and complete an objective such as unique indexed animals, a qualifying capture count, or active capture days. Achievement rewards are available today. Cash rewards are not live. This is not Arena PvP and not the website's animal-versus-animal comparison pages.",
                    linkHref: "/sponsor-a-challenge",
                    linkLabel: "Sponsor a Challenge"
                },
                {
                    question: "How can a business sponsor an AnimalDex Challenge?",
                    answer: "There is no self-serve sponsor portal. Email AnimalDex with the organisation name, campaign purpose, venue or region, dates, intended objective, and intended reward type. Zoos, aquariums, wildlife parks, tourism boards, conservation groups, and outdoor brands can enquire. AnimalDex configures the Challenge with you.",
                    linkHref: "/sponsor-a-challenge",
                    linkLabel: "How to sponsor a Challenge"
                }
            ]
        },
        {
            id: "instagram-import",
            title: "Instagram import",
            description: "Connecting Instagram and turning wildlife posts into AnimalDex captures.",
            items: [
                {
                    question: "How do I import wildlife posts from Instagram?",
                    searchAliases: ["import posts", "old wildlife photos", "instagram connect", "ig"],
                    answer: "In AnimalDex, go to Profile → Settings & Activity → Connected services → Instagram, connect a compatible Instagram professional account, then review identity and historical location before original media is added to your Dex.\n\nSteps: sign in, open Connected services, tap Instagram, connect, wait for the scan to finish, select posts, confirm location and identity, attest accuracy, then import.\n\nWhat can go wrong: you are signed out, the Instagram account is personal rather than professional, OAuth is cancelled, no animal posts are found, or a post is blocked because location or identity is still incomplete.\n\nWhat to do next: if you are not signed in, sign in first. Then open Instagram import from Connected services or Collection.",
                    linkHref: "/use-cases/import-instagram-wildlife-photos",
                    linkLabel: "Instagram wildlife import"
                },
                {
                    question: "What Instagram accounts can connect to AnimalDex?",
                    searchAliases: ["professional account", "ig", "instagram connect"],
                    answer: "Instagram import needs a compatible Instagram professional account. Personal accounts cannot always connect.\n\nSteps: in Instagram, convert the account to a professional type if Instagram requires it, then return to AnimalDex Connected services and connect again.\n\nWhat can go wrong: a personal account, a cancelled permission screen, or Instagram asking you to sign in again.\n\nWhat to do next: convert the account type Instagram supports for this login, reconnect, and retry. AnimalDex only requests the basic professional permission needed to look at your media. It does not ask for messaging permissions."
                },
                {
                    question: "Why can’t I connect my Instagram account?",
                    searchAliases: ["instagram connect", "professional account", "oauth", "ig"],
                    answer: "The usual causes are an unsupported account type, a cancelled permission screen, or Instagram asking you to sign in again.\n\nSteps: confirm the account is a compatible Instagram professional account, start Connect Instagram again, and complete the permission screen. If AnimalDex says reauthorization is required, connect again from Connected services.\n\nWhat can go wrong: cancelling OAuth returns you without a connection. A failed exchange shows Instagram was not connected. Preview or non-allowlisted hosts cannot complete web OAuth return.\n\nWhat to do next: retry from Connected services. If it still fails, talk to AnimalDex Support with the account type and whether you cancelled or saw an error."
                },
                {
                    question: "How does AnimalDex find animals in my Instagram posts?",
                    searchAliases: ["scan", "find animals", "old wildlife photos"],
                    answer: "After you connect, AnimalDex reviews your posts at a high level to look for animals. Photos are checked first. Videos get a closer look when a still is not enough. You then choose which detected posts to import.\n\nSteps: connect Instagram, start the scan, wait until review is ready, then select candidates. You can leave the screen; a durable job can resume when you return.\n\nWhat can go wrong: no animal is detected, no new posts since the last check, the scan fails, or some videos cannot be sampled on the current device.\n\nWhat to do next: use Check for new posts after you add more wildlife photos. If videos were skipped, retry later or import those Reels from the iOS app."
                },
                {
                    question: "Why do I need to confirm the location of an imported post?",
                    searchAliases: ["location import", "historic location", "gps"],
                    answer: "An import is a historical claim about where the animal was when you photographed it. AnimalDex does not use your current GPS and does not treat a caption or hashtag as the location.\n\nSteps: select the posts, search for the real place, confirm it. If you do not know, mark unknown.\n\nWhat can go wrong: unknown location stays blocked. Incomplete location review also stays blocked. Caption place names are not applied automatically.\n\nWhat to do next: search for the place of the photograph. Unknown is an honest answer; it does not unlock import."
                },
                {
                    question: "Why do I need to confirm the species before importing?",
                    searchAliases: ["wrong species", "species confirmation", "unknown animal"],
                    answer: "Detected identity is a starting point. You confirm the animal this post shows, including group-level identities when that is how AnimalDex indexes the catalog.\n\nSteps: select the post, choose from the suggested identities, then continue. A species-level name is not forced when the catalog does not support one.\n\nWhat can go wrong: no identity selected, several animals in one frame, or a lookalike group that should stay a group.\n\nWhat to do next: confirm the honest identity before import. If the model found nothing, use Unknown animal only in that case."
                },
                {
                    question: "Can I import Instagram Reels?",
                    searchAliases: ["reels", "instagram video", "video import"],
                    answer: "Often, yes — when the device can sample the video. AnimalDex then uses the same identity, location, and accuracy review as still posts before the original video is imported.\n\nSteps: connect and scan as usual. Videos that can be played are sampled. If a Reel cannot be sampled, that item is skipped so the rest of the archive can still be reviewed.\n\nWhat can go wrong: some devices cannot extract frames from every Instagram codec. A skipped Reel is not a failed import of your photos. The iOS app can extract frames from more video cases.\n\nWhat to do next: continue reviewing still posts, then retry the Reel later or finish those videos in the iOS app. Do not wait on a spinner if the video cannot play."
                },
                {
                    question: "What happens after I import an Instagram post?",
                    searchAliases: ["after import", "see them in my dex"],
                    answer: "Eligible original media becomes a real AnimalDex capture in your Dex. Imported posts may publish to Discover. They help build your collection. They do not replace a live field scan.\n\nSteps: after import, open See them in my Dex to view the new captures. Named failures stay on the summary if some posts could not download.\n\nWhat can go wrong: expired media URLs, deleted Instagram posts, or a partial materialize failure. A partial import is not labelled as a total failure.\n\nWhat to do next: retry failed posts if they are still on Instagram, or capture new finds live in the field."
                },
                {
                    question: "How do Instagram Import Credits work?",
                    searchAliases: ["import credits", "screening credits", "1 credit 15", "photo video credits"],
                    answer: "Looking through your Instagram posts to list them is free. AnimalDex then screens posts for animals. The first 20 lifetime screening units are included. After that, non-Pro accounts use 1 Credit per 15 actual screening units, with unused remainder carried to the next check. Adding a photo-equivalent animal uses 1 Credit. Adding a video-equivalent animal uses 3 Credits. AnimalDex Pro includes Instagram Import screening and import.\n\nSteps: connect Instagram, confirm the screening quote if a charge may occur, review animals, then confirm the import quote before originals are added.\n\nWhat can go wrong: a quote expires, your balance is too low, or Pro has not updated yet after a web purchase.\n\nWhat to do next: refresh the quote. Buy the smallest Credit pack that covers the deficit, or Go Pro. Do not start a second checkout while the first is still updating."
                },
                {
                    question: "Why was I charged for screening?",
                    searchAliases: ["screening charge", "charged for scan", "20 free"],
                    answer: "Enumeration of posts is free. Screening uses your lifetime allowance first. After 20 lifetime screening units, non-Pro accounts are quoted 1 Credit per 15 actual units before AnimalDex continues. You confirm that quote if a charge may occur. Pro accounts are not charged for Instagram Import screening.\n\nSteps: read the quote, confirm only if you accept the cost, or Go Pro so screening is included.\n\nWhat can go wrong: confirming a paid quote you did not mean to accept, or assuming every check is free after the first 20 units.\n\nWhat to do next: future checks use leftover remainder first. Instagram Import is included with Pro."
                },
                {
                    question: "I upgraded to Pro but Import still shows a cost",
                    searchAliases: ["pro still charging", "pro delayed", "import not free"],
                    answer: "Pro is granted from AnimalDex server entitlement, not from the payment completion screen. A short delay can leave an old non-Pro quote on screen.\n\nSteps: wait for “Pro is active”, then refresh the quote. Screening and import quotes should become included.\n\nWhat can go wrong: using a stale quote from before the subscription activated, or managing Pro in the wrong store.\n\nWhat to do next: refresh the quote once. If Pro is active in Credits but Import still shows a cost after a few minutes, contact support with the time you subscribed — not card details."
                },
                {
                    question: "Can imported Instagram posts earn Creator Rewards?",
                    searchAliases: ["creator rewards", "earnings", "live capture"],
                    answer: "No. Imported content does not add qualifying live-capture wildlife signals. Creator Rewards eligibility relies on qualifying live contribution.\n\nSteps: none — imports build the Dex only. Live scans remain the path for qualifying contribution.\n\nWhat can go wrong: treating an imported archive as earnings-eligible. It is not.\n\nWhat to do next: use Instagram import to start the collection, then keep shooting live captures if you want qualifying Creator Rewards contribution."
                },
                {
                    question: "Why was an Instagram post not imported?",
                    searchAliases: ["not imported", "failed import", "expired", "wrong species"],
                    answer: "Common reasons: no animal was detected, identification still needs review, a required location or species confirmation is missing, the original media is no longer available on Instagram, or a temporary download failed.\n\nSteps: check the import summary for named failures. Confirm location and species on remaining posts. Retry media that expired.\n\nWhat can go wrong: unknown location blocks import. Incomplete review blocks import. A skipped Reel in the browser is separate from a failed materialize.\n\nWhat to do next: finish review on blocked posts, retry failed downloads, or talk to AnimalDex Support with the named failure text — not the photo itself."
                }
            ]
        },
        {
            id: "account-login",
            title: "Account and login",
            description: "Signing in, recovering access, and account details.",
            items: [
                {question: "How do I sign in?", answer: "Use email and password or the platform sign-in option shown by the app. On iOS, Sign in with Apple is supported."},
                {question: "I forgot my password. What should I do?", answer: "Choose the password-reset option on the sign-in screen and follow the link sent to your account email. Accounts created only with Sign in with Apple do not use an AnimalDex password."},
                {question: "I lost access to my account. What information should I send?", answer: "Contact support with your AnimalDex username, the email associated with the account if known, sign-in method, device platform, and the approximate date you last had access. Never send your password."},
                {question: "How do I change my email?", answer: "Email changes are not currently self-service in every sign-in flow. Contact support from the email connected to the account so ownership and available options can be reviewed."}
            ]
        },
        {
            id: "privacy-safety",
            title: "Privacy and safety",
            description: "How capture, location, and account data are handled.",
            items: [
                {question: "What data does AnimalDex collect?", answer: "AnimalDex processes account and profile details, uploaded capture media and analysis, location context when enabled, app activity, purchases, and device diagnostics needed to run and secure the service. See the Privacy Policy for the complete description."},
                {question: "Does AnimalDex store my photos and videos?", answer: "Capture media and related metadata may be stored securely to provide your collection, analysis, sharing, and community features. You can delete individual captures in the app."},
                {question: "How is location used?", answer: "Location can provide approximate sighting, habitat, and environmental context for analysis and collection records. Public or shared captures may expose related context as described in the Privacy Policy."},
                {question: "Can children use AnimalDex?", answer: "AnimalDex is not intended for children under 13. If you believe a child under 13 submitted personal information, contact support for review."}
            ]
        },
        {
            id: "troubleshooting",
            title: "Troubleshooting",
            description: "Quick fixes for common app problems.",
            items: [
                {question: "The camera will not open.", answer: "Open your device settings and allow AnimalDex to use the camera. On iOS, also allow Location While Using the App for live scans. Close and reopen AnimalDex after changing permissions."},
                {question: "My capture upload failed.", answer: "Check your connection, turn off any restrictive VPN or data-saving mode temporarily, and retry on a stable network. Keep AnimalDex open while the upload begins."},
                {question: "My result is stuck processing.", answer: "Wait a few minutes, then refresh the collection or restart the app. Do not repeatedly submit the same capture. If it remains stuck, contact support with the time of capture and your app version."},
                {question: "AnimalDex is crashing or freezing.", answer: "Install the latest AnimalDex and operating-system updates, restart the device, and try again. If the issue continues, send support your device model, OS version, app version, and the steps immediately before the crash."},
                {question: "My location is missing or incorrect.", answer: "Check that location services are enabled and AnimalDex has permission while the app is in use. Approximate device location and environmental labeling can vary, especially indoors or with weak GPS reception."},
                {question: "I have no internet connection.", answer: "Scanning, analysis, account sync, and most collection updates need an internet connection. Reconnect to Wi-Fi or mobile data and retry."}
            ]
        }
    ],
    safetyTitle: "Identification safety",
    safetyDescription: "AnimalDex is an educational discovery tool, not a safety authority. Never approach, touch, feed, capture, or handle wildlife based on an app result.",
    deleteTitle: "Delete your AnimalDex account",
    deleteDescription: "You can permanently request deletion from inside the app.",
    deleteSteps: ["Open AnimalDex and sign in.", "Open your Profile.", "Choose Settings.", "Select Delete Account and confirm the warning."],
    deleteNote: "Deletion removes or deidentifies your profile, captures, community content, messages, and associated AnimalDex data unless limited retention is required for legal, security, fraud-prevention, or transaction-record purposes.",
    contactTitle: "Still need help?",
    contactDescription: "Contact AnimalDex Support and include your app version, device, account username, and a clear description of what happened. Never send your password.",
    contactButton: "Email support",
    privacyButton: "Read the Privacy Policy",
    businessEnquiryEyebrow: "Business or media enquiry?",
    businessEnquiryTitle: "Partnerships, sponsorships, creators and press should contact the AnimalDex team.",
    businessEnquiryDescription: "Zoos and brands should start with Sponsor a Challenge. Collectors who want to earn should read Ways to earn on AnimalDex. Use the contact page for press and other non-support enquiries.",
    businessEnquiryButton: "Contact AnimalDex",
    howCanWeHelp: "How can we help?",
    searchPlaceholder: "Search AnimalDex help…",
    searchEmptyTitle: "No match yet",
    searchEmptyBody: "Try another search, browse the topics below, or talk to AnimalDex Support.",
    talkToSupportLabel: "Talk to AnimalDex Support",
    cantFindHelp: "Can't find what you need?",
    browseTopicsLabel: "Browse help topics",
    readArticleLabel: "Read article",
    articleUpdatedLabel: "Updated",
    relatedArticlesLabel: "Related articles",
    feedbackPrompt: "Did this help?",
    feedbackYes: "Yes, thanks",
    feedbackNo: "Not really",
    feedbackThanksYes: "Glad that helped.",
    feedbackThanksNo: "Thanks — we'll use that to improve this article.",
    feedbackStillStuck: "Still stuck?",
    feedbackEscalationDescription: "Message our team in the official AnimalDex Support chat — real humans, not a bot.",
    feedbackStatsSummary: "{helpful} of {total} readers found this helpful",
    feedbackStatsFirst: "Be the first to rate this article."
};

const id: SupportContent = {
    ...en,
    eyebrow: "Pusat Bantuan",
    title: "Dukungan AnimalDex",
    description: "Bantuan untuk scan hewan, capture, koleksi, kredit, akun, privasi, dan pemecahan masalah aplikasi.",
    metaTitle: "Dukungan AnimalDex — Bantuan Scan, Capture, Akun & Aplikasi",
    metaDescription: "Dapatkan bantuan untuk AnimalDex. Pelajari cara scan hewan, mengelola capture, menggunakan kredit, memulihkan pembelian, dan memperbaiki masalah aplikasi.",
    quickHelpTitle: "Temukan jawaban yang kamu butuhkan",
    quickHelpDescription: "Pilih topik di bawah. Sebagian besar masalah scan dan akun dapat diselesaikan tanpa menunggu dukungan.",
    safetyTitle: "Keamanan identifikasi",
    safetyDescription: "AnimalDex adalah alat edukasi dan discovery, bukan otoritas keselamatan. Jangan mendekati, menyentuh, memberi makan, menangkap, atau menangani satwa liar berdasarkan hasil aplikasi.",
    deleteTitle: "Hapus akun AnimalDex",
    deleteDescription: "Kamu dapat meminta penghapusan permanen dari dalam aplikasi.",
    deleteSteps: ["Buka AnimalDex dan masuk.", "Buka Profil.", "Pilih Settings.", "Pilih Delete Account lalu konfirmasi peringatannya."],
    deleteNote: "Penghapusan menghapus atau mendeidentifikasi profil, capture, konten komunitas, pesan, dan data AnimalDex terkait, kecuali penyimpanan terbatas diperlukan untuk kewajiban hukum, keamanan, pencegahan penipuan, atau catatan transaksi.",
    contactTitle: "Masih butuh bantuan?",
    contactDescription: "Hubungi Dukungan AnimalDex dan sertakan versi aplikasi, perangkat, username akun, dan penjelasan yang jelas. Jangan pernah mengirim password.",
    contactButton: "Email dukungan",
    privacyButton: "Baca Kebijakan Privasi",
    businessEnquiryEyebrow: "Pertanyaan bisnis atau media?",
    businessEnquiryTitle: "Kemitraan, sponsorship, kreator, dan media sebaiknya menghubungi tim AnimalDex.",
    businessEnquiryDescription: "Kebun binatang dan brand sebaiknya mulai dari Sponsor a Challenge. Kolektor yang ingin menghasilkan sebaiknya baca Ways to earn on AnimalDex. Gunakan halaman kontak untuk pers dan pertanyaan di luar dukungan.",
    businessEnquiryButton: "Hubungi AnimalDex",
    howCanWeHelp: "Ada yang bisa kami bantu?",
    searchPlaceholder: "Cari bantuan AnimalDex…",
    searchEmptyTitle: "Belum ada hasil",
    searchEmptyBody: "Coba kata kunci lain, jelajahi topik di bawah, atau hubungi Dukungan AnimalDex.",
    talkToSupportLabel: "Hubungi Dukungan AnimalDex",
    cantFindHelp: "Tidak menemukan jawabannya?",
    browseTopicsLabel: "Jelajahi topik bantuan",
    readArticleLabel: "Baca artikel",
    articleUpdatedLabel: "Diperbarui",
    relatedArticlesLabel: "Artikel terkait",
    feedbackPrompt: "Apakah ini membantu?",
    feedbackYes: "Ya, terima kasih",
    feedbackNo: "Kurang membantu",
    feedbackThanksYes: "Senang artikel ini membantu.",
    feedbackThanksNo: "Terima kasih — kami akan gunakan masukan ini untuk memperbaiki artikel.",
    feedbackStillStuck: "Masih buntu?",
    feedbackEscalationDescription: "Kirim pesan ke tim kami di chat Dukungan AnimalDex resmi — manusia sungguhan, bukan bot.",
    feedbackStatsSummary: "{helpful} dari {total} pembaca merasa artikel ini membantu",
    feedbackStatsFirst: "Jadilah yang pertama memberi penilaian."
};

export function getSupportContent(locale: string) {
    return locale === "id" ? id : en;
}
