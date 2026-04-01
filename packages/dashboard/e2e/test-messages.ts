import deMessages from '../messages/de.json';
import enMessages from '../messages/en.json';
import esMessages from '../messages/es.json';
import frMessages from '../messages/fr.json';
import jaMessages from '../messages/ja.json';
import ptMessages from '../messages/pt.json';
import thMessages from '../messages/th.json';
import zhMessages from '../messages/zh.json';
import { defaultLocale, type Locale } from '../src/i18n/config';

type Messages = typeof enMessages;

const messagesByLocale = {
  en: enMessages,
  zh: zhMessages,
  fr: frMessages,
  es: esMessages,
  pt: ptMessages,
  de: deMessages,
  th: thMessages,
  ja: jaMessages,
} satisfies Record<Locale, Messages>;

export const defaultMessages = messagesByLocale[defaultLocale];
