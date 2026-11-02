import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import test from "node:test";

/** Tracked and new source files under the given prefixes. */
function sourceFiles(match: (path: string) => boolean, extensions = [".tsx"]) {
    return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "src"], {encoding: "utf8"})
        .split("\n")
        .filter((path) => extensions.some((extension) => path.endsWith(extension)) && match(path));
}

/** Every `rounded…` class, token or not. */
const ANY_ROUNDED = /(?<![\w-])(?:[a-z0-9]+:)*rounded(?:-[\w[\]./-]+)?(?![\w[-])/g;
/**
 * The one radius scale (globals.css, DESIGN.md section 2): rounded-full for
 * circles and capsules, and the five tokens, on any corner set.
 */
const TOKEN_ROUNDED = /^(?:[a-z0-9]+:)*rounded(?:-(?:t|b|l|r|tl|tr|bl|br|s|e|ss|se|ee|es))?-(?:full|pill|bubble|bubble-tight|panel|card)$/;
/** An inline radius written as a number or a length (`borderRadius: 12`, `"19px"`, `border-radius: 50%`). */
const INLINE_RADIUS = /border-?[Rr]adius\s*[:=]\s*(?:\{\s*)?["'`]?\s*-?\d[\w.%]*/g;

/** The source without its comments, where "rounded" may be an English word. */
function withoutComments(source: string) {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

/** The chat, Talk, debates and Companions folders: where the radius scale is law. */
const RADIUS_SCOPE = (path: string) =>
    path.startsWith("src/components/ask-animaldex/")
    || path.startsWith("src/components/debates/")
    || path.startsWith("src/components/companions/")
    || path.includes("/talk/")
    || path.includes("(authenticated)/app/companions/")
    || path.includes("(authenticated)/app/_components/app-shell");

test("the chat, Talk, debates and Companions use the radius tokens and nothing else", () => {
    // DESIGN.md section 2: pill, bubble (+ bubble-tight), panel, card, and circles (rounded-full).
    // A number, a px value or an ad-hoc rounded-* class is an offender; `var(--r-…)` is allowed
    // inline where corners are computed (a bubble's grouped corner).
    const files = sourceFiles(RADIUS_SCOPE, [".tsx", ".ts"]);
    assert.ok(files.length > 10, "the scope should find the chat's files");
    const offenders: string[] = [];
    for (const path of files) {
        const source = withoutComments(readFileSync(path, "utf8"));
        if (path.endsWith(".tsx")) {
            for (const match of source.match(ANY_ROUNDED) ?? []) {
                if (!TOKEN_ROUNDED.test(match)) offenders.push(`${path}: ${match}`);
            }
        }
        for (const match of source.match(INLINE_RADIUS) ?? []) offenders.push(`${path}: ${match.trim()}`);
    }
    assert.deepEqual(offenders, []);
});

test("the radius guard catches an ad-hoc value", () => {
    const sample = `<div className="rounded-xl md:rounded-[9px]" style={{borderRadius: 12}} /> <p style={{borderRadius: "19px"}} /> <b className="rounded-full rounded-t-card" style={{borderRadius: "var(--r-panel)"}} />`;
    const classes = (sample.match(ANY_ROUNDED) ?? []).filter((match) => !TOKEN_ROUNDED.test(match));
    assert.deepEqual(classes, ["rounded-xl", "md:rounded-[9px]"]);
    assert.deepEqual((sample.match(INLINE_RADIUS) ?? []).map((match) => match.trim()), ["borderRadius: 12", "borderRadius: \"19px"]);
    assert.equal(withoutComments("{/* never inset rounded cards */} // rounded\nrounded-card"), "{} \nrounded-card");
});

test("the radius tokens are declared once, in globals.css and the Tailwind theme", () => {
    const css = readFileSync("src/app/[locale]/_assets/globals.css", "utf8");
    for (const token of ["--r-pill", "--r-bubble", "--r-bubble-tight", "--r-panel", "--r-card", "--ease-spring"]) {
        assert.match(css, new RegExp(`${token}:`), `${token} in globals.css`);
    }
    const tailwind = readFileSync("tailwind.config.js", "utf8");
    for (const name of ["pill", "bubble", "bubble-tight", "panel", "card"]) {
        assert.match(tailwind, new RegExp(`'${name}': 'var\\(--r-${name}\\)'`), `rounded-${name} in the Tailwind theme`);
    }
});

const ROUNDED = /(?<![\w-])(?:[a-z0-9]+:)*rounded(?:-(?:t|b|l|r|tl|tr|bl|br|s|e))?(?:-(?:sm|md|lg|xl|2xl|3xl|\[[^\]]+\]))?(?![\w[-])/g;

test("the web app has no rounded containers, as in the iOS app", () => {
    // Square edges throughout /app, the iOS-port components it mounts, and /admin.
    // rounded-full stays for avatars, dots, badges and capsule buttons, the radius
    // tokens (rounded-pill, -panel, -card…) for the chat's controls;
    // rounded-[2px] is the site's square button.
    const files = sourceFiles((path) =>
        path.includes("(authenticated)/app")
        || path.startsWith("src/components/animal-detail/")
        || path.startsWith("src/components/ask-animaldex/")
        || path.startsWith("src/components/share/")
        || path.startsWith("src/components/wildlife-guides/")
        || path.includes("(composited)/guides/")
        || path.includes("(composited)/wildlife-guides/")
        || path.includes("(composited)/u/[handle]/")
        || path.startsWith("src/app/admin/")
        || path.startsWith("src/components/admin/")
    );
    const offenders: string[] = [];
    for (const path of files) {
        const source = readFileSync(path, "utf8");
        for (const match of source.match(ROUNDED) ?? []) {
            if (match.endsWith("rounded-[2px]")) continue;
            offenders.push(`${path}: ${match}`);
        }
    }
    assert.deepEqual(offenders, []);
});

test("capture photos and species artwork never go through the Next image optimizer", () => {
    // /api/capture-images, /api/species-images and /api/species-artwork redirect
    // to storage URLs, which the optimizer can't follow ("Unable to optimize
    // image"), so the image shows broken (the tier-list highlight cards, Oct
    // 2026). Every <Image> fed a capture photo or an artwork route is unoptimized.
    const files = sourceFiles((path) => path.startsWith("src/"));
    const offenders: string[] = [];
    for (const path of files) {
        const source = readFileSync(path, "utf8");
        for (const tag of source.match(/<Image\b[\s\S]*?\/>/g) ?? []) {
            const src = /src=\{([^}]*)\}/.exec(tag)?.[1] ?? "";
            const isCapturePhoto = /capture\.imageSrc|receiverImageSrc|donor\.imageSrc|photoUrl|iconSrc|getSpeciesArtworkRoute|buildSpeciesArtworkSrc/.test(src);
            if (isCapturePhoto && !/\bunoptimized\b/.test(tag)) offenders.push(`${path}: src={${src}}`);
        }
    }
    assert.deepEqual(offenders, []);
});
