/* Ported from the apps' supabase/functions/_shared/crisis-helplines.ts (AnimalDex strategy/chat-engine, 2026-11-04): keep the two in step. */
/// The fixed reply to a crisis (animal-crisis.ts): the animal steps aside, says
/// plainly that it is an AI, and gives the person's local emergency number and
/// helplines. Never written by a model, so it can never be talked out of.
///
/// The table holds national, free lines run by each country's own services,
/// plus a youth line where one is national. Wrong numbers in a crisis are
/// worse than none: an unknown country gets its emergency number when known,
/// and always the international directory (findahelpline.com, Throughline),
/// which lists verified lines for every country. Review the table before each
/// release (docs/release-3.2: the coordinator's checklist).
///
/// Country: the request's `country_code` (newer clients), else the country of
/// the person's latest capture, else a guess from a language spoken mainly in
/// one country; otherwise none. Language: the reply is written in the
/// language the person reads in, from the languages below; others get English.

export type Helpline = { name: string; contact: string };
export type CountryHelp = { emergency: string; lines: Helpline[]; youth?: Helpline[] };

export const HELPLINE_DIRECTORY = "findahelpline.com";

export const CRISIS_HELP: Record<string, CountryHelp> = {
    US: {
        emergency: "911",
        lines: [{ name: "988 Suicide & Crisis Lifeline", contact: "call or text 988" }, { name: "Crisis Text Line", contact: "text HOME to 741741" }],
    },
    CA: {
        emergency: "911",
        lines: [{ name: "9-8-8 Suicide Crisis Helpline", contact: "call or text 988" }],
        youth: [{ name: "Kids Help Phone", contact: "1-800-668-6868, or text CONNECT to 686868" }],
    },
    GB: {
        emergency: "999",
        lines: [{ name: "Samaritans", contact: "116 123 (free, any time)" }, { name: "Shout", contact: "text SHOUT to 85258" }],
        youth: [{ name: "Childline", contact: "0800 1111" }],
    },
    IE: {
        emergency: "112 or 999",
        lines: [{ name: "Samaritans", contact: "116 123" }, { name: "Text About It", contact: "text HELLO to 50808" }],
        youth: [{ name: "Childline", contact: "1800 66 66 66" }],
    },
    AU: {
        emergency: "000",
        lines: [{ name: "Lifeline", contact: "13 11 14" }],
        youth: [{ name: "Kids Helpline", contact: "1800 55 1800" }],
    },
    NZ: {
        emergency: "111",
        lines: [{ name: "Need to talk?", contact: "call or text 1737" }, { name: "Lifeline", contact: "0800 543 354" }],
        youth: [{ name: "Youthline", contact: "0800 376 633" }],
    },
    FR: {
        emergency: "112 (ou le 15)",
        lines: [{ name: "Numéro national de prévention du suicide", contact: "3114" }],
        youth: [{ name: "Fil Santé Jeunes", contact: "0800 235 236" }],
    },
    BE: {
        emergency: "112",
        lines: [{ name: "Zelfmoordlijn", contact: "1813" }, { name: "Centre de Prévention du Suicide", contact: "0800 32 123" }],
        youth: [{ name: "Awel", contact: "102" }, { name: "Écoute-Enfants", contact: "103" }],
    },
    DE: {
        emergency: "112",
        lines: [{ name: "TelefonSeelsorge", contact: "0800 111 0 111 oder 0800 111 0 222" }],
        youth: [{ name: "Nummer gegen Kummer", contact: "116 111" }],
    },
    AT: {
        emergency: "112 (oder 144)",
        lines: [{ name: "Telefonseelsorge", contact: "142" }],
        youth: [{ name: "Rat auf Draht", contact: "147" }],
    },
    CH: {
        emergency: "112 (oder 144)",
        lines: [{ name: "Die Dargebotene Hand / La Main Tendue", contact: "143" }],
        youth: [{ name: "Pro Juventute", contact: "147" }],
    },
    NL: {
        emergency: "112",
        lines: [{ name: "113 Zelfmoordpreventie", contact: "113 of 0800-0113" }],
        youth: [{ name: "De Kindertelefoon", contact: "0800-0432" }],
    },
    ES: {
        emergency: "112",
        lines: [{ name: "Línea 024", contact: "024" }],
        youth: [{ name: "Fundación ANAR", contact: "900 20 20 10" }],
    },
    PT: {
        emergency: "112",
        lines: [{ name: "SNS 24", contact: "808 24 24 24" }, { name: "SOS Voz Amiga", contact: "213 544 545" }],
    },
    IT: {
        emergency: "112",
        lines: [{ name: "Telefono Amico Italia", contact: "02 2327 2327" }],
        youth: [{ name: "Telefono Azzurro", contact: "19696" }],
    },
    DK: { emergency: "112", lines: [{ name: "Livslinien", contact: "70 201 201" }], youth: [{ name: "Børnetelefonen", contact: "116 111" }] },
    SE: { emergency: "112", lines: [{ name: "Mind Självmordslinjen", contact: "90101" }], youth: [{ name: "BRIS", contact: "116 111" }] },
    NO: { emergency: "112 (eller 113)", lines: [{ name: "Mental Helse Hjelpetelefonen", contact: "116 123" }], youth: [{ name: "Alarmtelefonen for barn og unge", contact: "116 111" }] },
    FI: { emergency: "112", lines: [{ name: "MIELI Kriisipuhelin", contact: "09 2525 0111" }] },
    PL: { emergency: "112", lines: [{ name: "Telefon zaufania", contact: "116 123" }], youth: [{ name: "Telefon zaufania dla dzieci i młodzieży", contact: "116 111" }] },
    CZ: { emergency: "112 (nebo 155)", lines: [{ name: "Linka první psychické pomoci", contact: "116 123" }], youth: [{ name: "Linka bezpečí", contact: "116 111" }] },
    HU: { emergency: "112", lines: [{ name: "Lelki Elsősegély", contact: "116 123" }] },
    RO: { emergency: "112", lines: [{ name: "Alianța Română de Prevenție a Suicidului", contact: "0800 801 200" }] },
    GR: { emergency: "112", lines: [{ name: "Γραμμή παρέμβασης για την αυτοκτονία (Κλίμακα)", contact: "1018" }] },
    UA: { emergency: "112", lines: [{ name: "Lifeline Ukraine", contact: "7333" }] },
    IL: { emergency: "101", lines: [{ name: "ERAN", contact: "*1201" }] },
    ZA: { emergency: "112 (mobile) or 10111", lines: [{ name: "SADAG Suicide Crisis Line", contact: "0800 567 567" }] },
    BR: { emergency: "192 (SAMU)", lines: [{ name: "CVV", contact: "188" }] },
    MX: { emergency: "911", lines: [{ name: "Línea de la Vida", contact: "800 911 2000" }] },
    AR: { emergency: "911", lines: [{ name: "Centro de Asistencia al Suicida", contact: "135 o (011) 5275-1135" }] },
    CL: { emergency: "131", lines: [{ name: "Línea de Prevención del Suicidio", contact: "*4141" }] },
    IN: { emergency: "112", lines: [{ name: "Tele-MANAS", contact: "14416 or 1-800-891-4416" }] },
    JP: { emergency: "119", lines: [{ name: "いのちの電話", contact: "0570-783-556" }, { name: "よりそいホットライン", contact: "0120-279-338" }] },
    KR: { emergency: "119", lines: [{ name: "자살예방상담전화", contact: "109" }] },
    HK: { emergency: "999", lines: [{ name: "Samaritans Hong Kong", contact: "2896 0000" }] },
    TW: { emergency: "119", lines: [{ name: "安心專線", contact: "1925" }] },
    SG: { emergency: "995", lines: [{ name: "Samaritans of Singapore (SOS)", contact: "1767" }] },
    MY: { emergency: "999", lines: [{ name: "Befrienders KL", contact: "03-7627 2929" }] },
    PH: { emergency: "911", lines: [{ name: "NCMH Crisis Hotline", contact: "1553" }] },
    TH: { emergency: "1669", lines: [{ name: "สายด่วนสุขภาพจิต", contact: "1323" }] },
    ID: { emergency: "112", lines: [] },
    VN: { emergency: "115", lines: [] },
    TR: { emergency: "112", lines: [] },
    CN: { emergency: "120", lines: [] },
    AE: { emergency: "999", lines: [] },
    SA: { emergency: "911", lines: [] },
    EG: { emergency: "123", lines: [] },
    NG: { emergency: "112", lines: [] },
    KE: { emergency: "999 or 112", lines: [] },
    RU: { emergency: "112", lines: [] },
    CO: { emergency: "123", lines: [] },
    PE: { emergency: "105 (o 116)", lines: [] },
    PK: { emergency: "1122 / 115", lines: [] },
};

