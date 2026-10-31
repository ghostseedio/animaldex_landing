import Link from "@/app/[locale]/_components/link";
import {parseInlineMarkup} from "@/lib/inline-markup";

/**
 * Copy written in `inline-markup.ts`: bold runs, and links. A site path goes
 * through the locale-aware Link, a `#ref` stays an in-page anchor, and
 * anything else opens in a new tab.
 */
export default function InlineCopy({text, linkClassName}: {text: string; linkClassName?: string}) {
    return (
        <>
            {parseInlineMarkup(text).map((token, index) => {
                if (token.type === "bold") return <strong key={index}>{token.text}</strong>;
                if (token.type === "text") return <span key={index}>{token.text}</span>;
                if (token.href.startsWith("#")) {
                    return <a key={index} href={token.href} className={linkClassName}>{token.text}</a>;
                }
                if (token.href.startsWith("/")) {
                    return <Link key={index} href={token.href} className={linkClassName}>{token.text}</Link>;
                }
                return (
                    <a key={index} href={token.href} target="_blank" rel="noopener noreferrer" className={linkClassName}>
                        {token.text}
                    </a>
                );
            })}
        </>
    );
}
