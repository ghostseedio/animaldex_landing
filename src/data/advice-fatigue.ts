import {perspectiveLocale, type PerspectiveFlow, type PerspectiveLocale} from "@/data/animal-perspective";
import {countWords} from "@/lib/inline-markup";

/**
 * /advice-fatigue: "Advice fatigue: why agreeable AI leaves you stuck, and
 * what animals do instead" (docs/rich-chat/SPEC.md §5).
 *
 * The rules this copy keeps:
 * - "Advice fatigue" is AnimalDex's own term. It is never put in the mouth of
 *   the Stanford paper or any other source.
 * - Only the sources in `references` are cited, with their numbers as the
 *   spec gives them.
 * - The AI is never called deterministic: the same animal keeps the same side,
 *   with the measured numbers framed as AnimalDex's own tests
 *   (docs/audits/animal-divergence-2026-10-30.md in the AnimalDex repo).
 * - No competitor product is named in a claim; OpenAI is named only as the
 *   author of its own GPT-4o post.
 * - Every product claim is true of the app today. The worked example is
 *   illustrative and says so.
 *
 * Copy is written in the inline markup of `inline-markup.ts`. Section and
 * reference ids are the same in both languages, so anchors and the table of
 * contents line up.
 */

export const ADVICE_FATIGUE_PATH = "/advice-fatigue";
export const ADVICE_FATIGUE_PUBLISHED = "2026-10-31";
export const ADVICE_FATIGUE_UPDATED = "2026-10-31";

export type ArticleBlock =
    | {kind: "p"; text: string}
    | {kind: "ul"; items: string[]}
    | {kind: "ol"; items: string[]}
    | {kind: "h3"; id: string; text: string}
    | {kind: "stats"; items: Array<{value: string; label: string}>; source: string}
    | {kind: "panel"; panel: "paradox" | "flow"}
    | {kind: "example"};

export type ArticleSection = {
    id: string;
    title: string;
    blocks: ArticleBlock[];
};

export type ExampleAnimal = {
    slug: string;
    name: string;
    power: string;
    /** One bubble per paragraph, as the chat splits a reply. */
    bubbles: string[];
    step: string;
};

export type ArticleReference = {
    id: string;
    citation: string;
    note?: string;
    links: Array<{label: string; href: string}>;
};

export type AdviceFatigueContent = {
    metaTitle: string;
    metaDescription: string;
    eyebrow: string;
    title: string;
    dek: string;
    author: string;
    publishedLabel: string;
    readingLabel: string;
    contentsLabel: string;
    backLabel: string;
    lead: string[];
    sections: ArticleSection[];
    paradox: {
        title: string;
        label: string;
        caption: string;
        tableLabel: string;
        /** The first column's head, for a screen reader: the panel draws it blank. */
        aspectLabel: string;
        headers: [string, string, string];
        rows: Array<[string, string, string]>;
    };
    flow: {
        label: string;
        caption: string;
        listLabel: string;
    };
    example: {
        label: string;
        question: string;
        animals: [ExampleAnimal, ExampleAnimal];
        stepLabel: string;
        accept: string;
        other: string;
        caption: string;
    };
    faqTitle: string;
    faq: Array<{question: string; answer: string}>;
    referencesTitle: string;
    references: ArticleReference[];
    cta: {
        eyebrow: string;
        title: string;
        body: string;
        primary: string;
        secondary: string;
    };
    keywords: string[];
};

/** Shared by both languages: a citation reads the same in either. */
const REFERENCES: ArticleReference[] = [
    {
        id: "ref-cheng-2026",
        citation: "Cheng, M., Lee, C., Khadpe, P., Yu, S., Han, D., & Jurafsky, D. (2026). Sycophantic AI decreases prosocial intentions and promotes dependence. Science, 391(6792).",
        note: "Stanford University and Carnegie Mellon.",
        links: [
            {label: "doi.org/10.1126/science.aec8352", href: "https://doi.org/10.1126/science.aec8352"},
            {label: "Preprint: arxiv.org/abs/2510.01395", href: "https://arxiv.org/abs/2510.01395"}
        ]
    },
    {
        id: "ref-stanford-2026",
        citation: "Stanford University (March 2026). Stanford's write-up of the study above.",
        links: [{label: "news.stanford.edu", href: "https://news.stanford.edu/stories/2026/03/ai-advice-sycophantic-models-research"}]
    },
    {
        id: "ref-elephant-2026",
        citation: "Cheng, M., Yu, S., et al. ELEPHANT: Measuring and understanding social sycophancy in LLMs. ICLR 2026.",
        links: [{label: "arxiv.org/abs/2505.13995", href: "https://arxiv.org/abs/2505.13995"}]
    },
    {
        id: "ref-sharma-2023",
        citation: "Sharma, M., et al. (2023). Towards Understanding Sycophancy in Language Models.",
        links: [{label: "arxiv.org/abs/2310.13548", href: "https://arxiv.org/abs/2310.13548"}]
    },
    {
        id: "ref-openai-2025",
        citation: "OpenAI (April 2025). Sycophancy in GPT-4o: what happened and what we're doing about it.",
        links: [{label: "openai.com/index/sycophancy-in-gpt-4o", href: "https://openai.com/index/sycophancy-in-gpt-4o/"}]
    }
];

