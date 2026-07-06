"use client";

import {useRouter} from "next/navigation";
import {useState} from "react";

type ProfileSignOutButtonProps = {
    label: string;
    loadingLabel: string;
};

export default function ProfileSignOutButton({label, loadingLabel}: ProfileSignOutButtonProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    async function handleSignOut() {
        setLoading(true);

        try {
            await fetch("/api/auth/logout", {method: "POST"});
            router.refresh();
        } finally {
            setLoading(false);
        }
    }

    return (
        <button
            type="button"
            onClick={handleSignOut}
            disabled={loading}
            className="inline-flex min-h-[3rem] w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-black text-white/70 transition hover:border-white/20 hover:text-white disabled:opacity-60"
        >
            {loading ? loadingLabel : label}
        </button>
    );
}
