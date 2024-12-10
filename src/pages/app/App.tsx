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

export const ROUTES = {
  DEFAULT: '/',
} as const;

const routes = [
  {
    children: [
      { path: ROUTES.DEFAULT, lazy: () => import('./pages/PostInstall') },
    ],
  },
] satisfies RouteObject[];

export const App = () => {
  const router = createMemoryRouter(routes);
  return (
    <BrowserContextProvider browser={browser}>
      <TranslationContextProvider>
        <RouterProvider router={router} />
      </TranslationContextProvider>
    </BrowserContextProvider>
  );
};