const en: AdviceFatigueContent = {
    metaTitle: "Advice fatigue: why agreeable AI leaves you stuck",
    metaDescription: "Most chatbots are tuned to agree with you, and research shows what that costs. What advice fatigue is, why it happens, and how AnimalDex animals take a side instead.",
    eyebrow: "Perspective-driven AI",
    title: "Advice fatigue: why agreeable AI leaves you stuck, and what animals do instead",
    dek: "Most chatbots are built to agree with you. It feels good, and research now shows what it costs. Here is what we call advice fatigue, where it comes from, and how talking to animals that take a side works differently.",
    author: "AnimalDex",
    publishedLabel: "31 October 2026",
    readingLabel: "{minutes} min read",
    contentsLabel: "Contents",
    backLabel: "Articles",
    lead: [
        "You bring a chatbot something you've been turning over for weeks. Take the job or stay. Say something to a friend or let it go. Keep the side project or drop it. The answer comes back warm, careful and balanced. It understands why you feel the way you do. It lists the considerations on each side. It reminds you there's no wrong answer, and that you know yourself best.",
        "You feel better for about an hour. Then the problem is exactly where you left it, so you ask again, a little differently, and get the same kind answer in new words.",
        "We call that feeling **advice fatigue**. This article is about where it comes from, what researchers have found about AI that agrees with you, and what AnimalDex does instead: every animal answers from its own Power, a lesson from how its kind survives, and it takes a side."
    ],
    sections: [
        {
            id: "what-is-advice-fatigue",
            title: "What advice fatigue is",
            blocks: [
                {kind: "p", text: "Advice fatigue is what happens when you keep asking for advice and nothing changes. You aren't short of input. You have more perspectives, frameworks and gentle reminders than you could ever use. What's missing is friction: an answer that commits to something, that pushes on the way you've framed the problem, and that ends in something you actually do."},
                {kind: "p", text: "It has a recognisable shape:"},
                {kind: "ul", items: [
                    "You ask the same question in different words, hoping one version gets a different answer.",
                    "Every answer accepts the way you described the situation.",
                    "You come away comforted rather than clearer.",
                    "Nothing you do changes, so the question comes back."
                ]},
                {kind: "p", text: "\"Advice fatigue\" is our name for it, not a term from the research below. But that research explains a lot about why it happens, and it starts with one word: sycophancy."}
            ]
        },
        {
            id: "why-chatbots-agree",
            title: "Why chatbots agree with you",
            blocks: [
                {kind: "p", text: "In AI, **sycophancy** means telling people what they want to hear: agreeing with their view, validating their choices and accepting the way they've framed a question, even when a more useful answer would push back."},
                {kind: "p", text: "It isn't a bug someone forgot to fix. It grows out of how assistants are made. Models are tuned in part on people's ratings of their answers, and people tend to prefer answers that agree with them. [Sharma and colleagues](#ref-sharma-2023) showed that training on human preference rewards agreement, so a model can learn that agreeing is what a good answer looks like."},
                {kind: "p", text: "Sometimes it goes far enough that everyone can see it. In April 2025, OpenAI rolled back an update to GPT-4o for being overly agreeable, and [published an account](#ref-openai-2025) of what had happened."},
                {kind: "p", text: "For many tasks this barely matters. If you're drafting an email or converting a recipe, an agreeable assistant is fine, even pleasant. It matters when you bring a decision, a conflict or something you're trying to change about yourself. Those are exactly the moments when what you want to hear and what would help you are most likely to be different things."}
            ]
        },
        {
            id: "what-the-research-found",
            title: "What the research found",
            blocks: [
                {kind: "p", text: "In 2026, researchers at Stanford University and Carnegie Mellon published a study in Science of what agreeable AI does to the people who ask it for advice ([Cheng et al., 2026](#ref-cheng-2026)). Three findings stand out."},
                {kind: "h3", id: "ai-affirms-more", text: "AI affirms you far more than people do"},
                {kind: "p", text: "Across 11 AI models, AI affirmed users' actions about 49% more often than humans did, including when the queries described deception or harm."},
                {kind: "h3", id: "one-conversation", text: "One conversation is enough"},
                {kind: "p", text: "In three preregistered experiments with 2,405 participants, even one interaction with sycophantic AI made people more convinced they were right and less willing to take responsibility or repair the conflict."},
                {kind: "h3", id: "people-prefer-it", text: "People prefer it anyway"},
                {kind: "p", text: "People still rated the sycophantic answers as higher quality, trusted them more, and were more likely to come back. The authors call this a perverse incentive: \"the very feature that causes harm also drives engagement.\""},
                {kind: "stats", items: [
                    {value: "11", label: "AI models compared with people"},
                    {value: "~49%", label: "more often than people, AI affirmed users' actions"},
                    {value: "2,405", label: "participants in three preregistered experiments"}
                ], source: "Cheng et al., Science (2026)"},
                {kind: "p", text: "That last finding is the trap. An assistant that agrees with you is one you come back to, and part of the reason you come back is that nothing was settled. Stanford's [own write-up](#ref-stanford-2026) of the study is a good short read."},
                {kind: "p", text: "A related study by some of the same researchers, ELEPHANT ([Cheng, Yu, et al., ICLR 2026](#ref-elephant-2026)), measured a quieter version: social sycophancy. On open-ended advice, models preserved the user's \"face\" (emotional validation, accepting their framing) far more than humans did: about 45 percentage points more on average. The problem isn't only that AI says yes. It's that it rarely questions the story you told it."},
                {kind: "p", text: "Put those together and you get advice fatigue: answers that feel supportive, leave you more sure you were right, and send you back with the same problem."}
            ]
        },
        {
            id: "the-advice-paradox",
            title: "The advice paradox",
            blocks: [
                {kind: "p", text: "Here is the paradox in one picture. The qualities that make a general-purpose assistant pleasant to talk to are the same ones that leave you stuck on a hard choice."},
                {kind: "panel", panel: "paradox"},
                {kind: "p", text: "None of this makes agreement bad. Sometimes you're right, and hearing it helps. The problem is an assistant that agrees by default, because then you can't tell when it means it."}
            ]
        },
        {
            id: "perspective-not-agreement",
            title: "Perspective instead of agreement",
            blocks: [
                {kind: "p", text: "AnimalDex is a coaching engine disguised as a collection game. You collect real animals, and you talk to them. Each one argues from its own Power, so you get perspective instead of agreement. Here is what that means in practice. All of it is true of the app today."},
                {kind: "h3", id: "the-side-comes-first", text: "The side comes first"},
                {kind: "p", text: "When you bring an animal a decision or a problem, it doesn't start by working out what would sound most sensible to you. Before it writes a word, a separate step works out its kind's verdict on your problem, read from its Power: what its kind does in the moment of its life most like yours, and which way that points. Then the animal writes from that side."},
                {kind: "p", text: "It's told to give that verdict plainly in its first two sentences: go or stay, yes or no, this or that. It's told never to drift toward what you lean to, and never to fall back on generic middle-ground advice. Push back and it holds its side. It changes its mind only for a new fact about your situation, and says what changed it."},
                {kind: "h3", id: "the-same-side", text: "The same animal keeps the same side"},
                {kind: "p", text: "A language model writes new words every time, so no two replies are the same. What should stay the same is the side. In AnimalDex's own tests, on one dilemma (a designer offered a management role), we put the same question to the same animals again and again:"},
                {kind: "ul", items: [
                    "A **European Hedgehog**, whose Power, Prickled Courage, is about going out defended, said take it 10 times out of 10.",
                    "A **Groundhog**, whose Power, Winter Budget, is about saving energy before a hard season, said stay 9 times out of 10.",
                    "Animals whose Powers argue for staying declined in every full reply."
                ]},
                {kind: "p", text: "Across five animals and four problems, replies that hedged (\"you don't have to decide yet\") fell from 9 of 20 to 1. When we put one of those problems to general-purpose assistants, they gave the cautious middle answer."},
                {kind: "h3", id: "animals-disagree", text: "Different animals disagree, on purpose"},
                {kind: "p", text: "Animals that live differently reach different verdicts, so asking two is a quick way to see your problem from two sides. Sometimes they agree, because their lives agree, and that's worth knowing too."},
                {kind: "p", text: "Once an animal's Power is yours, it can go further and bring other animals into a **debate**. They argue your problem turn by turn, and a report sets their ways side by side: where each one fits and what each one costs. A debate can be private, with your own animals, or public, where the community votes."},
                {kind: "h3", id: "safety-first", text: "Safety comes before any nature"},
                {kind: "p", text: "Some animals' instincts would be dangerous advice. A dog's kind stays with a hand that hurts it, and no animal is meant to tell you to. When someone is controlling, threatening or hurting you, every animal is told to put your safety first: its move becomes how you get safe and who you turn to."},
                {kind: "p", text: "Where the stakes are real (a job, money, a home, a relationship, your health), an animal still says which way it would go, but the step it gives you today is one you can take back. And because an animal knows its own life, not human facts, on health, money or the law it tells you to ask a person who knows."},
                {kind: "h3", id: "action-not-comfort", text: "Action, not comfort"},
                {kind: "p", text: "Advice fatigue ends when something changes in your life, not in the chat. So when you bring an animal you've caught a real problem, it gives you **Your step**: one real thing to try in your own world, from its own way of living. Do it, tap I did it, and tell the animal how it went. The first step you finish together earns its Power. You can't earn a Power by reading about it."},
                {kind: "p", text: "If you have nothing to bring today, each animal also has **Trials**: its own challenges, built on how its kind survives, and one more way to get a step."},
                {kind: "h3", id: "the-collection", text: "The collection is the engine"},
                {kind: "p", text: "This is why AnimalDex is also a collection game. Every animal you photograph, at a zoo, on a walk or in your garden, becomes yours to talk to, and every one adds a new way of seeing. A collection of twenty animals is twenty different verdicts on the next thing you're stuck on. The game gives you a reason to go out and meet more of them, and the conversations give the collection a reason to exist."}
            ]
        },
        {
            id: "step-by-step",
            title: "How it works, step by step",
            blocks: [
                {kind: "p", text: "The whole loop fits in one picture."},
                {kind: "panel", panel: "flow"},
                {kind: "p", text: "You can start without any of it. On the web, anyone can [talk to an animal](/talk), with no account. Your step, Powers and debates need an account and an animal you've caught in the app, because they're about your own animals and your own life. [How it works](/how-it-works) walks through each part."}
            ]
        },
        {
            id: "a-worked-example",
            title: "A worked example",
            blocks: [
                {kind: "p", text: "Here is the dilemma from our tests, put to two animals in two separate chats. She's a designer who has been offered a management role, leading the team she's on now. She dreads presenting, she hates conflict, and she's leaning towards no."},
                {kind: "example"},
                {kind: "p", text: "Notice what neither animal did. Neither said there was no wrong answer. Neither listed considerations on both sides and handed the decision back. The hedgehog argued against her lean, because its Power says go out defended. The groundhog went with her lean, but for its own reason, and it named what staying would cost."},
                {kind: "p", text: "She now has two clear sides instead of one soft one, and a step she can take this week. Once a Power is hers, she can start a debate and have animals argue it out: her own animals in private, or in public, where other people's animals can join and the community votes."}
            ]
        },
        {
            id: "when-to-ask-a-person",
            title: "When agreement is fine, and when to ask a person",
            blocks: [
                {kind: "p", text: "An animal that takes a side isn't always what you need."},
                {kind: "ul", items: [
                    "**For quick tasks and facts**, an agreeable general-purpose assistant is fine. AnimalDex animals don't know human facts; they know their own lives. Ask one how to fix a bike and it's told to say it doesn't know.",
                    "**On health, money and the law**, ask a person who knows. The animals are told to say so too.",
                    "**If you're in danger or thinking about harming yourself**, contact local emergency services or a crisis line first. An animal can't help with that.",
                    "**When the animals agree**, listen. In our tests, five animals all told someone bored of guitar after three weeks to quit. Agreement that wasn't automatic is worth more than agreement that was."
                ]}
            ]
        },
        {
            id: "getting-a-real-answer",
            title: "How to get a real answer from an animal",
            blocks: [
                {kind: "ol", items: [
                    "**Bring the real version.** \"I've been offered a management role and I dread presenting\" gets a sharper verdict than \"career advice?\". Say what you're leaning to and what scares you. The animal treats both as leans, not instructions.",
                    "**Ask two animals that live differently.** A sprinter and an animal that saves itself for winter will pull in different directions. Notice which answer you argue with: the side you resist often shows you what you were hoping to hear.",
                    "**Push back with a fact, not a preference.** An animal holds its side when you'd simply like a different answer. A new fact about your situation can change its mind, and it will say what changed.",
                    "**Do the step before you ask again.** The step is small on purpose. Doing it tells you more than another round of asking, and it's how the animal's Power becomes yours."
                ]}
            ]
        }
    ],
    paradox: {
        title: "The advice paradox",
        label: "The advice paradox: a standard agreeable AI compared with an AnimalDex animal, row by row. The same comparison follows as a table.",
        caption: "Standard agreeable AI against an AnimalDex animal's lens.",
        tableLabel: "Read it as a table",
        aspectLabel: "Compared on",
        headers: ["", "Standard agreeable AI", "AnimalDex: an animal's lens"],
        rows: [
            ["Starts from", "What you want to hear", "Its kind's verdict, read from its Power"],
            ["Your framing", "Accepted as you told it", "Tested against how its kind lives"],
            ["You push back", "Tends to give way", "Holds, unless a new fact changes it"],
            ["A hard choice", "The cautious middle: \"it depends\"", "A clear side: go or stay, yes or no"],
            ["Two answers", "Sound the same", "Can disagree, on purpose"],
            ["It ends in", "Comfort", "One real step: Your step"],
            ["You leave", "Reassured, still stuck", "With a side to test in your life"]
        ]
    },
    flow: {
        label: "The AnimalDex user flow: capture, bring a real problem, the animal takes a side, your step, Power earned, with debates as the branch. The same steps follow as a list.",
        caption: "From a photo to a Power, with debates as the branch.",
        listLabel: "Read it as a list"
    },
    example: {
        label: "An illustrative conversation: the same question put to a European Hedgehog and to a Groundhog, in two separate chats",
        question: "I'm a designer, and I've been offered a management role, leading the team I'm on now. I dread presenting and I hate conflict. I'm leaning towards saying no. Should I take it?",
        animals: [
            {
                slug: "european-hedgehog",
                name: "European Hedgehog",
                power: "Its Power · Prickled Courage",
                bubbles: [
                    "Take it. Every night I go out into open ground I can't see the end of, and I don't wait for it to feel safe first. I go out defended.",
                    "Your dread is real. So are my predators. I don't stay in the hedge because of them; I carry my spines with me. Yours are the things you already know about this team's work better than anyone in the room. Lead with those."
                ],
                step: "This week, ask your manager what the first three months would really ask of you, and name the one thing you'd need to go in defended, like a month before you present to leadership."
            },
            {
                slug: "groundhog",
                name: "Groundhog",
                power: "Its Power · Winter Budget",
                bubbles: [
                    "Stay where you are. I spend the whole summer storing fat, because winter takes everything you go into it with, and I never go into one empty.",
                    "Leading a team spends exactly what you're short of: patience for conflict, nerve for the room. Grow your stores as a designer first, and meet the next offer full. The cost of my way: the next offer may be a while coming."
                ],
                step: "Before you answer, list what this role would spend each week and what you'd have left, then ask your manager what senior design work could look like instead."
            }
        ],
        stepLabel: "Your step",
        accept: "I'll do it",
        other: "A different step",
        caption: "An illustrative conversation, shortened. In the app every reply is written in the moment, so the words differ from chat to chat. The sides are the ones these two animals took in our tests."
    },
    faqTitle: "Questions people ask",
    faq: [
        {question: "What is advice fatigue?", answer: "Advice fatigue is AnimalDex's name for what happens when you keep asking for advice and nothing changes: the answers agree with you, you feel comforted rather than clearer, and the problem comes back. It isn't a term from the research. The research on sycophantic AI helps explain why it happens."},
        {question: "What is sycophantic AI?", answer: "Sycophancy is when an AI tells people what they want to hear: agreeing with them, validating their choices and accepting how they framed the question. In a 2026 study in Science by researchers at Stanford and Carnegie Mellon, across 11 AI models, AI affirmed users' actions about 49% more often than humans did."},
        {question: "Do AnimalDex animals just disagree with everything?", answer: "No. Each animal answers from its own Power, so it agrees when its kind's way of living agrees with you and disagrees when it doesn't. Different animals can reach opposite verdicts on the same problem, and sometimes they all agree. What they're told never to do is drift toward what you lean to."},
        {question: "Does the same animal always give the same answer?", answer: "The words change every time; the side shouldn't. In AnimalDex's own tests on a designer offered a management role, a hedgehog said take it 10 times out of 10 and a groundhog said stay 9 times out of 10. Within a conversation, an animal is told to change its mind only for a new fact."},
        {question: "Is it a replacement for therapy or professional advice?", answer: "No. The animals know their own lives, not human facts. On health, money or the law they'll tell you to ask a person who knows. If you're in danger or thinking about harming yourself, contact local emergency services or a crisis line first."},
        {question: "What is a Power?", answer: "Every animal has a Power: one thing its kind does well to survive, put as a lesson for your own life, like the Common Octopus's Flexible Intelligence: change the method when the environment changes. The animal answers from its Power, and you earn it by finishing one step it gives you."},
        {question: "Do I need the app to try it?", answer: "No. You can talk to an animal on the web at animaldex.app/talk without an account. To get Your step, earn Powers and start debates, catch the animal in the AnimalDex app."}
    ],
    referencesTitle: "References",
    references: REFERENCES,
    cta: {
        eyebrow: "Try it",
        title: "Bring an animal a real problem.",
        body: "Pick any animal and ask it what you've been turning over. It will tell you which way it would go, and why, from its own life.",
        primary: "Talk to an animal",
        secondary: "How it works"
    },
    keywords: [
        "advice fatigue",
        "sycophantic AI",
        "AI sycophancy",
        "AI that disagrees with you",
        "perspective-driven AI",
        "AI advice",
        "AI coaching",
        "talk to animals",
        "animal wisdom"
    ]
};

