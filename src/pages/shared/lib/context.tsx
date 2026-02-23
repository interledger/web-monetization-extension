import React, { type PropsWithChildren } from 'react';
import { PostHog } from 'posthog-js/dist/module.no-external';
import { POSTHOG_KEY, POSTHOG_HOST } from '@/shared/defines';
import type { Browser, Runtime } from 'webextension-polyfill';
import {
  getBrowserName,
  tFactory,
  type BrowserName,
  type ErrorWithKeyLike,
  type Translation,
} from '@/shared/helpers';
import type { Storage } from '@/shared/types';

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

// #region Telemetry

// Reduce dependency on full PostHog SDK as we only wish to use a few things.
type Telemetry = {
  capture: PostHog['capture'];
  captureException: PostHog['captureException'];
  optInOut: (isOptedIn: boolean) => void;
  register: (
    properties: Parameters<PostHog['register']>[0],
  ) => ReturnType<PostHog['register']>;
};

const mockTelemetry: Telemetry = {
  capture: () => void 0,
  captureException: () => void 0,
  optInOut: () => {},
  register: () => void 0,
};
const TelemetryContext = React.createContext<Telemetry>(mockTelemetry);

const setupPosthog = (distinctId: string, isOptedIn: boolean) => {
  return new PostHog().init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    opt_out_capturing_by_default: !isOptedIn,
    opt_out_persistence_by_default: true,
    autocapture: true,
    capture_pageview: 'history_change',
    capture_pageleave: 'if_capture_pageview',
    persistence: 'localStorage',
    bootstrap: {
      distinctID: distinctId,
      // Prevent fetching feature flags.
      featureFlags: {},
      featureFlagPayloads: {},
      // We don't identify users, so marks as identified to avoid API requests.
      isIdentifiedID: true,
    },
    before_send(event) {
      if (!event) return null;
      // We use hash-based routing, so ensure hashes are tracked.
      if (event.properties?.$current_url) {
        const parsed = new URL(event.properties.$current_url);
        if (parsed.hash) {
          event.properties.$pathname = parsed.pathname + parsed.hash;
        }
      }
      return event;
    },
    disable_external_dependency_loading: true,
    disable_session_recording: true,
    disable_surveys: true,
    capture_performance: false,
    capture_heatmaps: false,
    // Prevent fetching flags and along with it, any remote config.
    advanced_disable_flags: true,
  });
};

export const TelemetryContextProvider = ({
  uid,
  continuousPaymentsEnabled,
  isOptedIn,
  children,
}: React.PropsWithChildren<{
  uid: string;
  continuousPaymentsEnabled?: Storage['continuousPaymentsEnabled'];
  isOptedIn?: Storage['consentTelemetry'];
}>) => {
  const browser = useBrowser();
  if (!POSTHOG_KEY) {
    // biome-ignore lint/suspicious/noConsole: It is always added in production builds, so it's safe. Warning here helps us debug better.
    console.warn('PostHog key not found. Telemetry will not be enabled.');
    return (
      <TelemetryContext.Provider value={mockTelemetry}>
        {children}
      </TelemetryContext.Provider>
    );
  }

  // While isOptedIn is undefined or false, we won't capture data.
  const posthog = setupPosthog(uid, isOptedIn === true);
  const { name, version, version_name } = browser.runtime.getManifest();
  posthog.register({
    app_name: name,
    version,
    version_name,
    continuousPaymentsEnabled,
  });

  const telemetry: Telemetry = {
    capture: posthog.capture.bind(posthog),
    captureException: posthog.captureException.bind(posthog),
    optInOut(isOptedIn) {
      if (isOptedIn) {
        posthog.opt_in_capturing();
      } else {
        posthog.opt_out_capturing();
      }
    },
    register(properties) {
      return posthog.register(properties);
    },
  };

  return (
    <TelemetryContext.Provider value={telemetry}>
      {children}
    </TelemetryContext.Provider>
  );
};

export const useTelemetry = () => React.useContext(TelemetryContext);
// #endregion
