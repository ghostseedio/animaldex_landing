import type {DiagramStep} from "@/lib/text-diagram";

/**
 * How the animals work, said the same way everywhere on the site
 * (docs/rich-chat/SPEC.md §3 and §5): the six points of the Help section, the
 * loop from a photo to a Power, and one question with two animals on opposite
 * sides. The Help page, /how-it-works, /advice-fatigue and the home page all
 * read from here. English and Indonesian; other locales read the English.
 *
 * Every line is true of the app today. The owl and cheetah replies are
 * illustrative copy, as the onboarding's are, not chat replies.
 */

export type PerspectiveLocale = "en" | "id";

export function perspectiveLocale(locale: string): PerspectiveLocale {
    return locale === "id" ? "id" : "en";
}

export type AnimalsWorkPoint = {
    id: "power" | "side" | "disagree" | "step" | "debates" | "trials";
    /** A short name for the point, for cards and headings. */
    title: string;
    /** The Help text, verbatim from the spec (§3.2). */
    text: string;
};

const ANIMALS_WORK_POINTS: Record<PerspectiveLocale, AnimalsWorkPoint[]> = {
    en: [
        {id: "power", title: "A Power", text: "Every animal has a Power: a lesson from how its kind survives."},
        {id: "side", title: "Its own side", text: "It answers from its own life. It takes a side and keeps it, even when it isn't what you hoped to hear."},
        {id: "disagree", title: "Different sides", text: "Different animals disagree. That's the point: ask two, and you see your problem from two sides."},
        {id: "step", title: "Your step", text: "Your step: bring it a real problem and it gives you one step to try. Do it, and its Power is yours."},
        {id: "debates", title: "Debates", text: "Debates: once its Power is yours, it can bring other animals in to argue your problem, privately or in public."},
        {id: "trials", title: "Trials", text: "Trials: each animal's own challenges, one more way to get a step."}
    ],
    id: [
        {id: "power", title: "Sebuah Kekuatan", text: "Setiap hewan punya Kekuatan: pelajaran dari cara jenisnya bertahan hidup."},
        {id: "side", title: "Sisinya sendiri", text: "Ia menjawab dari hidupnya sendiri. Ia memilih satu sisi dan bertahan di sana, meski itu bukan yang kamu harapkan."},
        {id: "disagree", title: "Sisi yang berbeda", text: "Hewan yang berbeda punya pendapat berbeda. Justru itu intinya: tanyakan pada dua hewan, dan kamu melihat masalahmu dari dua sisi."},
        {id: "step", title: "Langkahmu", text: "Langkahmu: bawakan ia masalah yang nyata, dan ia memberimu satu langkah untuk dicoba. Lakukan, dan Kekuatannya jadi milikmu."},
        {id: "debates", title: "Debat", text: "Debat: setelah Kekuatannya jadi milikmu, ia bisa mengajak hewan lain memperdebatkan masalahmu, secara privat atau di depan publik."},
        {id: "trials", title: "Uji Coba", text: "Uji Coba: tantangan milik setiap hewan, satu cara lagi untuk mendapatkan langkah."}
    ]
};

/**
 * A point's text without its own "Your step: " lead-in, for cards that already
 * show the title above it (WEB-43), so the card does not say it twice. The
 * spec's full sentence stays the source (Help, llms.txt, the apps).
 */
export function animalsWorkPointBody(point: AnimalsWorkPoint): string {
    const prefix = `${point.title}:`;
    if (!point.text.toLowerCase().startsWith(prefix.toLowerCase())) return point.text;
    const rest = point.text.slice(prefix.length).trim();
    return rest.charAt(0).toUpperCase() + rest.slice(1);
}

export function getAnimalsWorkPoints(locale: string): AnimalsWorkPoint[] {
    return ANIMALS_WORK_POINTS[perspectiveLocale(locale)];
}

export type PerspectiveFlow = {
    title: string;
    steps: DiagramStep[];
    branch: DiagramStep;
};

