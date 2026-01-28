import React from 'react';
import {
  BrowserContextProvider,
  BrowserInfoContextProvider,
  TranslationContextProvider,
} from '@/pages/shared/lib/context';
import browser from '@/shared/browser';
import { MessageContextProvider, WaitForStateLoad } from '@/app/lib/context';
import { Route, Router, Switch } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import * as PAGES from './pages/index';

export const ROUTES = {
  DEFAULT: '/',
  CONSENT: '/consent',
} as const;

const P = ROUTES;
const C = PAGES;
const Routes = () => (
  <Switch>
    <Route path={P.DEFAULT} component={C.PostInstall} />
    <Route path={P.CONSENT} component={C.Consent} />
  </Switch>
);

export const App = () => {
  return (
    <BrowserContextProvider browser={browser}>
      <TranslationContextProvider>
        <MessageContextProvider>
          <BrowserInfoContextProvider>
            <WaitForStateLoad>
              <Router hook={useHashLocation} base="/post-install">
                <Routes />
              </Router>
            </WaitForStateLoad>
          </BrowserInfoContextProvider>
        </MessageContextProvider>
      </TranslationContextProvider>
    </BrowserContextProvider>
  );
};
