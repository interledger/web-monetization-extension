import React from 'react';
import { useTranslation } from '@/pages/shared/lib/context';

export const HeaderEmpty = ({
  logo,
  children,
}: React.PropsWithChildren<{ logo: string }>) => {
  const t = useTranslation();
  return (
    <header className="flex h-8 flex-row items-center justify-between">
      <div className="flex flex-row items-center gap-3">
        <img src={logo} alt="" className="h-6" />
        <p className="text-xl text-strong">{t('header_brand_text')}</p>
      </div>
      <div className="flex flex-row items-center gap-3">{children}</div>
    </header>
  );
};
