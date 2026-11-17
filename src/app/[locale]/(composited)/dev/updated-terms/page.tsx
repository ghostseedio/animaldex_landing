import type {Metadata} from "next";
import {notFound} from "next/navigation";
import UpdatedTermsGate from "@/app/[locale]/(authenticated)/app/_components/updated-terms-gate";

/**
 * DEV ONLY: the "Updated Terms" gate from a fixture status, with no network.
 * 404s in production.   /dev/updated-terms
 */

export const metadata: Metadata = {title: "Updated Terms gate", robots: {index: false, follow: false}};

export default function UpdatedTermsGalleryPage() {
    if (process.env.NODE_ENV === "production") notFound();
    return <UpdatedTermsGate preview={{version: "2026-11-17", accepted: false, acceptedAt: null}}/>;
}
