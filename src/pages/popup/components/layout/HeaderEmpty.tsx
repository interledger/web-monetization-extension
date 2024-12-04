import React from 'react';

export const HeaderEmpty = ({
  logo,
  children,
}: React.PropsWithChildren<{ logo: string }>) => {
  return (
    <header className="flex h-8 flex-row items-center justify-between">
      <div className="flex flex-row items-center gap-3">
        <img src={logo} alt="Web Monetization Logo" className="h-6" />
        <p className="text-xl text-strong">Web Monetization</p>
      </div>
      <div className="flex flex-row items-center gap-3">{children}</div>
    </header>
  );
};
