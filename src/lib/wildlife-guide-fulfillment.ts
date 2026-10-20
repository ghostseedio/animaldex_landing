import "server-only";
import {createHash} from "crypto";
import type {SupabaseClient} from "@supabase/supabase-js";
import type {WildlifeGuideFulfillment, WildlifeGuideWebPurchase} from "@/lib/paddle-webhook";
import {getSiteUrl} from "@/lib/site";
import {sendResendEmail} from "@/lib/support";
import {guidePath} from "@/lib/virtual-wildlife-guides";

/**
 * The real side effects of a Wildlife Guide card purchase, for the Paddle
 * webhook: reading the purchase row, finding or creating the buyer's account
 * from the email they paid with, and emailing a guest a sign-in link that
 * opens the guide. Everything runs with the service role.
 */

const PURCHASE_COLUMNS = "id, listing_id, channel, status, buyer_user_id, buyer_email, paddle_transaction_id";

function normalizeEmail(email: string) {
    return email.trim().toLowerCase();
}

/** Same digest public.sync_user_contact_identifiers stores for every auth email. */
function emailIdentifierHash(email: string) {
    return createHash("sha256").update(normalizeEmail(email), "utf8").digest("hex");
}

function fromHeader() {
    const email = process.env.SUPPORT_FROM_EMAIL?.trim() || "support@animaldex.app";
    return `AnimalDex <${email}>`;
}

function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (char) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"}[char] ?? char));
}

async function userIdFromMagicLink(service: SupabaseClient, email: string) {
    const {data, error} = await service.auth.admin.generateLink({type: "magiclink", email});
    if (error || !data.user?.id) throw new Error(error?.message || "wildlife_guide_buyer_account_failed");
    return data.user.id;
}

/** A one-time sign-in link to /auth/confirm, which signs the person in and opens `nextPath`. */
export async function createSignInLink(service: SupabaseClient, email: string, nextPath: string) {
    const {data, error} = await service.auth.admin.generateLink({type: "magiclink", email: normalizeEmail(email)});
    const tokenHash = data?.properties?.hashed_token;
    if (error || !tokenHash) throw new Error(error?.message || "sign_in_link_failed");
    const url = new URL("/auth/confirm", getSiteUrl());
    url.searchParams.set("token_hash", tokenHash);
    url.searchParams.set("type", "magiclink");
    url.searchParams.set("next", nextPath);
    return url.toString();
}

/** Emails the buyer a link that signs them in on the guide's page. */
export async function sendGuideAccessEmail(
    service: SupabaseClient,
    input: {email: string; listingId: string; idempotencyKey: string}
) {
    const {data: listing} = await service
        .from("guide_listings")
        .select("id, slug, title")
        .eq("id", input.listingId)
        .maybeSingle();
    const title = (listing?.title as string | undefined)?.trim() || "your Wildlife Guide";
    const path = guidePath({id: input.listingId, slug: listing?.slug as string | undefined, title});
    const link = await createSignInLink(service, input.email, path);
    const text = [
        `Thanks for buying "${title}".`,
        "",
        "Open your guide (this link signs you in to AnimalDex):",
        link,
        "",
        "The author's notes and contacts are unlocked, and you can message the author from the guide page.",
        "The link works once and expires after an hour. If it has expired, open the guide page and ask for a new link with the same email.",
        "",
        "This is a virtual guide: advice from someone who has been there, not a tour."
    ].join("\n");
    const html = `<p>Thanks for buying <strong>${escapeHtml(title)}</strong>.</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 20px;background:#A7F432;color:#000;font-weight:700;text-decoration:none">Open your guide</a></p>
<p>This link signs you in to AnimalDex. The author's notes and contacts are unlocked, and you can message the author from the guide page.</p>
<p style="color:#666;font-size:13px">The link works once and expires after an hour. If it has expired, open the guide page and ask for a new link with the same email.</p>
<p style="color:#666;font-size:13px">This is a virtual guide: advice from someone who has been there, not a tour.</p>`;
    await sendResendEmail({
        from: fromHeader(),
        to: normalizeEmail(input.email),
        subject: `Your Wildlife Guide: ${title}`,
        text,
        html,
        idempotencyKey: input.idempotencyKey
    });
}

export function createWildlifeGuideFulfillment(service: SupabaseClient): WildlifeGuideFulfillment {
    return {
        async loadPurchase(purchaseId) {
            const {data, error} = await service.from("guide_purchases").select(PURCHASE_COLUMNS).eq("id", purchaseId).maybeSingle();
            if (error) throw new Error(error.message);
            return (data as WildlifeGuideWebPurchase | null) ?? null;
        },

        async findUserIdByEmail(email) {
            const {data, error} = await service
                .from("user_contact_identifiers")
                .select("user_id")
                .eq("identifier_hash", emailIdentifierHash(email))
                .limit(5);
            if (error) throw new Error(error.message);
            for (const row of (data ?? []) as {user_id: string}[]) {
                const {data: found} = await service.auth.admin.getUserById(row.user_id);
                if (found.user?.email && normalizeEmail(found.user.email) === normalizeEmail(email)) return found.user.id;
            }
            return null;
        },

        async createUser(email) {
            const {data, error} = await service.auth.admin.createUser({email: normalizeEmail(email), email_confirm: true});
            if (data.user?.id) return data.user.id;
            // Registered after all (an account from before the identifier table): the link call returns it.
            if (error && /already|exists|registered/i.test(error.message)) return userIdFromMagicLink(service, email);
            throw new Error(error?.message || "wildlife_guide_buyer_account_failed");
        },

        async reopenPurchase(purchaseId) {
            const {error} = await service.from("guide_purchases").update({status: "pending"}).eq("id", purchaseId).eq("status", "failed");
            if (error) throw new Error(error.message);
        },

        async sendAccessLink({email, purchaseId, listingId}) {
            await sendGuideAccessEmail(service, {email, listingId, idempotencyKey: `wildlife-guide-access:${purchaseId}`});
        }
    };
}