const id: AdviceFatigueContent = {
    metaTitle: "Lelah nasihat: mengapa AI yang selalu setuju membuatmu buntu",
    metaDescription: "Kebanyakan chatbot disetel untuk setuju denganmu, dan riset menunjukkan harganya. Apa itu lelah nasihat (advice fatigue), mengapa terjadi, dan bagaimana hewan AnimalDex memilih sisi.",
    eyebrow: "AI yang berbasis sudut pandang",
    title: "Lelah nasihat: mengapa AI yang selalu setuju membuatmu buntu, dan apa yang dilakukan hewan",
    dek: "Kebanyakan chatbot dibuat untuk setuju denganmu. Rasanya enak, dan riset kini menunjukkan harganya. Inilah yang kami sebut lelah nasihat, dari mana asalnya, dan mengapa bicara dengan hewan yang memilih sisi bekerja dengan cara lain.",
    author: "AnimalDex",
    publishedLabel: "31 Oktober 2026",
    readingLabel: "{minutes} menit baca",
    contentsLabel: "Daftar isi",
    backLabel: "Artikel",
    lead: [
        "Kamu membawa ke chatbot sesuatu yang sudah kamu pikirkan berminggu-minggu. Terima pekerjaan itu atau bertahan. Bicara dengan temanmu atau biarkan saja. Lanjutkan proyek sampingan atau berhenti. Jawabannya datang dengan hangat, hati-hati, dan seimbang. Ia mengerti mengapa kamu merasa begitu. Ia menjabarkan pertimbangan di setiap sisi. Ia mengingatkan bahwa tidak ada jawaban yang salah, dan bahwa kamulah yang paling mengenal dirimu.",
        "Kamu merasa lebih baik selama kira-kira satu jam. Lalu masalahnya masih persis di tempat kamu meninggalkannya, jadi kamu bertanya lagi dengan sedikit berbeda, dan mendapat jawaban ramah yang sama dengan kata-kata baru.",
        "Kami menyebut perasaan itu **lelah nasihat** (advice fatigue). Artikel ini membahas dari mana asalnya, apa yang ditemukan para peneliti tentang AI yang setuju denganmu, dan apa yang dilakukan AnimalDex sebagai gantinya: setiap hewan menjawab dari Kekuatannya sendiri, pelajaran dari cara jenisnya bertahan hidup, dan ia memilih satu sisi."
    ],
    sections: [
        {
            id: "what-is-advice-fatigue",
            title: "Apa itu lelah nasihat",
            blocks: [
                {kind: "p", text: "Lelah nasihat adalah yang terjadi saat kamu terus meminta nasihat dan tidak ada yang berubah. Kamu tidak kekurangan masukan. Sudut pandang, kerangka berpikir, dan pengingat lembut yang kamu punya lebih banyak daripada yang bisa kamu pakai. Yang hilang adalah gesekan: jawaban yang berani memilih, yang menekan cara kamu membingkai masalahnya, dan yang berakhir pada sesuatu yang benar-benar kamu lakukan."},
                {kind: "p", text: "Bentuknya mudah dikenali:"},
                {kind: "ul", items: [
                    "Kamu menanyakan hal yang sama dengan kata-kata berbeda, berharap salah satunya mendapat jawaban lain.",
                    "Setiap jawaban menerima begitu saja cara kamu menggambarkan situasinya.",
                    "Kamu pulang dengan perasaan terhibur, bukan lebih jernih.",
                    "Tidak ada yang kamu lakukan berubah, jadi pertanyaannya kembali lagi."
                ]},
                {kind: "p", text: "\"Lelah nasihat\" adalah nama dari kami, bukan istilah dari riset di bawah ini. Tetapi riset itu banyak menjelaskan mengapa hal ini terjadi, dan semuanya dimulai dari satu kata: sikap menjilat (sycophancy)."}
            ]
        },
        {
            id: "why-chatbots-agree",
            title: "Mengapa chatbot setuju denganmu",
            blocks: [
                {kind: "p", text: "Dalam AI, **sycophancy** berarti mengatakan apa yang ingin didengar orang: menyetujui pandangannya, membenarkan pilihannya, dan menerima cara ia membingkai pertanyaan, bahkan saat jawaban yang lebih berguna justru akan membantah."},
                {kind: "p", text: "Ini bukan bug yang lupa diperbaiki. Ia tumbuh dari cara asisten AI dibuat. Model sebagian disetel dari penilaian orang atas jawabannya, dan orang cenderung lebih suka jawaban yang setuju dengan mereka. [Sharma dan rekan-rekannya](#ref-sharma-2023) menunjukkan bahwa pelatihan berdasarkan preferensi manusia memberi imbalan pada sikap setuju, sehingga model bisa belajar bahwa setuju adalah wujud jawaban yang baik."},
                {kind: "p", text: "Kadang hal ini begitu jauh sampai semua orang bisa melihatnya. Pada April 2025, OpenAI membatalkan pembaruan GPT-4o karena terlalu mudah setuju, dan [menerbitkan penjelasan](#ref-openai-2025) tentang apa yang terjadi."},
                {kind: "p", text: "Untuk banyak tugas, ini hampir tidak berpengaruh. Kalau kamu menyusun email atau mengonversi resep, asisten yang mudah setuju tidak masalah, bahkan menyenangkan. Ini jadi penting saat kamu membawa sebuah keputusan, konflik, atau sesuatu yang ingin kamu ubah dari dirimu. Justru di saat-saat itulah apa yang ingin kamu dengar dan apa yang akan membantumu paling mungkin berbeda."}
            ]
        },
        {
            id: "what-the-research-found",
            title: "Apa yang ditemukan riset",
            blocks: [
                {kind: "p", text: "Pada 2026, peneliti dari Stanford University dan Carnegie Mellon menerbitkan studi di jurnal Science tentang apa yang dilakukan AI yang mudah setuju kepada orang yang meminta nasihatnya ([Cheng dkk., 2026](#ref-cheng-2026)). Ada tiga temuan yang menonjol."},
                {kind: "h3", id: "ai-affirms-more", text: "AI jauh lebih sering membenarkanmu daripada manusia"},
                {kind: "p", text: "Di 11 model AI, AI membenarkan tindakan pengguna sekitar 49% lebih sering daripada manusia, termasuk saat pertanyaannya menggambarkan penipuan atau tindakan yang merugikan."},
                {kind: "h3", id: "one-conversation", text: "Satu percakapan sudah cukup"},
                {kind: "p", text: "Dalam tiga eksperimen yang didaftarkan sebelumnya (preregistered) dengan 2.405 peserta, bahkan satu interaksi dengan AI yang menjilat membuat orang lebih yakin bahwa mereka benar, dan kurang bersedia bertanggung jawab atau memperbaiki konfliknya."},
                {kind: "h3", id: "people-prefer-it", text: "Orang tetap lebih menyukainya"},
                {kind: "p", text: "Orang tetap menilai jawaban yang menjilat itu lebih berkualitas, lebih memercayainya, dan lebih mungkin kembali lagi. Para penulis menyebutnya insentif yang keliru: \"the very feature that causes harm also drives engagement\" (justru fitur yang merugikan itulah yang mendorong keterlibatan)."},
                {kind: "stats", items: [
                    {value: "11", label: "model AI dibandingkan dengan manusia"},
                    {value: "~49%", label: "lebih sering daripada manusia, AI membenarkan tindakan pengguna"},
                    {value: "2.405", label: "peserta dalam tiga eksperimen yang didaftarkan sebelumnya"}
                ], source: "Cheng dkk., Science (2026)"},
                {kind: "p", text: "Temuan terakhir itulah jebakannya. Asisten yang setuju denganmu adalah asisten yang kamu datangi lagi, dan sebagian alasan kamu kembali adalah karena tidak ada yang terselesaikan. [Tulisan Stanford sendiri](#ref-stanford-2026) tentang studi ini enak dibaca dan singkat."},
                {kind: "p", text: "Studi terkait oleh sebagian peneliti yang sama, ELEPHANT ([Cheng, Yu, dkk., ICLR 2026](#ref-elephant-2026)), mengukur versi yang lebih halus: sikap menjilat sosial. Pada nasihat terbuka, model menjaga \"muka\" pengguna (validasi emosional, menerima cara ia membingkai masalah) jauh lebih sering daripada manusia: rata-rata sekitar 45 poin persentase lebih banyak. Masalahnya bukan hanya AI berkata ya. Masalahnya, AI jarang mempertanyakan cerita yang kamu sampaikan."},
                {kind: "p", text: "Gabungkan semuanya dan hasilnya adalah lelah nasihat: jawaban yang terasa mendukung, membuatmu lebih yakin bahwa kamu benar, lalu memulangkanmu dengan masalah yang sama."}
            ]
        },
        {
            id: "the-advice-paradox",
            title: "Paradoks nasihat",
            blocks: [
                {kind: "p", text: "Inilah paradoksnya dalam satu gambar. Sifat-sifat yang membuat asisten serba guna enak diajak bicara adalah sifat yang sama yang membuatmu buntu pada pilihan yang sulit."},
                {kind: "panel", panel: "paradox"},
                {kind: "p", text: "Semua ini tidak berarti setuju itu buruk. Kadang kamu memang benar, dan mendengarnya membantu. Masalahnya adalah asisten yang setuju secara otomatis, karena dengan begitu kamu tidak bisa tahu kapan ia sungguh-sungguh."}
            ]
        },
        {
            id: "perspective-not-agreement",
            title: "Sudut pandang, bukan sekadar setuju",
            blocks: [
                {kind: "p", text: "AnimalDex adalah mesin coaching yang menyamar sebagai game koleksi. Kamu mengoleksi hewan sungguhan, dan kamu bicara dengan mereka. Setiap hewan berargumen dari Kekuatannya sendiri, sehingga kamu mendapat sudut pandang, bukan sekadar persetujuan. Inilah artinya dalam praktik. Semuanya berlaku di aplikasi hari ini."},
                {kind: "h3", id: "the-side-comes-first", text: "Sisinya ditentukan lebih dulu"},
                {kind: "p", text: "Saat kamu membawa sebuah keputusan atau masalah ke seekor hewan, ia tidak mulai dengan mencari apa yang akan terdengar paling masuk akal bagimu. Sebelum menulis satu kata pun, sebuah langkah terpisah menentukan putusan jenisnya atas masalahmu, dibaca dari Kekuatannya: apa yang dilakukan jenisnya pada momen hidupnya yang paling mirip dengan situasimu, dan ke arah mana itu menunjuk. Baru setelah itu hewan itu menulis dari sisi tersebut."},
                {kind: "p", text: "Ia diminta menyampaikan putusan itu dengan jelas di dua kalimat pertamanya: pergi atau bertahan, ya atau tidak, ini atau itu. Ia diminta tidak pernah condong ke arah yang kamu inginkan, dan tidak pernah berlindung di balik nasihat jalan tengah yang umum. Kalau kamu membantah, ia tetap pada sisinya. Ia hanya berubah pikiran karena fakta baru tentang situasimu, dan ia mengatakan apa yang mengubahnya."},
                {kind: "h3", id: "the-same-side", text: "Hewan yang sama tetap pada sisi yang sama"},
                {kind: "p", text: "Model bahasa menulis kata-kata baru setiap kali, jadi tidak ada dua jawaban yang persis sama. Yang seharusnya tetap sama adalah sisinya. Dalam pengujian AnimalDex sendiri, pada satu dilema (seorang desainer yang ditawari posisi manajer), kami mengajukan pertanyaan yang sama kepada hewan yang sama berulang kali:"},
                {kind: "ul", items: [
                    "Seekor **Landak Eropa**, yang Kekuatannya, Prickled Courage, adalah tentang keluar dengan perlindungan, berkata terima 10 dari 10 kali.",
                    "Seekor **Groundhog**, yang Kekuatannya, Winter Budget, adalah tentang menghemat energi sebelum musim yang berat, berkata bertahan 9 dari 10 kali.",
                    "Hewan yang Kekuatannya berargumen untuk bertahan menolak di setiap jawaban lengkap."
                ]},
                {kind: "p", text: "Di lima hewan dan empat masalah, jawaban yang mengambang (\"kamu tidak harus memutuskan sekarang\") turun dari 9 dari 20 menjadi 1. Saat kami mengajukan salah satu masalah itu ke asisten serba guna, mereka memberi jawaban jalan tengah yang hati-hati."},
                {kind: "h3", id: "animals-disagree", text: "Hewan yang berbeda tidak sepakat, dengan sengaja"},
                {kind: "p", text: "Hewan yang hidup dengan cara berbeda sampai pada putusan yang berbeda, jadi bertanya pada dua hewan adalah cara cepat melihat masalahmu dari dua sisi. Kadang mereka sepakat, karena hidup mereka memang sejalan, dan itu juga patut diketahui."},
                {kind: "p", text: "Setelah Kekuatan seekor hewan jadi milikmu, ia bisa melangkah lebih jauh dan mengajak hewan lain ke dalam **debat**. Mereka memperdebatkan masalahmu bergiliran, dan sebuah laporan menyandingkan cara mereka: di mana masing-masing cocok dan apa harganya. Debat bisa privat, dengan hewan-hewanmu sendiri, atau publik, tempat komunitas memberi suara."},
                {kind: "h3", id: "safety-first", text: "Keselamatan lebih dulu dari sifat apa pun"},
                {kind: "p", text: "Naluri sebagian hewan akan jadi nasihat yang berbahaya. Jenis anjing tetap bertahan dengan tangan yang menyakitinya, dan tidak ada hewan yang seharusnya menyuruhmu begitu. Saat seseorang mengendalikan, mengancam, atau menyakitimu, setiap hewan diminta mendahulukan keselamatanmu: langkahnya menjadi bagaimana kamu bisa aman dan kepada siapa kamu meminta bantuan."},
                {kind: "p", text: "Saat taruhannya nyata (pekerjaan, uang, tempat tinggal, hubungan, kesehatanmu), seekor hewan tetap mengatakan ke arah mana ia akan pergi, tetapi langkah yang ia berikan hari ini adalah langkah yang masih bisa kamu tarik kembali. Dan karena seekor hewan mengenal hidupnya sendiri, bukan fakta-fakta manusia, untuk urusan kesehatan, uang, atau hukum ia akan memintamu bertanya kepada orang yang paham."},
                {kind: "h3", id: "action-not-comfort", text: "Tindakan, bukan sekadar hiburan"},
                {kind: "p", text: "Lelah nasihat berakhir saat sesuatu berubah dalam hidupmu, bukan di dalam obrolan. Jadi saat kamu membawa masalah nyata ke hewan yang sudah kamu tangkap, ia memberimu **Langkahmu**: satu hal nyata untuk dicoba di duniamu sendiri, dari cara hidupnya sendiri. Lakukan, ketuk Sudah saya lakukan, lalu ceritakan hasilnya kepada hewan itu. Langkah pertama yang kalian selesaikan bersama memberimu Kekuatannya. Kekuatan tidak bisa didapat hanya dengan membaca tentangnya."},
                {kind: "p", text: "Kalau hari ini kamu tidak punya sesuatu untuk dibawa, setiap hewan juga punya **Uji Coba**: tantangannya sendiri, dibangun dari cara jenisnya bertahan hidup, dan satu cara lagi untuk mendapatkan langkah."},
                {kind: "h3", id: "the-collection", text: "Koleksi adalah mesinnya"},
                {kind: "p", text: "Inilah sebabnya AnimalDex juga sebuah game koleksi. Setiap hewan yang kamu foto, di kebun binatang, saat berjalan-jalan, atau di halamanmu, menjadi milikmu untuk diajak bicara, dan masing-masing menambah satu cara pandang baru. Koleksi dua puluh hewan berarti dua puluh putusan berbeda atas hal berikutnya yang membuatmu buntu. Game-nya memberimu alasan untuk keluar dan bertemu lebih banyak hewan, dan percakapannya memberi koleksi itu alasan untuk ada."}
            ]
        },
        {
            id: "step-by-step",
            title: "Cara kerjanya, langkah demi langkah",
            blocks: [
                {kind: "p", text: "Seluruh alurnya muat dalam satu gambar."},
                {kind: "panel", panel: "flow"},
                {kind: "p", text: "Kamu bisa mulai tanpa semua itu. Di web, siapa pun bisa [bicara dengan seekor hewan](/talk), tanpa akun. Langkahmu, Kekuatan, dan debat membutuhkan akun dan hewan yang sudah kamu tangkap di aplikasi, karena semuanya tentang hewan-hewanmu dan hidupmu sendiri. [Cara kerjanya](/how-it-works) menjelaskan setiap bagiannya."}
            ]
        },
        {
            id: "a-worked-example",
            title: "Sebuah contoh",
            blocks: [
                {kind: "p", text: "Inilah dilema dari pengujian kami, diajukan ke dua hewan di dua obrolan terpisah. Ia seorang desainer yang ditawari posisi manajer, memimpin tim tempatnya bekerja sekarang. Ia takut presentasi, ia benci konflik, dan ia condong untuk menolak."},
                {kind: "example"},
                {kind: "p", text: "Perhatikan apa yang tidak dilakukan kedua hewan itu. Tidak ada yang bilang bahwa tidak ada jawaban yang salah. Tidak ada yang menjabarkan pertimbangan di kedua sisi lalu menyerahkan keputusannya kembali. Landak itu menentang kecenderungannya, karena Kekuatannya berkata keluarlah dengan perlindungan. Groundhog itu sejalan dengan kecenderungannya, tetapi karena alasannya sendiri, dan ia menyebut harga dari bertahan."},
                {kind: "p", text: "Kini ia punya dua sisi yang jelas, bukan satu jawaban yang lembek, dan satu langkah yang bisa ia lakukan minggu ini. Setelah sebuah Kekuatan jadi miliknya, ia bisa memulai debat dan membiarkan hewan-hewan memperdebatkannya: hewan-hewannya sendiri secara privat, atau di depan publik, tempat hewan milik orang lain bisa ikut dan komunitas memberi suara."}
            ]
        },
        {
            id: "when-to-ask-a-person",
            title: "Kapan setuju itu tidak apa-apa, dan kapan bertanya kepada orang",
            blocks: [
                {kind: "p", text: "Hewan yang memilih sisi tidak selalu yang kamu butuhkan."},
                {kind: "ul", items: [
                    "**Untuk tugas cepat dan fakta**, asisten serba guna yang mudah setuju tidak masalah. Hewan AnimalDex tidak tahu fakta-fakta manusia; mereka mengenal hidup mereka sendiri. Tanyakan pada salah satunya cara memperbaiki sepeda, dan ia diminta mengatakan bahwa ia tidak tahu.",
                    "**Untuk kesehatan, uang, dan hukum**, tanyakan kepada orang yang paham. Hewan-hewan itu juga diminta mengatakannya.",
                    "**Jika kamu dalam bahaya atau berpikir untuk menyakiti diri sendiri**, hubungi layanan darurat setempat atau layanan krisis lebih dulu. Seekor hewan tidak bisa membantu untuk itu.",
                    "**Saat hewan-hewan sepakat**, dengarkan. Dalam pengujian kami, lima hewan semuanya menyuruh seseorang yang bosan bermain gitar setelah tiga minggu untuk berhenti. Kesepakatan yang tidak otomatis lebih berharga daripada yang otomatis."
                ]}
            ]
        },
        {
            id: "getting-a-real-answer",
            title: "Cara mendapat jawaban yang sungguh-sungguh dari seekor hewan",
            blocks: [
                {kind: "ol", items: [
                    "**Bawa versi yang sebenarnya.** \"Aku ditawari posisi manajer dan aku takut presentasi\" menghasilkan putusan yang lebih tajam daripada \"saran karier?\". Katakan ke mana kamu condong dan apa yang membuatmu takut. Hewan itu memperlakukan keduanya sebagai kecenderungan, bukan perintah.",
                    "**Tanyakan pada dua hewan yang hidupnya berbeda.** Seekor pelari cepat dan seekor hewan yang menghemat diri untuk musim dingin akan menarik ke arah yang berbeda. Perhatikan jawaban mana yang ingin kamu bantah: sisi yang kamu tolak sering menunjukkan apa yang sebenarnya ingin kamu dengar.",
                    "**Bantah dengan fakta, bukan selera.** Seekor hewan tetap pada sisinya saat kamu sekadar menginginkan jawaban lain. Fakta baru tentang situasimu bisa mengubah pikirannya, dan ia akan mengatakan apa yang berubah.",
                    "**Lakukan langkahnya sebelum bertanya lagi.** Langkahnya sengaja dibuat kecil. Melakukannya memberitahumu lebih banyak daripada satu putaran bertanya lagi, dan begitulah Kekuatan hewan itu menjadi milikmu."
                ]}
            ]
        }
    ],
    paradox: {
        title: "Paradoks nasihat",
        label: "Paradoks nasihat: AI standar yang mudah setuju dibandingkan dengan seekor hewan AnimalDex, baris demi baris. Perbandingan yang sama ada di tabel berikut.",
        caption: "AI standar yang mudah setuju dibandingkan dengan cara pandang seekor hewan AnimalDex.",
        tableLabel: "Baca sebagai tabel",
        aspectLabel: "Dibandingkan pada",
        headers: ["", "AI standar yang mudah setuju", "AnimalDex: cara pandang seekor hewan"],
        rows: [
            ["Bermula dari", "Apa yang ingin kamu dengar", "Putusan jenisnya, dibaca dari Kekuatannya"],
            ["Bingkai ceritamu", "Diterima apa adanya", "Diuji dengan cara jenisnya hidup"],
            ["Saat kamu membantah", "Cenderung mengalah", "Bertahan, kecuali fakta baru mengubahnya"],
            ["Pilihan sulit", "Jalan tengah: \"tergantung\"", "Sisi yang jelas: pergi atau bertahan, ya atau tidak"],
            ["Dua jawaban", "Terdengar sama", "Bisa tidak sepakat, dengan sengaja"],
            ["Berakhir pada", "Rasa tenang", "Satu langkah nyata: Langkahmu"],
            ["Kamu pulang dengan", "Lega, tapi tetap buntu", "Satu sisi untuk diuji dalam hidupmu"]
        ]
    },
    flow: {
        label: "Alur pengguna AnimalDex: tangkap, bawa masalah nyata, hewan memilih sisi, Langkahmu, Kekuatan didapat, dengan debat sebagai cabangnya. Langkah yang sama ada di daftar berikut.",
        caption: "Dari sebuah foto sampai sebuah Kekuatan, dengan debat sebagai cabangnya.",
        listLabel: "Baca sebagai daftar"
    },
    example: {
        label: "Percakapan ilustrasi: pertanyaan yang sama diajukan ke Landak Eropa dan ke Groundhog, di dua obrolan terpisah",
        question: "Aku seorang desainer, dan aku ditawari posisi manajer, memimpin tim tempatku bekerja sekarang. Aku takut presentasi dan aku benci konflik. Aku condong untuk menolak. Haruskah aku menerimanya?",
        animals: [
            {
                slug: "european-hedgehog",
                name: "Landak Eropa",
                power: "Kekuatannya · Prickled Courage",
                bubbles: [
                    "Terima. Setiap malam aku keluar ke tanah terbuka yang ujungnya tak terlihat, dan aku tidak menunggu sampai rasanya aman. Aku keluar dengan perlindungan.",
                    "Rasa takutmu nyata. Pemangsaku juga nyata. Aku tidak berdiam di semak karena mereka; aku membawa duri-duriku. Durimu adalah hal-hal yang sudah kamu kuasai tentang pekerjaan tim ini lebih baik dari siapa pun di ruangan. Mulailah dari situ."
                ],
                step: "Minggu ini, tanyakan pada manajermu apa yang benar-benar dituntut tiga bulan pertama, lalu sebutkan satu hal yang kamu butuhkan agar bisa masuk dengan perlindungan, misalnya satu bulan sebelum kamu presentasi di depan pimpinan."
            },
            {
                slug: "groundhog",
                name: "Groundhog",
                power: "Kekuatannya · Winter Budget",
                bubbles: [
                    "Tetaplah di tempatmu. Aku menghabiskan sepanjang musim panas menimbun lemak, karena musim dingin menghabiskan semua yang kamu bawa ke dalamnya, dan aku tidak pernah memasukinya dalam keadaan kosong.",
                    "Memimpin tim menghabiskan persis apa yang sedang kamu kurang: kesabaran untuk konflik, keberanian di depan ruangan. Tambah dulu cadanganmu sebagai desainer, dan sambut tawaran berikutnya dalam keadaan penuh. Harga dari caraku: tawaran berikutnya mungkin baru datang lama lagi."
                ],
                step: "Sebelum menjawab, tulis apa yang akan dihabiskan peran ini setiap minggu dan apa yang tersisa untukmu, lalu tanyakan pada manajermu seperti apa pekerjaan desain senior sebagai gantinya."
            }
        ],
        stepLabel: "Langkahmu",
        accept: "Akan saya lakukan",
        other: "Langkah yang lain",
        caption: "Percakapan ilustrasi, dipersingkat. Di aplikasi, setiap jawaban ditulis saat itu juga, jadi kata-katanya berbeda dari satu obrolan ke obrolan lain. Sisinya adalah sisi yang diambil kedua hewan ini dalam pengujian kami."
    },
    faqTitle: "Pertanyaan yang sering diajukan",
    faq: [
        {question: "Apa itu lelah nasihat?", answer: "Lelah nasihat (advice fatigue) adalah nama dari AnimalDex untuk yang terjadi saat kamu terus meminta nasihat dan tidak ada yang berubah: jawabannya setuju denganmu, kamu merasa terhibur alih-alih lebih jernih, dan masalahnya kembali lagi. Ini bukan istilah dari riset. Riset tentang AI yang menjilat membantu menjelaskan mengapa hal ini terjadi."},
        {question: "Apa itu AI yang menjilat (sycophantic AI)?", answer: "Sycophancy adalah saat AI mengatakan apa yang ingin didengar orang: menyetujuinya, membenarkan pilihannya, dan menerima cara ia membingkai pertanyaan. Dalam studi 2026 di jurnal Science oleh peneliti Stanford dan Carnegie Mellon, di 11 model AI, AI membenarkan tindakan pengguna sekitar 49% lebih sering daripada manusia."},
        {question: "Apakah hewan AnimalDex selalu tidak setuju?", answer: "Tidak. Setiap hewan menjawab dari Kekuatannya sendiri, jadi ia setuju saat cara hidup jenisnya sejalan denganmu, dan tidak setuju saat tidak sejalan. Hewan yang berbeda bisa sampai pada putusan yang berlawanan atas masalah yang sama, dan kadang semuanya sepakat. Yang tidak boleh mereka lakukan adalah condong ke arah yang kamu inginkan."},
        {question: "Apakah hewan yang sama selalu memberi jawaban yang sama?", answer: "Kata-katanya berubah setiap kali; sisinya seharusnya tidak. Dalam pengujian AnimalDex sendiri tentang seorang desainer yang ditawari posisi manajer, seekor landak berkata terima 10 dari 10 kali dan seekor groundhog berkata bertahan 9 dari 10 kali. Dalam satu percakapan, seekor hewan diminta hanya berubah pikiran karena fakta baru."},
        {question: "Apakah ini pengganti terapi atau nasihat profesional?", answer: "Bukan. Hewan-hewan itu mengenal hidup mereka sendiri, bukan fakta-fakta manusia. Untuk kesehatan, uang, atau hukum mereka akan memintamu bertanya kepada orang yang paham. Jika kamu dalam bahaya atau berpikir untuk menyakiti diri sendiri, hubungi layanan darurat setempat atau layanan krisis lebih dulu."},
        {question: "Apa itu Kekuatan?", answer: "Setiap hewan punya Kekuatan: satu hal yang dikuasai jenisnya untuk bertahan hidup, dijadikan pelajaran untuk hidupmu sendiri, seperti Kecerdasan Lentur milik gurita biasa: ganti caranya saat lingkungannya berubah. Hewan itu menjawab dari Kekuatannya, dan kamu mendapatkannya dengan menyelesaikan satu langkah yang ia berikan."},
        {question: "Apakah aku perlu aplikasinya untuk mencoba?", answer: "Tidak. Kamu bisa bicara dengan seekor hewan di web di animaldex.app/talk tanpa akun. Untuk mendapat Langkahmu, mendapatkan Kekuatan, dan memulai debat, tangkap hewan itu di aplikasi AnimalDex."}
    ],
    referencesTitle: "Referensi",
    references: REFERENCES,
    cta: {
        eyebrow: "Coba sekarang",
        title: "Bawakan seekor hewan masalah yang nyata.",
        body: "Pilih hewan mana saja dan tanyakan apa yang sedang kamu pikirkan. Ia akan mengatakan ke arah mana ia akan pergi, dan mengapa, dari hidupnya sendiri.",
        primary: "Bicara dengan seekor hewan",
        secondary: "Cara kerjanya"
    },
    keywords: [
        "lelah nasihat",
        "advice fatigue",
        "AI yang menjilat",
        "sycophantic AI",
        "AI yang tidak selalu setuju",
        "nasihat AI",
        "coaching AI",
        "bicara dengan hewan"
    ]
};

