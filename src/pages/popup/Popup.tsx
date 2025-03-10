import React, { lazy, Suspense } from 'react';
import { MainLayout } from '@/popup/components/layout/MainLayout';
import {
  BrowserContextProvider,
  TranslationContextProvider,
} from '@/pages/shared/lib/context';
import { MessageContextProvider, WaitForStateLoad } from '@/popup/lib/context';
import { Route, Router, Switch } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import browser from 'webextension-polyfill';

export const ROUTES_PATH = {
  HOME: '/',
  CONNECT_WALLET: '/connect-wallet',
  SETTINGS: '/settings',
  MISSING_HOST_PERMISSION: '/missing-host-permission',
  OUT_OF_FUNDS: '/out-of-funds',
  OUT_OF_FUNDS_ADD_FUNDS: '/out-of-funds/s/add-funds/:recurring?',
  ERROR_KEY_REVOKED: '/error/key-revoked',
} as const;

const Routes = () => {
  const R = ROUTES_PATH;
  return (
    <Suspense>
      <Switch>
        <Route path={R.HOME} component={lazy(() => import('./pages/Home'))} />

        <Route
          path={R.MISSING_HOST_PERMISSION}
          component={lazy(() => import('./pages/MissingHostPermission'))}
        />
        <Route
          path={R.ERROR_KEY_REVOKED}
          component={lazy(() => import('./pages/ErrorKeyRevoked'))}
        />
        <Route
          path={R.OUT_OF_FUNDS}
          component={lazy(() => import('./pages/OutOfFunds'))}
        />
        <Route
          path={R.OUT_OF_FUNDS_ADD_FUNDS}
          component={lazy(() => import('./pages/OutOfFunds_AddFunds'))}
        />
        <Route
          path={R.SETTINGS}
          component={lazy(() => import('./pages/Settings'))}
        />
        <Route
          path={R.CONNECT_WALLET}
          component={lazy(() => import('./pages/ConnectWallet'))}
        />
      </Switch>
    </Suspense>
  );
};

export const Popup = () => {
  return (
    <>
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
    </>
  );
};
