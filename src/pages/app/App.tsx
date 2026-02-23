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
  DEFAULT: '/post-install',
  CONSENT: '/post-install/consent',
  POST_CONNECT: '/post-connect',
} as const;

const P = ROUTES;
const C = PAGES;
const Routes = () => (
  <Switch>
    <Route path={P.DEFAULT} component={C.PostInstall} />
    <Route path={P.CONSENT} component={C.Consent} />
    <Route path={P.POST_CONNECT} component={C.PostConnect} />
  </Switch>
);

export const App = () => {
  return (
    <BrowserContextProvider browser={browser}>
      <TranslationContextProvider>
        <MessageContextProvider>
          <BrowserInfoContextProvider>
            <WaitForStateLoad>
              <Router hook={useHashLocation}>
                <Routes />
              </Router>
            </WaitForStateLoad>
          </BrowserInfoContextProvider>
        </MessageContextProvider>
      </TranslationContextProvider>
    </BrowserContextProvider>
  );
};
