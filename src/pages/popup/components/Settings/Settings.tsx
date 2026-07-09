import React from 'react';
import { CaretDownIcon } from '@/pages/shared/components/Icons';
import { useTranslation } from '@/popup/lib/context';
import { DataCollectionSettings } from './SettingsDataCollection';
import { RateOfPayManageSites } from './RateOfPayManageSites';

export function SettingsScreen() {
  const t = useTranslation();

  React.useEffect(() => {
    const openSitePaymentRates = history.state?.open === 'sites-rate-of-pay';
    const toOpen = openSitePaymentRates
      ? document.getElementById('settings-site-payment-rates')!
      : document.getElementById('settings-data-collection')!;
    toOpen.setAttribute('open', '');
    toOpen.scrollIntoView();
  }, []);

  return (
    <div className="space-y-3 pb-8">
      <SettingsAccordion
        id="settings-data-collection"
        title={t('settings_dataCollection_title')}
      >
        <DataCollectionSettings />
      </SettingsAccordion>
      <SettingsAccordion
        id="settings-site-payment-rates"
        title={t('settings_sitePaymentRates_title')}
      >
        <RateOfPayManageSites />
      </SettingsAccordion>
    </div>
  );
}

function SettingsAccordion({
  title,
  id,
  children,
}: React.PropsWithChildren<{ title: string; id: string }>) {
  return (
    <details
      className="border border-gray-200 p-4 rounded-md space-y-2 group not-open:pb-2"
      id={id}
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
