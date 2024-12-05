import React from 'react';
import { HeaderEmpty } from '@/popup/components/layout/HeaderEmpty';
import { LoadingSpinner } from '@/pages/shared/components/LoadingSpinner';
import { Countdown } from '@/pages/progress-connect/components/Countdown';
import { useState } from '@/pages/progress-connect/context';
import { useBrowser } from '@/popup/lib/context';

export function AppNotification() {
  const browser = useBrowser();
  const { currentStep } = useState();

  const logo = browser.runtime.getURL('assets/images/logo.svg');

  return (
    <div className="flex-col space-y-2 border-base p-4">
      <HeaderEmpty logo={logo} />
      <div className="w-100 h-1 bg-divider-gradient" />
      <main className="flex h-full items-center gap-2 pt-2">
        <LoadingSpinner color="gray" />
        <p className="text-lg">
          {currentStep.name}…
          {currentStep.status === 'active' && currentStep.expiresAt && (
            <Countdown
              expiresAt={currentStep.expiresAt}
              className="ml-2 text-base text-weak"
            />
          )}
        </p>
      </main>
    </div>
  );
}
