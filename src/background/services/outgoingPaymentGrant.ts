import type {
  AccessToken,
  GrantDetails,
  TabId,
  WalletAmount,
} from 'shared/types';
import {
  isFinalizedGrant,
  isPendingGrant,
  type Grant,
  type PendingGrant,
  type WalletAddress,
} from '@interledger/open-payments/dist/types';
import type { Browser, Tabs } from 'webextension-polyfill';
import type { Cradle } from '@/background/container';
import { OPEN_PAYMENTS_REDIRECT_URL } from '@/shared/defines';
import { ErrorWithKey, withResolvers } from '@/shared/helpers';
import {
  isInvalidClientError,
  isInvalidContinuationError,
  isNotFoundError,
} from './openPayments';
import { toAmount } from '../utils';
import { KeyAutoAddService } from './keyAutoAdd';

const enum ErrorCode {
  CONTINUATION_FAILED = 'continuation_failed',
  HASH_FAILED = 'hash_failed',
  KEY_ADD_FAILED = 'key_add_failed',
}

const enum GrantResult {
  GRANT_SUCCESS = 'grant_success',
  GRANT_ERROR = 'grant_error',
  KEY_ADD_SUCCESS = 'key_add_success',
  KEY_ADD_ERROR = 'key_add_error',
}

export const enum InteractionIntent {
  CONNECT = 'connect',
  RECONNECT = 'reconnect',
  FUNDS = 'funds',
  UPDATE_BUDGET = 'update_budget',
}

interface InteractionParams {
  interactRef: string;
  hash: string;
  tabId: TabId;
}

type TabUpdateCallback = Parameters<Tabs.onUpdatedEvent['addListener']>[0];
type TabRemovedCallback = Parameters<
  Browser['tabs']['onRemoved']['addListener']
>[0];

export class OutgoingPaymentGrantService {
  private storage: Cradle['storage'];
  private logger: Cradle['logger'];
  private deduplicator: Cradle['deduplicator'];
  private openPaymentsService: Cradle['openPaymentsService'];
  private browser: Cradle['browser'];
  private appName: Cradle['appName'];
  private browserName: Cradle['browserName'];
  private t: Cradle['t'];

  private token: AccessToken;
  private grantDetails: GrantDetails | null;
  /** Whether a grant has enough balance to make payments */
  private isGrantUsable = { recurring: false, oneTime: false };

  public switchGrant: OutgoingPaymentGrantService['_switchGrant'];

  constructor({
    storage,
    logger,
    deduplicator,
    openPaymentsService,
    browser,
    appName,
    browserName,
    t,
  }: Cradle) {
    Object.assign(this, {
      storage,
      logger,
      deduplicator,
      openPaymentsService,
      browser,
      appName,
      browserName,
      t,
    });

    void this.initialize();
    this.switchGrant = this.deduplicator.dedupe(this._switchGrant.bind(this));
  }

  public isAnyGrantUsable() {
    return this.isGrantUsable.recurring || this.isGrantUsable.oneTime;
  }

  public accessToken() {
    return this.token.value;
  }

  public grantType() {
    return this.grant!.type;
  }

  public disableRecurringGrant() {
    this.isGrantUsable.recurring = false;
    this.grant = null;
  }

  public disableOneTimeGrant() {
    this.isGrantUsable.oneTime = false;
    this.grant = null;
  }

  private get grant() {
    return this.grantDetails;
  }

  private set grant(grantDetails) {
    this.logger.debug(`🤝🏻 Using grant: ${grantDetails?.type || null}`);
    this.grantDetails = grantDetails;
    this.token = grantDetails
      ? grantDetails.accessToken
      : { value: '', manageUrl: '' };
  }

  private async initialize() {
    const { connected, oneTimeGrant, recurringGrant } = await this.storage.get([
      'connected',
      'oneTimeGrant',
      'recurringGrant',
    ]);

    this.isGrantUsable.recurring = !!recurringGrant;
    this.isGrantUsable.oneTime = !!oneTimeGrant;

    if (connected === true && (recurringGrant || oneTimeGrant)) {
      this.grant = recurringGrant || oneTimeGrant!; // prefer recurring
    }
  }

