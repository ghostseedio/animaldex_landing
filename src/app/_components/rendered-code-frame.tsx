"use client";

import {useEffect, useId, useMemo, useState} from "react";

type RenderedCodeFrameProps = {
    documentHtml: string;
    title: string;
    className?: string;
    minHeight?: number;
};

let sharedCssCache: {key: string; promise: Promise<string>} | null = null;

function loadSharedCss(stylesheetUrls: string[]) {
    const key = stylesheetUrls.join("|");
    if (sharedCssCache?.key === key) return sharedCssCache.promise;
    const promise = Promise.all(stylesheetUrls.map(async (url) => {
        try {
            const response = await fetch(url);
            if (!response.ok) return "";
            return (await response.text()).replace(/url\((['"]?)(?!data:|https?:|\/)([^)'"]+)\1\)/gi, (_match, quote, assetUrl) => {
                try {
                    return `url(${quote}${new URL(assetUrl, url).href}${quote})`;
                } catch {
                    return _match;
                }
            });
        } catch {
            return "";
        }
    })).then((styles) => styles.join("\n").replace(/<\/style/gi, "<\\/style"));
    sharedCssCache = {key, promise};
    return promise;
}

function injectFrameEnvironment(documentHtml: string, frameId: string, stylesheetUrls: string[], sharedCss: string, themeCss: string) {
    const stylesheetLinks = stylesheetUrls
        .map((url) => `<link rel="stylesheet" href="${url.replace(/"/g, "&quot;")}">`)
        .join("");
    const frameGuardCss = `html,body{min-height:0!important;background:transparent!important}body{margin:0!important;color:#f4fff5;font-family:var(--font-sans),system-ui,sans-serif}`;
    const frameGuard = `<style data-animaldex-frame-guard>${frameGuardCss}</style>`;
    const head = `<base href="${typeof window === "undefined" ? "/" : `${window.location.origin}/`}" target="_blank"><meta name="viewport" content="width=device-width,initial-scale=1">${stylesheetLinks}<style>${sharedCss}</style><style>${themeCss}${frameGuardCss}</style>`;
    const resizeScript = `<script>(()=>{let observed=[];const measure=()=>{const body=document.body;if(!body)return;const top=body.getBoundingClientRect().top;let bottom=top;for(const child of body.children){if(child.tagName==="SCRIPT")continue;const rect=child.getBoundingClientRect();bottom=Math.max(bottom,rect.bottom)}const styles=getComputedStyle(body);const height=Math.ceil(Math.max(1,bottom-top+parseFloat(styles.paddingBottom||"0")));parent.postMessage({type:"animaldex-frame-height",id:${JSON.stringify(frameId)},height},"*")};const observe=()=>{observed.forEach(item=>item.disconnect());const resize=new ResizeObserver(measure);for(const child of document.body?.children||[]){if(child.tagName!=="SCRIPT")resize.observe(child)}observed=[resize];measure()};new MutationObserver(observe).observe(document.documentElement,{childList:true,subtree:true});addEventListener("load",observe);document.fonts?.ready.then(observe);setTimeout(observe,50);setTimeout(measure,500)})()</script>`;
    const hasHtml = /<html[\s>]/i.test(documentHtml);
    if (hasHtml) {
        const withHead = /<head[\s>]/i.test(documentHtml)
            ? documentHtml.replace(/<head([^>]*)>/i, `<head$1>${head}`)
            : documentHtml.replace(/<html([^>]*)>/i, `<html$1><head>${head}</head>`);
        return /<\/body>/i.test(withHead) ? withHead.replace(/<\/body>/i, `${frameGuard}${resizeScript}</body>`) : `${withHead}${frameGuard}${resizeScript}`;
    }
    return `<!doctype html><html><head>${head}</head><body>${documentHtml}${frameGuard}${resizeScript}</body></html>`;
}

export default function RenderedCodeFrame({documentHtml, title, className = "", minHeight = 224}: RenderedCodeFrameProps) {
    const reactId = useId();
    const frameId = useMemo(() => `animaldex-${reactId.replace(/:/g, "")}`, [reactId]);
    const [height, setHeight] = useState(minHeight);
    const [environment, setEnvironment] = useState<{stylesheetUrls: string[]; sharedCss: string; themeCss: string} | null>(null);

    useEffect(() => {
        let active = true;
        const urls = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).map((link) => link.href);
        const bodyStyles = getComputedStyle(document.body);
        const rootStyles = getComputedStyle(document.documentElement);
        const variableNames = ["--font-sans", "--font-display", "--font-onest", "--font-cal-sans"];
        const variables = variableNames.map((name) => {
            const value = bodyStyles.getPropertyValue(name) || rootStyles.getPropertyValue(name);
            return value.trim() ? `${name}:${value.trim()};` : "";
        }).join("");
        const themeCss = `:root{${variables}}body{font-family:${bodyStyles.fontFamily};color:${bodyStyles.color};}`;
        loadSharedCss(urls).then((sharedCss) => {
            if (active) setEnvironment({stylesheetUrls: urls, sharedCss, themeCss});
        });
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            if (event.data?.type !== "animaldex-frame-height" || event.data?.id !== frameId) return;
            const nextHeight = Number(event.data.height);
            if (Number.isFinite(nextHeight)) setHeight(Math.max(minHeight, Math.min(nextHeight + 2, 5000)));
        };
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, [frameId, minHeight]);

    const srcDoc = useMemo(
        () => environment ? injectFrameEnvironment(documentHtml, frameId, environment.stylesheetUrls, environment.sharedCss, environment.themeCss) : "",
        [documentHtml, environment, frameId]
    );

    if (!environment) {
        return <div role="status" aria-label={`Loading ${title}`} style={{minHeight}} className={`animate-pulse rounded-xl bg-white/[0.025] ${className}`} />;
    }

    return (
        <iframe
            title={title}
            sandbox="allow-scripts"
            srcDoc={srcDoc}
            style={{height}}
            className={`block w-full border-0 bg-transparent transition-[height] ${className}`}
        />
    );
}
