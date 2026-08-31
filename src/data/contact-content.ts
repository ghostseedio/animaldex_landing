export type ContactRoute = {
    id: string;
    label: string;
    heading: string;
    description: string;
    cta: string;
    microcopy?: string;
    href: string;
    featured?: boolean;
};

export type ContactContent = {
    eyebrow: string;
    title: string;
    description: string;
    metaTitle: string;
    metaDescription: string;
    supportCalloutEyebrow: string;
    supportCalloutTitle: string;
    supportCalloutDescription: string;
    supportCalloutCta: string;
    directContactTitle: string;
    directContactLead: string;
    directContactNote: string;
    routes: ContactRoute[];
};

const supportEmail = "support@animaldex.app";

function mailto(subject: string) {
    return `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}`;
}

const en: ContactContent = {
    eyebrow: "Contact AnimalDex",
    title: "Let's talk.",
    description:
        "Need help with AnimalDex, want to work with us, or have something worth sharing? Choose the right route and we'll get you where you need to go.",
    metaTitle: "Contact AnimalDex — Support, Partnerships, Press & Enquiries",
    metaDescription:
        "Contact AnimalDex for app support, partnerships, sponsorships, creator collaborations, press enquiries, and general business questions.",
    supportCalloutEyebrow: "Looking for app support?",
    supportCalloutTitle: "Most product questions are already answered in the Help Center.",
    supportCalloutDescription:
        "Scans, captures, AnimalDex numbers, collections, credits, accounts and privacy are covered there first.",
    supportCalloutCta: "Open Help Center",
    directContactTitle: "Direct contact",
    directContactLead: "Prefer email?",
    directContactNote:
        "Use the Help Center for product and account problems. Choose the relevant enquiry route above for partnerships, sponsorships, press, creators and other business enquiries.",
    routes: [
        {
            id: "support",
            label: "Support",
            heading: "Need help with AnimalDex?",
            description: "Scanning, captures, accounts, purchases, privacy and troubleshooting.",
            cta: "Visit Help Center",
            microcopy: "Find answers or contact support.",
            href: "/support",
            featured: true
        },
        {
            id: "partnerships",
            label: "Partnerships",
            heading: "Let's build something wild.",
            description:
                "For zoos, aquariums, wildlife organisations, tourism partners, conservation projects and other organisations interested in working with AnimalDex.",
            cta: "Discuss a partnership",
            href: mailto("AnimalDex Partnership Enquiry")
        },
        {
            id: "sponsors",
            label: "Sponsors",
            heading: "Reach people who explore.",
            description:
                "Sponsor a free-to-join AnimalDex Challenge for a zoo, aquarium, park, destination, or wildlife brand. Achievement rewards are live. Cash rewards are not.",
            cta: "See how Challenges work",
            microcopy: "Then enquire with the AnimalDex team. There is no self-serve sponsor portal yet.",
            href: "/sponsor-a-challenge"
        },
        {
            id: "creators",
            label: "Creators",
            heading: "Create with AnimalDex.",
            description:
                "Press and brand collaborations are one route. Earning on AnimalDex is another: AnimalDex Wildlife Guides are in live beta, and Creator Rewards is a paused company-funded program — not a collaboration pitch.",
            cta: "Pitch a collaboration",
            microcopy: "To earn in-product, start with Ways to earn on AnimalDex.",
            href: mailto("AnimalDex Creator Collaboration")
        },
        {
            id: "press",
            label: "Press",
            heading: "Writing about AnimalDex?",
            description: "Press enquiries, interviews, product information, media requests and brand assets.",
            cta: "Media enquiry",
            href: mailto("AnimalDex Press Enquiry")
        },
        {
            id: "general",
            label: "General",
            heading: "Something else?",
            description: "If none of the above fits, send us a general enquiry.",
            cta: "Contact AnimalDex",
            href: mailto("AnimalDex General Enquiry")
        }
    ]
};

