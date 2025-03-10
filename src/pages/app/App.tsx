import React, { lazy, Suspense } from 'react';
import {
  BrowserContextProvider,
  TranslationContextProvider,
} from '@/pages/shared/lib/context';
import { MessageContextProvider, WaitForStateLoad } from '@/app/lib/context';
import browser from 'webextension-polyfill';
import { Route, Router, Switch } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';

export const ROUTES = {
  DEFAULT: '/',
} as const;

const Routes = () => {
  return (
    <Suspense>
      <Switch>
        <Route
          path={ROUTES.DEFAULT}
          component={lazy(() => import('./pages/PostInstall'))}
        />
      </Switch>
    </Suspense>
  );
};

export const App = () => {
  return (
    <BrowserContextProvider browser={browser}>
      <TranslationContextProvider>
        <MessageContextProvider>
          <WaitForStateLoad>
            <Router hook={useHashLocation} base="/post-install">
              <Routes />
            </Router>
          </WaitForStateLoad>
        </MessageContextProvider>
      </TranslationContextProvider>
    </BrowserContextProvider>
  );
};
