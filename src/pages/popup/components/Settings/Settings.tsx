import React from 'react';
import { SwitchButton } from '@/pages/shared/components/ui/Switch';
import { CaretDownIcon } from '@/pages/shared/components/Icons';
import { useTelemetry, useTranslation } from '@/pages/shared/lib/context';
import { dispatch, usePopupState } from '@/popup/lib/store';
import { useMessage } from '@/popup/lib/context';

export function SettingsScreen() {
  return (
    <div>
      <DataCollectionSettings />
    </div>
  );
}

function DataCollectionSettings() {
  const t = useTranslation();
  const message = useMessage();
  const { consentTelemetry = false } = usePopupState();
  const telemetry = useTelemetry();

  return (
    <details className="border p-4 rounded-md space-y-2 group" open>
      <summary className="flex cursor-pointer items-center justify-between font-semibold text-xl text-alt">
        {t('settings_dataCollection_title')}
        <CaretDownIcon className="h-4 w-4 group-open:rotate-180" />
      </summary>

      <label
        htmlFor="data-collection-toggle"
        className="flex justify-between gap-2"
      >
        <span className="font-medium">
          {t('settings_dataCollection_label')}
        </span>
        <SwitchButton
          id="data-collection-toggle"
          size="small"
          checked={consentTelemetry}
          onChange={async (ev) => {
            const isOptedIn = ev.currentTarget.checked;
            await message.send('OPT_IN_OUT_TELEMETRY', { isOptedIn });
            dispatch({ type: 'OPT_IN_OUT_TELEMETRY', data: { isOptedIn } });
            telemetry.optInOut(isOptedIn);
          }}
        />
      </label>

      <p className="text-sm">
        {t('settings_dataCollection_text')}{' '}
        {t('settings_dataCollection_text_learnMore')}{' '}
        <button
          type="button"
          onClick={() =>
            message.send('OPEN_APP', { path: '/post-install/consent' })
          }
          className="underline text-alt"
        >
          data policy.
        </button>
      </p>
    </details>
  );
}
