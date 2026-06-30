// cSpell:ignore IDBPDatabase
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Cradle as Cradle_ } from '@/background/container';
import type { AmountValue } from '@/shared/types';

type Cradle = Pick<Cradle_, 'storage'>;

export class RateListService {
  #storage: Cradle['storage'];
  #db: IDBPDatabase<RatesSchema> | null = null;

  constructor({ storage }: Cradle) {
    this.#storage = storage;
  }

  async #getDb(): Promise<IDBPDatabase<RatesSchema>> {
    this.#db ??= await openDB<RatesSchema>('wm-rate-list', 1, {
      upgrade(db) {
        const store = db.createObjectStore('rates', {
          keyPath: ['assetCode', 'assetScale', 'site'],
        });
        store.createIndex('by-currency', ['assetCode', 'assetScale']);
      },
    });
    return this.#db;
  }

  async #getWallet() {
    const { walletAddress } = await this.#storage.get(['walletAddress']);
    return walletAddress ?? null;
  }

  async getAll() {
    const wallet = await this.#getWallet();
    if (!wallet) {
      throw new Error('Cannot get rates without a connected wallet');
    }
    const db = await this.#getDb();
    const entries = await db.getAllFromIndex(
      'rates',
      'by-currency',
      IDBKeyRange.only([wallet.assetCode, wallet.assetScale]),
    );
    return entries.map(({ site, rate }) => ({ site, rate }));
  }

  async setRate(hostname: string, rate: AmountValue): Promise<void> {
    const wallet = await this.#getWallet();
    if (!wallet) {
      throw new Error('Cannot set rate without a connected wallet');
    }

    const db = await this.#getDb();
    const { assetCode, assetScale } = wallet;
    const site = hostnameToSiteKey(hostname);
    await db.put('rates', { assetCode, assetScale, site, rate });
  }

  async deleteRate(hostname: string): Promise<void> {
    const wallet = await this.#getWallet();
    if (!wallet) return;
    const db = await this.#getDb();
    const site = hostnameToSiteKey(hostname);
    await db.delete('rates', [wallet.assetCode, wallet.assetScale, site]);
  }

  /**
   * Returns the effective rate for a hostname by checking, in order:
   * 1. Exact hostname match
   * 2. Wildcard patterns, most-specific first (e.g. *.sub.example.com before *.example.com)
   * 3. The global default entry stored under key '*'
   */
  async getRateForHostname(hostname: string): Promise<AmountValue | undefined> {
    const wallet = await this.#getWallet();
    if (!wallet) {
      throw new Error('Cannot get rate without a connected wallet');
    }
    const db = await this.#getDb();
    const { assetCode, assetScale } = wallet;

    const exact = await db.get('rates', [assetCode, assetScale, hostname]);
    if (exact) return exact.rate;

    const parts = hostname.split('.');
    for (let i = 0; i < parts.length - 1; i++) {
      const pattern = `*.${parts.slice(i).join('.')}`;
      const match = await db.get('rates', [assetCode, assetScale, pattern]);
      if (match) return match.rate;
    }

    const defaultEntry = await db.get('rates', [assetCode, assetScale, '*']);
    return defaultEntry?.rate;
  }
}

/**
 * Returns true if the given hostname is covered by the pattern. Used by
 * MonetizationService to decide which open tabs are affected when a per-site
 * rate changes.
 */
export function matchesPattern(hostname: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern === hostname) return true;
  if (!pattern.startsWith('*.')) return false;
  const domain = pattern.slice(2);
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/**
 * Converts a raw hostname to the site key used in the rate list. "www" is
 * treated as an alias for the apex domain and gets the same low-priority
 * wildcard (*.example.com). All other subdomains get their own wildcard
 * (*.sub.example.com) so they take priority over the apex wildcard.
 */
export function hostnameToSiteKey(hostname: string): string {
  const base = hostname.startsWith('www.') ? hostname.slice(4) : hostname;
  return `*.${base}`;
}

interface RatesSchema extends DBSchema {
  rates: {
    key: [assetCode: string, assetScale: number, site: string];
    value: RateListRecord;
    indexes: { 'by-currency': [assetCode: string, assetScale: number] };
  };
}

export type RateListRecord = {
  assetCode: string;
  assetScale: number;
  site: string;
  rate: AmountValue;
};
