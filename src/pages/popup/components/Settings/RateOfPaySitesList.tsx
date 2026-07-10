import React, { useCallback, useEffect, useRef } from 'react';
import { IconTrash } from '@/pages/shared/components/Icons';
import { cn } from '@/pages/shared/lib/utils';
import { useMessage, useTelemetry, useTranslation } from '@/popup/lib/context';
import { dispatch, usePopupState } from '@/popup/lib/store';
import { debounceAsync } from '@/shared/helpers';
import type { AmountValue, Host, WalletInfo } from '@/shared/types';
import { RateOfPayInput, type SiteRateChangeData } from './RateOfPay';

export function SitesList({
  highlightedHostname,
}: {
  highlightedHostname: Host | null;
}) {
  const t = useTranslation();
  const message = useMessage();
  const telemetry = useTelemetry();
  const { walletAddress, maxRateOfPay, sitesRateOfPay = [] } = usePopupState();

  useEffect(() => {
    message.send('GET_PER_SITE_RATE_OF_PAY').then((res) => {
      if (!res.success) return;
      const entries = res.payload.map((e) => ({
        hostname: e.site.replace(/^\*\./, ''),
        rate: e.rate,
      }));
      dispatch({ type: 'SET_DATA_SITES_RATE_OF_PAY', data: entries });
    });
  }, [message]);

  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!highlightedHostname) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-hostname="${CSS.escape(highlightedHostname)}"]`,
    );
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [highlightedHostname]);

  const updateSiteRateOfPay = React.useRef(
    debounceAsync(async (data: SiteRateChangeData) => {
      await message.send('SET_SITE_RATE_OF_PAY', data);
      telemetry.capture('site_rate_of_pay_change');
    }, 500),
  );

  const onSetRate = useCallback((data: SiteRateChangeData) => {
    dispatch({ type: 'UPDATE_SITE_RATE_OF_PAY', data });
    void updateSiteRateOfPay.current(data);
  }, []);

  if (!sitesRateOfPay.length) {
    return (
      <p className="text-xs italic text-slate-600">
        {t('settings_sitePaymentRates_noExceptions')}
      </p>
    );
  }

  return (
    <ul ref={listRef} className="space-y-6 list-none">
      {sitesRateOfPay.map(({ hostname, rate }) => (
        <li
          key={hostname}
          data-hostname={hostname}
          className={cn(
            'flex items-center gap-4 -mx-2 px-2 py-1',
            'transition-colors duration-500',
            hostname === highlightedHostname && 'bg-popup-light',
          )}
        >
          <SiteEntry
            hostname={hostname}
            rate={rate}
            onSetRate={onSetRate}
            walletAddress={walletAddress}
            maxRateOfPay={maxRateOfPay}
          />
        </li>
      ))}
    </ul>
  );
}

type SiteEntryProps = {
  hostname: Host;
  rate: AmountValue;
  onSetRate(data: SiteRateChangeData): void;
  maxRateOfPay: AmountValue;
  walletAddress: WalletInfo;
};
function SiteEntry({
  hostname,
  rate,
  onSetRate,
  maxRateOfPay,
  walletAddress,
}: SiteEntryProps) {
  const t = useTranslation();
  const id = `rate-of-pay-${hostname.replaceAll('.', '_')}`;
  return (
    <>
      <span
        className="font-medium text-medium overflow-hidden text-ellipsis grow"
        title={hostname}
      >
        {hostname}
      </span>

      <RateOfPayInput
        maxRateOfPay={maxRateOfPay}
        rateOfPay={rate}
        id={id}
        label={null}
        onRateChange={(rate) => onSetRate({ rate, hostname })}
        walletAddress={walletAddress}
        className="w-30"
        smallSize={true}
      />

      <button
        type="button"
        className="p-1 text-alt"
        onClick={() => onSetRate({ hostname, rate: null })}
      >
        <IconTrash className="size-4" />
        <span className="sr-only">
          {t('settings_rate_action_removeException')}
        </span>
      </button>
    </>
  );
}
