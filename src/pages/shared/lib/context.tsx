import React, { type PropsWithChildren } from 'react';
import { PostHog } from 'posthog-js/dist/module.no-external';
import { POSTHOG_KEY, POSTHOG_HOST } from '@/shared/defines';
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

// #region Telemetry
type Telemetry = Pick<PostHog, 'capture' | 'captureException'>;
const mockTelemetry: Telemetry = {
  capture: () => void 0,
  captureException: () => void 0,
};
const TelemetryContext = React.createContext<Telemetry>(mockTelemetry);

export const TelemetryContextProvider = ({
  children,
}: React.PropsWithChildren) => {
  const posthog = new PostHog().init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    disable_external_dependency_loading: true,
    disable_session_recording: true,
    disable_surveys: true,
    capture_heatmaps: true,
    capture_pageview: true,
    autocapture: true,
    before_send: (event) => {
      if (!event) return null;
      if (event.properties?.$current_url) {
        const parsed = new URL(event.properties.$current_url);
        if (parsed.hash) {
          event.properties.$pathname = parsed.pathname + parsed.hash;
        }
      }
      return event;
    },
    persistence: 'localStorage',
    bootstrap: {
      distinctID: '9de05dc6-e256-4625-9115-2aed1c2c7e2f',
    },
  });

  // posthog.consent.optInOut(false)

  return (
    <TelemetryContext.Provider value={posthog}>
      {children}
    </TelemetryContext.Provider>
  );
};

export const useTelemetry = () => React.useContext(TelemetryContext);
// #endregion
