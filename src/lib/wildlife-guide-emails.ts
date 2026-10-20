import {GUIDE_AUTHOR_TERMS_PATH, GUIDE_BUYER_TERMS_PATH, formatGuidePrice, guidePath} from "@/lib/virtual-wildlife-guides";

/**
 * The Wildlife Guide sales emails, rendered from a wildlife_guide_email_outbox
 * row (migration 20261020160000 in the AnimalDex repo). The database queues one
 * row per event with everything the email says, captured when it happened;
 * POST /api/cron/wildlife-guide-emails sends them through Resend.
 *
 * Authors hear about every sale (what they earn and when they must reply), the
 * 12-hour reminder, a refund for no reply, and their payout released or held
 * for the author terms. Buyers get a receipt (unless they checked out as a
 * guest: the sign-in email is theirs), and every refund decision.
 *
 * Pure: no I/O, so it is unit tested.
 */

export type GuideEmailKind =
    | "seller_sale"
    | "seller_reply_reminder"
    | "seller_no_reply_refund"
    | "seller_payout_released"
    | "seller_payout_held"
    | "buyer_purchase"
    | "buyer_refund"
    | "buyer_refund_review"
    | "buyer_refund_declined";

export type GuideEmailPayload = {
    purchaseId?: string;
    guideId?: string;
    guideSlug?: string;
    guideTitle?: string;
    areaLabel?: string;
    channel?: "credits" | "web_card" | string;
    currencyCode?: string;
    amountMinor?: number;
    creditsAmount?: number;
    chargeCurrency?: string;
    chargeAmountMinor?: number;
    earningsMinor?: number;
    paidAt?: string;
    replyDueAt?: string;
    refundWindowEndsAt?: string;
    releaseAt?: string;
    refundReason?: string;
    refundNote?: string;
    authorTermsAccepted?: boolean;
    buyerName?: string;
    buyerUserId?: string;
    sellerName?: string;
    sellerUserId?: string;
};

export type RenderedGuideEmail = {subject: string; text: string; html: string};

type Block =
    | {kind: "p"; text: string}
    | {kind: "strong"; text: string}
    | {kind: "button"; label: string; href: string}
    | {kind: "facts"; rows: [string, string][]}
    | {kind: "small"; text: string};

const NEON = "#A7F432";

function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (char) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"}[char] ?? char));
}

function absolute(siteUrl: string, path: string) {
    return new URL(path, siteUrl).toString();
}

function money(minor: number | undefined, currency: string | undefined) {
    return formatGuidePrice(Math.max(0, Math.round(minor ?? 0)), (currency || "USD").toUpperCase(), "en");
}

/** What the buyer paid, in the way they paid. */
function pricePaid(payload: GuideEmailPayload) {
    if (payload.channel === "credits" && payload.creditsAmount) {
        return `${payload.creditsAmount} Credits`;
    }
    if (payload.chargeAmountMinor) return money(payload.chargeAmountMinor, payload.chargeCurrency);
    return money(payload.amountMinor, payload.currencyCode);
}

/** Dates in emails are UTC and say so: the reader's time zone is unknown. */
function utcDateTime(value: string | undefined) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat("en", {dateStyle: "medium", timeStyle: "short", timeZone: "UTC"}).format(date);
}

function utcDate(value: string | undefined) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat("en", {dateStyle: "medium", timeZone: "UTC"}).format(date);
}

function hoursLeft(due: string | undefined, now: number) {
    const time = due ? new Date(due).getTime() : Number.NaN;
    if (Number.isNaN(time)) return null;
    return Math.max(1, Math.ceil((time - now) / 3_600_000));
}

