import assert from "node:assert/strict";
import test from "node:test";
import {attachmentResponseHeaders} from "./support-attachment-headers";

test("raster images render inline under a sandbox policy", () => {
    const headers = attachmentResponseHeaders("image/png", 'inline; filename="photo.png"');
    assert.equal(headers["Content-Type"], "image/png");
    assert.equal(headers["Content-Disposition"], 'inline; filename="photo.png"');
    assert.equal(headers["Content-Security-Policy"], "sandbox; default-src 'none'");
    assert.equal(headers["X-Content-Type-Options"], "nosniff");
    assert.equal(headers["Cache-Control"], "private, no-store");
});

test("HTML, SVG and PDF attachments become downloads with an opaque type", () => {
    for (const [type, name] of [
        ["text/html; charset=utf-8", "invoice.html"],
        ["image/svg+xml", "logo.svg"],
        ["application/pdf", "doc.pdf"],
        ["application/javascript", "x.js"],
        [null, "unknown.bin"]
    ] as const) {
        const headers = attachmentResponseHeaders(type, `attachment; filename="${name}"`);
        assert.equal(headers["Content-Type"], "application/octet-stream", type ?? "null");
        assert.equal(headers["Content-Disposition"], `attachment; filename="${name}"`);
    }
});

test("the filename is taken from upstream but cannot carry header syntax", () => {
    assert.equal(
        attachmentResponseHeaders("image/jpeg", 'inline; filename="a\\"b; evil=1.jpg"')["Content-Disposition"],
        'inline; filename="a_"'
    );
    assert.equal(
        attachmentResponseHeaders("image/jpeg", "attachment; filename*=UTF-8''r%C3%A9sum%C3%A9.jpg")["Content-Disposition"],
        'inline; filename="r_C3_A9sum_C3_A9.jpg"'
    );
    assert.equal(attachmentResponseHeaders("image/gif", null)["Content-Disposition"], 'inline; filename="attachment"');
});
