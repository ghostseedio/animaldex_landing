"use client";

import {useRouter} from "next/navigation";

type AccountSignOutButtonProps = {
    label: string;
};

export default function AccountSignOutButton({label}: AccountSignOutButtonProps) {
    const router = useRouter();

    async function handleSignOut() {
        await fetch("/api/auth/logout", {method: "POST"});
        router.push("/account");
        router.refresh();
    }

    return (
        <button
            type="button"
            onClick={handleSignOut}
            className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-primary-400 hover:text-primary-100"
        >
            {label}
        </button>
    );
}
