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
import { MessageContextProvider, WaitForStateLoad } from './lib/context';
import { MainLayout } from './components/MainLayout';

export const ROUTES = {
  HOME: '/',
  POST_INSTALL: '/post-install',
} as const;

const routes = [
  {
    element: <MainLayout />,
    children: [
      { path: ROUTES.HOME, lazy: () => import('./pages/Home') },
      { path: ROUTES.POST_INSTALL, lazy: () => import('./pages/PostInstall') },
    ],
  },
] satisfies RouteObject[];

export const App = () => {
  const router = createMemoryRouter(routes);
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
