import React from 'react';
import { Header } from './Header';

const Divider = () => {
  return <div className="w-100 h-1 bg-divider-gradient" />;
};

export const MainLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    // biome-ignore lint/correctness/useUniqueElementIds: main is unique, as at top-level layout
    <div className="flex h-popup w-popup flex-col gap-4 px-6 py-4" id="main">
      <Header />
      <Divider />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
};
