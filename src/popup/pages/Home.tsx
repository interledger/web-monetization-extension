import React from 'react';
import { usePopupState, useMessage, useTranslation } from '@/popup/lib/context';
import { WarningSign } from '@/popup/components/Icons';
import { Slider } from '../components/ui/Slider';
import { Label } from '../components/ui/Label';
import {
  formatNumber,
  getCurrencySymbol,
  roundWithPrecision,
} from '../lib/utils';
import { PayWebsiteForm } from '../components/PayWebsiteForm';
import { NotMonetized } from '@/popup/components/NotMonetized';
import { debounceAsync } from '@/shared/helpers';
import { Switch } from '../components/ui/Switch';

export const Component = () => {
  const t = useTranslation();
  const message = useMessage();
  const {
    state: {
      enabled,
      rateOfPay,
      minRateOfPay,
      maxRateOfPay,
      balance,
      walletAddress,
      tab,
    },
    dispatch,
  } = usePopupState();

  const rate = React.useMemo(() => {
    const r = Number(rateOfPay) / 10 ** walletAddress.assetScale;
    const roundedR = roundWithPrecision(r, walletAddress.assetScale);

    return formatNumber(roundedR, walletAddress.assetScale, true);
  }, [rateOfPay, walletAddress.assetScale]);

  const remainingBalance = React.useMemo(() => {
    const val = Number(balance) / 10 ** walletAddress.assetScale;
    const rounded = roundWithPrecision(val, walletAddress.assetScale);
    return formatNumber(rounded, walletAddress.assetScale, true);
  }, [balance, walletAddress.assetScale]);

  const updateRateOfPay = React.useRef(
    debounceAsync(async (rateOfPay: string) => {
      const response = await message.send('UPDATE_RATE_OF_PAY', { rateOfPay });
      if (!response.success) {
        // TODO: Maybe reset to old state, but not while user is active (avoid
        // sluggishness in UI)
      }
    }, 1000),
  );

  const onRateChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const rateOfPay = event.currentTarget.value;
    dispatch({ type: 'UPDATE_RATE_OF_PAY', data: { rateOfPay } });
    void updateRateOfPay.current(rateOfPay);
  };

  const onChangeWM = () => {
    message.send('TOGGLE_WM');
    dispatch({ type: 'TOGGLE_WM', data: {} });
  };

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
    <div className="space-y-8" data-testid="home-page">
      {enabled ? (
        <div className="space-y-2">
          <Label className="px-2 text-base font-medium text-medium">
            Current rate of pay
          </Label>
          <Slider
            onChange={onRateChange}
            min={Number(minRateOfPay)}
            max={Number(maxRateOfPay)}
            step={Number(minRateOfPay)}
            value={Number(rateOfPay)}
          />
          <div className="flex w-full items-center justify-between px-2 tabular-nums">
            <span className="text-sm">
              {rate} {getCurrencySymbol(walletAddress.assetCode)} per hour
            </span>
            <span className="text-sm">
              Remaining balance: {getCurrencySymbol(walletAddress.assetCode)}
              {remainingBalance}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <WarningSign className="text-error" />
          <p className="text-base text-medium">
            Web Monetization has been turned off.
          </p>
        </div>
      )}
      <Switch
        checked={enabled}
        onChange={onChangeWM}
        label="Continuous payment stream"
      />

      <hr />

      {tab.url ? <PayWebsiteForm /> : null}
    </div>
  );
};
