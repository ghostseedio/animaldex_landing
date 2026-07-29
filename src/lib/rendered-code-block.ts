type RenderableCodeBlock = {language?: string; code: string};

const HTML_LANGUAGES = new Set(["html", "htm", "svg", "html+css+js"]);
const CSS_LANGUAGES = new Set(["css", "scss"]);
const JAVASCRIPT_LANGUAGES = new Set(["js", "javascript"]);

export function canRenderCodeBlock(language?: string) {
    const normalized = (language ?? "").trim().toLowerCase();
    return HTML_LANGUAGES.has(normalized) || CSS_LANGUAGES.has(normalized) || JAVASCRIPT_LANGUAGES.has(normalized);
}

export function getRenderedCodeDocument(block: RenderableCodeBlock) {
    const language = (block.language ?? "").trim().toLowerCase();
    if (HTML_LANGUAGES.has(language)) return block.code;

    if (CSS_LANGUAGES.has(language)) {
        return `<!doctype html><html><head><meta charset="utf-8"><style>html{color-scheme:dark}body{margin:0;padding:24px;background:#0b1510;color:#e8f1eb;font:16px/1.6 system-ui}.preview-root{max-width:720px;margin:auto}${block.code}</style></head><body><main class="preview-root"><h1>CSS preview</h1><p>Edit the stylesheet to see changes immediately.</p><div class="card"><h2>Example card</h2><p>Target .card, headings, buttons, or the page body.</p><button type="button">Example button</button></div></main></body></html>`;
    }

    if (JAVASCRIPT_LANGUAGES.has(language)) {
        const safeCode = block.code.replace(/<\/script/gi, "<\\/script");
        return `<!doctype html><html><head><meta charset="utf-8"><style>html{color-scheme:dark}body{margin:0;padding:24px;background:#0b1510;color:#e8f1eb;font:16px/1.6 system-ui}#app{min-height:100px}.console{margin-top:20px;border-top:1px solid #294034;padding-top:12px;color:#82efa8;white-space:pre-wrap;font:13px/1.5 ui-monospace,monospace}.error{color:#fda4af}</style></head><body><main id="app">JavaScript preview — write output into #app.</main><pre id="console" class="console"></pre><script>const output=document.getElementById("console");const originalLog=console.log;console.log=(...values)=>{originalLog(...values);output.textContent+=values.map(value=>typeof value==="object"?JSON.stringify(value,null,2):String(value)).join(" ")+"\\n"};window.addEventListener("error",event=>{output.classList.add("error");output.textContent+="Error: "+event.message});try{${safeCode}}catch(error){output.classList.add("error");output.textContent+="Error: "+(error&&error.message?error.message:String(error))}</script></body></html>`;
    }
    return "";
}
