/**
 * Runs an edit of a live post without saving, and writes the result JSON.
 *   NODE_OPTIONS=--conditions=react-server npx tsx --env-file=.env --env-file=.env.local \
 *     scripts/blog-edit-dry-run.mts <slug> "instructions (empty = full refresh)" [yes|no research] [out.json]
 */
import {writeFile} from "node:fs/promises";
import {editArticle, listEditablePosts} from "@/lib/blog-generator/edit";

const [slug, instructions = "", research = "yes", out = "tmp/blog-edit-dry-run.json"] = process.argv.slice(2);
if (!slug) {
    const posts = await listEditablePosts();
    console.log(`${posts.length} editable posts, e.g.:\n${posts.slice(0, 15).map((post) => `  ${post.slug} (${post.source})`).join("\n")}`);
    process.exit(0);
}
const started = Date.now();
const result = await editArticle(
    {slug, instructions, research: research !== "no", publish: true, dryRun: true},
    (line) => console.log(`${((Date.now() - started) / 1000).toFixed(0).padStart(4)}s ${line}`)
);
await writeFile(out, JSON.stringify(result, null, 2));
console.log(JSON.stringify({...result, post: undefined}, null, 2));
