import React from 'react';
import { MainLayout } from '@/popup/components/layout/MainLayout';
import {
  BrowserContextProvider,
  BrowserInfoContextProvider,
  TranslationContextProvider,
} from '@/pages/shared/lib/context';
import { MessageContextProvider, WaitForStateLoad } from '@/popup/lib/context';
import browser from '@/shared/browser';
import { Route, Router, Switch, type AroundNavHandler } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import * as PAGES from './pages/index';

export const ROUTES_PATH = {
  HOME: '/',
  CONNECT_WALLET: '/connect-wallet',
  SETTINGS: '/settings',
  MISSING_HOST_PERMISSION: '/missing-host-permission',
  OUT_OF_FUNDS: '/out-of-funds',
  OUT_OF_FUNDS_ADD_FUNDS: '/out-of-funds/s/add-funds/:recurring?',
  CONSENT_REQUIRED: '/consent-required',
  ERROR_KEY_REVOKED: '/error/key-revoked',
} as const;

const P = ROUTES_PATH;
const C = PAGES;
const Routes = () => (
  <Switch>
    <Route path={P.HOME} component={C.Home} />

    <Route
      path={P.MISSING_HOST_PERMISSION}
      component={C.MissingHostPermission}
    />
    <Route path={P.ERROR_KEY_REVOKED} component={C.ErrorKeyRevoked} />
    <Route path={P.OUT_OF_FUNDS} component={C.OutOfFunds} />
    <Route path={P.OUT_OF_FUNDS_ADD_FUNDS} component={C.OutOfFundsAddFunds} />
    <Route path={P.CONSENT_REQUIRED} component={C.ConsentRequired} />

    <Route path={P.SETTINGS} component={C.Settings} />
    <Route path={P.CONNECT_WALLET} component={C.ConnectWallet} />
  </Switch>
);

const aroundNav: AroundNavHandler = (navigate, to, options) => {
  // In Firefox on Android, `window.close()` stops working if popup has a
  // navigation history. We need `window.close()` to close the popup (when
  // connecting wallet or other actions) to make sure sure user notices tabs
  // opened by the extension.
  // See: https://bugzilla.mozilla.org/show_bug.cgi?id=1963122
  navigate(to, { ...options, replace: true });
};

export const Popup = () => {
  return (
    <BrowserContextProvider browser={browser}>
      <MessageContextProvider>
        <TranslationContextProvider>
          <BrowserInfoContextProvider>
            <WaitForStateLoad>
              <Router hook={useHashLocation} aroundNav={aroundNav}>
                <MainLayout>
                  <Routes />
                </MainLayout>
              </Router>
            </WaitForStateLoad>
          </BrowserInfoContextProvider>
        </TranslationContextProvider>
      </MessageContextProvider>
    </BrowserContextProvider>
  );
};
