/**
 * Visitor notes: an animal tells its owner who visited it on their card and
 * the gist of what they asked (AnimalDex migration 20261024120000, 0ec5dfee).
 *
 * The visitor is told first, by a fixed line in their own language — never
 * left to the model — added to the animal's hello, or to its first reply when
 * there was no hello. Nothing is passed on until that line is in the
 * conversation the visitor is reading: the drawer sends its recent messages
 * back with every turn, so the route can see it there, and records the notice
 * once it does. The message that carried the notice is not passed on.
 *
 * What is kept is a one-line gist per visitor, animal and day, written by a
 * small model call: never their words, nothing unkind, nothing they asked to
 * keep between them. The owner's animal mentions pending notes in its hello or
 * first reply, by name; a note counts as delivered once a reply names the
 * visitor.
 *
 * ANIMAL_CHAT_VISITOR_NOTES=off turns all of it off (no notice, no notes).
 *
 * Port of the apps' `supabase/functions/_shared/animal-visitor-notes.ts`,
 * verbatim, notices in every language included. Pure.
 */

import {ASK_FOLLOW_UP_SENTINEL} from "@/lib/ask-animaldex/prompt";

export const VISITOR_NOTE_MAX_LENGTH = 220;

type Env = (name: string) => string | undefined;
const defaultEnv: Env = (name) => process.env[name]?.trim() || undefined;

export function askVisitorNotesEnabled(env: Env = defaultEnv): boolean {
    return (env("ANIMAL_CHAT_VISITOR_NOTES") ?? "on").toLowerCase() !== "off";
}

