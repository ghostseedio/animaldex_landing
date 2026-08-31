"use client";

import {useEffect, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {connectionStatusLabel, INSTAGRAM_IMPORT_PATH, type ExternalImportConnectionRow} from "@/lib/instagram-import";

export default function InstagramSettingsRow({localePrefix}: {localePrefix: string}) {
    const [label, setLabel] = useState("Checking…");

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const response = await fetch("/api/app/import", {cache: "no-store"});
                const payload = await response.json() as {connection?: ExternalImportConnectionRow | null};
                if (!active) return;
                setLabel(connectionStatusLabel(payload.connection ?? null));
            } catch {
                if (!active) return;
                setLabel("Not connected");
            }
        })();
        return () => {
            active = false;
        };
    }, []);

    return (
        <Link href={`${localePrefix}${INSTAGRAM_IMPORT_PATH}`} className="flex items-center justify-between gap-4 px-4 py-3.5 transition hover:bg-white/[0.04]">
            <span>
                <span className="block text-sm font-bold text-white">Instagram</span>
                <span className="block text-xs text-white/40">Import wildlife posts from Instagram.</span>
            </span>
            <span className="shrink-0 text-xs font-bold text-primary-200">{label}</span>
        </Link>
    );
}
