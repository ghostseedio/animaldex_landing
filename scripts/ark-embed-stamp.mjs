/**
 * The apps' Ark panel's code version (public/ark/embed.html): `var ARK_BUILT_V = "…";`, which the page puts on every Ark
 * script it asks for (`?v=`). scripts/build-ark-bundle.mjs stamps the build's version (public/ark/ark-version.txt) here in
 * the image's build; the committed page holds "" and falls back to its own Last-Modified.
 */
const STAMP = /var ARK_BUILT_V = "[^"\n]*";/g;

/** The page with `version` stamped in (again, if it was stamped before). Throws when the page has no single stamp. */
export function stampEmbedVersion(html, version) {
    if (!/^[0-9a-f]{6,64}$/.test(version)) throw new Error(`ark-embed-stamp: not a code version: ${JSON.stringify(version)}`);
    const count = (html.match(STAMP) ?? []).length;
    if (count !== 1) throw new Error(`ark-embed-stamp: embed.html has ${count} ARK_BUILT_V stamps, want 1`);
    return html.replace(STAMP, `var ARK_BUILT_V = "${version}";`);
}

/** The version stamped in the page, or "" when it is not stamped. */
export function embedVersion(html) {
    const match = /var ARK_BUILT_V = "([^"\n]*)";/.exec(html);
    return match ? match[1] : "";
}
