import React from 'react';
import { MainLayout } from '@/popup/components/layout/MainLayout';
import {
  BrowserContextProvider,
  TranslationContextProvider,
} from '@/pages/shared/lib/context';
import { MessageContextProvider, WaitForStateLoad } from '@/popup/lib/context';
import { Route, Router, Switch } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import browser from 'webextension-polyfill';
import * as PAGES from './pages/index';

export const ROUTES_PATH = {
  HOME: '/',
  CONNECT_WALLET: '/connect-wallet',
  SETTINGS: '/settings',
  MISSING_HOST_PERMISSION: '/missing-host-permission',
  OUT_OF_FUNDS: '/out-of-funds',
  OUT_OF_FUNDS_ADD_FUNDS: '/out-of-funds/s/add-funds/:recurring?',
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

    <Route path={P.SETTINGS} component={C.Settings} />
    <Route path={P.CONNECT_WALLET} component={C.ConnectWallet} />
  </Switch>
);

export const Popup = () => {
  return (
    <BrowserContextProvider browser={browser}>
      <MessageContextProvider>
        <TranslationContextProvider>
          <WaitForStateLoad>
            <Router hook={useHashLocation}>
              <MainLayout>
                <Routes />
              </MainLayout>
            </Router>
          </WaitForStateLoad>
        </TranslationContextProvider>
      </MessageContextProvider>
    </BrowserContextProvider>
  );
};
