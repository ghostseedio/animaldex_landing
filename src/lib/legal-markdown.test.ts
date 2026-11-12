import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {legalMarkdownForPage} from "@/lib/legal-markdown";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function outline(markdown: string): number[] {
    return markdown.split("\n").map((line) => line.match(/^(#{1,6})\s/)?.[1].length ?? 0).filter(Boolean);
}

test("every legal page has one h1 and never skips a level", () => {
    for (const file of ["privacy-policy", "terms-of-service", "refund-policy", "ai-and-safety", "wildlife-guide-author-terms", "wildlife-guide-buyer-terms"]) {
        const source = readFileSync(join(repoRoot, "src/data", `${file}.md`), "utf8");
        const page = legalMarkdownForPage(source);
        const levels = outline(page);
        assert.equal(levels.filter((level) => level === 1).length, 1, file);
        assert.equal(levels[0], 1, file);
        for (let i = 1; i < levels.length; i++) assert.ok(levels[i] <= levels[i - 1] + 1, `${file}: h${levels[i - 1]} -> h${levels[i]}`);
        // The words are unchanged.
        assert.equal(page.replace(/[#*]/g, "").replace(/\s+/g, " ").trim(), source.replace(/[#*]/g, "").replace(/\s+/g, " ").trim(), file);
    }
});

test("the date under the title becomes a line, not a heading", () => {
    assert.equal(legalMarkdownForPage("## Terms\n#### Effective 1 May\n\nText\n## Accounts\n### Age"), "# Terms\n*Effective 1 May*\n\nText\n## Accounts\n### Age");
    assert.equal(legalMarkdownForPage("## Guide Terms\n#### Version 2\n### 1. Who\nx\n### 2. What"), "# Guide Terms\n*Version 2*\n## 1. Who\nx\n## 2. What");
});
