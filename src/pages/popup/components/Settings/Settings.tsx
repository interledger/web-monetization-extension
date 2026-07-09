import React from 'react';
import { useHistoryState } from 'wouter/use-browser-location';
import { CaretDownIcon } from '@/pages/shared/components/Icons';
import { useTranslation } from '@/popup/lib/context';
import { DataCollectionSettings } from './SettingsDataCollection';
import { RateOfPayManageSites } from './RateOfPayManageSites';

export interface OtherSettingsHistoryState {
  open?: 'sites-rate-of-pay';
  highlight?: string;
}

export function SettingsScreen() {
  const t = useTranslation();
  const state = useHistoryState<OtherSettingsHistoryState>();

  React.useEffect(() => {
    if (state?.open === 'sites-rate-of-pay') {
      document.getElementById('settings-data-collection')?.scrollIntoView();
    }
  }, [state?.open]);

  return (
    <div className="space-y-3 pb-8">
      <SettingsAccordion
        id="settings-data-collection"
        title={t('settings_dataCollection_title')}
        open={state?.open !== 'sites-rate-of-pay'}
      >
        <DataCollectionSettings />
      </SettingsAccordion>
      <SettingsAccordion
        id="settings-site-payment-rates"
        title={t('settings_sitePaymentRates_title')}
        open={state?.open === 'sites-rate-of-pay'}
      >
        <RateOfPayManageSites highlight={state?.highlight} />
      </SettingsAccordion>
    </div>
  );
}

function SettingsAccordion({
  title,
  id,
  children,
  open = false,
}: React.PropsWithChildren<{ title: string; id: string; open?: boolean }>) {
  return (
    <details
      className="border border-gray-200 p-4 rounded-md space-y-2 group not-open:pb-2"
      id={id}
      open={open}
      name="other-settings"
    >
      <summary className="flex cursor-pointer items-center justify-between font-semibold text-xl text-alt">
        {title}
        <CaretDownIcon className="h-4 w-4 group-open:rotate-180" />
      </summary>

      {children}
    </details>
  );
}
