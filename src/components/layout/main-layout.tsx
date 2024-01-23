import React from 'react'
import { Outlet } from 'react-router-dom'

import { Header } from './header'

const Divider = () => {
  return <div className="mb-8 bg-divider-gradient w-100 h-1" />
}

export const MainLayout = () => {
  return (
    <div className="flex flex-col w-popup h-popup border-base px-6">
      <Header />
      <Divider />
      <main>
        <Outlet />
      </main>
    </div>
  )
}