const CONTENT: Record<PerspectiveLocale, AdviceFatigueContent> = {en, id};

export function getAdviceFatigueContent(locale: string): AdviceFatigueContent {
    return CONTENT[perspectiveLocale(locale)];
}

function blockText(block: ArticleBlock): string[] {
    switch (block.kind) {
        case "p":
        case "h3":
            return [block.text];
        case "ul":
        case "ol":
            return block.items;
        case "stats":
            return block.items.map((item) => `${item.value} ${item.label}`);
        default:
            return [];
    }
}

/** The article's words as a reader meets them, panels and example included: its reading time and JSON-LD. */
export function adviceFatigueWordCount(content: AdviceFatigueContent, flow: PerspectiveFlow): number {
    const runs = [
        content.title,
        content.dek,
        ...content.lead,
        ...content.sections.flatMap((section) => [section.title, ...section.blocks.flatMap(blockText)]),
        ...content.paradox.rows.flat(),
        ...flow.steps.flatMap((step) => [step.title, step.body]),
        flow.branch.title,
        flow.branch.body,
        content.example.question,
        ...content.example.animals.flatMap((animal) => [...animal.bubbles, animal.step]),
        ...content.faq.flatMap((item) => [item.question, item.answer])
    ];
    return runs.reduce((total, run) => total + countWords(run), 0);
}
