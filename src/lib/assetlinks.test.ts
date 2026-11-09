import assert from "node:assert/strict";
import test from "node:test";
import {assetLinksStatements, defaultAndroidSha256CertFingerprints} from "./assetlinks";

const fingerprintShape = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

test("without the env var the Play signing and upload fingerprints are served", () => {
    const [statement] = assetLinksStatements({});
    assert.equal(statement.target.package_name, "app.animaldex");
    assert.deepEqual(statement.target.sha256_cert_fingerprints, defaultAndroidSha256CertFingerprints);
    assert.deepEqual(statement.relation, ["delegate_permission/common.handle_all_urls"]);
    assert.equal(statement.target.namespace, "android_app");
});

test("an empty env var still falls back", () => {
    const [statement] = assetLinksStatements({packageName: " ", fingerprints: " , "});
    assert.equal(statement.target.package_name, "app.animaldex");
    assert.equal(statement.target.sha256_cert_fingerprints.length, 2);
});

test("the env var overrides the defaults", () => {
    const [statement] = assetLinksStatements({fingerprints: "AA:BB, CC:DD"});
    assert.deepEqual(statement.target.sha256_cert_fingerprints, ["AA:BB", "CC:DD"]);
});

test("every default fingerprint is a SHA-256 in colon form", () => {
    for (const value of defaultAndroidSha256CertFingerprints) assert.match(value, fingerprintShape);
});
