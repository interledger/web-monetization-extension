import React from 'react';
import { useState } from '@/pages/progress-connect/context';
import { useBrowser } from '@/popup/lib/context';
import { Steps } from './Steps';

export function AppFullscreen() {
  const browser = useBrowser();
  const state = useState();

  const Logo = browser.runtime.getURL('assets/images/logo.svg');

  return (
    <div className="m-auto flex h-full w-full max-w-80 flex-col items-center justify-center space-y-2 p-4 text-center">
      <header>
        <img src={Logo} alt="" className="mx-auto mb-2 h-20" />
        <h1 className="text-2xl text-strong">Web Monetization</h1>
        <h2 className="text-lg text-weak">Connecting wallet…</h2>
      </header>
      <main className="w-full space-y-2 pt-2">
        <Steps steps={state.steps} />
        <p className="text-xs text-weak">{state.currentStep.name}…</p>
      </main>
    </div>
  );
}
