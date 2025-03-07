import React from 'react';
import { formatCurrency } from '@/shared/helpers';
import { Settings } from '@/pages/shared/components/Icons';
import { formatNumber, roundWithPrecision } from '@/pages/shared/lib/utils';
import { PayWebsiteForm } from '@/popup/components/PayWebsiteForm';
import { NotMonetized } from '@/popup/components/NotMonetized';
import { useTranslation } from '@/popup/lib/context';
import { usePopupState } from '@/popup/lib/store';
import { ROUTES_PATH } from '../Popup';
import { Redirect as Navigate } from 'wouter';

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
  if (connected === false) {
    return <Navigate to={ROUTES_PATH.CONNECT_WALLET} />;
  }

  if (!enabled) {
    return <NotMonetized text={t('app_text_disabled')} />;
  }

  if (tab.status !== 'monetized') {
    switch (tab.status) {
      case 'all_sessions_invalid':
        return <NotMonetized text={t('notMonetized_text_allInvalid')} />;
      case 'internal_page':
        return <NotMonetized text={t('notMonetized_text_internalPage')} />;
      case 'new_tab':
        return <NotMonetized text={t('notMonetized_text_newTab')} />;
      case 'unsupported_scheme':
        return <NotMonetized text={t('notMonetized_text_unsupportedScheme')} />;
      default:
        return <NotMonetized text={t('notMonetized_text_noLinks')} />;
    }
  }

  return (
    <div
      className="-mx-6 -mb-4 flex h-full flex-col gap-6 px-6"
      data-testid="home-page"
      style={{
        backgroundImage: `url("/assets/images/bg-tile.svg")`,
        height: 'calc(100% + 1rem)',
      }}
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
  const { rateOfPay, balance, walletAddress } = usePopupState();

  const rate = React.useMemo(() => {
    const r = Number(rateOfPay) / 10 ** walletAddress.assetScale;
    const roundedR = roundWithPrecision(r, walletAddress.assetScale);

    return formatCurrency(
      formatNumber(roundedR, walletAddress.assetScale, true),
      walletAddress.assetCode,
      walletAddress.assetScale,
    );
  }, [rateOfPay, walletAddress.assetCode, walletAddress.assetScale]);

  const remainingBalance = React.useMemo(() => {
    const val = Number(balance) / 10 ** walletAddress.assetScale;
    const rounded = roundWithPrecision(val, walletAddress.assetScale);
    return formatCurrency(
      formatNumber(rounded, walletAddress.assetScale, true),
      walletAddress.assetCode,
      walletAddress.assetScale,
    );
  }, [balance, walletAddress.assetCode, walletAddress.assetScale]);

  return (
    <div className="space-y-2 rounded-md bg-button-base p-4 text-white">
      <dl className="flex items-center justify-between px-10">
        <div className="flex flex-col-reverse items-center">
          <dt className="text-sm">Hourly rate</dt>
          <dd className="font-medium tabular-nums">{rate}</dd>
        </div>
        <div className="flex flex-col-reverse items-center">
          <dt className="text-sm">Balance</dt>
          <dd className="font-medium tabular-nums">{remainingBalance}</dd>
        </div>
      </dl>

      <p className="text-center text-xs italic text-white/90">
        To adjust your budget or rate of pay, click on{' '}
        <Settings className="inline-block h-4 w-4 fill-white align-top" />
      </p>
    </div>
  );
};
