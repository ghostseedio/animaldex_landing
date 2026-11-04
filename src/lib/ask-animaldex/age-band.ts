/* Ported from the apps' supabase/functions/_shared/age-band.ts (AnimalDex strategy/chat-engine, 2026-11-04): keep the two in step. */
/// Who the person is by age, for the chat (strategy contract 3.1, 2026-11-04;
/// the column and RPCs are WS-B's migration 20261104160000 range):
///
/// - under_13: Talk is closed. Every chat request gets a fixed, calm refusal
///   with the code age_restricted; nothing is remembered and the animals never
///   message them.
/// - teen (13 to 17): teen mode. No sensitive facts are remembered, the animals
///   never message them first, and the reply carries a stricter safety block
///   (no romance or role-play drift, an adult they trust for anything hard).
/// - adult, and unknown (no birth year: every account before 3.2): as before.
///
/// The band is read from profiles.birth_year as public.age_band() computes it:
/// this year minus the birth year, the boundary year counting as the older
/// band. Read defensively: before the column exists the read fails and the
/// band is unknown, so this ships ahead of the migration.

export type AgeBand = "unknown" | "under_13" | "teen" | "adult";

export const AGE_RESTRICTED_CODE = "age_restricted";

/// public.age_band(), in TypeScript: the same years, the same boundaries.
export function ageBandFor(birthYear: unknown, now: Date = new Date()): AgeBand {
    const year = typeof birthYear === "number" ? birthYear : typeof birthYear === "string" ? Number(birthYear) : Number.NaN;
    if (!Number.isInteger(year)) return "unknown";
    const thisYear = now.getUTCFullYear();
    if (year < 1900 || year > thisYear) return "unknown";
    const age = thisYear - year;
    if (age < 13) return "under_13";
    if (age < 18) return "teen";
    return "adult";
}

type ProfileAdmin = {
    from: (table: string) => unknown;
};

/// Their band from profiles.birth_year. Unknown on any error, including a
/// missing column (before the migration) or no row.
export async function loadAgeBand(admin: ProfileAdmin, userId: string | null | undefined, now: Date = new Date()): Promise<AgeBand> {
    if (!userId) return "unknown";
    try {
        // deno-lint-ignore no-explicit-any
        const { data, error } = await (admin.from("profiles") as any).select("birth_year").eq("id", userId).maybeSingle();
        if (error || !data) return "unknown";
        return ageBandFor((data as { birth_year?: unknown }).birth_year, now);
    } catch {
        return "unknown";
    }
}

/// The teen-mode block, in the reply's per-turn context (the system prompt
/// stays the same for everyone, so its cache is shared).
export const TEEN_MODE_LINES = [
    "teen_mode — this person is 13 to 17. Everything else holds, and on top of it:",
    "- Keep it friendly and age-appropriate. No romance, flirting, dating advice for them, sexual content or",
    "  role-play of any relationship; if they steer there, say lightly that it is not something you do, and carry on.",
    "- Nothing about alcohol, drugs, gambling, weight loss or dieting as something to try, and no risky dares or",
    "  challenges. A step is always something safe, legal and small they can do at home, at school or outside.",
    "- When they tell you something hard (being hurt, bullied, scared, very low, a secret that worries them), be kind,",
    "  take it seriously, and say plainly that an adult they trust (a parent, a teacher, a school counsellor) can help;",
    "  never keep a secret that puts them at risk, and never promise to.",
    "- Never ask where they live, which school they go to, or for photos of themselves.",
];

