import React from 'react';
import { CaretDownIcon } from '@/pages/shared/components/Icons';
import { useTranslation } from '@/popup/lib/context';
import { DataCollectionSettings } from './SettingsDataCollection';

export function SettingsScreen() {
  const t = useTranslation();

  return (
    <div>
      <SettingsAccordion
        id="settings-data-collection"
        title={t('settings_dataCollection_title')}
      >
        <DataCollectionSettings />
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
      className="border border-gray-200 p-4 not-open:pb-2 rounded-md space-y-2 group"
      id={id}
      name="other-settings"
      open
    >
      <summary className="flex cursor-pointer items-center justify-between font-semibold text-xl text-alt">
        {title}
        <CaretDownIcon className="h-4 w-4 group-open:rotate-180" />
      </summary>

      {children}
    </details>
  );
}
