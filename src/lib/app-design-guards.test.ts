import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import test from "node:test";

/** Tracked and new .tsx files under the given prefixes. */
function sourceFiles(match: (path: string) => boolean) {
    return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "src"], {encoding: "utf8"})
        .split("\n")
        .filter((path) => path.endsWith(".tsx") && match(path));
}

const ROUNDED = /(?<![\w-])(?:[a-z0-9]+:)*rounded(?:-(?:t|b|l|r|tl|tr|bl|br|s|e))?(?:-(?:sm|md|lg|xl|2xl|3xl|\[[^\]]+\]))?(?![\w[-])/g;

test("the web app has no rounded containers, as in the iOS app", () => {
    // Square edges throughout /app, the iOS-port components it mounts, and /admin.
    // rounded-full stays for avatars, dots, badges and capsule buttons;
    // rounded-[2px] is the site's square button.
    const files = sourceFiles((path) =>
        path.includes("(authenticated)/app")
        || path.startsWith("src/components/animal-detail/")
        || path.startsWith("src/components/ask-animaldex/")
        || path.startsWith("src/components/share/")
        || path.startsWith("src/components/guides/")
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

test("capture photos never go through the Next image optimizer", () => {
    // /api/capture-images and /api/species-images redirect to signed storage
    // URLs, which the optimizer can't follow ("Unable to optimize image"), so
    // the image shows broken. Every <Image> fed a capture photo is unoptimized.
    const files = sourceFiles((path) => path.startsWith("src/"));
    const offenders: string[] = [];
    for (const path of files) {
        const source = readFileSync(path, "utf8");
        for (const tag of source.match(/<Image\b[\s\S]*?\/>/g) ?? []) {
            const src = /src=\{([^}]*)\}/.exec(tag)?.[1] ?? "";
            const isCapturePhoto = /capture\.imageSrc|receiverImageSrc|donor\.imageSrc|photoUrl/.test(src);
            if (isCapturePhoto && !/\bunoptimized\b/.test(tag)) offenders.push(`${path}: src={${src}}`);
        }
    }
    assert.deepEqual(offenders, []);
});
