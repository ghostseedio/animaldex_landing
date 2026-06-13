const {readFileSync, writeFileSync, existsSync} = require("node:fs");
const path = require("node:path");

function readEnvFile(filePath) {
    if (!existsSync(filePath)) {
        return;
    }

    for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
            continue;
        }

        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex === -1) {
            continue;
        }

        const key = trimmed.slice(0, separatorIndex).trim();
        const value = trimmed.slice(separatorIndex + 1).trim();
        if (!(key in process.env)) {
            process.env[key] = value;
        }
    }
}

function upsertEnvValue(filePath, key, value) {
    const line = `${key}=${value}`;
    if (!existsSync(filePath)) {
        writeFileSync(filePath, `${line}\n`, "utf8");
        return;
    }

    const raw = readFileSync(filePath, "utf8");
    const pattern = new RegExp(`^${key}=.*$`, "m");

    if (pattern.test(raw)) {
        writeFileSync(filePath, raw.replace(pattern, line), "utf8");
        return;
    }

    writeFileSync(filePath, `${raw.trimEnd()}\n${line}\n`, "utf8");
}

async function main() {
    readEnvFile(path.resolve(process.cwd(), ".env"));
    readEnvFile(path.resolve(process.cwd(), ".env.local"));

    const apiKey = process.env.RESEND_API_KEY?.trim();
    const endpoint = process.env.SUPPORT_WEBHOOK_URL?.trim() || "https://animaldex.app/api/resend/inbound";

    if (!apiKey) {
        throw new Error("RESEND_API_KEY is required");
    }

    const listResponse = await fetch("https://api.resend.com/webhooks", {
        headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json"
        }
    });
    const listPayload = await listResponse.json();

    if (!listResponse.ok) {
        throw new Error(`Unable to list Resend webhooks (${listResponse.status})`);
    }

    const existing = Array.isArray(listPayload.data)
        ? listPayload.data.find((item) => item && item.endpoint === endpoint)
        : null;

    if (existing) {
        console.log(`Resend webhook already exists for ${endpoint}`);
        console.log(`Webhook ID: ${existing.id}`);
        console.log("If inbound email is still not arriving, confirm RESEND_WEBHOOK_SECRET in Vercel matches this webhook's signing secret.");
        return;
    }

    const createResponse = await fetch("https://api.resend.com/webhooks", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            endpoint,
            events: ["email.received"]
        })
    });
    const createPayload = await createResponse.json();

    if (!createResponse.ok) {
        throw new Error(`Unable to create Resend webhook (${createResponse.status}): ${JSON.stringify(createPayload)}`);
    }

    console.log(`Created Resend webhook for ${endpoint}`);
    console.log(`Webhook ID: ${createPayload.id}`);

    if (createPayload.signing_secret) {
        upsertEnvValue(path.resolve(process.cwd(), ".env.local"), "RESEND_WEBHOOK_SECRET", createPayload.signing_secret);
        console.log("Saved RESEND_WEBHOOK_SECRET to .env.local");
        console.log("Also add RESEND_WEBHOOK_SECRET to Vercel production env vars before relying on the webhook.");
    } else {
        console.log("No signing_secret returned. Copy the webhook signing secret from Resend and set RESEND_WEBHOOK_SECRET in Vercel.");
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