  public async completeOutgoingPaymentGrant(
    amount: string,
    walletAddress: WalletAddress,
    recurring: boolean,
    intent: InteractionIntent,
    existingTabId?: number,
  ): Promise<GrantDetails> {
    const clientNonce = crypto.randomUUID();
    const walletAmount = toAmount({
      value: amount,
      recurring,
      assetScale: walletAddress.assetScale,
    });
    const grant = await this.createOutgoingPaymentGrant(
      clientNonce,
      walletAddress,
      walletAmount,
      intent,
    );

    const { interactRef, hash, tabId } = await this.getInteractionInfo(
      grant.interact.redirect,
      existingTabId,
    );

    await this.verifyInteractionHash(
      clientNonce,
      grant.interact.finish,
      interactRef,
      hash,
      walletAddress.authServer,
      intent,
      tabId,
    );

    const continuation = await this.continueGrant(
      grant,
      interactRef,
      intent,
      tabId,
    );

    if (!isFinalizedGrant(continuation)) {
      throw new Error(
        'Expected finalized grant. Received non-finalized grant.',
      );
    }

    this.grant = this.buildGrantDetails(continuation, recurring, walletAmount);
    await this.persistGrantDetails(this.grant);

    await this.redirectToWelcomeScreen(
      tabId,
      GrantResult.GRANT_SUCCESS,
      intent,
    );

    return this.grant;
  }

  public async cancelGrant(grantContinuation: GrantDetails['continue']) {
    try {
      await this.openPaymentsService.client.grant.cancel(grantContinuation);
    } catch (error) {
      if (
        isInvalidClientError(error) ||
        isInvalidContinuationError(error) ||
        isNotFoundError(error)
      ) {
        // key already removed from wallet
        return;
      }
      throw error;
    }
  }

  public async rotateToken() {
    if (!this.grant) {
      throw new Error('No grant to rotate token for');
    }

    const rotate = this.deduplicator.dedupe(
      this.openPaymentsService.client.token.rotate,
    );
    const newToken = await rotate({
      url: this.token.manageUrl,
      accessToken: this.token.value,
    });
    const accessToken: AccessToken = {
      value: newToken.access_token.value,
      manageUrl: newToken.access_token.manage,
    };
    if (this.grant.type === 'recurring') {
      this.storage.set({ recurringGrant: { ...this.grant, accessToken } });
    } else {
      this.storage.set({ oneTimeGrant: { ...this.grant, accessToken } });
    }
    this.grant = { ...this.grant, accessToken };

    return newToken;
  }

  /**
   * Adds public key to wallet by "browser automation" - the content script
   * takes control of tab when the correct message is sent, and adds the key
   * through the wallet's dashboard.
   * @returns tabId that we can reuse for further connecting, or redirects etc.
   */
  public async addPublicKeyToWallet(
    walletAddress: WalletAddress,
    tabId?: TabId,
  ): Promise<TabId | undefined> {
    const keyAutoAdd = new KeyAutoAddService({
      browser: this.browser,
      storage: this.storage,
      appName: this.appName,
      browserName: this.browserName,
      t: this.t,
    });
    try {
      await keyAutoAdd.addPublicKeyToWallet(walletAddress, tabId);
      return keyAutoAdd.tabId;
    } catch (error) {
      const tabId = keyAutoAdd.tabId;
      const isTabClosed = error.key === 'connectWallet_error_tabClosed';
      if (tabId && !isTabClosed) {
        await this.redirectToWelcomeScreen(
          tabId,
          GrantResult.GRANT_ERROR,
          InteractionIntent.CONNECT,
          ErrorCode.KEY_ADD_FAILED,
        );
      }
      if (error instanceof ErrorWithKey) {
        throw error;
      } else {
        // TODO: check if need to handle errors here
        throw new Error(error.message, { cause: error });
      }
    }
  }

