import type {
  WalletAddress,
  OutgoingPaymentGrantSpentAmounts,
} from '@interledger/open-payments';
import type { Cradle } from '@/background/container';
import { Timeout } from '@/shared/helpers';
import { isNotFoundError } from '@/background/services/openPayments';
import { onPopupOpen } from '@/background/utils';

export const GRANT_SPENT_AMOUNTS_SUPPORT_RECHECK_INTERVAL_MS =
  7 * 24 * 60 * 60 * 1000;
export const GRANT_SPENT_AMOUNTS_SUPPORT_RECHECK_ALARM =
  'grant-spent-amounts-support-recheck';

export class GrantBalanceService {
  private storage: Cradle['storage'];
  private logger: Cradle['logger'];
  private outgoingPaymentGrantService: Cradle['outgoingPaymentGrantService'];
  private browser: Cradle['browser'];
  private balanceUpdateTimeout: Timeout | null = null;

  constructor({
    storage,
    logger,
    outgoingPaymentGrantService,
    browser,
  }: Cradle) {
    this.storage = storage;
    this.logger = logger;
    this.outgoingPaymentGrantService = outgoingPaymentGrantService;
    this.browser = browser;
  }

  start() {
    void this.registerBalanceUpdateHandler();

    this.browser.alarms.onAlarm.addListener(async (alarm) => {
      if (alarm.name !== GRANT_SPENT_AMOUNTS_SUPPORT_RECHECK_ALARM) return;

      const supported = await this.checkGrantSpentAmountsSupport();
      if (supported) {
        this.browser.alarms.clear(GRANT_SPENT_AMOUNTS_SUPPORT_RECHECK_ALARM);
      }
    });

    void this.checkGrantSpentAmountsSupport();
  }

  private async getGrantSpentAmounts(
    walletAddress: WalletAddress,
  ): Promise<OutgoingPaymentGrantSpentAmounts | undefined> {
    try {
      const spentAmounts =
        await this.outgoingPaymentGrantService.getGrantSpentAmounts(
          walletAddress,
        );

      await this.storage.set({
        supportsGrantSpentAmounts: {
          supported: true,
          lastCheckedAt: Date.now(),
        },
      });

      return spentAmounts;
    } catch (error) {
      if (isNotFoundError(error)) {
        this.logger.debug(
          'Resource server does not support grant spent amounts endpoint',
          error,
        );

        await this.storage.set({
          supportsGrantSpentAmounts: {
            supported: false,
            lastCheckedAt: Date.now(),
          },
        });
      } else {
        const { supportsGrantSpentAmounts } = await this.storage.get([
          'supportsGrantSpentAmounts',
        ]);

        await this.storage.set({
          supportsGrantSpentAmounts: {
            supported: supportsGrantSpentAmounts?.supported,
            lastCheckedAt: Date.now(),
          },
        });

        throw error;
      }
    }
  }

  private async checkGrantSpentAmountsSupport() {
    if (!this.outgoingPaymentGrantService.isAnyGrantUsable) return;

    const { supportsGrantSpentAmounts, walletAddress } = await this.storage.get(
      ['supportsGrantSpentAmounts', 'walletAddress'],
    );

    if (supportsGrantSpentAmounts?.supported || !walletAddress) return;

    const existingGrantSpentAmountAlarm = await this.browser.alarms.get(
      GRANT_SPENT_AMOUNTS_SUPPORT_RECHECK_ALARM,
    );

    if (!existingGrantSpentAmountAlarm) {
      this.browser.alarms.create(GRANT_SPENT_AMOUNTS_SUPPORT_RECHECK_ALARM, {
        when:
          (supportsGrantSpentAmounts?.lastCheckedAt ?? 0) +
          GRANT_SPENT_AMOUNTS_SUPPORT_RECHECK_INTERVAL_MS,
        periodInMinutes:
          GRANT_SPENT_AMOUNTS_SUPPORT_RECHECK_INTERVAL_MS / 60 / 1000,
      });
    }

    const spentAmounts = await this.getGrantSpentAmounts(walletAddress);
    return spentAmounts?.spentDebitAmount !== undefined;
  }

  private async registerBalanceUpdateHandler() {
    const { supportsGrantSpentAmounts } = await this.storage.get([
      'supportsGrantSpentAmounts',
    ]);

    if (!supportsGrantSpentAmounts?.supported || this.balanceUpdateTimeout) {
      return;
    }

    const updateBalance = async () => {
      await this.saveUpdatedBalance();

      const timeoutMs = await this.getBalanceUpdateTimeout();

      this.balanceUpdateTimeout = new Timeout(timeoutMs, async () => {
        await this.saveUpdatedBalance();

        if (this.balanceUpdateTimeout) {
          const timeoutMs = await this.getBalanceUpdateTimeout();
          this.balanceUpdateTimeout.reset(timeoutMs);
        }
      });
    };

    const unregisterTimeout = async () => {
      if (this.balanceUpdateTimeout) {
        this.balanceUpdateTimeout.clear();
        this.balanceUpdateTimeout = null;
      }
    };

    onPopupOpen(this.browser, updateBalance, unregisterTimeout);
  }

  private async getBalanceUpdateTimeout() {
    const { continuousPaymentsEnabled } = await this.storage.get([
      'continuousPaymentsEnabled',
    ]);

    const timeoutMs = continuousPaymentsEnabled ? 1 * 60 * 1000 : 5 * 60 * 1000;

    return timeoutMs;
  }

  private async saveUpdatedBalance() {
    const { walletAddress } = await this.storage.get(['walletAddress']);

    if (!walletAddress) return;

    try {
      const amounts = await this.getGrantSpentAmounts(walletAddress);

      if (!amounts?.spentDebitAmount) return;

      this.storage.setSpentAmount(
        this.outgoingPaymentGrantService.grantType,
        amounts.spentDebitAmount.value,
      );
    } catch (error) {
      this.logger.warn('Background balance update failed', error);
      this.balanceUpdateTimeout?.clear();
      this.balanceUpdateTimeout = null;
    }
  }
}
