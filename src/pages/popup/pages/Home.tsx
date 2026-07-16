import React from 'react';
import { Link, Redirect as Navigate } from 'wouter';
import {
  formatNumber,
  roundWithPrecision,
  formatCurrency,
  cn,
} from '@/pages/shared/lib/utils';
import { PayWebsiteForm } from '@/popup/components/PayWebsiteForm';
import { NotMonetized } from '@/popup/components/NotMonetized';
import type { OtherSettingsHistoryState } from '@/popup/components/Settings/Settings';
import { useTranslation } from '@/popup/lib/context';
import { usePopupState } from '@/popup/lib/store';
import { ROUTES_PATH } from '../Popup';
import type { AmountValue, WalletInfo } from '@/shared/types';

export default () => {
  const t = useTranslation();
  const { tab, enabled, state, connected } = usePopupState();

  if (state.missing_host_permissions) {
    return <Navigate to={ROUTES_PATH.MISSING_HOST_PERMISSION} />;
  }
  if (state.key_revoked) {
    return <Navigate to={ROUTES_PATH.ERROR_KEY_REVOKED} />;
  }
  if (state.out_of_funds) {
    return <Navigate to={ROUTES_PATH.OUT_OF_FUNDS} />;
  }
  if (state.consent_required) {
    return <Navigate to={ROUTES_PATH.CONSENT_REQUIRED} />;
  }
  if (connected === false) {
    return <Navigate to={ROUTES_PATH.CONNECT_WALLET} />;
  }

  if (!enabled) {
    return <NotMonetized text={t('app_disabled_text')} />;
  }

  if (tab.status !== 'monetized') {
    switch (tab.status) {
      case 'all_sessions_invalid':
        return <NotMonetized text={t('notMonetized_allInvalid_text')} />;
      case 'internal_page':
        return <NotMonetized text={t('notMonetized_internalPage_text')} />;
      case 'new_tab':
        return <NotMonetized text={t('notMonetized_newTab_text')} />;
      case 'unsupported_scheme':
        return <NotMonetized text={t('notMonetized_unsupportedScheme_text')} />;
      default:
        return <NotMonetized text={t('notMonetized_noLinks_text')} />;
    }
  }

  return (
    <div
      className="-mx-6 -mb-4 flex h-full flex-col gap-6 px-6 home"
      data-testid="home-page"
      style={{ height: 'calc(100% + 1rem)' }}
    >
      <header className="text-center text-3xl text-secondary-dark">
        <h2 className="font-bold">Pay as you browse</h2>
        <p className="font-light">Support content you love</p>
      </header>
      <InfoBanner />
      <PayWebsiteForm />
    </div>
  );
};

const InfoBanner = () => {
  const t = useTranslation();
  const { rateOfPay, tab, balance, walletAddress, hasSitesRateOfPay } =
    usePopupState();

  const hasExceptions = hasSitesRateOfPay || tab.rateOfPay;

  const rate = React.useMemo(() => {
    return formattedAmount(rateOfPay, walletAddress);
  }, [rateOfPay, walletAddress]);

  const tabRateOfPay = React.useMemo(() => {
    return tab.rateOfPay ? formattedAmount(tab.rateOfPay, walletAddress) : null;
  }, [tab.rateOfPay, walletAddress]);

  const remainingBalance = React.useMemo(() => {
    return formattedAmount(balance, walletAddress);
  }, [balance, walletAddress]);

  return (
    <div className="grid grid-cols-2 h-40 items-center justify-between gap-2 text-medium">
      <section className="flex flex-col h-full p-3 border border-gray-200 rounded-md">
        <h3 className="text-sm mb-1">{t('home_balance_title')}</h3>
        <p className="text-4xl font-medium tabular-nums">{remainingBalance}</p>

        <Link
          className="mt-auto px-3 py-2 border border-current rounded-lg text-alt font-medium text-sm flex items-center justify-center"
          to="/settings/budget"
        >
          {t('home_manageBudget_action')}
        </Link>
      </section>

      <section className="flex flex-col h-full p-3 border border-gray-200 rounded-md">
        <h3 className="text-sm mb-1">{t('home_hourlyRate_title')}</h3>
        <p className="flex flex-col gap-1">
          <span
            className={cn(
              'flex items-center gap-1',
              !!tab.rateOfPay && 'text-alt',
            )}
          >
            <span className="tabular-nums text-3xl font-medium">
              {tabRateOfPay || rate}
            </span>
            <span className="text-xs font-normal">
              {!tab.rateOfPay
                ? t('home_hourlyRateDefault_text')
                : t('home_hourlyRateException_text')}
            </span>
          </span>

          {!!tab.rateOfPay && (
            <span className="text-xs font-normal px-2 py-1 rounded-lg bg-slate-50 w-fit">
              {t('home_hourlyRateDefault_text')}{' '}
              <span className="tabular-nums">{rate}</span>
            </span>
          )}
        </p>

        <Link
          className="mt-auto px-3 py-2 border border-current rounded-lg text-alt font-medium text-sm flex items-center justify-center"
          to="/settings/other"
          state={
            {
              open: 'sites-rate-of-pay',
              highlight: hasExceptions ? URL.parse(tab.url)?.hostname : 'new',
            } satisfies OtherSettingsHistoryState
          }
        >
          {hasExceptions
            ? t('home_manageExceptions_action')
            : t('home_addException_action')}
        </Link>
      </section>
    </div>
  );
};

function formattedAmount(
  amount: AmountValue,
  walletAddress: Pick<WalletInfo, 'assetCode' | 'assetScale'>,
): string {
  const val = Number(amount) / 10 ** walletAddress.assetScale;
  const rounded = roundWithPrecision(val, walletAddress.assetScale);
  return formatCurrency(
    formatNumber(rounded, walletAddress.assetScale, true),
    walletAddress.assetCode,
    walletAddress.assetScale,
  );
}
