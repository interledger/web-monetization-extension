import { MainLayout } from '@/popup/components/layout/MainLayout'
import { PopupContextProvider } from './lib/context'
import { LazyMotion, domAnimation } from 'framer-motion'
import React from 'react'
import { ProtectedRoute } from '@/popup/components/ProtectedRoute'
import {
  RouteObject,
  RouterProvider,
  createMemoryRouter
} from 'react-router-dom'

export const ROUTES_PATH = {
  HOME: '/',
  SETTINGS: '/settings',
  MISSING_HOST_PERMISSION: '/missing-host-permission'
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
            lazy: () => import('./pages/Home')
          }
        ]
      },
      {
        children: [
          {
            path: ROUTES_PATH.MISSING_HOST_PERMISSION,
            lazy: () => import('./pages/MissingHostPermission')
          },
          {
            path: ROUTES_PATH.SETTINGS,
            lazy: () => import('./pages/Settings')
          }
        ]
      }
    ]
  }
] satisfies RouteObject[]

const router = createMemoryRouter(routes)

export const Popup = () => {
  return (
    <LazyMotion features={domAnimation} strict>
      <PopupContextProvider>
        <RouterProvider router={router} />
      </PopupContextProvider>
    </LazyMotion>
  )
}
