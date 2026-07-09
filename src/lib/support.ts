import {randomBytes} from "crypto";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {getSiteUrl} from "@/lib/site";

export type ResendWebhookPayload = {
    type?: string;
    created_at?: string;
    data?: Record<string, unknown>;
};

export type InboundEmail = {
    emailId?: string;
    from?: string;
    to: string[];
    subject?: string;
    createdAt?: string;
    html?: string | null;
    text?: string | null;
    headers?: Record<string, string> | null;
    messageId?: string;
};

export type SupportThread = {
    id: string;
    customer_email: string;
    customer_name: string | null;
    subject: string | null;
    status: string;
    resend_received_email_id: string | null;
    created_at: string;
    updated_at: string;
};

export type SupportMessage = {
    id: string;
    thread_id: string;
    direction: "inbound" | "outbound";
    from_email: string;
    to_email: string;
    subject: string | null;
    text_body: string | null;
    html_body: string | null;
    resend_email_id: string | null;
    raw_payload?: unknown;
    created_at: string;
};

type SupportReplyToken = {
    id: string;
    thread_id: string;
    token: string;
    expires_at: string;
    used_at: string | null;
    created_at: string;
};

type RuntimeResendClient = {
    emails?: {
        receiving?: {
            get?: (emailId: string) => Promise<{
                data?: unknown;
                error?: {message?: string} | null;
            }>;
        };
    };
};

type ResendSendOptions = {
    from: string;
    to: string | string[];
    replyTo?: string;
    subject: string;
    text: string;
    html: string;
    headers?: Record<string, string>;
    idempotencyKey?: string;
};

export type SafeSupportMessage = {
    id: string;
    direction: "inbound" | "outbound";
    fromEmail: string;
    toEmail: string;
    subject: string | null;
    body: string;
    createdAt: string;
};

export type SafeSupportThread = {
    id: string;
    subject: string | null;
    customerEmail: string;
    customerName: string | null;
    status: string;
    messages: SafeSupportMessage[];
};

function getRequiredResendApiKey() {
    const apiKey = process.env.RESEND_API_KEY?.trim();

    if (!apiKey) {
        throw new Error("RESEND_API_KEY is not configured");
    }

    return apiKey;
}

function getSupportForwardTo() {
    return process.env.SUPPORT_FORWARD_TO?.trim() || "lennybeadle@gmail.com";
}

function getSupportFromEmail() {
    return process.env.SUPPORT_FROM_EMAIL?.trim() || "support@animaldex.app";
}

function getSupportFromName() {
    return process.env.SUPPORT_FROM_NAME?.trim() || "AnimalDex Support";
}

function getSupportFromHeader() {
    return `${getSupportFromName()} <${getSupportFromEmail()}>`;
}

function getSupabaseWriteConfig() {
    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getSupabaseServiceKey();

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Supabase write env vars are not configured");
    }

    return {supabaseUrl, serviceRoleKey};
}

function buildSupabaseUrl(path: string) {
    const {supabaseUrl} = getSupabaseWriteConfig();
    return `${supabaseUrl}/rest/v1/${path.replace(/^\//, "")}`;
}