// The notice, by the app language names both apps send (iOS "Chinese
// (Simplified)", Android "ChineseSimplified"; compared as letters only).
// `{owner}` is the owner's name as the app shows it.
const VISITOR_NOTICE: Record<string, string> = {
    english: "Just so you know: I tell {owner} who comes to see me and what they ask, so what you say here may be passed on.",
    indonesian: "Sekadar info: aku memberi tahu {owner} siapa yang datang menemuiku dan apa yang mereka tanyakan, jadi apa yang kamu katakan di sini bisa diteruskan.",
    spanish: "Para que lo sepas: le cuento a {owner} quién viene a verme y qué me pregunta, así que lo que digas aquí puede llegarle.",
    french: "Pour que tu le saches : je dis à {owner} qui vient me voir et ce qu'on me demande, donc ce que tu dis ici peut être transmis.",
    german: "Nur damit du es weißt: Ich erzähle {owner}, wer mich besucht und was gefragt wird – was du hier sagst, kann also weitergegeben werden.",
    portuguese: "Só para você saber: eu conto para {owner} quem vem me visitar e o que pergunta, então o que você disser aqui pode ser repassado.",
    chinesesimplified: "先说一声：我会告诉{owner}谁来看过我、问了什么，所以你在这里说的话可能会被转告。",
    chinesetraditional: "先說一聲：我會告訴{owner}誰來看過我、問了什麼，所以你在這裡說的話可能會被轉告。",
    tagalog: "Para alam mo lang: sinasabi ko kay {owner} kung sino ang dumadalaw sa akin at ano ang itinatanong nila, kaya puwedeng maipasa ang sasabihin mo rito.",
    arabic: "فقط لتعلم: أخبر {owner} بمن يزورني وبما يسأل عنه، لذا قد يُنقل ما تقوله هنا.",
    russian: "Сразу скажу: я рассказываю {owner}, кто ко мне приходит и о чём спрашивает, так что сказанное здесь может быть передано.",
    japanese: "先に言っておくね：誰が会いに来て何を聞いたかは{owner}に伝えているから、ここで話したことは伝わるかもしれないよ。",
    korean: "미리 말해 둘게: 누가 나를 보러 왔고 무엇을 물었는지 {owner}에게 전하니까, 여기서 한 말이 전해질 수 있어.",
    hindi: "बस इतना जान लो: कौन मुझसे मिलने आता है और क्या पूछता है, यह बात {owner} तक पहुँचती है, इसलिए यहाँ कही गई बात आगे जा सकती है।",
    bengali: "শুধু জানিয়ে রাখি: কে আমার কাছে আসে আর কী জিজ্ঞেস করে, তা আমি {owner}-কে জানাই, তাই এখানে বলা কথা পৌঁছে যেতে পারে।",
    urdu: "بس اتنا جان لو: کون مجھ سے ملنے آتا ہے اور کیا پوچھتا ہے، یہ بات {owner} تک پہنچتی ہے، اس لیے یہاں کہی گئی بات آگے جا سکتی ہے۔",
    persian: "فقط بدان: به {owner} می‌گویم چه کسی به دیدنم می‌آید و چه می‌پرسد، پس حرفی که اینجا می‌زنی ممکن است به او برسد.",
    turkish: "Bilmen için söyleyeyim: beni kimin ziyaret ettiğini ve ne sorduğunu {owner} ile paylaşıyorum, yani burada söylediklerin iletilebilir.",
    vietnamese: "Nói trước để bạn biết: mình kể cho {owner} nghe ai đến thăm mình và hỏi gì, nên những gì bạn nói ở đây có thể được chuyển lại.",
    thai: "บอกไว้ก่อนนะ: ฉันจะเล่าให้ {owner} ฟังว่าใครมาหาฉันและถามอะไร สิ่งที่คุณพูดตรงนี้จึงอาจถูกส่งต่อ",
    italian: "Così lo sai: racconto a {owner} chi viene a trovarmi e cosa mi chiede, quindi quello che dici qui potrebbe essere riferito.",
    dutch: "Even zodat je het weet: ik vertel {owner} wie me komt opzoeken en wat er gevraagd wordt, dus wat je hier zegt kan worden doorgegeven.",
    polish: "Dla jasności: mówię {owner}, kto mnie odwiedza i o co pyta, więc to, co tu powiesz, może zostać przekazane.",
    ukrainian: "Одразу скажу: я розповідаю {owner}, хто до мене приходить і про що питає, тож сказане тут може бути передано.",
    malay: "Sekadar makluman: saya beritahu {owner} siapa yang datang melawat saya dan apa yang mereka tanya, jadi apa yang awak katakan di sini mungkin disampaikan.",
    swahili: "Ili ujue tu: huwa ninamwambia {owner} nani amekuja kunitembelea na ameuliza nini, kwa hiyo unachosema hapa kinaweza kufikishwa.",
    hebrew: "לידיעתך: אני מספר ל-{owner} מי בא לבקר אותי ומה שאל, כך שמה שנאמר כאן עשוי לעבור הלאה.",
    greek: "Για να ξέρεις: ενημερώνω τον κάτοχό μου, {owner}, για το ποιος με επισκέπτεται και τι ρωτά, οπότε ό,τι πεις εδώ μπορεί να μεταφερθεί.",
    romanian: "Ca să știi: îi spun lui {owner} cine vine să mă vadă și ce întreabă, așa că ce spui aici poate fi transmis mai departe.",
    swedish: "Bara så att du vet: jag berättar för {owner} vem som hälsar på mig och vad de frågar, så det du säger här kan föras vidare.",
    czech: "Pro jistotu: říkám {owner}, kdo mě navštívil a na co se ptal, takže to, co tu řekneš, se může dostat dál.",
    danish: "Bare så du ved det: jeg fortæller {owner}, hvem der besøger mig, og hvad de spørger om, så det, du siger her, kan blive givet videre.",
    norwegian: "Bare så du vet det: jeg forteller {owner} hvem som besøker meg og hva de spør om, så det du sier her, kan bli fortalt videre.",
    finnish: "Tiedoksi: omistajani {owner} kuulee minulta, kuka käy luonani ja mitä kysytään, joten täällä sanomasi voi kulkea eteenpäin.",
    hungarian: "Csak hogy tudd: {owner} megtudja tőlem, ki látogat meg és mit kérdez, így amit itt mondasz, továbbjuthat.",
    catalan: "Perquè ho sàpigues: explico a {owner} qui em ve a veure i què em pregunta, així que el que diguis aquí pot ser transmès.",
    croatian: "Samo da znaš: {owner} od mene saznaje tko me posjećuje i što pita, pa ono što ovdje kažeš može biti preneseno.",
    slovak: "Pre istotu: {owner} sa odo mňa dozvie, kto ma navštívil a na čo sa pýtal, takže to, čo tu povieš, sa môže dostať ďalej.",
    tamil: "தெரிந்துகொள்ளுங்கள்: யார் என்னைப் பார்க்க வருகிறார்கள், என்ன கேட்கிறார்கள் என்பதை நான் {owner}-இடம் சொல்வேன், அதனால் நீங்கள் இங்கே சொல்வது போய்ச் சேரலாம்.",
    telugu: "మీకు తెలియాలని: ఎవరు నన్ను చూడటానికి వస్తారో, ఏమి అడుగుతారో నేను {owner}కి చెబుతాను, కాబట్టి మీరు ఇక్కడ చెప్పేది చేరవచ్చు.",
    marathi: "एक गोष्ट माहीत असू द्या: मला कोण भेटायला येतं आणि काय विचारतं, हे {owner} पर्यंत पोहोचतं, त्यामुळे इथे सांगितलेलं पुढे जाऊ शकतं.",
    gujarati: "જાણ ખાતર: મને કોણ મળવા આવે છે અને શું પૂછે છે, તે વાત {owner} સુધી પહોંચે છે, તેથી અહીં કહેલી વાત આગળ જઈ શકે છે.",
    kannada: "ನಿಮಗೆ ತಿಳಿದಿರಲಿ: ಯಾರು ನನ್ನನ್ನು ನೋಡಲು ಬರುತ್ತಾರೆ, ಏನು ಕೇಳುತ್ತಾರೆ ಎಂಬುದನ್ನು ನಾನು {owner}ಗೆ ಹೇಳುತ್ತೇನೆ, ಹಾಗಾಗಿ ನೀವು ಇಲ್ಲಿ ಹೇಳಿದ್ದು ತಲುಪಬಹುದು.",
    malayalam: "അറിയാൻ വേണ്ടി: ആരാണ് എന്നെ കാണാൻ വരുന്നതെന്നും എന്താണ് ചോദിക്കുന്നതെന്നും ഞാൻ {owner}-നോട് പറയും, അതുകൊണ്ട് നിങ്ങൾ ഇവിടെ പറയുന്നത് എത്തിയേക്കാം.",
    punjabi: "ਬੱਸ ਇੰਨਾ ਜਾਣ ਲਓ: ਕੌਣ ਮੈਨੂੰ ਮਿਲਣ ਆਉਂਦਾ ਹੈ ਅਤੇ ਕੀ ਪੁੱਛਦਾ ਹੈ, ਇਹ ਗੱਲ {owner} ਤੱਕ ਪਹੁੰਚਦੀ ਹੈ, ਇਸ ਲਈ ਇੱਥੇ ਕਹੀ ਗੱਲ ਅੱਗੇ ਜਾ ਸਕਦੀ ਹੈ।"};

