import { useMessage } from '@/popup/lib/context';
import { Button } from '@/pages/shared/components/ui/Button';
import React from 'react';
import { WarningSign } from '@/pages/shared/components/Icons';

export default () => {
  const message = useMessage();
  return (
    <div className="space-y-4 text-base" data-user-action="required">
      <div className="flex gap-2 rounded-md bg-error p-2">
        <WarningSign className="size-6 text-error" />
        <h3 className="text-base font-medium text-error">
          Consent Required: Data Collection & Transmission
        </h3>
      </div>

      <p className="">
        We want to be transparent about what data is shared and how it’s used.
      </p>

      <p className="pt-2">
        To use the the Web Monetization Extension, we require your consent to
        our data collection & transmission policy.
      </p>

      <Button
        type="button"
        onClick={() =>
          message.send('OPEN_APP', { path: '/post-install/consent' })
        }
      >
        View Policy
      </Button>
    </div>
  );
};
