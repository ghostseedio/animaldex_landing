import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";
import test from "node:test";
import {resolveVisualSignature} from "@/lib/system-dynamics";
import {
    WELCOME_APP_LANGUAGES,
    WELCOME_INTRO_CLIPS,
    WELCOME_LANGUAGE_NATIVE_NAMES,
    formatWelcomeLanguageCookie,
    matchWelcomeLanguage,
    parseWelcomeLanguageCookie,
    resolveWelcomeIntroLanguage,
    welcomeLanguageFromAcceptLanguage,
    welcomeLanguageIsRTL,
    welcomeLanguageShortCode,
    welcomeLanguageTag,
    welcomeLanguageUsesTracking,
    welcomeOfferedLanguages,
    WELCOME_INTRO_LINEUP,
    WELCOME_INTRO_VOICEOVER,
    WELCOME_VOICEOVER_BASE_URL,
    localizeWelcomeLineup,
    parseWelcomeVoiceoverManifest,
    resolveWelcomeVoiceSource,
    selectWelcomeCues,
    selectWelcomeIntroStrings,
    welcomeDomainTitle,
    welcomeSystemDynamics,
    welcomeText,
    welcomeVoiceClip,
    welcomeVoiceoverUrl
} from "@/lib/welcome-intro";

test("every System Dynamics card decodes its live rows and draws a wave", () => {
    const stories = WELCOME_INTRO_LINEUP.flatMap((animal) => (animal.system ? [animal.system] : []));
    assert.equal(stories.length, 3);
    for (const story of stories) {
        const dynamics = welcomeSystemDynamics(story);
        assert.ok(dynamics, "rows decode");
        assert.ok(dynamics.frequencyProfile.modes.length > 0, "has frequency modes");
        assert.ok(dynamics.waveform?.pathD, "has the waveform path");
        assert.notEqual(resolveVisualSignature(dynamics).type, undefined);
    }
});

test("each lesson's cues are in order, one per domain or evidence step", () => {
    for (const animal of WELCOME_INTRO_LINEUP) {
        const cues = animal.system?.cueSeconds ?? animal.trial?.cueSeconds;
        if (!cues) continue;
        assert.deepEqual([...cues].sort((a, b) => a - b), cues, `${animal.name} cues ascend`);
        if (animal.system) assert.equal(cues.length, animal.system.domains.length);
        if (animal.trial) assert.equal(cues.length, 4);
    }
});

test("every card's image and voiceover is in public/", () => {
    for (const animal of WELCOME_INTRO_LINEUP) {
        assert.ok(existsSync(`public/images/welcome/${animal.image}.webp`), animal.image);
        assert.ok(existsSync(`public/audio/welcome/${animal.voiceover}.mp3`), animal.voiceover);
    }
    assert.ok(existsSync(`public/audio/welcome/${WELCOME_INTRO_VOICEOVER}.mp3`));
    for (const sound of ["camera_shutter", "reward_points", "reward_credits", "train_complete"]) {
        assert.ok(existsSync(`public/audio/welcome/${sound}.wav`), sound);
    }
});

// MARK: - Languages

const TEXT_FILE = {
    version: 1,
    languages: {
        en: {"Little Owl": "Little Owl", "For you": "For you", "Trial": "Trial", "Language": "Language"},
        fr: {"Little Owl": "Chevêche d'Athéna", "For you": "Pour toi", "Trial": ""}
    }
};

test("text resolves in the chosen language, then English, then the key", () => {
    const fr = selectWelcomeIntroStrings(TEXT_FILE, "fr");
    assert.equal(welcomeText(fr, "Little Owl"), "Chevêche d'Athéna");
    assert.equal(welcomeText(fr, "For you"), "Pour toi");
    assert.equal(welcomeText(fr, "Trial"), "Trial", "an empty translation falls back to English");
    assert.equal(welcomeText(fr, "Language"), "Language", "a missing key falls back to English");
    assert.equal(welcomeText(fr, "Nowhere"), "Nowhere", "a key in no language reads as itself");

    const unknown = selectWelcomeIntroStrings(TEXT_FILE, "sw");
    assert.deepEqual(unknown, TEXT_FILE.languages.en, "a language not in the file is English");
});

