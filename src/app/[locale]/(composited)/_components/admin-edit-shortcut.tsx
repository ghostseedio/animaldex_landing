"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useEffect, useMemo, useState} from "react";
import {requestHasSupabaseAuthCookie} from "@/lib/supabase/auth-cookie";

export default function AdminEditShortcut({editablePageSlugs}: {editablePageSlugs: string[]}) {
    const pathname = usePathname();
    const [isAdmin, setIsAdmin] = useState(false);
    const target = useMemo(() => {
        const segments = pathname.split("/").filter(Boolean);
        if (segments[0] === "en" || segments[0] === "id") segments.shift();
        if (segments[0] === "blog" && segments.length === 2) {
            return {type: "blog", slug: segments[1], label: "Edit article"};
        }
        if (segments.length === 1 && editablePageSlugs.includes(segments[0])) {
            return {type: "page", slug: segments[0], label: "Edit page"};
        }
        return null;
    }, [pathname, editablePageSlugs]);

    useEffect(() => {
        if (!target) return;
        // Shared-password admin sessions are httpOnly and cannot be seen here.
        // Named email admins are signed into Supabase, so skip the status call
        // unless an auth cookie is already present.
        if (!requestHasSupabaseAuthCookie(document.cookie)) return;
        let active = true;
        fetch("/api/admin/auth/status", {cache: "no-store"})
            .then((response) => response.json())
            .then((body) => { if (active) setIsAdmin(body.isAdmin === true); })
            .catch(() => {});
        return () => { active = false; };
    }, [target]);

    if (!target || !isAdmin) return null;

    return (
        <Link
            href={`/admin/seo?type=${target.type}&slug=${encodeURIComponent(target.slug)}`}
            className="fixed bottom-5 right-4 z-40 flex items-center gap-2 rounded-full border border-primary-300/50 bg-canvas-950/95 px-4 py-3 text-sm font-black text-primary-100 shadow-[0_16px_50px_rgba(0,0,0,.45)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-primary-400 hover:text-canvas-950 sm:bottom-7 sm:right-7"
            aria-label={`${target.label}: ${target.slug}`}
        >
            <span aria-hidden="true">✎</span><span>{target.label}</span>
        </Link>
    );
}
