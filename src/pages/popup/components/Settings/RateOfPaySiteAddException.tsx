import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/pages/shared/components/ui/Button';
import { Input } from '@/pages/shared/components/ui/Input';
import { useMessage, useTranslation } from '@/popup/lib/context';
import { usePopupState, dispatch } from '@/popup/lib/store';
import { normalizeHostname } from '@/shared/helpers';
import type { AmountValue, Host } from '@/shared/types';
import { RateOfPayInput } from './RateOfPay';

export function AddExceptionForm({
  defaultHostname,
  onDone,
}: {
  defaultHostname: Host;
  onDone: (entry?: { hostname: Host; rate: AmountValue }) => void;
}) {
  const t = useTranslation();
  const message = useMessage();
  const {
    walletAddress,
    rateOfPay: defaultRateOfPay,
    sitesRateOfPay = [],
    maxRateOfPay,
  } = usePopupState();

  const [hostname, setHostname] = useState(() => defaultHostname);
  const [rate, setRate] = useState(() => {
    if (!defaultHostname) return defaultRateOfPay;
    const existing = sitesRateOfPay.find((e) => e.hostname === defaultHostname);
    return existing?.rate || defaultRateOfPay;
  });
  const [isRateValid, setIsRateValid] = useState(true);
  const isSiteValid = isValidHostname(hostname);

  useEffect(() => {
    document
      .querySelector('[data-testid="rate-of-pay-site-add-exception-form"]')
      ?.scrollIntoView();
  }, []);

  const save: React.SubmitEventHandler = useCallback(
    (ev) => {
      ev.preventDefault();

      const data = { rate, hostname };
      dispatch({ type: 'UPDATE_SITE_RATE_OF_PAY', data });
      void message.send('SET_SITE_RATE_OF_PAY', data);
      onDone(data);
    },
    [message, rate, hostname, onDone],
  );

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={save}
      data-testid="rate-of-pay-site-add-exception-form"
    >
      <div className="flex justify-between gap-2">
        <h3 className="font-medium text-secondary">
          {t('settings_sitePaymentRates_text_formTitle')}
        </h3>
        <button
          className="underline text-error"
          type="button"
          onClick={() => onDone()}
        >
          {t('settings_sitePaymentRates_action_cancel')}
        </button>
      </div>

      <div className="h-px bg-gray-200" />

      <SiteInput value={hostname} onChange={setHostname} />

      <RateOfPayInput
        id="site-rate-of-pay-new"
        label={t('settings_sitePaymentRates_inputRate_label')}
        rateOfPay={rate}
        onRateChange={setRate}
        onValidityChange={setIsRateValid}
        maxRateOfPay={maxRateOfPay}
        walletAddress={walletAddress}
      />

      <Button
        type="submit"
        variant="default"
        disabled={!isSiteValid || !isRateValid}
      >
        {t('settings_sitePaymentRates_action_save')}
      </Button>
    </form>
  );
}

function SiteInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslation();
  const [error, setError] = useState('');

  const validate = (val: string): string => {
    if (!val) {
      return t('settings_sitePaymentRates_inputSite_error_required');
    }
    if (!isValidHostname(val)) {
      return t('settings_sitePaymentRates_inputSite_error_invalid');
    }
    return '';
  };

  return (
    <Input
      label={t('settings_sitePaymentRates_inputSite_label')}
      value={value}
      onChange={(ev) => {
        const val = toHostname(ev.currentTarget.value.trim());
        onChange(val);
        setError(validate(val));
      }}
      onBlur={() => setError(validate(value))}
      errorMessage={error}
      spellCheck="false"
    />
  );
}

const toHostname = (value: string): string => {
  const url = URL.parse(value) ?? URL.parse(`http://${value}`);
  return url?.hostname ? normalizeHostname(url.hostname) : value;
};

const isValidHostname = (val: string): boolean => {
  if (!val) return false;
  const parsed = URL.parse(`http://${val}`);
  return !!parsed && parsed.hostname === val;
};