/** The user flow: Capture → Bring a real problem → The animal takes a side → Your step → Power earned, with Debates as the branch. */
const FLOW: Record<PerspectiveLocale, PerspectiveFlow> = {
    en: {
        title: "AnimalDex user flow",
        steps: [
            {title: "1. Capture", body: "Photograph a real animal. It becomes yours to talk to."},
            {title: "2. Bring a real problem", body: "A decision, a conflict or a habit, in your own words."},
            {title: "3. The animal takes a side", body: "Its kind's verdict, read from its Power. It keeps it."},
            {title: "4. Your step", body: "One real step to try in your own life. Do it, and tell it how it went."},
            {title: "5. Power earned", body: "The first step you finish together makes its Power yours."}
        ],
        branch: {title: "Debates", body: "It brings other animals in to argue your problem: private, or public with a community vote."}
    },
    id: {
        title: "Alur pengguna AnimalDex",
        steps: [
            {title: "1. Tangkap", body: "Foto hewan sungguhan. Ia jadi milikmu untuk diajak bicara."},
            {title: "2. Bawa masalah nyata", body: "Keputusan, konflik, atau kebiasaan, dengan kata-katamu sendiri."},
            {title: "3. Hewan memilih sisi", body: "Putusan jenisnya, dibaca dari Kekuatannya. Ia bertahan di sana."},
            {title: "4. Langkahmu", body: "Satu langkah nyata untuk dicoba dalam hidupmu. Lakukan, lalu ceritakan hasilnya."},
            {title: "5. Kekuatan didapat", body: "Langkah pertama yang kalian selesaikan bersama membuat Kekuatannya jadi milikmu."}
        ],
        branch: {title: "Debat", body: "Ia mengajak hewan lain memperdebatkan masalahmu: privat, atau publik dengan voting komunitas."}
    }
};

export function getPerspectiveFlow(locale: string): PerspectiveFlow {
    return FLOW[perspectiveLocale(locale)];
}

/** Inner widths for the flow's boxes: the main column fits a phone's panel, the branch scrolls into view beside it. */
export const PERSPECTIVE_FLOW_WIDTHS = {step: 32, branch: 24} as const;

export type DisagreeingAnimal = {
    slug: string;
    name: string;
    /** "Its Power · Night Focus Strategy". */
    power: string;
    reply: string;
    /** The species icon art; the welcome owl ships with the site. */
    image: string;
};

export type DisagreeExample = {
    label: string;
    question: string;
    animals: [DisagreeingAnimal, DisagreeingAnimal];
    caption: string;
};

const OWL_IMAGE = "/images/welcome/little-owl.webp";

/**
 * One question, two animals on opposite sides (spec §3.1). The words are the
 * spec's illustrative copy; the Power names are the ones the site's own
 * species and Power pages show.
 */
const DISAGREE: Record<PerspectiveLocale, Omit<DisagreeExample, "animals"> & {animals: Array<Omit<DisagreeingAnimal, "image">>}> = {
    en: {
        label: "An example: one question, and two animals answering it from opposite sides",
        question: "Should I take the promotion?",
        animals: [
            {slug: "little-owl", name: "Little Owl", power: "Its Power · Night Focus Strategy", reply: "Not yet. I watch a whole night before I move. Learn the team first."},
            {slug: "cheetah", name: "Cheetah", power: "Its Power · Spring-Loaded Spine", reply: "Take it. I win by going all in, fast, before the chance is gone."}
        ],
        caption: "An example. In a real chat, each animal writes its reply in the moment, from its own Power."
    },
    id: {
        label: "Sebuah contoh: satu pertanyaan, dan dua hewan menjawabnya dari sisi yang berlawanan",
        question: "Haruskah aku menerima promosi itu?",
        animals: [
            {slug: "little-owl", name: "Burung Hantu Kecil", power: "Kekuatannya · Night Focus Strategy", reply: "Jangan dulu. Aku mengamati semalaman penuh sebelum bergerak. Kenali timnya dulu."},
            {slug: "cheetah", name: "Cheetah", power: "Kekuatannya · Spring-Loaded Spine", reply: "Terima. Aku menang dengan habis-habisan, cepat, sebelum kesempatannya hilang."}
        ],
        caption: "Sebuah contoh. Di obrolan sungguhan, setiap hewan menulis jawabannya saat itu juga, dari Kekuatannya sendiri."
    }
};

export function getDisagreeExample(locale: string, artworkUrl: (slug: string) => string): DisagreeExample {
    const example = DISAGREE[perspectiveLocale(locale)];
    const [owl, cheetah] = example.animals;
    return {
        ...example,
        animals: [
            {...owl, image: OWL_IMAGE},
            {...cheetah, image: artworkUrl(cheetah.slug)}
        ]
    };
}

/** The quiet line at the top of a chat (spec §3.3), `{name}` = the animal. */
export function ownPowerLine(locale: string, name: string): string {
    return perspectiveLocale(locale) === "id"
        ? `${name} menjawab dari Kekuatannya sendiri. Hewan lain mungkin akan mengatakan sebaliknya.`
        : `${name} answers from its own Power. Another animal may tell you the opposite.`;
}
