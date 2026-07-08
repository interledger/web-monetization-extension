import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { SwitchButton } from '@/pages/shared/components/ui/Switch';
import { Button } from '@/pages/shared/components/ui/Button';
import { InputAmountMemoized as InputAmount } from '@/pages/shared/components/InputAmount';
import { IconTrash } from '@/pages/shared/components/Icons';
import { debounceAsync, normalizeHostname } from '@/shared/helpers';
import { cn, formatNumber, roundWithPrecision } from '@/pages/shared/lib/utils';
import { useMessage, useTelemetry, useTranslation } from '@/popup/lib/context';
import { dispatch, usePopupState, type PopupState } from '@/popup/lib/store';
import type { AmountValue, Host } from '@/shared/types';

export const RateOfPayScreen = () => {
  const message = useMessage();
  const telemetry = useTelemetry();

  const updateRateOfPay = React.useRef(
    debounceAsync(async (rateOfPay: AmountValue) => {
      const response = await message.send('UPDATE_RATE_OF_PAY', { rateOfPay });
      if (!response.success) {
        // TODO: Maybe reset to old state, but not while user is active (avoid
        // sluggishness in UI)
      }
      telemetry.capture('rate_of_pay_change');
    }, 1000),
  );

  const updateSiteRateOfPay = React.useRef(
    debounceAsync(async (data: SiteRateChangeData) => {
      const response = await message.send('SET_SITE_RATE_OF_PAY', data);
      if (!response.success) return;
      telemetry.capture('site_rate_of_pay_change');
    }, 500),
  );

  const onRateChange = async (rateOfPay: AmountValue) => {
    dispatch({ type: 'UPDATE_RATE_OF_PAY', data: { rateOfPay } });
    void updateRateOfPay.current(rateOfPay);
  };

  const onSiteRateChange = async (data: SiteRateChangeData) => {
    dispatch({ type: 'UPDATE_SITE_RATE_OF_PAY', data });
    void updateSiteRateOfPay.current(data);
  };

  const toggleContinuousPayments = (continuousPaymentsEnabled: boolean) => {
    message.send('TOGGLE_CONTINUOUS_PAYMENTS');
    dispatch({ type: 'TOGGLE_CONTINUOUS_PAYMENTS' });
    telemetry.register({ continuousPaymentsEnabled });
    telemetry.capture('toggle_continuous_payments', {
      enabled: continuousPaymentsEnabled,
    });
  };

  return (
    <RateOfPayComponent
      onRateChange={onRateChange}
      onSiteRateChange={onSiteRateChange}
      toggle={toggleContinuousPayments}
    />
  );
};

interface Props {
  onRateChange: (rate: AmountValue) => Promise<void> | void;
  onSiteRateChange: (data: SiteRateChangeData) => Promise<void> | void;
  toggle: (nowEnabled: boolean) => void | Promise<void>;
}

export type SiteRateChangeData = {
  hostname: Host;
  rate: AmountValue | null;
};

export const RateOfPayComponent = ({
  onRateChange,
  onSiteRateChange,
  toggle,
}: Props) => {
  const t = useTranslation();
  const {
    continuousPaymentsEnabled,
    rateOfPay,
    maxRateOfPay,
    walletAddress,
    tab,
  } = usePopupState();
  const [editingSiteRate, setEditingSiteRate] = useState(false);
  const [_location, navigate] = useLocation();

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <label
          htmlFor="continuous-payments-toggle"
          className="flex items-center gap-x-4"
        >
          <span className="font-medium text-medium grow">
            {t('settings_rate_continuousPayments_label')}
          </span>
          <SwitchButton
            id="continuous-payments-toggle"
            data-testid="continuous-payments-toggle"
            size="small"
            checked={continuousPaymentsEnabled}
            onChange={(e) => toggle(e.currentTarget.checked)}
          />
        </label>

        {!continuousPaymentsEnabled ? (
          <p className="text-weak italic">
            {t('settings_rate_continuousPayments_disabled_text')}
          </p>
        ) : null}
      </div>

      <div
        className={cn(
          'border p-3 rounded-lg',
          continuousPaymentsEnabled ? 'border-popup' : 'border-base',
          continuousPaymentsEnabled && !tab.rateOfPay ? 'bg-popup-light' : '',
        )}
      >
        <RateOfPayInput
          id="rateOfPay"
          label={t('settings_rate_label_inputDefaultRate')}
          onRateChange={onRateChange}
          rateOfPay={rateOfPay}
          maxRateOfPay={maxRateOfPay}
          walletAddress={walletAddress}
        />
      </div>

      {(tab.rateOfPay || editingSiteRate) && (
        <div
          className={cn(
            'space-y-2',
            'border p-3 rounded-lg',
            continuousPaymentsEnabled ? 'border-popup' : 'border-base',
            continuousPaymentsEnabled && tab.rateOfPay ? 'bg-popup-light' : '',
          )}
        >
          <SiteRateOfPayInput onRateChange={onSiteRateChange} />
        </div>
      )}

      {!tab.rateOfPay ? (
        <Button
          type="button"
          variant="default"
          className="w-full font-semibold"
          onClick={() => setEditingSiteRate(true)}
        >
          {t('settings_rate_label_addException')}
        </Button>
      ) : (
        <Button
          type="button"
          variant="default"
          className="w-full font-semibold"
          onClick={() =>
            navigate('~/settings/other', {
              replace: true,
              state: { open: 'sites-rate-of-pay' },
            })
          }
        >
          {t('settings_rate_label_manageExceptions')}
        </Button>
      )}
    </div>
  );
};

