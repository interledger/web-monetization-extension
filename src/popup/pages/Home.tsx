import React from 'react';
import { Link } from 'react-router-dom';
import { usePopupState, useTranslation } from '@/popup/lib/context';
import { Settings } from '@/popup/components/Icons';
import { formatNumber, roundWithPrecision } from '../lib/utils';
import { PayWebsiteForm } from '@/popup/components/PayWebsiteForm';
import { NotMonetized } from '@/popup/components/NotMonetized';
import { formatCurrency } from '@/shared/helpers';
import { ROUTES_PATH } from '@/popup/Popup';

export const Component = () => {
  const t = useTranslation();
  const {
    state: { tab },
  } = usePopupState();

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
      case 'no_monetization_links':
      default:
        return <NotMonetized text={t('notMonetized_text_noLinks')} />;
    }
  }

  return (
    <div className="h-full space-y-6" data-testid="home-page">
      <header className="text-secondary-dark text-center text-3xl">
        <h2 className="font-bold">Pay as you browse</h2>
        <p className="font-light">Support content you love</p>
      </header>
      <InfoBanner />
      <PayWebsiteForm />
    </div>
  );
};

const InfoBanner = () => {
  const {
    state: { rateOfPay, balance, walletAddress },
  } = usePopupState();

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

      <p className="text-xs italic text-white/90">
        <Link to={ROUTES_PATH.SETTINGS} className="hover:underline">
          To adjust your budget or rate of pay, click on{' '}
          <Settings className="inline-block h-4 w-4 fill-white align-top" />
        </Link>
      </p>
    </div>
  );
};
