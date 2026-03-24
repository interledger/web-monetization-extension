import type {
  AccessToken,
  GrantDetails,
  TabId,
  WalletAmount,
} from '@/shared/types';
import {
  isFinalizedGrantWithAccessToken,
  isPendingGrant,
  type Grant,
  type PendingGrant,
  type WalletAddress,
} from '@interledger/open-payments/dist/types';
import type { Browser, Tabs } from 'webextension-polyfill';
import type { Cradle } from '@/background/container';
import { ACCEPT_GRANT_TIMEOUT } from '@/background/config';
import { OPEN_PAYMENTS_REDIRECT_URL } from '@/shared/defines';
import { ensureEnd, ErrorWithKey, withResolvers } from '@/shared/helpers';
import {
  isInvalidClientError,
  isInvalidContinuationError,
  isNotFoundError,
} from '@/background/services/openPayments';
import {
  createTabIfNotExists,
  WalletStatusCancelError,
  WalletStatusFailureError,
} from '@/background/utils';

interface InteractionParams {
  interactRef: string;
  hash: string;
  tabId: TabId;
}

type TabUpdateCallback = Parameters<Tabs.OnUpdatedEvent['addListener']>[0];
type TabRemovedCallback = Parameters<
  Browser['tabs']['onRemoved']['addListener']
>[0];

export class OutgoingPaymentGrantService {
  private storage: Cradle['storage'];
  private logger: Cradle['logger'];
  private deduplicator: Cradle['deduplicator'];
  private openPaymentsService: Cradle['openPaymentsService'];
  private events: Cradle['events'];
  private browser: Cradle['browser'];

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
    events,
    browser,
  }: Cradle) {
    this.storage = storage;
    this.logger = logger;
    this.deduplicator = deduplicator;
    this.events = events;
    this.openPaymentsService = openPaymentsService;
    this.browser = browser;

    void this.initialize();
    this.switchGrant = this.deduplicator.dedupe(this._switchGrant.bind(this));
  }

  public get isAnyGrantUsable() {
    return this.isGrantUsable.recurring || this.isGrantUsable.oneTime;
  }

  public get accessToken() {
    return this.token.value;
  }

  public get grantType() {
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

  private async initialize(): Promise<void> {
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

  async completeOutgoingPaymentGrant(
    walletAmount: WalletAmount,
    walletAddress: WalletAddress,
    { grant, nonce }: Awaited<ReturnType<this['createOutgoingPaymentGrant']>>,
    onTabOpen: (tabId: TabId) => void,
    existingTabId?: TabId,
    timeout = ACCEPT_GRANT_TIMEOUT,
  ): Promise<GrantDetails> {
    const signal = AbortSignal.timeout(timeout);

    const { interactRef, hash } = await this.getInteractionInfo(
      grant.interact.redirect,
      onTabOpen,
      signal,
      existingTabId,
    );

    await this.verifyInteractionHash(
      nonce,
      grant.interact.finish,
      interactRef,
      hash,
      walletAddress.authServer,
    );
    signal.throwIfAborted();

    const continuation = await this.continueGrant(grant, interactRef);
    if (!isFinalizedGrantWithAccessToken(continuation)) {
      throw new Error(
        'Expected finalized grant. Received non-finalized grant.',
      );
    }
    signal.throwIfAborted();

    this.grant = this.buildGrantDetails(continuation, walletAmount);
    await this.persistGrantDetails(this.grant);

    return this.grant;
  }

  async cancelGrant(grantContinuation: GrantDetails['continue']) {
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

  async rotateToken() {
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

  async createOutgoingPaymentGrant(
    walletAddress: WalletAddress,
    amount: WalletAmount,
  ) {
    const nonce = crypto.randomUUID();
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
              nonce: nonce,
            },
          },
        },
      );

      if (!isPendingGrant(grant)) {
        throw new Error(
          'Expected interactive grant. Received non-pending grant.',
        );
      }

      return { grant, nonce };
    } catch (error) {
      if (isInvalidClientError(error)) {
        throw new ErrorWithKey('connectWallet_error_invalidClient');
      }
      throw error;
    }
  }

  private async getInteractionInfo(
    url: string,
    onTabOpen: (tabId: TabId) => void,
    signal: AbortSignal,
    existingTabId?: TabId,
  ): Promise<InteractionParams> {
    const { resolve, reject, promise } = withResolvers<InteractionParams>();

    signal.addEventListener('abort', () => {
      removeListeners();
      reject(signal.reason);
    });

    const tabID = await createTabIfNotExists(this.browser, url, existingTabId);
    onTabOpen(tabID);

    this.events.emit('request_popup_close');

    const removeListeners = () => {
      this.browser.tabs.onUpdated.removeListener(getInteractionInfo);
      this.browser.tabs.onRemoved.removeListener(tabCloseListener);
    };

    const tabCloseListener: TabRemovedCallback = (tabId) => {
      if (tabId !== tabID) return;

      removeListeners();
      reject(new WalletStatusCancelError('tab_closed'));
    };

    const getInteractionInfo: TabUpdateCallback = async (tabId, changeInfo) => {
      if (tabId !== tabID) return;
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
          removeListeners();
        }

        if (interactRef && hash) {
          resolve({ interactRef, hash, tabId });
        } else if (result === 'grant_rejected') {
          reject(new WalletStatusCancelError('grant_rejected'));
        } else if (result === 'grant_invalid') {
          reject(new WalletStatusFailureError('grant_invalid'));
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
  ) {
    const computeHash = (authServer: string) =>
      this.computeHash(clientNonce, interactionNonce, interactRef, authServer);

    if (hash === (await computeHash(authServer))) return;
    // See https://github.com/interledger/web-monetization-extension/pull/1230
    this.logger.warn(
      'verifyInteractionHash failed with authServer without trailing slash',
    );
    if (hash === (await computeHash(ensureEnd(authServer, '/')))) return;
    throw new WalletStatusFailureError('grant_hash_failed');
  }

  private computeHash = async (
    clientNonce: string,
    interactionNonce: string,
    interactRef: string,
    authServer: string,
  ) => {
    const data = new TextEncoder().encode(
      `${clientNonce}\n${interactionNonce}\n${interactRef}\n${authServer}`,
    );
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)));
  };

  private async continueGrant(grant: PendingGrant, interactRef: string) {
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
      const err = new WalletStatusFailureError('grant_continuation_failed', {
        details: error,
      });
      this.logger.error(err);
      throw err;
    }
  }

  private buildGrantDetails(
    continuation: Grant,
    amount: WalletAmount,
  ): GrantDetails {
    const recurring = !!amount.interval;
    return {
      type: recurring ? 'recurring' : 'one-time',
      amount: amount as Required<WalletAmount>,
      accessToken: {
        value: continuation.access_token!.value,
        manageUrl: continuation.access_token!.manage,
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

  /**
   * Switches to the next grant that can be used.
   * @returns the type of grant that should be used now, or null if no grant can
   * be used.
   */
  private async _switchGrant(): Promise<GrantDetails['type'] | null> {
    if (!this.isAnyGrantUsable) {
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