/// Never remembered for a teenager, on top of what is never remembered for
/// anyone (EXCLUDED_MEMORY_FACT): their relationships, body and looks, where
/// they are, family trouble, and anything that would identify them.
export const TEEN_EXCLUDED_MEMORY_FACT = new RegExp(
    "\\b(" +
        [
            "boyfriends?", "girlfriends?", "crush(es)?", "dating", "dates?", "dated", "kiss(es|ed|ing)?", "romance", "romantic",
            "relationships?", "in love", "sex(ual)?", "body", "weight", "diet(ing)?", "looks", "appearance", "school(s)?",
            "classmates?", "teachers?", "street", "address", "phone( number)?", "instagram", "snapchat", "tiktok", "discord",
            "username", "divorce[ds]?", "abuse[ds]?", "police", "alcohol", "drunk", "drinking", "drugs?", "vap(e|es|ing)",
            "smok(e|es|ing)", "pregnan(t|cy)", "period", "lives (in|at|on)", "parents?'? (fight|fights|argue|argues)",
        ].join("|") +
        ")\\b",
    "i",
);

export function teenMemoryAllowed(fact: string): boolean {
    return !TEEN_EXCLUDED_MEMORY_FACT.test(fact);
}

/// The memory extraction's extra rule for a teenager.
export const TEEN_MEMORY_RULE =
    "- This person is a teenager: keep only light, everyday things (interests, hobbies, what they are learning or " +
    "making, how they like answers). Never keep relationships or crushes, family trouble, their body or looks, their " +
    "school, where they live, or anything that could identify them.";

/// The refusal for under-13s, by language; others get English. Calm, short,
/// and not the animal speaking.
const AGE_RESTRICTED_WORDS: Record<string, string> = {
    english: "Talk is for ages 13 and up, so the animals can't chat with you yet. You can still collect and explore animals.",
    spanish: "Talk es para mayores de 13 años, así que los animales todavía no pueden hablar contigo. Puedes seguir coleccionando y explorando animales.",
    french: "Talk est réservé aux 13 ans et plus, donc les animaux ne peuvent pas encore discuter avec toi. Tu peux toujours collectionner et explorer des animaux.",
    german: "Talk ist ab 13 Jahren, deshalb können die Tiere noch nicht mit dir chatten. Du kannst aber weiter Tiere sammeln und entdecken.",
    portuguese: "O Talk é para maiores de 13 anos, então os animais ainda não podem conversar com você. Você ainda pode colecionar e explorar animais.",
    italian: "Talk è per chi ha almeno 13 anni, quindi gli animali non possono ancora chattare con te. Puoi comunque collezionare ed esplorare animali.",
    dutch: "Talk is voor 13 jaar en ouder, dus de dieren kunnen nog niet met je chatten. Je kunt wel dieren blijven verzamelen en ontdekken.",
    indonesian: "Talk untuk usia 13 tahun ke atas, jadi para hewan belum bisa mengobrol denganmu. Kamu tetap bisa mengoleksi dan menjelajahi hewan.",
    japanese: "トークは13歳以上向けなので、動物たちはまだあなたとおしゃべりできません。動物を集めたり探したりすることはできます。",
    korean: "토크는 13세 이상만 이용할 수 있어서 동물들이 아직 대화할 수 없어요. 동물을 모으고 탐험하는 건 계속할 수 있어요.",
    "chinese (simplified)": "聊天功能仅限13岁及以上使用，所以动物们暂时还不能和你聊天。你仍然可以收集和探索动物。",
    "chinese (traditional)": "聊天功能僅限13歲以上使用，所以動物們暫時還不能和你聊天。你仍然可以收集和探索動物。",
};

export function ageRestrictedText(languageName: string | null | undefined): string {
    return AGE_RESTRICTED_WORDS[(languageName ?? "").trim().toLowerCase()] ?? AGE_RESTRICTED_WORDS.english;
}

/// What a chat function returns to an under-13 (SPEC 3.1): HTTP 403 with the
/// code, and the words for a client that shows them.
export function ageRestrictedBody(languageName: string | null | undefined): Record<string, unknown> {
    return { error: AGE_RESTRICTED_CODE, code: AGE_RESTRICTED_CODE, message: ageRestrictedText(languageName) };
}
