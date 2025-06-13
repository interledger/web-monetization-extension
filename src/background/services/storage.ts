import type {
  AmountValue,
  ExtensionState,
  GrantDetails,
  PopupTransientState,
  Storage,
  StorageKey,
  WalletAmount,
} from '@/shared/types';
import { objectEquals, ThrottleBatch } from '@/shared/helpers';
import { bigIntMax, computeBalance } from '../utils';
import type { Cradle } from '../container';

const defaultStorage = {
  /**
   * For migrations, increase this version and add a migration script in
   * {@linkcode MIGRATIONS}. New additions to structure that can be dynamically
   * set don't need migrations (e.g. we check if value is null etc.) but other
   * structural changes would need migrations for keeping compatibility with
   * existing installations.
   */
  version: 5,
  state: {},
  connected: false,
  enabled: true,
  continuousPaymentsEnabled: true,
  exceptionList: {},
  walletAddress: null,
  recurringGrant: null,
  recurringGrantSpentAmount: '0',
  oneTimeGrant: null,
  oneTimeGrantSpentAmount: '0',
  rateOfPay: null,
  maxRateOfPay: null,
} satisfies Omit<Storage, 'publicKey' | 'privateKey' | 'keyId'>;

export class StorageService {
  private browser: Cradle['browser'];
  private events: Cradle['events'];

  private setSpentAmountRecurring: ThrottleBatch<[amount: string]>;
  private setSpentAmountOneTime: ThrottleBatch<[amount: string]>;
  // used as an optimization/cache
  private currentState: Storage['state'] | null = null;

  private popupTransientState: PopupTransientState = {};

  constructor({ browser, events }: Cradle) {
    Object.assign(this, { browser, events });

    this.setSpentAmountRecurring = new ThrottleBatch(
      (amount) => this.setSpentAmount('recurring', amount),
      (args) => [args.reduce((max, [v]) => bigIntMax(max, v), '0')],
      1000,
    );
    this.setSpentAmountOneTime = new ThrottleBatch(
      (amount) => this.setSpentAmount('one-time', amount),
      (args) => [args.reduce((max, [v]) => bigIntMax(max, v), '0')],
      1000,
    );
  }

  async get<TKey extends StorageKey>(
    keys?: TKey[],
  ): Promise<{ [Key in TKey[][number]]: Storage[Key] }> {
    const data = await this.browser.storage.local.get(keys);
    return data as { [Key in TKey[][number]]: Storage[Key] };
  }

  async set<TKey extends StorageKey>(
    data: {
      [K in TKey]: Storage[TKey];
    },
  ): Promise<void> {
    await this.browser.storage.local.set(data);
  }

  async clear(): Promise<void> {
    await this.set(defaultStorage);
    this.currentState = { ...defaultStorage.state };
  }

  /**
   * Needs to run before any other storage `set` call.
   */
  async populate(): Promise<void> {
    const data = await this.get(Object.keys(defaultStorage) as StorageKey[]);

    if (Object.keys(data).length === 0) {
      await this.set(defaultStorage);
    }
  }

  /**
   * Migrate storage to given target version.
   */
  async migrate(targetVersion: Storage['version'] = defaultStorage.version) {
    const storage = this.browser.storage.local;

    let { version = 1 } = await this.get(['version']);
    if (version === targetVersion) {
      return null;
    }

    let data = await storage.get();
    while (version < targetVersion) {
      ++version;
      const migrate = MIGRATIONS[version];
      if (!migrate) {
        throw new Error(`No migration available to reach version "${version}"`);
      }
      const [newData, deleteKeys = []] = migrate(data);
      data = { ...newData, version };
      await storage.set(data);
      await storage.remove(deleteKeys);
    }
    return data as unknown as Storage;
  }

  async keyPairExists(): Promise<boolean> {
    const keys = await this.get(['privateKey', 'publicKey', 'keyId']);
    if (
      keys.privateKey &&
      typeof keys.privateKey === 'string' &&
      keys.publicKey &&
      typeof keys.publicKey === 'string' &&
      keys.keyId &&
      typeof keys.keyId === 'string'
    ) {
      return true;
    }

    return false;
  }

  async setState(state: Storage['state']): Promise<boolean> {
    const prevState = this.currentState ?? (await this.get(['state'])).state;

    const newState: Storage['state'] = { ...this.currentState };
    for (const key of Object.keys(state) as ExtensionState[]) {
      newState[key] = state[key];
    }
    this.currentState = newState;
    if (prevState && objectEquals(prevState, newState)) {
      return false;
    }

    await this.set({ state: newState });
    this.events.emit('storage.state_update', {
      state: newState,
      prevState: prevState,
    });
    return true;
  }

