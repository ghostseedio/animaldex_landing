import {ReactNode} from "react";
import {cookies} from "next/headers";
import AdminLoginForm from "@/app/admin/_components/admin-login-form";
import {isSupportAdminCookieAuthorized} from "@/lib/support-admin-auth";

/**
 * Server-side gate for admin pages: returns the page for an operator, and the
 * password prompt for everyone else.
 *
 * The data behind these pages was already protected — every /api/admin route
 * answers 401 without a session — but the pages themselves rendered for anyone,
 * which published the shape of the operation: which tools exist, what each one
 * holds, and where it lives. Deciding on the server means an unauthorised
 * request is sent the prompt and never the page.
 *
 * Not applied to /admin/support/reply/[token], which is a magic-link flow for
 * people who are not operators and carries its own token check.
 */
export async function withAdminGate(content: ReactNode): Promise<ReactNode> {
    if (await isSupportAdminCookieAuthorized(cookies())) {
        return content;
    }

    return <AdminLoginForm />;
}
