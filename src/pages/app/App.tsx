import React from 'react';
import {
  BrowserContextProvider,
  TranslationContextProvider,
} from '@/pages/shared/lib/context';
import { MessageContextProvider, WaitForStateLoad } from '@/app/lib/context';
import browser from 'webextension-polyfill';
import {
  createHashRouter,
  RouterProvider,
  type RouteObject,
} from 'react-router-dom';

export const ROUTES = {
  DEFAULT: '/',
} as const;

const routes = [
  {
    path: ROUTES.DEFAULT,
    lazy: () => import('./pages/PostInstall'),
  },
] satisfies RouteObject[];

export const App = () => {
  const router = createHashRouter(routes, {
    basename: '/post-install',
  });
  return (
    <BrowserContextProvider browser={browser}>
      <TranslationContextProvider>
        <MessageContextProvider>
          <WaitForStateLoad>
            <RouterProvider router={router} />
          </WaitForStateLoad>
        </MessageContextProvider>
      </TranslationContextProvider>
    </BrowserContextProvider>
  );
};
