import React from 'react';
import { Outlet } from 'react-router-dom';

import { Header } from './Header';

const Divider = () => {
  return <div className="w-100 h-1 bg-divider-gradient" />;
};

export const MainLayout = () => {
  return (
    <div className="flex h-popup w-popup flex-col gap-4 px-6 py-4" id="main">
      <Header />
      <Divider />
      <main className="h-full">
        <Outlet />
      </main>
    </div>
  );
};