  updateSpentAmount(grant: GrantDetails['type'], amount: string) {
    if (grant === 'recurring') {
      this.setSpentAmountRecurring.enqueue(amount);
    } else if (grant === 'one-time') {
      this.setSpentAmountOneTime.enqueue(amount);
    }
  }

  private async setSpentAmount(grant: GrantDetails['type'], amount: string) {
    if (grant === 'recurring') {
      await this.set({ recurringGrantSpentAmount: amount });
    } else if (grant === 'one-time') {
      await this.set({ oneTimeGrantSpentAmount: amount });
    }
    const balance = await this.getBalance();
    this.events.emit('storage.balance_update', balance);
  }

  async getBalance(): Promise<
    Record<'recurring' | 'oneTime' | 'total', AmountValue>
  > {
    const data = await this.get([
      'recurringGrant',
      'recurringGrantSpentAmount',
      'oneTimeGrant',
      'oneTimeGrantSpentAmount',
    ]);
    const balanceRecurring = computeBalance(
      data.recurringGrant,
      data.recurringGrantSpentAmount,
    );
    const balanceOneTime = computeBalance(
      data.oneTimeGrant,
      data.oneTimeGrantSpentAmount,
    );
    const balance = balanceRecurring + balanceOneTime;
    return {
      total: balance.toString(),
      recurring: balanceRecurring.toString(),
      oneTime: balanceOneTime.toString(),
    };
  }

  async updateRate(rate: string): Promise<void> {
    await this.set({ rateOfPay: rate });
    this.events.emit('storage.rate_of_pay_update', { rate });
  }

  setPopupTransientState<T extends keyof PopupTransientState>(
    id: T,
    update: (prev?: PopupTransientState[T]) => PopupTransientState[T],
  ) {
    const newState = update(this.popupTransientState[id]);
    this.popupTransientState[id] = newState;

    const state = this.getPopupTransientState();
    this.events.emit('storage.popup_transient_state_update', state);
  }

  getPopupTransientState(): PopupTransientState {
    return this.popupTransientState;
  }
}

/**
 * @param existingData Existing data from previous version.
 */

// biome-ignore lint/suspicious/noExplicitAny: our code defines shape of data
type Data = Record<string, any>;
type Migration = (existingData: Data) => [data: Data, deleteKeys?: string[]];

// There was never a migration to reach 1.
//
// In future, we may remove older version migrations as unsupported. That would
// require user to reinstall and setup extension from scratch.
const MIGRATIONS: Record<Storage['version'], Migration> = {
  2: (data) => {
    const deleteKeys = ['amount', 'token', 'grant', 'hasHostPermissions'];

    data.recurringGrant = null;
    data.recurringGrantSpentAmount = '0';
    data.oneTimeGrant = null;
    data.oneTimeGrantSpentAmount = '0';
    data.state = null;

    if (data.amount?.value && data.token && data.grant) {
      const type = data.amount.interval ? 'recurring' : 'one-time';

      const grantDetails: GrantDetails = {
        type,
        amount: {
          value: data.amount.value as string,
          ...(type === 'recurring'
            ? { interval: data.amount.interval as string }
            : {}),
        } as Required<WalletAmount>,
        accessToken: {
          value: data.token.value as string,
          manageUrl: data.token.manage as string,
        },
        continue: {
          url: data.grant.continueUri as string,
          accessToken: data.grant.accessToken as string,
        },
      };

      if (type === 'recurring') {
        data.recurringGrant = grantDetails;
      } else {
        data.oneTimeGrant = grantDetails;
      }
    }

    if (data.hasHostPermissions === false) {
      data.state = 'missing_host_permissions';
    }

    return [data, deleteKeys];
  },
  3: (data) => {
    const newState =
      data.state && typeof data.state === 'string'
        ? { [data.state as ExtensionState]: true }
        : {};
    data.state = newState satisfies Storage['state'];
    return [data];
  },
  4: (data) => {
    data.continuousPaymentsEnabled = data.enabled;
    data.enabled = true;
    return [data];
  },
  5: (data) => {
    if (data.walletAddress && !data.walletAddress.url) {
      data.walletAddress.url = data.walletAddress.id;
    }
    return [data, ['minRateOfPay']];
  },
};
