import type {Metadata} from "next";
import {notFound} from "next/navigation";
import LandingTalkClient from "./landing-talk-client";

/**
 * DEV ONLY: one talking animal, its mouth moved by a line of text, for the home page's "Hear their side" loop
 * (`public/images/home/ark/`). The real call renderer (`talking-model-renderer.ts`) over the animal's habitat scene,
 * time stepped one frame at a time (`record-clock.ts`), so `window.__landingTalk.frame()` returns exact 30 fps
 * frames however long each takes to draw. 404s in production.
 *
 *   /dev/landing-talk?slug=komodo-dragon&text=...
 */

export const metadata: Metadata = {title: "Landing talking loop", robots: {index: false, follow: false}};

export default function LandingTalkPage({searchParams}: {searchParams: {slug?: string; text?: string; scene?: string}}) {
    if (process.env.NODE_ENV === "production") notFound();
    return <LandingTalkClient slug={searchParams.slug ?? "komodo-dragon"} text={searchParams.text ?? ""} withScene={searchParams.scene !== "0"} />;
}
