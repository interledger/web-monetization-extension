/// <reference types="chrome"/>
// cSpell:ignore serviceworker
import { Buffer } from 'node:buffer';
import net from 'node:net';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import {
  chromium,
  firefox,
  type BrowserContext,
  type WorkerInfo,
  type Worker,
} from '@playwright/test';
import { format } from 'date-fns';
import { APP_URL } from '@/background/constants';
import { DIST_DIR, ROOT_DIR } from '../../../scripts/esbuild/config';
import type { TranslationKeys } from '../../../src/shared/helpers';
import type { Storage, StorageKey } from '../../../src/shared/types';

export type BrowserInfo = { browserName: string; channel: string | undefined };
export type Background = Worker;

export const testDir = path.join(ROOT_DIR, 'tests', 'e2e');
export const BUILD_DIR = DIST_DIR;

// https://playwright.dev/docs/auth#basic-shared-account-in-all-tests
export const authFile = path.join(
  testDir,
  '.auth',
  `testnet-${format(new Date(), 'yyyyII')}.json`,
);

const FIREFOX_ADDON_UUID = crypto.randomUUID();

// From https://github.com/microsoft/playwright/issues/7297#issuecomment-1211763085
export const loadFirefoxAddon = (
  port: number,
  host: string,
  addonPath: string,
) => {
  return new Promise<boolean>((resolve) => {
    const socket = net.connect({
      port,
      host,
    });

    let success = false;

    socket.once('error', () => {});
    socket.once('close', () => {
      resolve(success);
    });

    const send = (data: Record<string, string>) => {
      const raw = Buffer.from(JSON.stringify(data));

      socket.write(`${raw.length}`);
      socket.write(':');
      socket.write(raw);
    };

    send({
      to: 'root',
      type: 'getRoot',
    });

    const onMessage = (message: Record<string, unknown>) => {
      if (message.addonsActor && typeof message.addonsActor === 'string') {
        send({
          to: message.addonsActor,
          type: 'installTemporaryAddon',
          addonPath,
        });
      }

      if (message.addon) {
        success = true;
        socket.end();
      }

      if (message.error) {
        socket.end();
      }
    };

    const buffers: Buffer[] = [];
    let remainingBytes = 0;

    socket.on('data', (data) => {
      while (true) {
        if (remainingBytes === 0) {
          const index = data.indexOf(':');

          buffers.push(data);

          if (index === -1) {
            return;
          }

          const buffer = Buffer.concat(buffers);
          const bufferIndex = buffer.indexOf(':');

          buffers.length = 0;
          remainingBytes = Number(buffer.subarray(0, bufferIndex).toString());

          if (!Number.isFinite(remainingBytes)) {
            throw new Error('Invalid state');
          }

          // biome-ignore lint/style/noParameterAssign: it's ok here
          data = buffer.subarray(bufferIndex + 1);
        }

        if (data.length < remainingBytes) {
          remainingBytes -= data.length;
          buffers.push(data);
          break;
        } else {
          buffers.push(data.subarray(0, remainingBytes));

          const buffer = Buffer.concat(buffers);
          buffers.length = 0;

          const json = JSON.parse(buffer.toString());
          queueMicrotask(() => {
            onMessage(json);
          });

          const remainder = data.subarray(remainingBytes);
          remainingBytes = 0;

          if (remainder.length === 0) {
            break;
          } else {
            // biome-ignore lint/style/noParameterAssign: it's ok here
            data = remainder;
          }
        }
      }
    });
  });
};

