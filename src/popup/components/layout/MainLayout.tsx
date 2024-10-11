import React from 'react';
import { Outlet } from 'react-router-dom';

import { Header } from './Header';

const Divider = () => {
  return <div className="w-100 h-1 bg-divider-gradient" />;
};

export const MainLayout = () => {
  return (
    <div
      className="flex h-popup w-popup flex-col"
      id="main"
      style={{
        backgroundImage: `url("https://webmonetization.org/img/bg-tile.svg")`,
      }}
    >
      <div className="space-y-4 bg-white px-6 py-4">
        <Header />
        <Divider />
      </div>
      <main className="h-full px-6 pb-4 pt-8">
        <Outlet />
      </main>
    </div>
  );
};
