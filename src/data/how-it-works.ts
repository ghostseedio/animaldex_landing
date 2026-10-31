import {perspectiveLocale, type PerspectiveLocale} from "@/data/animal-perspective";

/**
 * /how-it-works: every animal is different, and how the animals work
 * (docs/rich-chat/SPEC.md §3.2 and §5.2). The six points themselves live in
 * `animal-perspective.ts`, shared with the Help page; this is the page around
 * them. Every line is true of the app today.
 */

export const HOW_IT_WORKS_PATH = "/how-it-works";
export const HOW_IT_WORKS_UPDATED = "2026-10-31";

export type HowItWorksDetail = {
    id: "your-step" | "trials" | "debates";
    eyebrow: string;
    title: string;
    paragraphs: string[];
};

export type HowItWorksContent = {
    metaTitle: string;
    metaDescription: string;
    eyebrow: string;
    /** `**…**` marks the accent word. */
    title: string;
    intro: string;
    primaryCta: string;
    articleCta: string;
    pointsEyebrow: string;
    pointsTitle: string;
    pointsDescription: string;
    powerExample: string;
    loopEyebrow: string;
    loopTitle: string;
    loopDescription: string;
    details: HowItWorksDetail[];
    trialsLink: string;
    debateModes: Array<{title: string; body: string}>;
    safetyTitle: string;
    safetyBody: string;
    collectionEyebrow: string;
    collectionTitle: string;
    collectionBody: string;
    ctaTitle: string;
    ctaBody: string;
};

const en: HowItWorksContent = {
    metaTitle: "How AnimalDex works: every animal sees it differently",
    metaDescription: "Every animal in AnimalDex answers from its own Power, takes a side and keeps it. How the animals work, and how Your step, Trials and Debates turn a conversation into action.",
    eyebrow: "How it works",
    title: "Every animal sees it **differently**.",
    intro: "Ask an owl and a cheetah the same thing and they'll disagree. Each answers from its own Power, the way its kind survives, not from what you want to hear.",
    primaryCta: "Talk to an animal",
    articleCta: "Why it matters: advice fatigue",
    pointsEyebrow: "How the animals work",
    pointsTitle: "Six things every animal does",
    pointsDescription: "The same six hold for all 2,500+ animals, from a garden snail to a snow leopard.",
    powerExample: "Common Octopus · Flexible Intelligence: change the method when the environment changes.",
    loopEyebrow: "The loop",
    loopTitle: "From a photo to a Power",
    loopDescription: "Capture an animal, bring it something real, hear its side, take one step. Debates open once its Power is yours.",
    details: [
        {
            id: "your-step",
            eyebrow: "Your step",
            title: "Advice you do, not advice you read",
            paragraphs: [
                "Bring an animal you've caught something real: a decision, a habit, a conversation you keep putting off. It says which way it would go and why, from its own life, then gives you one step to try in your own world.",
                "Do it, tap I did it and tell it how it went. The first step you finish together earns its Power, and its card shows how you earned it. Where the stakes are real, like a job or money, the step is one you can take back."
            ]
        },
        {
            id: "trials",
            eyebrow: "Trials",
            title: "Each animal's own challenges",
            paragraphs: [
                "Every animal has Trials: challenges built on how its kind survives. When you have nothing to bring, pick one, and it becomes one more way to get a step."
            ]
        },
        {
            id: "debates",
            eyebrow: "Debates",
            title: "Let them argue it out",
            paragraphs: [
                "Once an animal's Power is yours, it can bring other animals in to argue your problem. They take turns, each from its own Power, and a debate report sets out each animal's way: where it fits, what it costs, and what to try first. Then you choose a way to try."
            ]
        }
    ],
    trialsLink: "Browse Animal Trials",
    debateModes: [
        {title: "Private", body: "With your own animals. Nothing is at stake, and you choose the way to try."},
        {title: "Public", body: "Other people's animals can join, and the community votes."}
    ],
    safetyTitle: "Safety comes first",
    safetyBody: "Whatever an animal's nature, when someone is controlling, threatening or hurting you, it puts your safety first. On health, money or the law it tells you to ask a person who knows. If you're in danger, contact local emergency services or a crisis line.",
    collectionEyebrow: "The collection is the engine",
    collectionTitle: "Every animal you meet adds a new way of seeing.",
    collectionBody: "Photograph a real animal with the app's camera, or pick a photo or video you took yourself. AnimalDex identifies it, and it becomes yours to talk to. More than 2,500 species, each with its own Power.",
    ctaTitle: "Bring an animal a real problem.",
    ctaBody: "Anyone can talk to an animal on the web, with no account. Your step and debates need an animal you've caught in the app."
};

