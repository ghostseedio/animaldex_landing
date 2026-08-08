export type SupportFAQ = {
    question: string;
    answer: string;
    linkHref?: string;
    linkLabel?: string;
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
};

const en: SupportContent = {
    eyebrow: "Help Center",
    title: "AnimalDex Support",
    description: "Help with scanning animals, AnimalDex numbers, captures, collections, credits, accounts, privacy, and app troubleshooting.",
    metaTitle: "AnimalDex Support — Scanning, Captures, Accounts & App Help",
    metaDescription: "Get help with AnimalDex, the animal scanner and wildlife collection app. Learn how AnimalDex numbers work, how to scan animals, manage captures, use credits, restore purchases, and fix app issues.",
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
                {question: "What are credits?", answer: "Credits are AnimalDex's in-app balance. A scan, re-analysis, or deeper field-guide unlock on an individual card uses 1 credit. Other actions show their credit cost before confirmation."},
                {question: "Do failed scans use a credit?", answer: "A successfully completed paid analysis uses its stated credit cost. If AnimalDex charges a scan credit and the analysis then fails, the backend returns that analysis charge to your balance."},
                {question: "How do I restore purchases?", answer: "Sign in to the AnimalDex account you used for the purchase, open Credits & Unlocks, and choose Restore Purchases. Also make sure the device is signed in to the same App Store or Google Play account used originally."},
                {question: "What does AnimalDex Pro include?", answer: "AnimalDex Pro includes unlimited scans and re-analysis plus expanded field-guide details on cards. The current purchase screen lists the exact entitlement before you subscribe."}
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
    contactButton: "Contact support",
    privacyButton: "Read the Privacy Policy"
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
    contactButton: "Hubungi dukungan",
    privacyButton: "Baca Kebijakan Privasi"
};

export function getSupportContent(locale: string) {
    return locale === "id" ? id : en;
}
