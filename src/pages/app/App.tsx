import React from 'react';
import {
  BrowserContextProvider,
  TranslationContextProvider,
} from '@/pages/shared/lib/context';
import { MessageContextProvider, WaitForStateLoad } from '@/app/lib/context';
import browser from 'webextension-polyfill';
import { Route, Router, Switch } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import * as PAGES from './pages/index';

export const ROUTES = {
  DEFAULT: '/',
} as const;

const P = ROUTES;
const C = PAGES;
const Routes = () => (
  <Switch>
    <Route path={P.DEFAULT} component={C.PostInstall} />
  </Switch>
);

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
