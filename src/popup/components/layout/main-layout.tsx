import React from 'react'
import { Outlet } from 'react-router-dom'

import { Header } from './Header'

const Divider = () => {
  return <div className="bg-divider-gradient w-100 h-1" />
}

export const MainLayout = () => {
  return (
    <div className="flex flex-col gap-8 w-popup h-popup border-base px-6 pt-8">
      <Header />
      <Divider />
      <main>
        <Outlet />
      </main>
    </div>
  )
}