async function supabaseRequest<T>(path: string, init: RequestInit = {}) {
    const {serviceRoleKey} = getSupabaseWriteConfig();
    const response = await fetch(buildSupabaseUrl(path), {
        ...init,
        headers: {
            ...getSupabaseHeaders(serviceRoleKey, {
                Accept: "application/json"
            }),
            ...init.headers
        },
        cache: "no-store"
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Supabase request failed with status ${response.status}: ${errorText.slice(0, 300)}`);
    }

    if (response.status === 204) {
        return null as T;
    }

    return await response.json() as T;
}

function withRepresentationHeaders(extra?: Record<string, string>) {
    return {
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...extra
    };
}

export function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function stripHtmlToText(value: string) {
    if (!value) {
        return "";
    }

    return value
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]{2,}/g, " ")
        .trim();
}

export function normalizeEmailAddress(value: string | undefined) {
    if (!value) {
        return null;
    }

    const angleMatch = value.match(/<([^<>\s]+@[^<>\s]+)>/);
    const email = angleMatch?.[1] ?? value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
    return email?.toLowerCase() ?? null;
}

export function extractEmailName(value: string | undefined) {
    if (!value) {
        return null;
    }

    const angleIndex = value.indexOf("<");
    const name = angleIndex >= 0 ? value.slice(0, angleIndex).trim().replace(/^"|"$/g, "") : "";
    return name || null;
}

export function createReplyToken() {
    return randomBytes(32).toString("base64url");
}

export function getReplyLink(token: string) {
    return `${getSiteUrl()}/admin/support/reply/${encodeURIComponent(token)}`;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value : undefined;
}

function asStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    }

    const singleValue = asString(value);
    return singleValue ? [singleValue] : [];
}

function asHeaders(value: unknown): Record<string, string> | null {
    if (!isRecord(value)) {
        return null;
    }

    return Object.fromEntries(
        Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string")
    );
}

function getHeaderValue(headers: Record<string, string> | null | undefined, name: string) {
    if (!headers) {
        return undefined;
    }

    const lowerName = name.toLowerCase();
    const match = Object.entries(headers).find(([key]) => key.toLowerCase() === lowerName);
    return match?.[1];
}

export function normalizeInboundEmail(data: Record<string, unknown>): InboundEmail {
    return {
        emailId: asString(data.email_id) ?? asString(data.id),
        from: asString(data.from),
        to: asStringArray(data.to),
        subject: asString(data.subject),
        createdAt: asString(data.created_at) ?? asString(data.date),
        html: typeof data.html === "string" ? data.html : null,
        text: typeof data.text === "string" ? data.text : null,
        headers: asHeaders(data.headers),
        messageId: asString(data.message_id)
    };
}

function mergeInboundEmail(base: InboundEmail, fetched: InboundEmail): InboundEmail {
    return {
        emailId: fetched.emailId ?? base.emailId,
        from: fetched.from ?? base.from,
        to: fetched.to.length > 0 ? fetched.to : base.to,
        subject: fetched.subject ?? base.subject,
        createdAt: fetched.createdAt ?? base.createdAt,
        html: fetched.html ?? base.html,
        text: fetched.text ?? base.text,
        headers: fetched.headers ?? base.headers,
        messageId: fetched.messageId ?? base.messageId
    };
}

async function retrieveReceivedEmailWithSdk(emailId: string) {
    const runtimeRequire = eval("require") as NodeRequire;
    const {Resend} = runtimeRequire("resend") as {Resend: new (key: string) => RuntimeResendClient};
    const client = new Resend(getRequiredResendApiKey());
    const get = client.emails?.receiving?.get;

    // Resend SDK 6.12.4 exposes emails.receiving.get(emailId). If a future
    // version changes this API, this best-effort path can be adjusted while
    // the direct REST fallback below keeps inbound processing working.
    if (typeof get !== "function") {
        return null;
    }

    const result = await get(emailId);

    if (result.error) {
        throw new Error(`Resend SDK received-email lookup failed: ${result.error.message ?? "Unknown error"}`);
    }

    return isRecord(result.data) ? normalizeInboundEmail(result.data) : null;
}

async function retrieveReceivedEmailWithRest(emailId: string) {
    const response = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
        headers: {
            Authorization: `Bearer ${getRequiredResendApiKey()}`,
            Accept: "application/json"
        },
        cache: "no-store"
    });

    if (!response.ok) {
        throw new Error(`Resend REST received-email lookup failed with status ${response.status}`);
    }

    const data = await response.json();
    return isRecord(data) ? normalizeInboundEmail(data) : null;
}

export async function retrieveReceivedEmail(email: InboundEmail) {
    if (!email.emailId || email.html || email.text) {
        return email;
    }

    try {
        const sdkEmail = await retrieveReceivedEmailWithSdk(email.emailId);

        if (sdkEmail) {
            return mergeInboundEmail(email, sdkEmail);
        }
    } catch (error) {
        console.error("[support] Resend SDK received-email lookup failed", {
            emailId: email.emailId,
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }

    const restEmail = await retrieveReceivedEmailWithRest(email.emailId);
    return restEmail ? mergeInboundEmail(email, restEmail) : email;
}

function normalizeThreadSubject(subject: string | undefined) {
    const value = subject?.trim().replace(/^(re|fw|fwd):\s*/i, "");
    return value || "(no subject)";
}

function encoded(value: string) {
    return encodeURIComponent(value);
}

async function findOpenThread(customerEmail: string, subject: string) {
    const query = [
        "select=*",
        `customer_email=eq.${encoded(customerEmail)}`,
        `subject=eq.${encoded(subject)}`,
        "status=eq.open",
        "order=updated_at.desc",
        "limit=1"
    ].join("&");
    const rows = await supabaseRequest<SupportThread[]>(`support_threads?${query}`);
    return rows[0] ?? null;
}

async function createSupportThread(input: {
    customerEmail: string;
    customerName: string | null;
    subject: string;
    resendReceivedEmailId: string | null;
}) {
    const rows = await supabaseRequest<SupportThread[]>("support_threads", {
        method: "POST",
        headers: withRepresentationHeaders(),
        body: JSON.stringify({
            customer_email: input.customerEmail,
            customer_name: input.customerName,
            subject: input.subject,
            status: "open",
            resend_received_email_id: input.resendReceivedEmailId
        })
    });

    if (!rows[0]) {
        throw new Error("Supabase did not return created support thread");
    }

    return rows[0];
}

export async function createOrUpdateSupportThread(email: InboundEmail) {
    const customerEmail = normalizeEmailAddress(email.from);

    if (!customerEmail) {
        throw new Error("Inbound email is missing a valid sender");
    }

    const subject = normalizeThreadSubject(email.subject);
    const existingThread = await findOpenThread(customerEmail, subject);

    if (existingThread) {
        await updateSupportThread(existingThread.id, {
            customer_name: existingThread.customer_name ?? extractEmailName(email.from),
            resend_received_email_id: email.emailId ?? existingThread.resend_received_email_id
        });
        return existingThread;
    }

    return createSupportThread({
        customerEmail,
        customerName: extractEmailName(email.from),
        subject,
        resendReceivedEmailId: email.emailId ?? null
    });
}

export async function updateSupportThread(threadId: string, patch: Partial<Pick<SupportThread, "customer_name" | "resend_received_email_id" | "status">> = {}) {
    const rows = await supabaseRequest<SupportThread[]>(
        `support_threads?id=eq.${encoded(threadId)}`,
        {
            method: "PATCH",
            headers: withRepresentationHeaders(),
            body: JSON.stringify({
                ...patch,
                updated_at: new Date().toISOString()
            })
        }
    );
    return rows[0] ?? null;
}

export async function createSupportMessage(input: {
    threadId: string;
    direction: "inbound" | "outbound";
    fromEmail: string;
    toEmail: string;
    subject: string | null;
    textBody: string | null;
    htmlBody: string | null;
    resendEmailId?: string | null;
    rawPayload?: unknown;
}) {
    const rows = await supabaseRequest<SupportMessage[]>("support_messages", {
        method: "POST",
        headers: withRepresentationHeaders(),
        body: JSON.stringify({
            thread_id: input.threadId,
            direction: input.direction,
            from_email: input.fromEmail,
            to_email: input.toEmail,
            subject: input.subject,
            text_body: input.textBody,
            html_body: input.htmlBody,
            resend_email_id: input.resendEmailId ?? null,
            raw_payload: input.rawPayload ?? null
        })
    });

    if (!rows[0]) {
        throw new Error("Supabase did not return created support message");
    }

    return rows[0];
}

export async function createStoredReplyToken(threadId: string) {
    const token = createReplyToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const rows = await supabaseRequest<SupportReplyToken[]>("support_reply_tokens", {
        method: "POST",
        headers: withRepresentationHeaders(),
        body: JSON.stringify({
            thread_id: threadId,
            token,
            expires_at: expiresAt
        })
    });

    if (!rows[0]) {
        throw new Error("Supabase did not return created support reply token");
    }

    return rows[0];
}

async function loadToken(token: string) {
    const rows = await supabaseRequest<SupportReplyToken[]>(
        `support_reply_tokens?token=eq.${encoded(token)}&select=*&limit=1`
    );
    return rows[0] ?? null;
}

async function loadThread(threadId: string) {
    const rows = await supabaseRequest<SupportThread[]>(
        `support_threads?id=eq.${encoded(threadId)}&select=*&limit=1`
    );
    return rows[0] ?? null;
}

async function loadMessages(threadId: string) {
    return await supabaseRequest<SupportMessage[]>(
        `support_messages?thread_id=eq.${encoded(threadId)}&select=id,thread_id,direction,from_email,to_email,subject,text_body,html_body,resend_email_id,created_at&order=created_at.asc`
    );
}

export async function loadSupportThreads(options?: {limit?: number; offset?: number}) {
    const safeLimit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
    const safeOffset = Math.max(options?.offset ?? 0, 0);
    return await supabaseRequest<SupportThread[]>(
        `support_threads?select=*&order=updated_at.desc&limit=${safeLimit}&offset=${safeOffset}`
    );
}

export async function loadSupportThreadById(threadId: string) {
    return loadThread(threadId);
}

export async function loadSupportMessagesByThreadId(threadId: string) {
    return loadMessages(threadId);
}

export async function loadValidSupportThreadByToken(token: string) {
    const record = await loadToken(token);

    if (!record) {
        return {ok: false as const, status: 404, error: "Reply link was not found"};
    }

    if (record.used_at) {
        return {ok: false as const, status: 410, error: "Reply link has already been used"};
    }

    if (new Date(record.expires_at).getTime() <= Date.now()) {
        return {ok: false as const, status: 410, error: "Reply link has expired"};
    }

    const thread = await loadThread(record.thread_id);

    if (!thread) {
        return {ok: false as const, status: 404, error: "Support thread was not found"};
    }

    const messages = await loadMessages(thread.id);
    return {ok: true as const, token: record, thread, messages};
}

export async function markReplyTokenUsed(tokenId: string) {
    await supabaseRequest<SupportReplyToken[]>(
        `support_reply_tokens?id=eq.${encoded(tokenId)}`,
        {
            method: "PATCH",
            headers: withRepresentationHeaders(),
            body: JSON.stringify({used_at: new Date().toISOString()})
        }
    );
}

export function toSafeSupportThread(thread: SupportThread, messages: SupportMessage[]): SafeSupportThread {
    return {
        id: thread.id,
        subject: thread.subject,
        customerEmail: thread.customer_email,
        customerName: thread.customer_name,
        status: thread.status,
        messages: messages.map((message) => ({
            id: message.id,
            direction: message.direction,
            fromEmail: message.from_email,
            toEmail: message.to_email,
            subject: message.subject,
            body: message.text_body || stripHtmlToText(message.html_body || "") || "(No message body)",
            createdAt: message.created_at
        }))
    };
}

export async function sendResendEmail(options: ResendSendOptions) {
    const headers: Record<string, string> = {
        Authorization: `Bearer ${getRequiredResendApiKey()}`,
        "Content-Type": "application/json",
        Accept: "application/json"
    };

    if (options.idempotencyKey) {
        headers["Idempotency-Key"] = options.idempotencyKey;
    }

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers,
        body: JSON.stringify({
            from: options.from,
            to: options.to,
            reply_to: options.replyTo,
            subject: options.subject,
            text: options.text,
            html: options.html,
            headers: options.headers
        })
    });

    const responseBody = await response.json().catch(() => null);

    if (!response.ok) {
        const message = isRecord(responseBody) && typeof responseBody.message === "string"
            ? responseBody.message
            : `Resend send failed with status ${response.status}`;
        throw new Error(message);
    }

    return isRecord(responseBody) && typeof responseBody.id === "string" ? responseBody.id : null;
}

function buildOriginalMessageText(email: InboundEmail) {
    return email.text || stripHtmlToText(email.html || "") || "(No message body was available.)";
}

function buildOriginalMessageHtml(email: InboundEmail) {
    return email.html || `<pre style="white-space:pre-wrap">${escapeHtml(buildOriginalMessageText(email))}</pre>`;
}

export async function sendSupportForwardNotification(input: {
    email: InboundEmail;
    replyLink: string;
}) {
    const {email, replyLink} = input;
    const originalSubject = email.subject ?? "(no subject)";
    const originalDate = email.createdAt ?? getHeaderValue(email.headers, "date") ?? "(unknown)";
    const originalTo = email.to.length > 0 ? email.to.join(", ") : "(unknown)";
    const metadataText = [
        "New inbound support email for AnimalDex.",
        "",
        `Reply in AnimalDex Admin: ${replyLink}`,
        "",
        `From: ${email.from ?? "(unknown)"}`,
        `To: ${originalTo}`,
        `Subject: ${originalSubject}`,
        `Date: ${originalDate}`,
        "",
        "----- Original message -----",
        "",
        buildOriginalMessageText(email)
    ].join("\n");
    const metadataHtml = [
        "<div>",
        "<p>New inbound support email for AnimalDex.</p>",
        `<p><a href="${escapeHtml(replyLink)}" style="display:inline-block;padding:10px 14px;background:#1bc451;color:#040705;text-decoration:none;border-radius:6px;font-weight:700">Reply in AnimalDex Admin</a></p>`,
        "<dl>",
        `<dt><strong>From</strong></dt><dd>${escapeHtml(email.from ?? "(unknown)")}</dd>`,
        `<dt><strong>To</strong></dt><dd>${escapeHtml(originalTo)}</dd>`,
        `<dt><strong>Subject</strong></dt><dd>${escapeHtml(originalSubject)}</dd>`,
        `<dt><strong>Date</strong></dt><dd>${escapeHtml(originalDate)}</dd>`,
        "</dl>",
        "<hr />",
        buildOriginalMessageHtml(email),
        "</div>"
    ].join("");

    return sendResendEmail({
        from: getSupportFromHeader(),
        to: getSupportForwardTo(),
        replyTo: getSupportForwardTo(),
        subject: `[AnimalDex Support] ${originalSubject}`,
        text: metadataText,
        html: metadataHtml,
        headers: email.messageId ? {"X-AnimalDex-Original-Message-ID": email.messageId} : undefined,
        idempotencyKey: email.emailId ? `support-forward-${email.emailId}` : undefined
    });
}

export async function sendSupportReply(input: {
    thread: SupportThread;
    message: string;
    previousMessages?: SupportMessage[];
}) {
    const subject = input.thread.subject?.startsWith("Re:")
        ? input.thread.subject
        : `Re: ${input.thread.subject ?? "(no subject)"}`;
    const escapedMessage = escapeHtml(input.message).replace(/\n/g, "<br />");
    const history = (input.previousMessages ?? []).slice(-6);
    const historyText = history.length > 0
        ? [
            "",
            "----- Previous support thread -----",
            ...history.map((item) => {
                const label = item.direction === "inbound" ? item.from_email : "AnimalDex Support";
                const body = item.text_body || stripHtmlToText(item.html_body || "") || "(No message body)";
                return [`${label} on ${item.created_at}:`, body].join("\n");
            })
        ].join("\n\n")
        : "";
    const historyHtml = history.length > 0
        ? [
            "<hr />",
            "<p><strong>Previous support thread</strong></p>",
            ...history.map((item) => {
                const label = item.direction === "inbound" ? item.from_email : "AnimalDex Support";
                const body = item.text_body || stripHtmlToText(item.html_body || "") || "(No message body)";
                return `<blockquote style="border-left:3px solid #d1ddd3;margin:12px 0;padding-left:12px;color:#4b5563"><p><strong>${escapeHtml(label)}</strong> on ${escapeHtml(item.created_at)}</p><pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(body)}</pre></blockquote>`;
            })
        ].join("")
        : "";
    const html = [
        "<div>",
        `<p>${escapedMessage}</p>`,
        "<p>AnimalDex Support</p>",
        historyHtml,
        "</div>"
    ].join("");
    const text = `${input.message.trim()}\n\nAnimalDex Support${historyText}`;

    return sendResendEmail({
        from: getSupportFromHeader(),
        to: input.thread.customer_email,
        replyTo: getSupportFromEmail(),
        subject,
        text,
        html
    });
}

export function getSupportSenderEmail() {
    return getSupportFromEmail();
}

type ResendReceivedEmailListItem = {
    id: string;
    from?: string;
    to?: string[];
    subject?: string;
    created_at?: string;
    message_id?: string;
};

export async function listResendReceivedEmails(limit = 50) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const response = await fetch(`https://api.resend.com/emails/receiving?limit=${safeLimit}`, {
        headers: {
            Authorization: `Bearer ${getRequiredResendApiKey()}`,
            Accept: "application/json"
        },
        cache: "no-store"
    });

    if (!response.ok) {
        throw new Error(`Resend received-email list failed with status ${response.status}`);
    }

    const payload = await response.json();

    if (!isRecord(payload) || !Array.isArray(payload.data)) {
        return [] as ResendReceivedEmailListItem[];
    }

    return payload.data.filter((item): item is ResendReceivedEmailListItem => isRecord(item) && typeof item.id === "string");
}