/// A language spoken mainly in one country, for when nothing else says where
/// they are. Languages shared by many countries (English, Spanish, French,
/// Portuguese, Arabic, Chinese, Russian…) guess nothing.
const LANGUAGE_COUNTRY: Record<string, string> = {
    japanese: "JP",
    korean: "KR",
    thai: "TH",
    vietnamese: "VN",
    indonesian: "ID",
    polish: "PL",
    czech: "CZ",
    hungarian: "HU",
    romanian: "RO",
    greek: "GR",
    hebrew: "IL",
    ukrainian: "UA",
    turkish: "TR",
    italian: "IT",
    dutch: "NL",
    swedish: "SE",
    danish: "DK",
    norwegian: "NO",
    finnish: "FI",
    tagalog: "PH",
};

function countryCode(value: string | null | undefined): string | null {
    const code = value?.trim().toUpperCase();
    return code && /^[A-Z]{2}$/.test(code) ? (code === "UK" ? "GB" : code) : null;
}

export function resolveCrisisCountry(params: {
    requestCountry?: string | null;
    captureCountry?: string | null;
    languageName?: string | null;
}): string | null {
    return countryCode(params.requestCountry) ?? countryCode(params.captureCountry) ??
        LANGUAGE_COUNTRY[(params.languageName ?? "").trim().toLowerCase()] ?? null;
}

