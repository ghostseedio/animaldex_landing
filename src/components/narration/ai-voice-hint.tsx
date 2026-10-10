"use client";

import {usePathname} from "next/navigation";
import Link from "@/app/[locale]/_components/link";

/** "Sign in for the AI voice" under a Listen / Play button, for signed-out readers. */
export default function AiVoiceHint({className = ""}: {className?: string}) {
    const pathname = usePathname() || "/";

    return (
        <p className={`text-[12px] leading-5 text-[color:var(--text-400)] ${className}`}>
            <Link href={`/account?next=${encodeURIComponent(pathname)}`} className="font-semibold text-[color:var(--lime)] underline-offset-2 hover:underline">
                Sign in
            </Link>
            {" "}to hear this read by a natural AI voice instead of your browser&apos;s.
        </p>
    );
}
