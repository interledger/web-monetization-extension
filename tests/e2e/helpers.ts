import path from 'node:path';
import { readFileSync } from 'node:fs';
import { BUILD_DIR } from './fixtures/helpers';
import { TranslationKeys } from '../../src/shared/helpers';

type TranslationData = Record<
  TranslationKeys,
  { message: string; placeholders?: Record<string, { content: string }> }
>;

// Replacement of browser.i18n.getMessage related APIs
export const i18n = new (class BrowserIntl {
  private cache = new Map<string, TranslationData>();
  private lang = 'en';

  private get(lang: string) {
    const cached = this.cache.get(lang);
    if (cached) return cached;

    const filePath = path.join(BUILD_DIR, '_locales', lang, 'messages.json');
    const data = JSON.parse(readFileSync(filePath, 'utf8')) as TranslationData;
    this.cache.set(lang, data);
    return data;
  }

  getMessage(key: TranslationKeys, substitutions?: string | string[]) {
    const msg = this.get(this.lang)[key] || this.get('en')[key];
    if (typeof msg === 'undefined') {
      throw new Error(`Message not found: ${key}`);
    }

    let result = msg.message;
    if (!msg.placeholders) return result;

    if (!substitutions) {
      throw new Error('Missing substitutions');
    }

    if (typeof substitutions === 'string') {
      substitutions = [substitutions];
    }

    for (const [key, { content }] of Object.entries(msg.placeholders)) {
      const idx = Number(content.replace('$', ''));
      result = result.replaceAll(`$${key.toUpperCase()}$`, substitutions[idx]);
    }
    return result;
  }
})();
