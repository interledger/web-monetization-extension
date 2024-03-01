import React from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { Home } from '@/popup/pages/Home'
import { Settings } from '@/popup/pages/Settings'
import { MainLayout } from './layout/main-layout'

export const ROUTES = {
  INDEX: 'index',
  SETTINGS: 'settings',
}

export const RouterProvider = () => (
  <MemoryRouter basename="popup" initialEntries={['/popup/index']}>
    <Routes>
      <Route path="" element={<MainLayout />}>
        <Route path={ROUTES.SETTINGS} element={<Settings />} />
        <Route path={ROUTES.INDEX} element={<Home />} />
      </Route>
    </Routes>
  </MemoryRouter>
)
