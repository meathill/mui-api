export const locales = ['en', 'zh', 'fr', 'es', 'pt', 'de', 'th', 'ja'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';