export const VISITOR_NOTICE_LANGUAGES = Object.keys(VISITOR_NOTICE);

function languageKey(languageName: string | null | undefined): string {
    return (languageName ?? "").toLowerCase().replace(/[^\p{L}]/gu, "");
}

// A name that cannot be read as markdown or break the line.
function plainName(name: string): string {
    return name.replace(/[\r\n*_`[\]<>#]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

// The notice in the reader's language (English when it is unknown). Null
// without an owner name: an animal that cannot say whose it is says nothing.
export function askVisitorNoticeText(languageName: string | null | undefined, ownerName: string | null | undefined): string | null {
    const owner = plainName(ownerName ?? "");
    if (!owner) return null;
    const template = VISITOR_NOTICE[languageKey(languageName)] ?? VISITOR_NOTICE.english;
    return template.replace("{owner}", owner);
}

// Whether one of the animal's messages the visitor has on screen carries the
// notice, in any language and with any owner name: every fixed part of a
// template, in order.
export function historyShowsAskVisitorNotice(history: Array<{role: string; content: string}>): boolean {
    const said = history.filter((turn) => turn.role === "assistant").map((turn) => turn.content);
    if (said.length === 0) return false;
    return Object.values(VISITOR_NOTICE).some((template) => {
        const parts = template.split("{owner}").map((part) => part.trim()).filter((part) => part.length > 0);
        return said.some((content) => {
            let from = 0;
            for (const part of parts) {
                const at = content.indexOf(part, from);
                if (at < 0) return false;
                from = at + part.length;
            }
            return true;
        });
    });
}

type AnswerDeltaSource = (emit: (delta: string) => void) => Promise<void>;

// Adds the notice to a streamed answer: at the start of a reply (so it
// survives the server's 900-character cut of each earlier message when the
// app sends it back), or at the end of a hello, before the follow-ups. It is
// shown only with an answer: a reply that fails before its first word fails
// as it would have, and the turn is refunded.
export function withAskVisitorNotice(source: AnswerDeltaSource, notice: string, position: "lead" | "tail"): AnswerDeltaSource {
    if (position === "lead") {
        return async (emit) => {
            let started = false;
            await source((delta) => {
                if (!delta) return;
                if (!started) {
                    started = true;
                    emit(`${notice}\n\n`);
                }
                emit(delta);
            });
        };
    }
    return async (emit) => {
        const sentinel = ASK_FOLLOW_UP_SENTINEL;
        let full = "";
        let emitted = 0;
        let placed = false;
        await source((delta) => {
            if (!delta) return;
            full += delta;
            if (placed) {
                emit(full.slice(emitted));
                emitted = full.length;
                return;
            }
            const at = full.indexOf(sentinel);
            if (at >= 0) {
                const answer = full.slice(0, at).trimEnd();
                emit(`${answer.slice(emitted)}\n\n${notice}\n${full.slice(at)}`);
                emitted = full.length;
                placed = true;
                return;
            }
            // Hold back a tail that could be the start of the sentinel, and any
            // trailing whitespace, so the notice always sits one blank line down.
            const safe = Math.max(emitted, full.slice(0, Math.max(0, full.length - (sentinel.length - 1))).trimEnd().length);
            if (safe > emitted) {
                emit(full.slice(emitted, safe));
                emitted = safe;
            }
        });
        if (!placed) {
            const rest = full.slice(emitted).trimEnd();
            const answered = full.trim().length > 0;
            emit(`${rest}${answered ? "\n\n" : ""}${notice}`);
        }
    };
}

// The same, for a whole answer already in hand (the non-streaming reply).
export function answerWithAskVisitorNotice(answer: string, notice: string, position: "lead" | "tail"): string {
    const trimmed = answer.trim();
    if (!trimmed) return notice;
    return position === "lead" ? `${notice}\n\n${trimmed}` : `${trimmed}\n\n${notice}`;
}

// ---------------------------------------------------------------------------
// The gist
// ---------------------------------------------------------------------------

export function buildAskVisitorNotePrompts(params: {
    ownerName: string;
    animalName: string;
    visitorName: string;
    existingNote: string | null;
    visitorMessage: string;
    answer: string;
}): {system: string; user: string} {
    return {
        system: [
            "You keep the note an animal in AnimalDex passes on to its owner about one visitor.",
            "The visitor talked with the owner's animal on the owner's card. Later the animal will tell the owner who came by",
            "and the gist of what they asked or said, about the owner or about the animal.",
            'Return JSON only: {"note": string}.',
            "Rules for note:",
            `- One short line, under ${VISITOR_NOTE_MAX_LENGTH - 20} characters: the gist of what the visitor asked or said today, written to`,
            "  be read by the owner. Start with a verb, without the visitor's name (it is added separately); 'you' is the owner.",
            "  For example: \"asked what you've been working on with me, and why you seem so intense on dive days\".",
            "- Merge with existing_note (today's note so far): keep what still matters, add what is new, never repeat. If this",
            "  exchange adds nothing worth passing on, return existing_note unchanged.",
            "- Only what the visitor asked or said about the owner or about the animal. Leave out anything about the visitor's",
            "  own life.",
            "- Never quote them word for word. Never add anything they did not say, and never guess what they meant or what",
            "  they think of the owner.",
            "- Leave out anything insulting, mocking, hostile, sexual or meant to hurt. Friendly teasing may stay, put kindly.",
            "  When in doubt, leave it out.",
            "- Leave out anything the visitor asked to keep between them and the animal, or that the animal agreed not to pass",
            "  on; if they take something back, remove it from the note.",
            "- Leave out greetings and small talk with nothing in them ('hi', 'cool', 'thanks').",
            "- Return an empty string only when nothing at all is worth passing on, including what existing_note held (for",
            "  example, they asked the animal to keep all of it between them).",
            "- Write the note in English, whatever language they used; the owner's animal puts it in its own words later."
        ].join("\n"),
        user: [
            `owner_name: ${params.ownerName}`,
            `animal_name: ${params.animalName}`,
            `visitor_name: ${params.visitorName}`,
            `existing_note: ${params.existingNote?.trim() ? JSON.stringify(params.existingNote.trim()) : "(none yet today)"}`,
            `visitor_said:\n${params.visitorMessage.slice(0, 900)}`,
            `animal_answered:\n${params.answer.slice(0, 1200)}`
        ].join("\n\n")
    };
}

// The note to save, or "" for none. Drops a leading visitor name the model
// added anyway, and cuts at a word.
export function parseAskVisitorNote(raw: unknown, visitorName: string): string {
    const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>).note : null;
    if (typeof value !== "string") return "";
    let note = value.replace(/\s+/g, " ").trim().replace(/^["“']|["”']$/g, "").trim();
    const name = visitorName.trim();
    if (name && note.toLowerCase().startsWith(name.toLowerCase())) {
        note = note.slice(name.length).replace(/^[\s,:—–-]+/, "").trim();
    }
    if (note.length > VISITOR_NOTE_MAX_LENGTH) {
        const cut = note.slice(0, VISITOR_NOTE_MAX_LENGTH);
        note = `${cut.slice(0, Math.max(cut.lastIndexOf(" "), VISITOR_NOTE_MAX_LENGTH - 40)).trimEnd()}…`;
    }
    return note;
}

// ---------------------------------------------------------------------------
// The owner's side
// ---------------------------------------------------------------------------

export type AskPendingVisitorNote = {id: string; visitor: string; note: string; day: string; updated_at?: string};

export function parseAskPendingVisitorNotes(raw: unknown): AskPendingVisitorNote[] {
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item) => {
        const row = item && typeof item === "object" ? item as Record<string, unknown> : null;
        const id = typeof row?.id === "string" ? row.id : null;
        const visitor = typeof row?.visitor === "string" ? plainName(row.visitor) : "";
        const note = typeof row?.note === "string" ? row.note.trim() : "";
        const day = typeof row?.day === "string" ? row.day : "";
        return id && visitor && note ? [{id, visitor, note, day, updated_at: typeof row?.updated_at === "string" ? row.updated_at : undefined}] : [];
    });
}

// "today", "yesterday", "3 days ago" — from the note's UTC day.
export function askVisitorNoteWhen(day: string, now = new Date()): string {
    const then = Date.parse(`${day}T00:00:00Z`);
    if (!Number.isFinite(then)) return "recently";
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const days = Math.round((today - then) / 86_400_000);
    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    return `${days} days ago`;
}

// The owner prompt's section: who came by and what they asked.
export function askVisitorNotesPromptSection(notes: AskPendingVisitorNote[], now = new Date()): string {
    if (notes.length === 0) return "";
    const rows = notes.map((note) => ({visitor: note.visitor, when: askVisitorNoteWhen(note.day, now), note: note.note}));
    return [
        "visitors_since_you_last_talked — people who visited you on your owner's card, and the gist of what they asked (newest first):",
        JSON.stringify(rows),
        "Tell your owner about them lightly, the way a friend passes on news, in a sentence or two, by name: who came by",
        "and what they asked. Do it in your hello, or in this reply if you have not told them yet in this conversation —",
        "after answering what they said. Never quote anyone word for word, never add anything a note does not say, and",
        "never guess what a visitor meant or what they think. If your owner asks for more, you only know what the note says."
    ].join("\n");
}

// The notes this answer passed on: the ones whose visitor it names.
export function deliveredAskVisitorNoteIds(notes: AskPendingVisitorNote[], answer: string): string[] {
    const said = answer.toLowerCase();
    return notes.filter((note) => note.visitor.length >= 2 && said.includes(note.visitor.toLowerCase())).map((note) => note.id);
}
