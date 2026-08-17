import React, { type PropsWithChildren } from 'react';
import type { Browser, Runtime } from 'webextension-polyfill';
import {
  getBrowserName,
  tFactory,
  type BrowserName,
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

// #region BrowserInfo
type BrowserInfo = {
  name: BrowserName;
  ua: string;
  platform: Partial<Runtime.PlatformInfo>;
};

const BrowserInfoContext = React.createContext({} as BrowserInfo);

export const useBrowserInfo = () => React.useContext(BrowserInfoContext);

export const BrowserInfoContextProvider = ({ children }: PropsWithChildren) => {
  const browser = useBrowser();
  const [platform, setPlatform] = React.useState<BrowserInfo['platform']>({});

  const ua = navigator.userAgent;
  const name = getBrowserName(browser, ua);

  React.useEffect(() => {
    browser.runtime.getPlatformInfo().then(setPlatform);
  }, [browser]);

  return (
    <BrowserInfoContext.Provider value={{ name, ua, platform }}>
      {children}
    </BrowserInfoContext.Provider>
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