export async function loadContext(
  { browserName, channel }: BrowserInfo,
  workerInfo: WorkerInfo,
) {
  const pathToExtension = getPathToExtension(browserName);
  let context: BrowserContext | undefined;
  if (browserName === 'chromium') {
    context = await chromium.launchPersistentContext('', {
      channel,
      args: [
        '--headless=new',
        '--disable-gpu',
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
      ignoreDefaultArgs: ['--disable-back-forward-cache'],
    });
  } else if (browserName === 'firefox') {
    const RDP_PORT = 12_345;
    context = await firefox.launchPersistentContext('', {
      headless: false,
      args: ['-start-debugger-server', String(RDP_PORT)],
      firefoxUserPrefs: {
        'devtools.debugger.remote-enabled': true,
        'devtools.debugger.prompt-connection': false,
        'extensions.webextensions.uuids': JSON.stringify({
          // See `browser_specific_settings.gecko.id` in manifest.json
          'tech@interledger.org': FIREFOX_ADDON_UUID,
        }),
      },
    });
    await loadFirefoxAddon(RDP_PORT, 'localhost', pathToExtension);
  }

  if (!context) {
    throw new Error(`Unknown browser: ${browserName}`);
  }

  // Note that loading this directly via config -> use({ storageState }) doesn't
  // work correctly with our browser context. So, we addCookies manually.
  if (workerInfo.project.name !== 'setup') {
    const { cookies } = await readFile(authFile, 'utf8').then(JSON.parse);
    await context.addCookies(cookies);
  }

  return context;
}

function getPathToExtension(browserName: string) {
  let pathToExtension: string;
  if (browserName === 'chromium') {
    pathToExtension = path.join(BUILD_DIR, 'chrome');
  } else if (browserName === 'firefox') {
    pathToExtension = path.join(BUILD_DIR, 'firefox');
  } else {
    throw new Error(`Unknown browser: ${browserName}`);
  }
  return pathToExtension;
}

export async function getBackground(
  browserName: string,
  context: BrowserContext,
): Promise<Background> {
  let background: Background | undefined;
  if (browserName === 'chromium') {
    background = context.serviceWorkers()[0];
    if (!background) {
      background = await context.waitForEvent('serviceworker');
    }
    // wait for Service Worker to be activated
    await background.evaluate(() => {
      return new Promise<void>((resolve) => {
        if (chrome.runtime) return resolve();
        // @ts-expect-error self is extension's SW, not TS-defined enough.
        if (self.serviceWorker?.state === 'activated') return resolve();
        // @ts-expect-error self is extension's SW, not TS-defined enough.
        self.addEventListener('activate', resolve, { once: true });
      });
    });
  } else if (browserName === 'firefox') {
    // TODO
    // background = context.backgroundPages()[0];
    // if (!background) {
    //
    // }
  } else {
    throw new Error(`Unsupported browser: ${browserName}`);
  }

  if (!background) {
    throw new Error('Could not find background page/worker');
  }

  await optOutTelemetry(background);
  // Close the post-install page as we mostly test the scenarios where the
  // extension is already installed. Besides, it's not really relevant to tests,
  // unless we're specifically testing the post-install page or checking that
  // the post-install page tab was reused for the connect process.
  await closePostInstallPage(context, background);

  return background;
}

// We exclude events with given `uid` from PostHog.
// Also set telemetry consent to false just in case.
export async function optOutTelemetry(background: Background) {
  await background.evaluate(() =>
    chrome.storage.local.set({
      uid: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      consentTelemetry: false,
    }),
  );
}

export async function closePostInstallPage(
  context: BrowserContext,
  background: Background,
) {
  const url = await background.evaluate(
    (path) => chrome.runtime.getURL(path),
    APP_URL,
  );
  let page = context.pages().find((page) => page.url().startsWith(url));
  page ??= await context.waitForEvent('page', (p) => p.url().startsWith(url));

  // Give data sharing consent at once, instead of providing in each test.
  await page.getByRole('checkbox').click();
  await page.getByRole('button').click();

  const promise = page.waitForEvent('close');
  await page.evaluate(() => window.close());
  await promise;
}

export type KeyInfo = {
  /** UUID-v4 */
  keyId: string;
  /** Format: Hex encoded Ed25519 private key */
  privateKey: string;
  /** Format: Base64 encoded Ed25519 public key */
  publicKey: string;
};

/**
 * We load a consistent key-pair to extension and have it pre-connected with the
 * wallet once, so we don't have to add/remove the keys every time to the wallet
 * on each test run.
 */
export async function loadKeysToExtension(
  background: Background,
  keyInfo: KeyInfo,
) {
  await background.evaluate(async ({ privateKey, publicKey, keyId }) => {
    return await chrome.storage.local.set({
      privateKey,
      publicKey,
      keyId,
    });
  }, keyInfo);

  const res = await getStorage(background, [
    'privateKey',
    'publicKey',
    'keyId',
  ]);
  if (!res || !res.keyId || !res.privateKey || !res.publicKey) {
    throw new Error('Could not load keys to extension');
  }
}

type TranslationData = Record<
  TranslationKeys,
  { message: string; placeholders?: Record<string, { content: string }> }
>;

/**
 * Replacement of browser.i18n.getMessage related APIs
 */
export class BrowserIntl {
  private cache = new Map<string, TranslationData>();
  private lang = 'en';
  private pathToExtension: string;

  constructor(browserName: string) {
    this.pathToExtension = getPathToExtension(browserName);
  }

  private get(lang: string) {
    const cached = this.cache.get(lang);
    if (cached) return cached;

    const filePath = path.join(
      this.pathToExtension,
      '_locales',
      lang,
      'messages.json',
    );
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
      // biome-ignore lint/style/noParameterAssign: it's ok here
      substitutions = [substitutions];
    }

    for (const [key, { content }] of Object.entries(msg.placeholders)) {
      const idx = Number(content.replace('$', '')) - 1;
      result = result.replaceAll(`$${key.toUpperCase()}$`, substitutions[idx]);
    }
    return result;
  }
}

export async function getStorage<TKey extends StorageKey>(
  background: Background,
  keys?: TKey[],
) {
  const data = await background.evaluate(
    (keys) => chrome.storage.local.get(keys),
    keys,
  );
  return data as { [Key in TKey[][number]]: Storage[Key] };
}
