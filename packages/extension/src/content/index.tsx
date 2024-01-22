import { runtime } from 'webextension-polyfill';

import { initMonetizationTagManager } from '@/utils/monetizationTagManager';
import { wm2Polyfill } from '@/utils/polyfill';

import { loadObserver } from './linksObserver';
import MessageListener from './messageListener';

// import "./content.css";

runtime.onMessage.addListener(MessageListener);

function inject(configure: (_script: HTMLScriptElement) => void) {
  const script = document.createElement('script');
  configure(script);
  document.documentElement.appendChild(script);
  // document.documentElement.removeChild(script)
}

// eslint-disable-next-line @typescript-eslint/no-extra-semi
(function injectCode(code: string) {
  inject(script => (script.innerHTML = code));
})(wm2Polyfill);

loadObserver();
initMonetizationTagManager();
