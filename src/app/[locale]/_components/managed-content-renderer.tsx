import {notFound} from "next/navigation";
import Header from "@/app/[locale]/(composited)/_components/header";
import Footer from "@/app/[locale]/(composited)/_components/footer";
import ContentImageFigure from "@/app/[locale]/(composited)/_components/content-image-figure";
import {getManagedPage} from "@/lib/admin-content";
import {canRenderCodeBlock, getRenderedCodeDocument} from "@/lib/rendered-code-block";
import RenderedCodeFrame from "@/app/_components/rendered-code-frame";

type ManagedContentRendererProps = {
    locale: string;
    page: NonNullable<Awaited<ReturnType<typeof getManagedPage>>>;
};

export default function ManagedContentRenderer({locale, page}: ManagedContentRendererProps) {
    if (!page) notFound();
    const sourceMigrated = typeof (page as typeof page & {cmsSourceMigrated?: unknown}).cmsSourceMigrated === "string";

    return (
        <>
            <Header locale={locale} />
            <main className="mx-auto w-full max-w-[86rem] px-4 pb-20 sm:px-8">
                <article className={sourceMigrated ? "mx-auto flex w-full max-w-[88rem] flex-col gap-10 py-12 md:py-20" : "mx-auto max-w-5xl"}>
                    {page.headerHtml ? (
                        <RenderedCodeFrame
                            title="Page header"
                            documentHtml={getRenderedCodeDocument({language: "html+css+js", code: page.headerHtml})}
                            minHeight={240}
                        />
                    ) : (
                        <header className="py-12 text-center sm:py-16">
                            <div className="flex flex-wrap justify-center gap-2">
                                {page.tags.map((tag) => <span key={tag} className="rounded-full border border-primary-400/30 bg-primary-500/10 px-3 py-1 text-xs font-bold text-primary-100">{tag}</span>)}
                            </div>
                            <h1 className="mt-5 font-display text-4xl leading-tight text-white sm:text-6xl">{page.title}</h1>
                            <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-ink-300">{page.description}</p>
                        </header>
                    )}
                    {sourceMigrated ? null : <div className="mb-12"><ContentImageFigure image={page.featuredImage} priority /></div>}
                    <div className={sourceMigrated ? "flex flex-col gap-10" : "space-y-14"}>
                        {page.sections.map((section, sectionIndex) => (
                            section.html !== undefined ? (
                                <RenderedCodeFrame
                                    key={`${section.title}-${sectionIndex}`}
                                    title={section.title || `Page section ${sectionIndex + 1}`}
                                    documentHtml={getRenderedCodeDocument({language: "html+css+js", code: section.html})}
                                    minHeight={sourceMigrated ? 280 : 320}
                                />
                            ) : (
                                <section key={`${section.title}-${sectionIndex}`} className="space-y-6">
                                    {section.kicker ? <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-200">{section.kicker}</p> : null}
                                    <h2 className="font-display text-3xl text-white sm:text-4xl">{section.title}</h2>
                                    <div className="space-y-5">
                                        {section.paragraphs.map((paragraph, index) => <p key={index} className="whitespace-pre-wrap text-lg leading-8 text-ink-200">{paragraph}</p>)}
                                    </div>
                                    {section.codeBlocks?.map((block, index) => block.render && canRenderCodeBlock(block.language) ? (
                                        <RenderedCodeFrame key={index} title={block.caption || `Embedded content ${index + 1}`} documentHtml={getRenderedCodeDocument(block)} minHeight={320} />
                                    ) : (
                                        <figure key={index} className="overflow-hidden rounded-2xl border border-line-300 bg-[#080d0a]">
                                            <div className="border-b border-line-300 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">{block.language || "Text"}</div>
                                            <pre className="overflow-x-auto p-4 text-sm leading-6 text-primary-100"><code>{block.code}</code></pre>
                                            {block.caption ? <figcaption className="border-t border-line-300 px-4 py-3 text-xs text-ink-400">{block.caption}</figcaption> : null}
                                        </figure>
                                    ))}
                                    {section.media?.type === "image" ? <ContentImageFigure image={section.media.image} /> : null}
                                </section>
                            )
                        ))}
                    </div>
                </article>
            </main>
            <Footer />
        </>
    );
}
