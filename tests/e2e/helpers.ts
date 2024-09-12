import path from 'node:path';
import { readFileSync } from 'node:fs';
import { SRC_DIR } from '../../esbuild/config';
import { TranslationKeys } from '../../src/shared/helpers';

type TranslationData = Record<
  TranslationKeys,
  { message: string; placeholders?: Record<string, { content: string }> }
>;

const MESSAGES = {
  _cache: new Map<string, TranslationData>(),
  get(lang: string) {
    const cached = this._cache.get(lang);
    if (cached) return cached;

    const filePath = path.join(SRC_DIR, '_locales', lang, 'messages.json');
    const data = JSON.parse(readFileSync(filePath, 'utf8')) as TranslationData;
    this._cache.set(lang, data);
    return data;
  },
};

// Replacement of browser.i18n.getMessage
export function getMessage(
  key: TranslationKeys,
  substitutions?: string | string[],
  language = 'en',
) {
  const msg = MESSAGES.get(language)[key] || MESSAGES.get('en')[key];
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