function render(subject: string, preheader: string, blocks: Block[], footer: string): RenderedGuideEmail {
    const text = [
        ...blocks.map((block) => {
            switch (block.kind) {
            case "button": return `${block.label}: ${block.href}`;
            case "facts": return block.rows.map(([label, value]) => `${label}: ${value}`).join("\n");
            default: return block.text;
            }
        }),
        "",
        "--",
        footer,
        "AnimalDex · support@animaldex.app"
    ].join("\n\n").replace(/\n{3,}/g, "\n\n");

    const body = blocks.map((block) => {
        switch (block.kind) {
        case "p":
            return `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#1a1a1a">${escapeHtml(block.text)}</p>`;
        case "strong":
            return `<p style="margin:0 0 16px;font-size:17px;line-height:26px;font-weight:700;color:#000">${escapeHtml(block.text)}</p>`;
        case "small":
            return `<p style="margin:0 0 12px;font-size:13px;line-height:20px;color:#666">${escapeHtml(block.text)}</p>`;
        case "button":
            return `<p style="margin:8px 0 24px"><a href="${escapeHtml(block.href)}" style="display:inline-block;padding:12px 22px;background:${NEON};color:#000;font-size:15px;font-weight:700;text-decoration:none;border-radius:999px">${escapeHtml(block.label)}</a></p>`;
        case "facts":
            return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:collapse;width:100%">${block.rows.map(([label, value]) =>
                `<tr><td style="padding:6px 12px 6px 0;font-size:13px;color:#666;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td><td style="padding:6px 0;font-size:14px;color:#1a1a1a;font-weight:600">${escapeHtml(value)}</td></tr>`
            ).join("")}</table>`;
        }
    }).join("\n");

    const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f2">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<tr><td style="background:#111;padding:16px 24px;font-size:15px;font-weight:800;letter-spacing:.02em;color:${NEON}">AnimalDex · Wildlife Guides</td></tr>
<tr><td style="padding:28px 24px 8px">
${body}
</td></tr>
<tr><td style="padding:16px 24px 24px;border-top:1px solid #eee;font-size:12px;line-height:18px;color:#888">${escapeHtml(footer)}<br>AnimalDex · <a href="mailto:support@animaldex.app" style="color:#888">support@animaldex.app</a></td></tr>
</table></td></tr></table>
</body></html>`;
    return {subject, text, html};
}

const SELLER_FOOTER = "You're receiving this because a Wildlife Guide built from your AnimalDex sightings was sold. Sales emails can't be turned off while you have guides for sale; to stop selling, turn off sharing in your Shop.";
const BUYER_FOOTER = "You're receiving this because you bought a Wildlife Guide on AnimalDex.";

/**
 * The email for one outbox row. Returns null for a kind this version does not
 * know (the caller skips it rather than sending something wrong).
 */
export function renderGuideEmail(
    kind: GuideEmailKind | string,
    payload: GuideEmailPayload,
    siteUrl: string,
    now = Date.now()
): RenderedGuideEmail | null {
    const title = payload.guideTitle?.trim() || "your Wildlife Guide";
    const guideUrl = payload.guideId
        ? absolute(siteUrl, guidePath({id: payload.guideId, slug: payload.guideSlug, title: payload.guideTitle}))
        : absolute(siteUrl, "/wildlife-guides");
    const shopUrl = absolute(siteUrl, "/app/guides");
    const chatWithBuyer = payload.buyerUserId ? absolute(siteUrl, `/app/messages/${payload.buyerUserId}`) : absolute(siteUrl, "/app/messages");
    const chatWithSeller = payload.sellerUserId ? absolute(siteUrl, `/app/messages/${payload.sellerUserId}`) : absolute(siteUrl, "/app/messages");
    const earnings = money(payload.earningsMinor, payload.currencyCode);
    const buyer = payload.buyerName?.trim() || "A buyer";
    const seller = payload.sellerName?.trim() || "the author";
    const replyBy = utcDateTime(payload.replyDueAt);
    const authorTermsUrl = absolute(siteUrl, GUIDE_AUTHOR_TERMS_PATH);
    const byCard = payload.channel === "web_card";

    switch (kind) {
    case "seller_sale": {
        const blocks: Block[] = [
            {kind: "strong", text: `${buyer} bought "${title}".`},
            {kind: "p", text: `Reply to them in Messages within 48 hours${replyBy ? ` (by ${replyBy} UTC)` : ""} to keep this sale. If nobody replies, the buyer is refunded automatically and you won't be paid.`},
            {kind: "facts", rows: [
                ["Guide", title],
                ["Buyer", buyer],
                ["Your earnings", `${earnings} (70% after fees)`],
                ["Reply by", replyBy ? `${replyBy} UTC` : "Within 48 hours"]
            ]},
            {kind: "button", label: "Reply to your buyer", href: chatWithBuyer}
        ];
        if (!payload.authorTermsAccepted) {
            blocks.push({kind: "p", text: `To be paid, accept the Wildlife Guide Author Terms in your Shop. Your guides sell either way; your share is held for you until you accept.`});
            blocks.push({kind: "small", text: `Read the terms: ${authorTermsUrl}`});
        } else {
            blocks.push({kind: "small", text: "Your share goes to your Earnings 8 days after the purchase if it isn't refunded."});
        }
        return render(`You sold "${title}": reply within 48 hours`, `${buyer} bought your guide. Reply to keep ${earnings}.`, blocks, SELLER_FOOTER);
    }
    case "seller_reply_reminder": {
        const hours = hoursLeft(payload.replyDueAt, now);
        return render(
            `Reminder: your buyer is waiting (${hours ?? "a few"} hours left)`,
            `Reply about "${title}" to keep ${earnings}.`,
            [
                {kind: "strong", text: `${buyer} is waiting for your reply about "${title}".`},
                {kind: "p", text: `You have ${hours ?? "a few"} ${hours === 1 ? "hour" : "hours"} left. If nobody replies by ${replyBy ?? "the deadline"} UTC, ${earnings} goes back to the buyer as a refund.`},
                {kind: "button", label: "Reply now", href: chatWithBuyer},
                {kind: "small", text: "Any message in the buyer's chat counts as a reply: a welcome and a question about their trip is plenty."}
            ],
            SELLER_FOOTER
        );
    }
    case "seller_no_reply_refund":
        return render(
            `A buyer of "${title}" was refunded`,
            `No reply within 48 hours, so ${earnings} wasn't earned.`,
            [
                {kind: "strong", text: `${buyer} didn't get a reply within 48 hours, so they were refunded.`},
                {kind: "p", text: `You won't be paid the ${earnings} from this sale. To protect buyers, "${title}" has stopped selling. It is still public and still shows up in search.`},
                {kind: "p", text: "When you're ready to answer buyers, resume sales from the guide in your Shop."},
                {kind: "button", label: "Open your Shop", href: shopUrl}
            ],
            SELLER_FOOTER
        );
    case "seller_payout_released":
        return render(
            `${earnings} from "${title}" is in your Earnings`,
            "Your Wildlife Guide earnings are ready.",
            [
                {kind: "strong", text: `${earnings} from your sale of "${title}" is now in your Earnings.`},
                {kind: "p", text: "Payouts follow the AnimalDex Earnings terms. Thanks for helping another explorer."},
                {kind: "button", label: "View Earnings", href: absolute(siteUrl, "/app/earnings")}
            ],
            SELLER_FOOTER
        );
    case "seller_payout_held":
        return render(
            `${earnings} is waiting for you: accept the Author Terms`,
            `Accept the Wildlife Guide Author Terms to receive ${earnings}.`,
            [
                {kind: "strong", text: `You've earned ${earnings} from "${title}".`},
                {kind: "p", text: "To receive it, accept the Wildlife Guide Author Terms and confirm you're 18 or older. It takes a minute in your Shop, and the money moves to your Earnings straight away."},
                {kind: "button", label: "Accept and get paid", href: shopUrl},
                {kind: "small", text: `Read the terms: ${authorTermsUrl}`}
            ],
            SELLER_FOOTER
        );
    case "buyer_purchase":
        return render(
            `Your Wildlife Guide: ${title}`,
            `Your receipt for "${title}". ${seller} will reply within 48 hours.`,
            [
                {kind: "strong", text: `Thanks for buying "${title}".`},
                {kind: "p", text: `The author's notes and contacts are unlocked. ${seller} has 48 hours to reply in your chat; if they don't, you're refunded automatically.`},
                {kind: "facts", rows: [
                    ["Guide", title],
                    ["Author", seller],
                    ["Paid", pricePaid(payload)],
                    ["Date", utcDate(payload.paidAt) ?? ""],
                    ["Refunds open until", utcDate(payload.refundWindowEndsAt) ?? "7 days after purchase"],
                    ["Order", payload.purchaseId ?? ""]
                ].filter(([, value]) => value) as [string, string][]},
                {kind: "button", label: "Open your guide", href: guideUrl},
                {kind: "p", text: `Message the author: ${chatWithSeller}`},
                {kind: "small", text: `You agreed to the Wildlife Guide Buyer Terms: ${absolute(siteUrl, GUIDE_BUYER_TERMS_PATH)}. This is a virtual guide: advice from someone who has been there, not a tour. Wildlife is never guaranteed.`},
                ...(byCard ? [{kind: "small" as const, text: "Your card statement shows the payment through Paddle, our payment provider, which also emails you its own receipt."}] : [])
            ],
            BUYER_FOOTER
        );
    case "buyer_refund": {
        const why = payload.refundReason === "no_reply"
            ? `${seller} didn't reply within 48 hours, so we refunded you automatically.`
            : payload.refundReason === "moderation"
                ? "AnimalDex removed this guide, so we refunded you."
                : payload.refundReason === "payment_reversed"
                    ? "Your payment was reversed, so the purchase was cancelled."
                    : "Your refund request was approved.";
        const how = byCard
            ? `${pricePaid(payload)} is going back to the card you paid with. Your bank usually shows it within 5 to 10 business days.`
            : `${pricePaid(payload)} is back in your Credits balance.`;
        return render(
            `Refund for "${title}"`,
            why,
            [
                {kind: "strong", text: `You've been refunded for "${title}".`},
                {kind: "p", text: why},
                {kind: "p", text: how},
                {kind: "small", text: "The guide's notes and contacts are locked again. You can buy it again at any time."}
            ],
            BUYER_FOOTER
        );
    }
    case "buyer_refund_review":
        return render(
            `We're reviewing your refund request for "${title}"`,
            "A person will look at your request and let you know.",
            [
                {kind: "strong", text: `We've received your refund request for "${title}".`},
                {kind: "p", text: "Your first refund in 90 days is instant; after that, a person reviews each request. We'll email you and tell you in the app when it's decided, usually within 2 business days."},
                {kind: "p", text: "Until then the guide stays open to you."}
            ],
            BUYER_FOOTER
        );
    case "buyer_refund_declined":
        return render(
            `Your refund request for "${title}" was declined`,
            "Your refund request was reviewed.",
            [
                {kind: "strong", text: `We reviewed your refund request for "${title}" and couldn't approve it.`},
                ...(payload.refundNote?.trim() ? [{kind: "p" as const, text: `Reason: ${payload.refundNote.trim()}`}] : []),
                {kind: "p", text: "The guide stays open to you. If you think we got this wrong, reply to this email."},
                {kind: "button", label: "Open your guide", href: guideUrl}
            ],
            BUYER_FOOTER
        );
    default:
        return null;
    }
}