test("the bundled text file covers every on-screen string in English", () => {
    const file = JSON.parse(readFileSync("src/data/welcome-intro/welcome-intro-text.json", "utf8"));
    const english = selectWelcomeIntroStrings(file, "en");
    const localized = localizeWelcomeLineup(english);
    assert.deepEqual(localized, WELCOME_INTRO_LINEUP, "English is unchanged by localization");
    const keys = WELCOME_INTRO_LINEUP.flatMap((animal) => [
        animal.name, animal.power, animal.motto, animal.forYou,
        ...(animal.system?.domains.map((line) => line.text) ?? []),
        ...(animal.trial ? [animal.trial.title, animal.trial.instruction, animal.trial.proofLabel, ...animal.trial.checks] : [])
    ]);
    for (const key of [...keys, "Collected", "For you", "Seen in", "Trial", "min", "Power earned", "Record", "AI check", "Earned", "Spot", "Collect", "Learn", "Language"]) {
        assert.ok(key in english, key);
    }
    for (const animal of WELCOME_INTRO_LINEUP) {
        for (const line of animal.system?.domains ?? []) assert.notEqual(welcomeDomainTitle(english, line.domain), line.domain, line.domain);
    }
});

test("a translated lineup swaps text but keeps stats, images, clips and cues", () => {
    const strings = {"Hawaiian Crow": "Corbeau d'Hawaï", "Video": "Vidéo", "Free jazz: each player acts on local cues.": "Free jazz : chacun réagit."};
    const lineup = localizeWelcomeLineup(strings);
    const crow = lineup.find((animal) => animal.image === "hawaiian-crow")!;
    assert.equal(crow.name, "Corbeau d'Hawaï");
    assert.equal(crow.trial?.proofLabel, "Vidéo");
    assert.equal(crow.voiceover, "welcome_vo_hawaiian_crow");
    const octopus = lineup.find((animal) => animal.image === "common-octopus")!;
    assert.equal(octopus.system?.domains[1].text, "Free jazz : chacun réagit.");
    assert.equal(octopus.system?.domains[0].text, "Soft robot arms that sense and respond on their own.");
    assert.deepEqual(octopus.system?.cueSeconds, WELCOME_INTRO_LINEUP[2].system?.cueSeconds);
});

const MANIFEST = {
    version: 1,
    voice: "JBFqnCBsd6RMkjVDRZzb",
    languages: {
        fr: {
            bytes: 712345,
            clips: {
                welcome_vo_intro: {path: "v1/fr/welcome_vo_intro.mp3", duration: 3.9, cues: []},
                welcome_vo_common_octopus: {path: "v1/fr/welcome_vo_common_octopus.mp3", duration: 21.4, cues: [8.1, 12.0, 15.6]},
                // Wrong number of cues for the Trial card: left out.
                welcome_vo_hawaiian_crow: {path: "v1/fr/welcome_vo_hawaiian_crow.mp3", duration: 20, cues: [8, 15]},
                // Cues out of order: dropped by the parser.
                welcome_vo_kingfisher: {path: "v1/fr/welcome_vo_kingfisher.mp3", duration: 18, cues: [9, 8, 14]},
                // No duration: dropped.
                welcome_vo_lar_gibbon: {path: "v1/fr/welcome_vo_lar_gibbon.mp3", cues: []}
            }
        },
        de: {clips: "nope"}
    }
};

test("the manifest parser keeps good clips and drops malformed ones", () => {
    assert.equal(parseWelcomeVoiceoverManifest(null), null);
    assert.equal(parseWelcomeVoiceoverManifest({error: "not_found"}), null);
    assert.equal(parseWelcomeVoiceoverManifest({version: 1, languages: []})?.languages.fr, undefined);

    const manifest = parseWelcomeVoiceoverManifest(MANIFEST);
    assert.ok(manifest);
    assert.deepEqual(Object.keys(manifest.languages), ["fr"], "a language without a clips object is skipped");
    const clips = manifest.languages.fr.clips;
    assert.deepEqual(clips.welcome_vo_common_octopus, {path: "v1/fr/welcome_vo_common_octopus.mp3", duration: 21.4, cues: [8.1, 12.0, 15.6]});
    assert.ok(clips.welcome_vo_hawaiian_crow, "the parser doesn't judge cue counts");
    assert.equal(clips.welcome_vo_kingfisher, undefined);
    assert.equal(clips.welcome_vo_lar_gibbon, undefined);
});

