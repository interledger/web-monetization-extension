import type { WalletAddress } from '@interledger/open-payments/dist/types';
import type { Tabs } from 'webextension-polyfill';

/** Bigint amount, before transformation with assetScale */
export type AmountValue = string;

/** https://en.wikipedia.org/wiki/ISO_8601#Repeating_intervals */
export type RepeatingInterval = string;

/** Wallet amount */
export interface WalletAmount {
  value: string;
  interval?: RepeatingInterval;
}

/** Amount interface - used in the `exceptionList` */
export interface Amount {
  value: AmountValue;
  interval: number;
}

export interface AccessToken {
  value: AmountValue;
  manageUrl: string;
}

interface GrantDetailsBase {
  type: string;
  accessToken: AccessToken;
  continue: { url: string; accessToken: string };
}
export interface OneTimeGrant extends GrantDetailsBase {
  type: 'one-time';
  amount: Omit<WalletAmount, 'interval'>;
}
export interface RecurringGrant extends GrantDetailsBase {
  type: 'recurring';
  amount: Required<WalletAmount>;
}
export type GrantDetails = OneTimeGrant | RecurringGrant;

export type ExtensionState =
  | never // just added for code formatting
  /** Extension can't inject scripts and fetch resources from all hosts */
  | 'missing_host_permissions'
  /** The public key no longer exists or valid in connected wallet */
  | 'key_revoked'
  /** The wallet is out of funds, cannot make payments */
  | 'out_of_funds';

export interface Storage {
  /**
   * Storage structure version. Used in migrations. Numbers are sequential.
   * Inspired by database upgrades in IndexedDB API.
   */
  version: number;

  /** If web monetization is enabled */
  enabled: boolean;
  /** If a wallet is connected or not */
  connected: boolean;
  /** Extension state */
  state: Partial<Record<ExtensionState, boolean>>;

  rateOfPay?: string | undefined | null;
  minRateOfPay?: string | undefined | null;
  maxRateOfPay?: string | undefined | null;

  /** User wallet address information */
  walletAddress?: WalletAddress | undefined | null;

  recurringGrant?: RecurringGrant | undefined | null;
  recurringGrantSpentAmount?: AmountValue | undefined | null;
  oneTimeGrant?: OneTimeGrant | undefined | null;
  oneTimeGrantSpentAmount?: AmountValue | undefined | null;

  /** Exception list with websites and each specific amount */
  exceptionList: {
    [website: string]: Amount;
  };
  /** Key information */
  publicKey: string;
  privateKey: string;
  keyId: string;
}
export type StorageKey = keyof Storage;

export type PopupTabInfo = {
  tabId: TabId;
  url: string;
  status:
    | never // just added for code formatting
    /** Happy state */
    | 'monetized'
    /** No monetization links or all links disabled */
    | 'no_monetization_links'
    /** New tab */
    | 'new_tab'
    /** Browser internal pages */
    | 'internal_page'
    /** Not https:// */
    | 'unsupported_scheme'
    /**
     * All wallet addresses belong to wallets that are not peered with the
     * connected wallet, or cannot receive payments for some other reason.
     */
    | 'all_sessions_invalid'
    | never; // just added for code formatting
};

export type PopupTransientState = Partial<{
  connect: Partial<{
    status: 'connecting' | 'error' | 'adding-key' | 'error-key' | null;
  }> | null;
}>;

export type PopupStore = Omit<
  Storage,
  | 'version'
  | 'privateKey'
  | 'keyId'
  | 'exceptionList'
  | 'recurringGrant'
  | 'oneTimeGrant'
> & {
  balance: AmountValue;
  tab: PopupTabInfo;
  transientState: PopupTransientState;
  grants?: Partial<{
    oneTime: OneTimeGrant['amount'];
    recurring: RecurringGrant['amount'];
  }>;
};

export type DeepNonNullable<T> = {
  [P in keyof T]?: NonNullable<T[P]>;
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type Tab = RequiredFields<Tabs.Tab, 'id' | 'url'>;
export type TabId = NonNullable<Tabs.Tab['id']>;
export type WindowId = NonNullable<Tabs.Tab['windowId']>;
