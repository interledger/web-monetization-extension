import React from 'react';
import { XIcon } from './Icons';
import { cn } from '@/pages/shared/lib/utils';

interface ErrorMessageProps extends React.ComponentPropsWithRef<'div'> {
  error?: string;
}
export const ErrorMessage = ({
  error,
  className,
  children,
  ref,
  ...props
}: ErrorMessageProps) => {
  if (!error) return null;

  return (
    <div
      {...props}
      data-testid="ErrorMessage"
      ref={ref}
      className={cn(
        'break-word mb-4 flex items-center gap-2 rounded-xl border border-red-300 bg-red-500/10 px-3 py-2',
        className,
      )}
      role="alert"
    >
      <XIcon className="size-8 text-red-500" />
      <div>
        <span>{error}</span>
        {children}
      </div>
    </div>
  );
};

ErrorMessage.displayName = 'ErrorMessage';
