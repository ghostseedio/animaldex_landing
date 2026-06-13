import createIntlMiddleware from 'next-intl/middleware';
import {localeConfig} from "@/i18n";

export default createIntlMiddleware(localeConfig);

export const config = {
    matcher: ['/((?!api|admin|_next|.*\\..*|legal).*)']
};