test("a language's voice: English bundled, others from the manifest, silent without one", () => {
    const manifest = parseWelcomeVoiceoverManifest(MANIFEST);
    assert.deepEqual(resolveWelcomeVoiceSource("en", null), {kind: "bundled"});
    assert.deepEqual(resolveWelcomeVoiceSource("en", manifest), {kind: "bundled"}, "English never downloads");
    assert.deepEqual(resolveWelcomeVoiceSource("fr", null), {kind: "silent"});
    assert.deepEqual(resolveWelcomeVoiceSource("ja", manifest), {kind: "silent"});

    const fr = resolveWelcomeVoiceSource("fr", manifest);
    assert.equal(fr.kind, "remote");
    if (fr.kind !== "remote") return;
    assert.deepEqual(Object.keys(fr.clips).sort(), ["welcome_vo_common_octopus", "welcome_vo_intro"]);
    assert.equal(fr.clips.welcome_vo_common_octopus.url, `${WELCOME_VOICEOVER_BASE_URL}v1/fr/welcome_vo_common_octopus.mp3`);

    // A clip the language lacks plays nothing: never the English file.
    assert.equal(welcomeVoiceClip(fr, "welcome_vo_little_owl"), null);
    assert.equal(welcomeVoiceClip({kind: "silent"}, "welcome_vo_intro"), null);
    assert.deepEqual(welcomeVoiceClip({kind: "bundled"}, "welcome_vo_intro"), {url: "/audio/welcome/welcome_vo_intro.mp3", duration: null, cues: null});
    assert.deepEqual(welcomeVoiceClip(fr, "welcome_vo_common_octopus"), {url: fr.clips.welcome_vo_common_octopus.url, duration: 21.4, cues: [8.1, 12.0, 15.6]});
});

test("manifest paths resolve against the bucket; site paths stay local", () => {
    assert.equal(welcomeVoiceoverUrl("v1/fr/a.mp3"), `${WELCOME_VOICEOVER_BASE_URL}v1/fr/a.mp3`);
    assert.equal(welcomeVoiceoverUrl("/audio/welcome/a.mp3"), "/audio/welcome/a.mp3");
    assert.equal(welcomeVoiceoverUrl("https://cdn.example/a.mp3"), "https://cdn.example/a.mp3");
    assert.equal(welcomeVoiceoverUrl("v1/a.mp3", "https://x.test/bucket///"), "https://x.test/bucket/v1/a.mp3");
});

test("cue selection: manifest cues for translations, English cues for English, silent pacing without a voice", () => {
    const englishCues = [12.78, 17.51, 19.57];
    const silentCues = [1.6, 4.4, 7.2];
    assert.deepEqual(selectWelcomeCues({spoken: true, englishCues, clipCues: null, silentCues}), englishCues);
    assert.deepEqual(selectWelcomeCues({spoken: true, englishCues, clipCues: [8.1, 12, 15.6], silentCues}), [8.1, 12, 15.6]);
    assert.deepEqual(selectWelcomeCues({spoken: false, englishCues, clipCues: [8.1, 12, 15.6], silentCues}), silentCues);
    assert.deepEqual(selectWelcomeCues({spoken: true, englishCues, clipCues: [8.1], silentCues}), silentCues, "a cue-count mismatch never borrows English timing");
});

test("the dev fixture manifest serves every clip under a fake code", () => {
    const fixture = parseWelcomeVoiceoverManifest(JSON.parse(readFileSync("src/data/welcome-intro/dev-voiceover-manifest.json", "utf8")));
    const source = resolveWelcomeVoiceSource("xx", fixture);
    assert.equal(source.kind, "remote");
    if (source.kind !== "remote") return;
    assert.deepEqual(Object.keys(source.clips).sort(), [...WELCOME_INTRO_CLIPS].sort());
    for (const clip of Object.values(source.clips)) assert.ok(existsSync(`public${clip.url}`), clip.url);
});

// MARK: - The intro's language on the web

const OFFERED = [...WELCOME_APP_LANGUAGES];

test("the text file offers all 45 app languages, each with every English key", () => {
    const file = JSON.parse(readFileSync("src/data/welcome-intro/welcome-intro-text.json", "utf8"));
    const offered = welcomeOfferedLanguages(file);
    assert.equal(offered.length, 45);
    assert.deepEqual(offered, WELCOME_APP_LANGUAGES, "in the app's order");
    const englishKeys = Object.keys(file.languages.en);
    for (const code of offered) {
        assert.ok(WELCOME_LANGUAGE_NATIVE_NAMES[code], `${code} has a native name`);
        const missing = englishKeys.filter((key) => !file.languages[code][key]);
        assert.deepEqual(missing, [], `${code} translates every key`);
    }
});

test("short codes, tags and direction", () => {
    assert.equal(welcomeLanguageShortCode("zh-hans"), "ZH-S");
    assert.equal(welcomeLanguageShortCode("zh-hant"), "ZH-T");
    assert.equal(welcomeLanguageShortCode("pt"), "PT");
    assert.equal(welcomeLanguageTag("zh-hant"), "zh-Hant");
    for (const code of ["ar", "ur", "fa", "he"]) assert.ok(welcomeLanguageIsRTL(code), code);
    for (const code of ["en", "hi", "ja", "zh-hans"]) assert.ok(!welcomeLanguageIsRTL(code), code);
    for (const code of ["en", "ru", "el", "vi", "xx"]) assert.ok(welcomeLanguageUsesTracking(code), `${code} tracked`);
    for (const code of ["ar", "hi", "ta", "th", "ja", "zh-hant", "he"]) assert.ok(!welcomeLanguageUsesTracking(code), `${code} untracked`);
});

