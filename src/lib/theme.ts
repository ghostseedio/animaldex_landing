export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "animaldex-theme";
export const DEFAULT_THEME: Theme = "dark";

// Runs in <head> before first paint so a reader who chose light never sees a dark
// frame. Pages are statically rendered with data-theme="dark"; only an explicit
// saved choice switches it, so the site stays dark by default whatever the OS says.
export const themeBootScript = `(function(){try{if(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})==="light"){document.documentElement.setAttribute("data-theme","light")}}catch(e){}})()`;