  public async retryAddPublicKeyToWallet(walletAddress: WalletAddress) {
    let tabId: number | undefined;

    try {
      tabId = await this.addPublicKeyToWallet(walletAddress);
      await this.rotateToken();

      tabId ??= await this.ensureTabExists();
      await this.redirectToWelcomeScreen(
        tabId,
        GrantResult.KEY_ADD_SUCCESS,
        InteractionIntent.RECONNECT,
      );
    } catch (error) {
      const isTabClosed = error.key === 'connectWallet_error_tabClosed';
      if (tabId && !isTabClosed) {
        await this.redirectToWelcomeScreen(
          tabId,
          GrantResult.KEY_ADD_ERROR,
          InteractionIntent.RECONNECT,
        );
      }

      if (isInvalidClientError(error)) {
        const msg = this.t('connectWallet_error_invalidClient');
        throw new Error(msg, { cause: error });
      }
      throw error;
    }
  }

  private async ensureTabExists(): Promise<number> {
    const tab = await this.browser.tabs.create({});
    if (!tab.id) {
      throw new Error('Could not create tab');
    }
    return tab.id;
  }

  private async createOutgoingPaymentGrant(
    clientNonce: string,
    walletAddress: WalletAddress,
    amount: WalletAmount,
    intent: InteractionIntent,
  ) {
    try {
      const grant = await this.openPaymentsService.client.grant.request(
        { url: walletAddress.authServer },
        {
          access_token: {
            access: [
              {
                type: 'quote',
                actions: ['create'],
              },
              {
                type: 'outgoing-payment',
                actions: ['create', 'read'],
                identifier: walletAddress.id,
                limits: {
                  debitAmount: {
                    value: amount.value,
                    assetScale: walletAddress.assetScale,
                    assetCode: walletAddress.assetCode,
                  },
                  interval: amount.interval,
                },
              },
            ],
          },
          interact: {
            start: ['redirect'],
            finish: {
              method: 'redirect',
              uri: OPEN_PAYMENTS_REDIRECT_URL,
              nonce: clientNonce,
            },
          },
        },
      );

      if (!isPendingGrant(grant)) {
        throw new Error(
          'Expected interactive grant. Received non-pending grant.',
        );
      }

      return grant;
    } catch (error) {
      if (isInvalidClientError(error)) {
        if (intent !== InteractionIntent.FUNDS) {
          throw new ErrorWithKey('connectWallet_error_invalidClient');
        }
        const msg = this.t('connectWallet_error_invalidClient');
        throw new Error(msg, { cause: error });
      }
      throw error;
    }
  }

  private async getInteractionInfo(
    url: string,
    existingTabId?: TabId,
  ): Promise<InteractionParams> {
    const { resolve, reject, promise } = withResolvers<InteractionParams>();

    const tab = existingTabId
      ? await this.browser.tabs.update(existingTabId, { url })
      : await this.browser.tabs.create({ url });
    if (!tab.id) {
      reject(new Error('Could not create/update tab'));
      return promise;
    }

    const tabCloseListener: TabRemovedCallback = (tabId) => {
      if (tabId !== tab.id) return;

      this.browser.tabs.onRemoved.removeListener(tabCloseListener);
      reject(new ErrorWithKey('connectWallet_error_tabClosed'));
    };

    const getInteractionInfo: TabUpdateCallback = async (tabId, changeInfo) => {
      if (tabId !== tab.id) return;
      try {
        const tabUrl = new URL(changeInfo.url || '');
        const interactRef = tabUrl.searchParams.get('interact_ref');
        const hash = tabUrl.searchParams.get('hash');
        const result = tabUrl.searchParams.get('result');

        if (
          (interactRef && hash) ||
          result === 'grant_rejected' ||
          result === 'grant_invalid'
        ) {
          this.browser.tabs.onUpdated.removeListener(getInteractionInfo);
          this.browser.tabs.onRemoved.removeListener(tabCloseListener);
        }

        if (interactRef && hash) {
          resolve({ interactRef, hash, tabId });
        } else if (result === 'grant_rejected') {
          reject(new ErrorWithKey('connectWallet_error_grantRejected'));
        }
      } catch {
        /* do nothing */
      }
    };

    this.browser.tabs.onRemoved.addListener(tabCloseListener);
    this.browser.tabs.onUpdated.addListener(getInteractionInfo);

    return promise;
  }

