import React from 'react';
import { WarningSign } from '@/popup/components/Icons';

export const NotMonetized = ({ text }: { text: string }) => {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 p-1">
      <div className="flex-shrink-0">
        <WarningSign className="size-10 text-medium" />
      </div>
      <h3 className="text-center text-lg leading-tight text-medium">{text}</h3>
    </div>
  );
};
