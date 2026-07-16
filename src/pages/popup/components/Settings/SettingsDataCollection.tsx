import React from 'react';
import { SwitchButton } from '@/pages/shared/components/ui/Switch';
import {
  useBrowser,
  useBrowserInfo,
  useTelemetry,
  useTranslation,
} from '@/pages/shared/lib/context';
import { dispatch, usePopupState } from '@/popup/lib/store';
import { useMessage } from '@/popup/lib/context';
import type { Browser } from '@/shared/browser';

export function DataCollectionSettings() {
  const t = useTranslation();
  const message = useMessage();
  const { consentTelemetry = false } = usePopupState();
  const telemetry = useTelemetry();
  const browser = useBrowser();
  const browserInfo = useBrowserInfo();

  return (
    <>
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
            if (browserInfo.name === 'firefox') {
              const ok = await handleFirefoxDataCollectionPermission(
                isOptedIn,
                browser,
              );
              if (!ok) {
                ev.preventDefault();
                return;
              }
            }
            await message.send('OPT_IN_OUT_TELEMETRY', { isOptedIn });
            dispatch({ type: 'OPT_IN_OUT_TELEMETRY', data: { isOptedIn } });
            telemetry.optInOut(isOptedIn);
          }}
        />
      </label>

      <p className="text-sm">
        {t('settings_dataCollection_desc')}{' '}
        {t('settings_dataCollection_learnMore_text')}{' '}
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
    </>
  );
}

async function handleFirefoxDataCollectionPermission(
  isOptedIn: boolean,
  browser: Browser,
): Promise<boolean> {
  const permission = {
    data_collection: ['technicalAndInteraction' as const],
  };
  if (isOptedIn) {
    const granted = await browser.permissions.request(permission);
    if (!granted) {
      return false;
    }
  } else {
    await browser.permissions.remove(permission);
  }
  return true;
}