const id: ContactContent = {
    eyebrow: "Hubungi AnimalDex",
    title: "Mari bicara.",
    description:
        "Butuh bantuan dengan AnimalDex, ingin bekerja sama, atau punya sesuatu yang layak dibagikan? Pilih jalur yang tepat dan kami akan mengarahkanmu.",
    metaTitle: "Hubungi AnimalDex — Dukungan, Kemitraan, Media & Pertanyaan",
    metaDescription:
        "Hubungi AnimalDex untuk bantuan aplikasi, kemitraan, sponsorship, kolaborasi kreator, media, dan pertanyaan bisnis umum.",
    supportCalloutEyebrow: "Mencari bantuan aplikasi?",
    supportCalloutTitle: "Kebanyakan pertanyaan produk sudah ada di Pusat Bantuan.",
    supportCalloutDescription:
        "Scan, capture, nomor AnimalDex, koleksi, kredit, akun, dan privasi sudah dibahas di sana.",
    supportCalloutCta: "Buka Pusat Bantuan",
    directContactTitle: "Kontak langsung",
    directContactLead: "Lebih suka email?",
    directContactNote:
        "Gunakan Pusat Bantuan untuk masalah produk dan akun. Pilih jalur pertanyaan di atas untuk kemitraan, sponsorship, media, kreator, dan pertanyaan bisnis lainnya.",
    routes: [
        {
            id: "support",
            label: "Dukungan",
            heading: "Butuh bantuan dengan AnimalDex?",
            description: "Scanning, capture, akun, pembelian, privasi, dan troubleshooting.",
            cta: "Kunjungi Pusat Bantuan",
            microcopy: "Temukan jawaban atau hubungi dukungan.",
            href: "/support",
            featured: true
        },
        {
            id: "partnerships",
            label: "Kemitraan",
            heading: "Mari bangun sesuatu yang liar.",
            description:
                "Untuk kebun binatang, akuarium, organisasi satwa liar, mitra pariwisata, proyek konservasi, dan organisasi lain yang ingin bekerja sama dengan AnimalDex.",
            cta: "Bahas kemitraan",
            href: mailto("AnimalDex Partnership Enquiry")
        },
        {
            id: "sponsors",
            label: "Sponsor",
            heading: "Jangkau orang yang menjelajah.",
            description:
                "Sponsor Challenge AnimalDex yang bisa diikuti gratis untuk kebun binatang, akuarium, taman, destinasi, atau brand satwa liar. Achievement sudah tersedia. Hadiah uang tunai belum.",
            cta: "Lihat cara Challenge bekerja",
            microcopy: "Setelah itu hubungi tim AnimalDex. Belum ada portal sponsor mandiri.",
            href: "/sponsor-a-challenge"
        },
        {
            id: "creators",
            label: "Kreator",
            heading: "Berkarya dengan AnimalDex.",
            description:
                "Kolaborasi pers dan brand adalah satu jalur. Menghasilkan di AnimalDex adalah jalur lain: Wildlife Guide sedang beta, dan Creator Rewards adalah program yang sedang dijeda — bukan pitch kolaborasi.",
            cta: "Ajukan kolaborasi",
            microcopy: "Untuk menghasilkan di dalam produk, mulai dari Ways to earn on AnimalDex.",
            href: mailto("AnimalDex Creator Collaboration")
        },
        {
            id: "press",
            label: "Media",
            heading: "Menulis tentang AnimalDex?",
            description: "Pertanyaan media, wawancara, informasi produk, permintaan pers, dan aset brand.",
            cta: "Pertanyaan media",
            href: mailto("AnimalDex Press Enquiry")
        },
        {
            id: "general",
            label: "Umum",
            heading: "Ada hal lain?",
            description: "Jika tidak ada yang cocok di atas, kirim pertanyaan umum.",
            cta: "Hubungi AnimalDex",
            href: mailto("AnimalDex General Enquiry")
        }
    ]
};

export function getContactContent(locale: string): ContactContent {
    return locale === "id" ? id : en;
}

export const contactSupportEmail = supportEmail;
