import { MainLayout } from '@/popup/components/layout/MainLayout';
import {
  BrowserContextProvider,
  TranslationContextProvider,
} from '@/pages/shared/lib/context';
import { MessageContextProvider, WaitForStateLoad } from '@/popup/lib/context';
import React from 'react';
import browser from 'webextension-polyfill';
import { ProtectedRoute } from '@/popup/components/ProtectedRoute';
import {
  type RouteObject,
  RouterProvider,
  createMemoryRouter,
} from 'react-router-dom';

export const ROUTES_PATH = {
  HOME: '/',
  CONNECT_WALLET: '/connect-wallet',
  SETTINGS: '/settings',
  MISSING_HOST_PERMISSION: '/missing-host-permission',
  OUT_OF_FUNDS: '/out-of-funds',
  OUT_OF_FUNDS_ADD_FUNDS: '/out-of-funds/s/add-funds',
  ERROR_KEY_REVOKED: '/error/key-revoked',
} as const;

export const routes = [
  {
    element: <MainLayout />,
    children: [
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: ROUTES_PATH.HOME,
            lazy: () => import('./pages/Home'),
          },
        ],
      },
      {
        children: [
          {
            path: ROUTES_PATH.MISSING_HOST_PERMISSION,
            lazy: () => import('./pages/MissingHostPermission'),
          },
          {
            path: ROUTES_PATH.ERROR_KEY_REVOKED,
            lazy: () => import('./pages/ErrorKeyRevoked'),
          },
          {
            path: ROUTES_PATH.OUT_OF_FUNDS,
            lazy: () => import('./pages/OutOfFunds'),
          },
          {
            path: ROUTES_PATH.OUT_OF_FUNDS_ADD_FUNDS,
            lazy: () => import('./pages/OutOfFunds_AddFunds'),
          },
          {
            path: ROUTES_PATH.SETTINGS,
            lazy: () => import('./pages/Settings'),
          },
          {
            path: ROUTES_PATH.CONNECT_WALLET,
            lazy: () => import('./pages/ConnectWallet'),
          },
        ],
      },
    ],
  },
] satisfies RouteObject[];

const router = createMemoryRouter(routes);

export const Popup = () => {
  return (
    <>
      <BrowserContextProvider browser={browser}>
        <MessageContextProvider>
          <TranslationContextProvider>
            <WaitForStateLoad>
              <RouterProvider router={router} />
            </WaitForStateLoad>
          </TranslationContextProvider>
        </MessageContextProvider>
      </BrowserContextProvider>
    </>
  );
};