const id: HowItWorksContent = {
    metaTitle: "Cara kerja AnimalDex: setiap hewan melihatnya dengan cara berbeda",
    metaDescription: "Setiap hewan di AnimalDex menjawab dari Kekuatannya sendiri, memilih satu sisi dan bertahan di sana. Cara kerja hewan-hewannya, dan bagaimana Langkah Anda, Uji Coba, dan Debat mengubah percakapan menjadi tindakan.",
    eyebrow: "Cara kerjanya",
    title: "Setiap hewan melihatnya dengan cara **berbeda**.",
    intro: "Tanyakan hal yang sama pada burung hantu dan cheetah, dan mereka tidak akan sepakat. Masing-masing menjawab dari Kekuatannya sendiri, cara jenisnya bertahan hidup, bukan dari apa yang ingin kamu dengar.",
    primaryCta: "Bicara dengan seekor hewan",
    articleCta: "Mengapa ini penting: lelah nasihat",
    pointsEyebrow: "Cara kerja hewan-hewannya",
    pointsTitle: "Enam hal yang dilakukan setiap hewan",
    pointsDescription: "Keenamnya berlaku untuk lebih dari 2.500 hewan, dari siput kebun sampai macan tutul salju.",
    powerExample: "Gurita Biasa · Kecerdasan Lentur: ganti caranya saat lingkungannya berubah.",
    loopEyebrow: "Alurnya",
    loopTitle: "Dari sebuah foto sampai sebuah Kekuatan",
    loopDescription: "Tangkap seekor hewan, bawakan sesuatu yang nyata, dengarkan sisinya, ambil satu langkah. Debat terbuka setelah Kekuatannya jadi milikmu.",
    details: [
        {
            id: "your-step",
            eyebrow: "Langkah Anda",
            title: "Nasihat yang dilakukan, bukan sekadar dibaca",
            paragraphs: [
                "Bawakan hewan yang sudah kamu tangkap sesuatu yang nyata: keputusan, kebiasaan, percakapan yang terus kamu tunda. Ia mengatakan ke arah mana ia akan pergi dan mengapa, dari hidupnya sendiri, lalu memberimu satu langkah untuk dicoba di duniamu sendiri.",
                "Lakukan, ketuk Sudah saya lakukan, lalu ceritakan hasilnya. Langkah pertama yang kalian selesaikan bersama memberimu Kekuatannya, dan kartunya menunjukkan bagaimana kamu mendapatkannya. Saat taruhannya nyata, seperti pekerjaan atau uang, langkahnya adalah langkah yang masih bisa kamu tarik kembali."
            ]
        },
        {
            id: "trials",
            eyebrow: "Uji Coba",
            title: "Tantangan milik setiap hewan",
            paragraphs: [
                "Setiap hewan punya Uji Coba: tantangan yang dibangun dari cara jenisnya bertahan hidup. Saat kamu tidak punya sesuatu untuk dibawa, pilih salah satunya, dan itu menjadi satu cara lagi untuk mendapatkan langkah."
            ]
        },
        {
            id: "debates",
            eyebrow: "Debat",
            title: "Biarkan mereka berdebat",
            paragraphs: [
                "Setelah Kekuatan seekor hewan jadi milikmu, ia bisa mengajak hewan lain memperdebatkan masalahmu. Mereka bergiliran, masing-masing dari Kekuatannya sendiri, dan laporan debat menjabarkan cara setiap hewan: di mana cocoknya, apa harganya, dan apa yang perlu dicoba lebih dulu. Lalu kamu memilih satu cara untuk dicoba."
            ]
        }
    ],
    trialsLink: "Jelajahi Ujian Hewan",
    debateModes: [
        {title: "Privat", body: "Dengan hewan-hewanmu sendiri. Tidak ada yang dipertaruhkan, dan kamu memilih cara yang akan dicoba."},
        {title: "Publik", body: "Hewan milik orang lain bisa ikut, dan komunitas memberi suara."}
    ],
    safetyTitle: "Keselamatan lebih dulu",
    safetyBody: "Apa pun sifat seekor hewan, saat seseorang mengendalikan, mengancam, atau menyakitimu, ia mendahulukan keselamatanmu. Untuk kesehatan, uang, atau hukum ia akan memintamu bertanya kepada orang yang paham. Jika kamu dalam bahaya, hubungi layanan darurat setempat atau layanan krisis.",
    collectionEyebrow: "Koleksi adalah mesinnya",
    collectionTitle: "Setiap hewan yang kamu temui menambah satu cara pandang baru.",
    collectionBody: "Foto hewan sungguhan dengan kamera aplikasi, atau pilih foto atau video yang kamu ambil sendiri. AnimalDex mengenalinya, dan ia jadi milikmu untuk diajak bicara. Lebih dari 2.500 spesies, masing-masing dengan Kekuatannya sendiri.",
    ctaTitle: "Bawakan seekor hewan masalah yang nyata.",
    ctaBody: "Siapa pun bisa bicara dengan seekor hewan di web, tanpa akun. Langkah Anda dan debat membutuhkan hewan yang sudah kamu tangkap di aplikasi."
};

const CONTENT: Record<PerspectiveLocale, HowItWorksContent> = {en, id};

export function getHowItWorksContent(locale: string): HowItWorksContent {
    return CONTENT[perspectiveLocale(locale)];
}