  private async verifyInteractionHash(
    clientNonce: string,
    interactionNonce: string,
    interactRef: string,
    hash: string,
    authServer: string,
    intent: InteractionIntent,
    tabId: TabId,
  ) {
    try {
      const grantEndpoint = new URL(authServer).origin + '/';
      const data = new TextEncoder().encode(
        `${clientNonce}\n${interactionNonce}\n${interactRef}\n${grantEndpoint}`,
      );

      const digest = await crypto.subtle.digest('SHA-256', data);
      const calculatedHash = btoa(
        String.fromCharCode.apply(null, new Uint8Array(digest)),
      );
      if (calculatedHash !== hash) throw new Error('Invalid interaction hash');
    } catch (error) {
      await this.redirectToWelcomeScreen(
        tabId,
        GrantResult.GRANT_ERROR,
        intent,
        ErrorCode.HASH_FAILED,
      );
      throw error;
    }
  }

  private async continueGrant(
    grant: PendingGrant,
    interactRef: string,
    intent: InteractionIntent,
    tabId: TabId,
  ) {
    try {
      const continuation = await this.openPaymentsService.client.grant.continue(
        {
          url: grant.continue.uri,
          accessToken: grant.continue.access_token.value,
        },
        { interact_ref: interactRef },
      );

      return continuation;
    } catch (error) {
      await this.redirectToWelcomeScreen(
        tabId,
        GrantResult.GRANT_ERROR,
        intent,
        ErrorCode.CONTINUATION_FAILED,
      );
      throw error;
    }
  }

  private buildGrantDetails(
    continuation: Grant,
    recurring: boolean,
    amount: WalletAmount,
  ): GrantDetails {
    return {
      type: recurring ? 'recurring' : 'one-time',
      amount: amount as Required<WalletAmount>,
      accessToken: {
        value: continuation.access_token.value,
        manageUrl: continuation.access_token.manage,
      },
      continue: {
        accessToken: continuation.continue.access_token.value,
        url: continuation.continue.uri,
      },
    };
  }

  private async persistGrantDetails(grantDetails: GrantDetails) {
    if (grantDetails.type === 'recurring') {
      await this.storage.set({
        recurringGrant: grantDetails,
        recurringGrantSpentAmount: '0',
      });
      this.isGrantUsable.recurring = true;
    } else {
      await this.storage.set({
        oneTimeGrant: grantDetails,
        oneTimeGrantSpentAmount: '0',
      });
      this.isGrantUsable.oneTime = true;
    }
  }

  private async redirectToWelcomeScreen(
    tabId: number,
    result: GrantResult,
    intent: InteractionIntent,
    errorCode?: ErrorCode,
  ) {
    const url = new URL(OPEN_PAYMENTS_REDIRECT_URL);
    url.searchParams.set('result', result);
    url.searchParams.set('intent', intent);
    if (errorCode) url.searchParams.set('errorCode', errorCode);

    await this.browser.tabs.update(tabId, {
      url: url.toString(),
    });
  }

  /**
   * Switches to the next grant that can be used.
   * @returns the type of grant that should be used now, or null if no grant can
   * be used.
   */
  private async _switchGrant(): Promise<GrantDetails['type'] | null> {
    if (!this.isAnyGrantUsable()) {
      return null;
    }

    this.logger.debug('Switching from grant', this.grant?.type);
    const { oneTimeGrant, recurringGrant } = await this.storage.get([
      'oneTimeGrant',
      'recurringGrant',
    ]);

    if (this.grant?.type === 'recurring') {
      this.isGrantUsable.recurring = false;
      if (oneTimeGrant) {
        this.grant = oneTimeGrant;
        return 'one-time';
      }
    } else if (this.grant?.type === 'one-time') {
      this.isGrantUsable.oneTime = false;
      if (recurringGrant) {
        this.grant = recurringGrant;
        return 'recurring';
      }
    }

    return null;
  }
}
