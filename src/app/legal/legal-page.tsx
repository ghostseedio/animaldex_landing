import {remark} from "remark";
import html from "remark-html";
import Image from "next/image";
import logo from "@/app/[locale]/_assets/logos/logo.svg";
import {DatabaseIcon, ShieldUserIcon} from "@/app/[locale]/_components/icons";

export type LegalPageProps = {
    content: string;
};

export default function LegalPage({content}: LegalPageProps) {
    const processedContent = remark()
        .use(html)
        .processSync(content);
    const contentHtml = processedContent.toString();

    return (
        <main className="min-h-screen w-full bg-canvas-950 text-ink-200">
            <div className="w-full text-center max-w-3xl px-4 mx-auto py-16">
                <aside className="flex items-center justify-center gap-4 text-primary-500 mb-8">
                    <Image src={logo} alt="AnimalDex logo" width={64} height={64} priority />
                    <ShieldUserIcon size={64} />
                    <DatabaseIcon size={64} />
                </aside>
                <div
                    className="prose prose-invert prose-headings:font-bold prose-headings:font-display prose-headings:text-white
                    prose-a:text-primary-200 prose-a:underline prose-strong:text-white marker:text-ink-200 prose-li:text-left
                    rounded-4xl border border-line-300 bg-surface-900/80 px-6 py-8 backdrop-blur"
                    dangerouslySetInnerHTML={{__html: contentHtml}}
                />
            </div>
        </main>
    );
}
