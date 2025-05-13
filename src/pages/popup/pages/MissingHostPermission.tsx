import React from 'react';
import { WarningSign } from '@/pages/shared/components/Icons';
import { useBrowser, useTranslation } from '@/popup/lib/context';

export default () => {
  const browser = useBrowser();
  const t = useTranslation();
  return (
    <div
      className="rounded-md bg-orange-50 p-4 text-sm"
      data-user-action="required"
    >
      <div className="flex">
        <div className="flex-shrink-0">
          <WarningSign className="size-8 text-orange-500" />
        </div>
        <div className="ml-3 flex flex-col gap-2">
          <h3 className="font-medium text-orange-800">Permission needed</h3>
          <div className="text-orange-700">
            <p>{t('missingHostPermission_state_text')}</p>
          </div>
        </div>
      </div>
      <button
        type="button"
        className="mx-auto mt-3 block w-fit rounded-md bg-orange-100 px-2 py-1.5 font-medium text-orange-800 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2 focus:ring-offset-orange-50"
        onClick={() => {
          const origins = browser.runtime.getManifest().host_permissions!;
          return browser.permissions.request({ origins }).finally(() => {
            // So we open popup with refreshed state, avoiding additional message passing.
            // Firefox closes popup automatically.
            window.close();
          });
        }}
      >
        Grant permission
      </button>
    </div>
  );
};
