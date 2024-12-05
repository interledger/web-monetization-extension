import React, { type PropsWithChildren } from 'react';
import type { Browser } from 'webextension-polyfill';
import {
  tFactory,
  type ErrorWithKeyLike,
  type Translation,
} from '@/shared/helpers';

// #region Browser
const BrowserContext = React.createContext<Browser>({} as Browser);

export const useBrowser = () => React.useContext(BrowserContext);

export const BrowserContextProvider = ({
  browser,
  children,
}: PropsWithChildren<{ browser: Browser }>) => {
  return (
    <BrowserContext.Provider value={browser}>
      {children}
    </BrowserContext.Provider>
  );
};
// #endregion

// #region Translation
const TranslationContext = React.createContext<Translation>(
  (v: string | ErrorWithKeyLike) => (typeof v === 'string' ? v : v.key),
);

export const useTranslation = () => React.useContext(TranslationContext);

export const TranslationContextProvider = ({ children }: PropsWithChildren) => {
  const browser = useBrowser();
  const t = tFactory(browser);

  return (
    <TranslationContext.Provider value={t}>
      {children}
    </TranslationContext.Provider>
  );
};
// #endregion
