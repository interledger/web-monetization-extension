import React from 'react';
import { Header } from './Header';

const Divider = () => {
  return <div className="w-full h-px bg-divider-gradient" />;
};

export const MainLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    // biome-ignore lint/correctness/useUniqueElementIds: main is unique, as at top-level layout
    <div
      id="main"
      className="flex w-popup min-h-[480px] min-w-[360px] max-h-[90vh] h-auto flex-col gap-4 px-6 py-4 overflow-hidden"
    >
      <Header />
      <Divider />
      <main className="flex flex-1 flex-col overflow-y-auto">{children}</main>
    </div>
  );
}