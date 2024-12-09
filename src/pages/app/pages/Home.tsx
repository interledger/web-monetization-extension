import React from 'react';
import { HeaderEmpty } from '@/popup/components/layout/HeaderEmpty';
import { useBrowser } from '@/app/lib/context';

export const Component = () => {
  const browser = useBrowser();
  const logo = browser.runtime.getURL('assets/images/logo.svg');

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-2">
      <header>
        <HeaderEmpty logo={logo} />
      </header>
      <p>
        Access the extension from the{' '}
        <button
          className="font-semibold text-secondary-dark underline"
          onClick={() => browser.action.openPopup({})}
        >
          browser menu
        </button>
      </p>
    </div>
  );
};
