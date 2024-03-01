import { MainLayout } from '@/popup/components/layout/main-layout'
import { PopupContextProvider } from './lib/context'

import React from 'react'
import { ProtectedRoute } from '@/popup/components/ProtectedRoute'
import { RouteObject, RouterProvider, createMemoryRouter } from 'react-router-dom'

export const ROUTES_PATH = {
  HOME: '/',
  SETTINGS: '/settings',
} as const

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
            path: ROUTES_PATH.SETTINGS,
            lazy: () => import('./pages/Settings'),
          },
        ],
      },
    ],
  },
] satisfies RouteObject[]

const router = createMemoryRouter(routes)

export const Popup = () => {
  return (
    <PopupContextProvider>
      <RouterProvider router={router} />
    </PopupContextProvider>
  )
}