type RateOfPayInputProps = {
  id: string;
  label: React.ReactNode;
  onRateChange: Props['onRateChange'];
  onValidityChange?: (isValid: boolean) => void;
  walletAddress: PopupState['walletAddress'];
  rateOfPay: PopupState['rateOfPay'];
  maxRateOfPay: PopupState['maxRateOfPay'];
  disabled?: boolean;
  className?: string;
  smallSize?: boolean;
};

const SiteRateOfPayInput = ({
  onRateChange,
}: {
  onRateChange: Props['onSiteRateChange'];
}) => {
  const t = useTranslation();
  const { rateOfPay, maxRateOfPay, walletAddress, tab } = usePopupState();

  const hostname = new URL(tab.url).hostname;
  const site = normalizeHostname(hostname);

  return (
    <>
      <div className="flex justify-between">
        <label
          htmlFor="rateOfPaySite"
          className="flex items-center px-2 font-medium leading-6 text-medium"
        >
          {site} (exception)
        </label>
        <button
          onClick={() => onRateChange({ rate: null, hostname })}
          type="button"
          className="p-1 text-alt"
        >
          <span className="sr-only">
            {t('settings_rate_action_removeException')}
          </span>
          <IconTrash className="size-4" />
        </button>
      </div>

      <RateOfPayInput
        id="rateOfPaySite"
        label={null}
        onRateChange={(rate) => onRateChange({ rate, hostname })}
        rateOfPay={tab.rateOfPay || rateOfPay}
        maxRateOfPay={maxRateOfPay}
        walletAddress={walletAddress}
      />
    </>
  );
};

export const RateOfPayInput = ({
  id,
  label,
  onRateChange,
  onValidityChange,
  walletAddress,
  rateOfPay,
  maxRateOfPay,
  disabled,
  className,
  smallSize,
}: RateOfPayInputProps) => {
  const t = useTranslation();
  const [errorMessage, setErrorMessage] = React.useState('');

  const formatAmount = React.useMemo(
    () => (value: number | string) => {
      const r = Number(value) / 10 ** walletAddress.assetScale;
      const roundedR = roundWithPrecision(r, walletAddress.assetScale);

      return formatNumber(roundedR, walletAddress.assetScale, true);
    },
    [walletAddress.assetScale],
  );

  return (
    <InputAmount
      id={id}
      label={label}
      className={cn(
        'bg-white border-base',
        disabled && 'focus-within:border-base',
        className,
      )}
      walletAddress={walletAddress}
      onChange={(value) => {
        setErrorMessage('');
        onValidityChange?.(true);
        const rate = Number(value) * 10 ** walletAddress.assetScale;
        onRateChange(Math.round(rate).toString());
      }}
      onError={(error) => {
        setErrorMessage(t(error));
        onValidityChange?.(false);
      }}
      errorMessage={errorMessage}
      min={0}
      max={Number(formatAmount(maxRateOfPay))}
      amount={formatAmount(rateOfPay)}
      controls={true}
      readOnly={disabled}
      size={smallSize ? 'small' : 'default'}
    />
  );
};
