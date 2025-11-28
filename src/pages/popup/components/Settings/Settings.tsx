import React from 'react';
import { SwitchButton } from '@/pages/shared/components/ui/Switch';
import { CaretDownIcon } from '@/pages/shared/components/Icons';
import { useTelemetry } from '@/pages/shared/lib/context';
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
  const message = useMessage();
  const { consentTelemetry = false } = usePopupState();
  const telemetry = useTelemetry();

  return (
    <details className="border p-4 rounded-md space-y-2 group" open>
      <summary className="flex cursor-pointer items-center justify-between font-semibold text-xl text-alt">
        Data Collection
        <CaretDownIcon className="h-4 w-4 group-open:rotate-180" />
      </summary>

      <label
        htmlFor="data-collection-toggle"
        className="flex justify-between gap-2"
      >
        <span className="font-medium">Data collection</span>
        {/** biome-ignore lint/correctness/useUniqueElementIds: custom ID better */}
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
        The extension doesn't collect any personal data. Some information is
        transmitted to understand how the users use the extension. Read details
        in our{' '}
        <button
          type="button"
          onClick={() =>
            message.send('OPEN_APP', { path: '/post-install/consent' })
          }
          className="underline text-secondary"
        >
          data policy.
        </button>
      </p>
    </details>
  );
}