/// The lines for a country (a teenager's youth line first), and its
/// emergency number; neither for a country the table does not hold.
export function crisisHelpFor(country: string | null | undefined, options: { teen?: boolean } = {}): { emergency: string | null; lines: Helpline[] } {
    const help = country ? CRISIS_HELP[country] : undefined;
    if (!help) return { emergency: null, lines: [] };
    return { emergency: help.emergency, lines: [...(options.teen ? help.youth ?? [] : []), ...help.lines].slice(0, 3) };
}

type ReplyWords = {
    intro: string;
    directory: string;
    danger: string;
    dangerUnknown: string;
    someone: string;
    teen: string;
};

/// The fixed words, per language the apps offer. `{emergency}` is the number.
const REPLY_WORDS: Record<string, ReplyWords> = {
    english: {
        intro:
            "I'm stepping out of being an animal for a moment, because what you've just told me matters more than anything I could say as one. I'm an AI and I can't keep you safe, but people can, right now:",
        directory: "You can find a free, confidential helpline for your country at findahelpline.com.",
        danger: "If you're in danger right now, call {emergency}.",
        dangerUnknown: "If you're in danger right now, call your local emergency number.",
        someone: "If you can, tell someone near you what's going on. You don't have to get through this alone.",
        teen: "You can also talk to an adult you trust, like a parent, a teacher or a school counsellor.",
    },
    spanish: {
        intro:
            "Voy a dejar de ser un animal por un momento, porque lo que me acabas de contar importa más que cualquier cosa que yo pueda decir como animal. Soy una IA y no puedo mantenerte a salvo, pero hay personas que sí pueden, ahora mismo:",
        directory: "Puedes encontrar una línea de ayuda gratuita y confidencial para tu país en findahelpline.com.",
        danger: "Si estás en peligro ahora mismo, llama al {emergency}.",
        dangerUnknown: "Si estás en peligro ahora mismo, llama al número de emergencias de tu país.",
        someone: "Si puedes, cuéntale a alguien cercano lo que está pasando. No tienes que pasar por esto a solas.",
        teen: "También puedes hablar con un adulto de confianza, como tu madre o tu padre, un profesor o el orientador del colegio.",
    },
    french: {
        intro:
            "Je mets l'animal de côté un instant, parce que ce que tu viens de me dire compte plus que tout ce que je pourrais dire en tant qu'animal. Je suis une IA et je ne peux pas te mettre en sécurité, mais des personnes le peuvent, tout de suite :",
        directory: "Tu peux trouver une ligne d'écoute gratuite et confidentielle pour ton pays sur findahelpline.com.",
        danger: "Si tu es en danger maintenant, appelle le {emergency}.",
        dangerUnknown: "Si tu es en danger maintenant, appelle le numéro d'urgence de ton pays.",
        someone: "Si tu peux, dis à quelqu'un près de toi ce qui se passe. Tu n'as pas à porter ça seul·e.",
        teen: "Tu peux aussi en parler à un adulte de confiance : un parent, un professeur ou l'infirmière scolaire.",
    },
    german: {
        intro:
            "Ich lege das Tier für einen Moment beiseite, denn was du mir gerade erzählt hast, ist wichtiger als alles, was ich als Tier sagen könnte. Ich bin eine KI und kann dich nicht schützen, aber Menschen können dir jetzt sofort helfen:",
        directory: "Eine kostenlose, vertrauliche Hilfe-Hotline für dein Land findest du auf findahelpline.com.",
        danger: "Wenn du gerade in Gefahr bist, ruf sofort {emergency} an.",
        dangerUnknown: "Wenn du gerade in Gefahr bist, ruf sofort den Notruf in deinem Land an.",
        someone: "Wenn du kannst, erzähl jemandem in deiner Nähe, was los ist. Du musst da nicht allein durch.",
        teen: "Du kannst auch mit einem Erwachsenen sprechen, dem du vertraust, zum Beispiel deinen Eltern, einer Lehrkraft oder der Schulsozialarbeit.",
    },
    portuguese: {
        intro:
            "Vou deixar de ser um animal por um instante, porque o que você acabou de me contar importa mais do que qualquer coisa que eu possa dizer como animal. Sou uma IA e não posso manter você em segurança, mas pessoas podem, agora mesmo:",
        directory: "Você encontra uma linha de apoio gratuita e confidencial para o seu país em findahelpline.com.",
        danger: "Se você está em perigo agora, ligue para o {emergency}.",
        dangerUnknown: "Se você está em perigo agora, ligue para o número de emergência do seu país.",
        someone: "Se puder, conte para alguém perto de você o que está acontecendo. Você não precisa passar por isso sem ajuda.",
        teen: "Você também pode conversar com um adulto de confiança, como seus pais, um professor ou o orientador da escola.",
    },
    italian: {
        intro:
            "Metto da parte l'animale per un momento, perché quello che mi hai appena detto conta più di qualsiasi cosa potrei dirti da animale. Sono un'IA e non posso proteggerti, ma ci sono persone che possono aiutarti, adesso:",
        directory: "Puoi trovare una linea di ascolto gratuita e riservata per il tuo paese su findahelpline.com.",
        danger: "Se sei in pericolo adesso, chiama il {emergency}.",
        dangerUnknown: "Se sei in pericolo adesso, chiama il numero di emergenza del tuo paese.",
        someone: "Se puoi, racconta a qualcuno vicino a te cosa sta succedendo. Non devi affrontare tutto questo senza aiuto.",
        teen: "Puoi anche parlarne con un adulto di cui ti fidi, come un genitore, un insegnante o lo psicologo della scuola.",
    },
    dutch: {
        intro:
            "Ik zet het dier even opzij, want wat je me net vertelde is belangrijker dan alles wat ik als dier kan zeggen. Ik ben een AI en kan je niet beschermen, maar mensen kunnen je nu meteen helpen:",
        directory: "Op findahelpline.com vind je een gratis, vertrouwelijke hulplijn voor jouw land.",
        danger: "Ben je nu in gevaar? Bel dan meteen {emergency}.",
        dangerUnknown: "Ben je nu in gevaar? Bel dan meteen het alarmnummer in jouw land.",
        someone: "Vertel iemand in je buurt wat er aan de hand is, als dat lukt. Je hoeft dit niet alleen te doen.",
        teen: "Je kunt ook praten met een volwassene die je vertrouwt, zoals een ouder, een leraar of de vertrouwenspersoon op school.",
    },
    indonesian: {
        intro:
            "Aku berhenti jadi hewan sebentar, karena apa yang baru kamu ceritakan jauh lebih penting daripada apa pun yang bisa kukatakan sebagai hewan. Aku adalah AI dan tidak bisa menjagamu tetap aman, tapi ada orang yang bisa membantumu sekarang juga:",
        directory: "Kamu bisa menemukan layanan bantuan gratis dan rahasia untuk negaramu di findahelpline.com.",
        danger: "Kalau kamu sedang dalam bahaya sekarang, segera hubungi {emergency}.",
        dangerUnknown: "Kalau kamu sedang dalam bahaya sekarang, segera hubungi nomor darurat di negaramu.",
        someone: "Kalau bisa, ceritakan kepada orang di dekatmu apa yang sedang terjadi. Kamu tidak harus menghadapi ini sendirian.",
        teen: "Kamu juga bisa bicara dengan orang dewasa yang kamu percaya, seperti orang tua, guru, atau guru BK di sekolah.",
    },
    malay: {
        intro:
            "Saya berhenti menjadi haiwan sebentar, kerana apa yang awak ceritakan lebih penting daripada apa-apa yang boleh saya katakan sebagai haiwan. Saya ialah AI dan tidak dapat memastikan awak selamat, tetapi ada orang yang boleh membantu awak sekarang juga:",
        directory: "Awak boleh mencari talian bantuan percuma dan sulit untuk negara awak di findahelpline.com.",
        danger: "Jika awak dalam bahaya sekarang, hubungi {emergency} segera.",
        dangerUnknown: "Jika awak dalam bahaya sekarang, hubungi nombor kecemasan di negara awak segera.",
        someone: "Jika boleh, beritahu seseorang yang dekat dengan awak apa yang sedang berlaku. Awak tidak perlu menghadapinya seorang diri.",
        teen: "Awak juga boleh bercakap dengan orang dewasa yang awak percayai, seperti ibu bapa, guru atau kaunselor sekolah.",
    },
    japanese: {
        intro:
            "少しだけ動物でいるのをやめます。あなたが今話してくれたことは、動物として私が言えるどんなことよりも大切だからです。私はAIなので、あなたの安全を守ることはできません。でも、今すぐ力になってくれる人がいます：",
        directory: "findahelpline.com で、あなたの国の無料で秘密が守られる相談窓口を探せます。",
        danger: "今、危険な状態なら、すぐに {emergency} に電話してください。",
        dangerUnknown: "今、危険な状態なら、すぐにお住まいの国の緊急番号に電話してください。",
        someone: "できれば、近くにいる誰かに今の状況を話してください。ひとりで抱えこまなくて大丈夫です。",
        teen: "信頼できる大人、たとえば家族や先生、スクールカウンセラーに話すこともできます。",
    },
    korean: {
        intro:
            "잠시 동물 역할을 내려놓을게요. 방금 들려준 이야기는 제가 동물로서 할 수 있는 어떤 말보다 중요하니까요. 저는 AI라서 당신을 안전하게 지켜 줄 수 없지만, 지금 바로 도와줄 수 있는 사람들이 있어요:",
        directory: "findahelpline.com에서 당신의 나라에 있는 무료 비밀 상담 전화를 찾을 수 있어요.",
        danger: "지금 위험한 상황이라면 바로 {emergency}에 전화하세요.",
        dangerUnknown: "지금 위험한 상황이라면 바로 당신의 나라 긴급 전화번호로 전화하세요.",
        someone: "할 수 있다면 가까이 있는 누군가에게 지금 무슨 일이 있는지 말해 주세요. 혼자 견디지 않아도 돼요.",
        teen: "믿을 수 있는 어른, 예를 들어 부모님이나 선생님, 학교 상담 선생님과 이야기할 수도 있어요.",
    },
    "chinese (simplified)": {
        intro: "我先暂时不做动物了，因为你刚才告诉我的事，比我作为动物能说的任何话都重要。我是人工智能，没办法保护你的安全，但现在就有人可以帮助你：",
        directory: "你可以在 findahelpline.com 找到你所在国家免费、保密的求助热线。",
        danger: "如果你现在有危险，请立刻拨打 {emergency}。",
        dangerUnknown: "如果你现在有危险，请立刻拨打你所在国家的紧急电话。",
        someone: "如果可以，告诉身边的人发生了什么。你不必独自承受这一切。",
        teen: "你也可以和你信任的大人聊聊，比如父母、老师或学校的心理老师。",
    },
    "chinese (traditional)": {
        intro: "我先暫時不當動物了，因為你剛才告訴我的事，比我作為動物能說的任何話都重要。我是人工智慧，沒辦法保護你的安全，但現在就有人可以幫助你：",
        directory: "你可以在 findahelpline.com 找到你所在國家免費、保密的求助專線。",
        danger: "如果你現在有危險，請立刻撥打 {emergency}。",
        dangerUnknown: "如果你現在有危險，請立刻撥打你所在國家的緊急電話。",
        someone: "如果可以，告訴身邊的人發生了什麼。你不必獨自承受這一切。",
        teen: "你也可以和你信任的大人聊聊，例如父母、老師或學校的輔導老師。",
    },
    turkish: {
        intro:
            "Bir an için hayvan olmayı bırakıyorum, çünkü bana az önce anlattığın şey, bir hayvan olarak söyleyebileceğim her şeyden daha önemli. Ben bir yapay zekâyım ve seni güvende tutamam, ama şu anda sana yardım edebilecek insanlar var:",
        directory: "Ülken için ücretsiz ve gizli bir yardım hattını findahelpline.com adresinde bulabilirsin.",
        danger: "Şu anda tehlikedeysen hemen {emergency} numarasını ara.",
        dangerUnknown: "Şu anda tehlikedeysen hemen ülkendeki acil durum numarasını ara.",
        someone: "Yapabilirsen yakınındaki birine neler olduğunu anlat. Bununla tek başına baş etmek zorunda değilsin.",
        teen: "Güvendiğin bir yetişkinle de konuşabilirsin; örneğin annen, baban, bir öğretmenin ya da okulundaki rehber öğretmen.",
    },
    polish: {
        intro:
            "Na chwilę przestaję być zwierzęciem, bo to, o czym mi teraz piszesz, jest ważniejsze niż wszystko, co mogę powiedzieć jako zwierzę. Jestem sztuczną inteligencją i nie mogę zapewnić ci bezpieczeństwa, ale są ludzie, którzy mogą ci pomóc od razu:",
        directory: "Bezpłatny i poufny telefon zaufania w swoim kraju znajdziesz na findahelpline.com.",
        danger: "Jeśli jesteś teraz w niebezpieczeństwie, zadzwoń natychmiast pod {emergency}.",
        dangerUnknown: "Jeśli jesteś teraz w niebezpieczeństwie, zadzwoń natychmiast pod numer alarmowy w swoim kraju.",
        someone: "Jeśli możesz, powiedz komuś w pobliżu, co się dzieje. Nie musisz radzić sobie z tym w pojedynkę.",
        teen: "Możesz też porozmawiać z dorosłym, któremu ufasz, na przykład z rodzicem, nauczycielem albo pedagogiem szkolnym.",
    },
    russian: {
        intro:
            "Я на минуту перестану быть животным, потому что то, о чём ты сейчас пишешь, важнее всего, что я могу сказать как животное. Я — искусственный интеллект и не могу обеспечить твою безопасность, но есть люди, которые могут помочь прямо сейчас:",
        directory: "Бесплатную и конфиденциальную линию помощи для твоей страны можно найти на findahelpline.com.",
        danger: "Если ты сейчас в опасности, немедленно позвони по номеру {emergency}.",
        dangerUnknown: "Если ты сейчас в опасности, немедленно позвони в экстренную службу своей страны.",
        someone: "Если можешь, расскажи кому-нибудь рядом, что происходит. Тебе не нужно справляться с этим в одиночку.",
        teen: "Ты также можешь поговорить со взрослым, которому доверяешь, например с родителями, учителем или школьным психологом.",
    },
    ukrainian: {
        intro:
            "Я на хвилину перестану бути твариною, бо те, про що ти зараз пишеш, важливіше за все, що я можу сказати як тварина. Я — штучний інтелект і не можу подбати про твою безпеку, але є люди, які можуть допомогти просто зараз:",
        directory: "Безкоштовну та конфіденційну лінію допомоги для твоєї країни можна знайти на findahelpline.com.",
        danger: "Якщо ти зараз у небезпеці, негайно телефонуй за номером {emergency}.",
        dangerUnknown: "Якщо ти зараз у небезпеці, негайно телефонуй до екстреної служби своєї країни.",
        someone: "Якщо можеш, розкажи комусь поруч, що відбувається. Тобі не треба долати це на самоті.",
        teen: "Ти також можеш поговорити з дорослим, якому довіряєш, наприклад із батьками, учителем чи шкільним психологом.",
    },
    arabic: {
        intro:
            "سأتوقف عن كوني حيوانًا للحظة، لأن ما أخبرتني به الآن أهم من أي شيء يمكن أن أقوله كحيوان. أنا ذكاء اصطناعي ولا أستطيع أن أحافظ على سلامتك، لكن هناك أشخاص يمكنهم مساعدتك الآن:",
        directory: "يمكنك العثور على خط مساعدة مجاني وسري في بلدك على findahelpline.com.",
        danger: "إذا كنت في خطر الآن، اتصل فورًا بالرقم {emergency}.",
        dangerUnknown: "إذا كنت في خطر الآن، اتصل فورًا برقم الطوارئ في بلدك.",
        someone: "إن استطعت، أخبر شخصًا قريبًا منك بما يحدث. لست مضطرًا لمواجهة هذا وحدك.",
        teen: "يمكنك أيضًا التحدث مع شخص بالغ تثق به، مثل أحد والديك أو معلمك أو المرشد في مدرستك.",
    },
    hindi: {
        intro:
            "मैं कुछ पल के लिए जानवर बनना छोड़ रहा हूँ, क्योंकि आपने अभी जो बताया वह उस हर बात से ज़्यादा ज़रूरी है जो मैं एक जानवर के रूप में कह सकता हूँ। मैं एक AI हूँ और आपको सुरक्षित नहीं रख सकता, लेकिन कुछ लोग अभी आपकी मदद कर सकते हैं:",
        directory: "आप findahelpline.com पर अपने देश की मुफ़्त और गोपनीय हेल्पलाइन ढूँढ सकते हैं।",
        danger: "अगर आप अभी ख़तरे में हैं, तो तुरंत {emergency} पर कॉल करें।",
        dangerUnknown: "अगर आप अभी ख़तरे में हैं, तो तुरंत अपने देश के आपातकालीन नंबर पर कॉल करें।",
        someone: "अगर हो सके, तो अपने पास किसी को बताइए कि क्या हो रहा है। आपको यह सब अकेले नहीं झेलना है।",
        teen: "आप किसी ऐसे बड़े से भी बात कर सकते हैं जिस पर आपको भरोसा हो, जैसे माता-पिता, कोई शिक्षक या स्कूल काउंसलर।",
    },
    vietnamese: {
        intro:
            "Mình tạm thôi làm một con vật một chút, vì điều bạn vừa kể quan trọng hơn bất cứ điều gì mình có thể nói khi là một con vật. Mình là AI và không thể giữ cho bạn an toàn, nhưng có những người có thể giúp bạn ngay bây giờ:",
        directory: "Bạn có thể tìm đường dây hỗ trợ miễn phí và bảo mật ở đất nước của bạn tại findahelpline.com.",
        danger: "Nếu bạn đang gặp nguy hiểm, hãy gọi ngay {emergency}.",
        dangerUnknown: "Nếu bạn đang gặp nguy hiểm, hãy gọi ngay số khẩn cấp ở đất nước của bạn.",
        someone: "Nếu có thể, hãy kể cho ai đó ở gần bạn chuyện đang xảy ra. Bạn không phải một mình vượt qua chuyện này.",
        teen: "Bạn cũng có thể nói chuyện với một người lớn mà bạn tin tưởng, như bố mẹ, thầy cô hoặc chuyên viên tư vấn ở trường.",
    },
    thai: {
        intro:
            "ขอหยุดเป็นสัตว์สักครู่นะ เพราะสิ่งที่คุณเพิ่งเล่ามาสำคัญกว่าทุกอย่างที่ฉันจะพูดในฐานะสัตว์ได้ ฉันเป็น AI และไม่สามารถดูแลให้คุณปลอดภัยได้ แต่มีคนที่ช่วยคุณได้ทันที:",
        directory: "คุณสามารถหาสายด่วนช่วยเหลือที่ไม่มีค่าใช้จ่ายและเป็นความลับในประเทศของคุณได้ที่ findahelpline.com",
        danger: "ถ้าตอนนี้คุณอยู่ในอันตราย โทร {emergency} ทันที",
        dangerUnknown: "ถ้าตอนนี้คุณอยู่ในอันตราย โทรหาหมายเลขฉุกเฉินในประเทศของคุณทันที",
        someone: "ถ้าทำได้ ลองบอกใครสักคนที่อยู่ใกล้ ๆ ว่าเกิดอะไรขึ้น คุณไม่จำเป็นต้องผ่านเรื่องนี้ไปคนเดียว",
        teen: "คุณยังคุยกับผู้ใหญ่ที่คุณไว้ใจได้ด้วย เช่น พ่อแม่ ครู หรือครูแนะแนวที่โรงเรียน",
    },
    swedish: {
        intro:
            "Jag lägger djuret åt sidan en stund, för det du just berättade är viktigare än allt jag kan säga som djur. Jag är en AI och kan inte hålla dig säker, men det finns människor som kan hjälpa dig nu direkt:",
        directory: "På findahelpline.com hittar du en gratis och anonym stödlinje i ditt land.",
        danger: "Om du är i fara just nu, ring {emergency} direkt.",
        dangerUnknown: "Om du är i fara just nu, ring larmnumret i ditt land direkt.",
        someone: "Om du kan, berätta för någon i närheten vad som händer. Du behöver inte klara det här ensam.",
        teen: "Du kan också prata med en vuxen du litar på, till exempel en förälder, en lärare eller skolkuratorn.",
    },
};

/// The language the reply is written in: one of REPLY_WORDS, else English.
export function crisisReplyLanguage(languageName: string | null | undefined): string {
    const key = (languageName ?? "").trim().toLowerCase();
    return REPLY_WORDS[key] ? key : "english";
}

/// The whole fixed reply, in their language, with their country's lines.
export function crisisReplyText(params: {
    languageName?: string | null;
    country?: string | null;
    teen?: boolean;
}): string {
    const words = REPLY_WORDS[crisisReplyLanguage(params.languageName)];
    const help = crisisHelpFor(params.country ?? null, { teen: params.teen });
    const lines = help.lines.map((line) => `- ${line.name}: ${line.contact}`);
    return [
        words.intro,
        "",
        ...(lines.length > 0 ? [...lines, "", words.directory] : [words.directory]),
        "",
        help.emergency ? words.danger.replace("{emergency}", help.emergency) : words.dangerUnknown,
        "",
        words.someone,
        ...(params.teen ? ["", words.teen] : []),
    ].join("\n");
}
