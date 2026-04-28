import React from 'react';
import { Header } from './Header';

const Divider = () => {
  return <div className="w-100 h-1 bg-divider-gradient" />;
};

export const MainLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div
      className="flex h-popup max-h-screen w-popup touch:w-full touch:h-screen flex-col gap-4 px-6 touch:px-4 py-4 overflow-hidden @container"
      id="main"
    >
      <Header />
      <Divider />
      <main className="flex flex-1 flex-col overflow-y-auto">{children}</main>
    </div>
  );
};
