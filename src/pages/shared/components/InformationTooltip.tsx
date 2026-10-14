import React from 'react';
import { InfoCircle } from '@/pages/shared/components/Icons';
import { cn } from '@/pages/shared/lib/utils';

export function InformationTooltip({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <span title={text}>
      <InfoCircle
        className={cn(
          'inline-block h-5 w-5 ml-1 -mt-1 text-gray-500',
          className,
        )}
      />
    </span>
  );
}
