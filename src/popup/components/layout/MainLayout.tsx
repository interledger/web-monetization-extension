import React from 'react'
import { Outlet } from 'react-router-dom'

import { Header } from './Header'

const Divider = () => {
  return <div className="bg-divider-gradient w-100 h-1" />
}

export const MainLayout = () => {
  return (
    <div className="space-y-4 w-popup h-popup border-base px-6 py-4">
      <Header />
      <Divider />
      <main>
        <Outlet />
      </main>
    </div>
  )
}
