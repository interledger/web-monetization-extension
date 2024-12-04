import React from 'react';
import {
  BrowserContextProvider,
  TranslationContextProvider,
} from '@/pages/shared/lib/context';
import browser from 'webextension-polyfill';
import {
  createMemoryRouter,
  RouterProvider,
  type RouteObject,
} from 'react-router-dom';
import { MessageContextProvider } from './lib/context';

export const ROUTES_PATH = {
  HOME: '/',
  POST_INSTALL: '/post-install',
} as const;

export const routes = [
  {
    children: [
      {
        path: ROUTES_PATH.HOME,
        lazy: () => import('./pages/Home'),
      },
      {
        path: ROUTES_PATH.POST_INSTALL,
        lazy: () => import('./pages/PostInstall'),
      },
    ],
  },
] satisfies RouteObject[];

export const App = () => {
  const router = createMemoryRouter(routes);
  return (
    <BrowserContextProvider browser={browser}>
      <TranslationContextProvider>
        <MessageContextProvider>
          <RouterProvider router={router} />
        </MessageContextProvider>
      </TranslationContextProvider>
    </BrowserContextProvider>
  );
};