export async function supportMessageExistsForResendEmailId(resendEmailId: string) {
    const rows = await supabaseRequest<SupportMessage[]>(
        `support_messages?resend_email_id=eq.${encoded(resendEmailId)}&select=id&limit=1`
    );
    return rows.length > 0;
}

export async function processInboundSupportEmail(input: {
    payload?: ResendWebhookPayload;
    emailId?: string;
    sendForwardNotification?: boolean;
}) {
    const payloadData = input.payload?.data;
    const webhookData = isRecord(payloadData) ? payloadData : null;
    const emailId = input.emailId ?? asString(webhookData?.email_id) ?? asString(webhookData?.id);

    if (!emailId && !webhookData) {
        throw new Error("Inbound email metadata is missing an email id");
    }

    const initialEmail = normalizeInboundEmail({
        ...(webhookData ?? {}),
        email_id: emailId,
        id: emailId,
        created_at: webhookData?.created_at ?? input.payload?.created_at
    });
    const email = await retrieveReceivedEmail(initialEmail);
    const fromEmail = normalizeEmailAddress(email.from);

    if (!fromEmail) {
        throw new Error("Inbound email is missing a valid sender");
    }

    if (!email.html && !email.text) {
        throw new Error("Inbound email body is unavailable after lookup");
    }

    if (email.emailId && await supportMessageExistsForResendEmailId(email.emailId)) {
        return {status: "skipped" as const, reason: "already_imported", emailId: email.emailId};
    }

    const thread = await createOrUpdateSupportThread(email);
    const message = await createSupportMessage({
        threadId: thread.id,
        direction: "inbound",
        fromEmail,
        toEmail: email.to.join(", ") || getSupportFromEmail(),
        subject: email.subject ?? null,
        textBody: email.text ?? stripHtmlToText(email.html ?? "") ?? null,
        htmlBody: email.html ?? null,
        resendEmailId: email.emailId ?? null,
        rawPayload: input.payload ?? null
    });
    await updateSupportThread(thread.id);

    let forwardResendEmailId: string | null = null;

    if (input.sendForwardNotification !== false) {
        const replyToken = await createStoredReplyToken(thread.id);
        forwardResendEmailId = await sendSupportForwardNotification({
            email,
            replyLink: getReplyLink(replyToken.token)
        });
    }

    return {
        status: "imported" as const,
        threadId: thread.id,
        messageId: message.id,
        emailId: email.emailId ?? null,
        forwardResendEmailId
    };
}

export async function syncMissingReceivedEmailsFromResend(limit = 50) {
    const receivedEmails = await listResendReceivedEmails(limit);
    const results: Array<Awaited<ReturnType<typeof processInboundSupportEmail>>> = [];

    for (const receivedEmail of receivedEmails) {
        results.push(await processInboundSupportEmail({
            emailId: receivedEmail.id,
            payload: {
                type: "email.received",
                created_at: receivedEmail.created_at,
                data: {
                    email_id: receivedEmail.id,
                    from: receivedEmail.from,
                    to: receivedEmail.to,
                    subject: receivedEmail.subject,
                    created_at: receivedEmail.created_at,
                    message_id: receivedEmail.message_id
                }
            },
            sendForwardNotification: false
        }));
    }

    const imported = results.filter((result) => result.status === "imported").length;
    const skipped = results.filter((result) => result.status === "skipped").length;

    return {
        scanned: receivedEmails.length,
        imported,
        skipped,
        results
    };
}