test("browser language tags map onto the app's codes", () => {
    assert.equal(matchWelcomeLanguage("pt-BR", OFFERED), "pt");
    assert.equal(matchWelcomeLanguage("zh-CN", OFFERED), "zh-hans");
    assert.equal(matchWelcomeLanguage("zh-TW", OFFERED), "zh-hant");
    assert.equal(matchWelcomeLanguage("zh-Hant-HK", OFFERED), "zh-hant");
    assert.equal(matchWelcomeLanguage("zh-Hans-HK", OFFERED), "zh-hans");
    assert.equal(matchWelcomeLanguage("zh", OFFERED), "zh-hans");
    assert.equal(matchWelcomeLanguage("fil-PH", OFFERED), "tl");
    assert.equal(matchWelcomeLanguage("iw", OFFERED), "he");
    assert.equal(matchWelcomeLanguage("no", OFFERED), "nb");
    assert.equal(matchWelcomeLanguage("en_GB", OFFERED), "en");
    assert.equal(matchWelcomeLanguage("xh", OFFERED), null);
    assert.equal(matchWelcomeLanguage("te", ["en"]), null, "only offered languages");

    assert.equal(welcomeLanguageFromAcceptLanguage("xh-ZA,fr-CH;q=0.9,en;q=0.8", OFFERED), "fr");
    assert.equal(welcomeLanguageFromAcceptLanguage("en;q=0.5, ja;q=0.9", OFFERED), "ja", "by quality, not order");
    assert.equal(welcomeLanguageFromAcceptLanguage("de;q=0, *", OFFERED), null);
    assert.equal(welcomeLanguageFromAcceptLanguage(null, OFFERED), null);
});

test("the remembered choice holds only on the locale it was made on", () => {
    assert.deepEqual(parseWelcomeLanguageCookie(formatWelcomeLanguageCookie("zh-hant", "en")), {code: "zh-hant", locale: "en"});
    assert.deepEqual(parseWelcomeLanguageCookie("ar%3Aid"), {code: "ar", locale: "id"});
    assert.equal(parseWelcomeLanguageCookie("ar"), null);
    assert.equal(parseWelcomeLanguageCookie("<script>:en"), null);

    const base = {defaultLocale: "en", offered: OFFERED};
    // First visit: the browser's language on the unprefixed site, else the site locale.
    assert.equal(resolveWelcomeIntroLanguage({...base, locale: "en", cookie: null, acceptLanguage: "hi-IN,en;q=0.8"}), "hi");
    assert.equal(resolveWelcomeIntroLanguage({...base, locale: "en", cookie: null, acceptLanguage: "xh"}), "en");
    assert.equal(resolveWelcomeIntroLanguage({...base, locale: "id", cookie: null, acceptLanguage: "hi"}), "id", "a locale prefix is a choice");
    // A choice made here holds, over the browser's language.
    assert.equal(resolveWelcomeIntroLanguage({...base, locale: "en", cookie: "ar:en", acceptLanguage: "hi"}), "ar");
    assert.equal(resolveWelcomeIntroLanguage({...base, locale: "en", cookie: "en:en", acceptLanguage: "hi"}), "en");
    // The site locale changed since: it takes over.
    assert.equal(resolveWelcomeIntroLanguage({...base, locale: "id", cookie: "ar:en", acceptLanguage: "hi"}), "id");
    assert.equal(resolveWelcomeIntroLanguage({...base, locale: "en", cookie: "ar:id", acceptLanguage: "hi"}), "en");
    // A code the intro doesn't offer is ignored.
    assert.equal(resolveWelcomeIntroLanguage({...base, locale: "en", cookie: "qq:en", acceptLanguage: null}), "en");
});

test("a clip's bytes version its URL, so a regenerated clip isn't served from cache", () => {
    const manifest = parseWelcomeVoiceoverManifest({
        version: 1,
        languages: {ja: {clips: {welcome_vo_intro: {path: "v1/ja/welcome_vo_intro.mp3", bytes: 171234, duration: 3.2, cues: []}}}}
    });
    assert.equal(manifest?.languages.ja.clips.welcome_vo_intro.bytes, 171234);
    const source = resolveWelcomeVoiceSource("ja", manifest);
    assert.equal(source.kind === "remote" && source.clips.welcome_vo_intro.url, `${WELCOME_VOICEOVER_BASE_URL}v1/ja/welcome_vo_intro.mp3?v=171234`);
});
