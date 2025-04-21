import React from 'react';
import { Button } from './Button';
import { CheckIcon, ClipboardIcon } from '../Icons';
import { cn } from '@/pages/shared/lib/utils';

interface CodeProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export const Code = ({ value, className, ...props }: CodeProps) => {
  return (
    <div
      className={cn(
        'flex items-center justify-between break-all rounded-xl bg-disabled px-4 py-4 text-sm text-disabled',
        className,
      )}
      {...props}
    >
      <code className="overflow-hidden text-ellipsis whitespace-nowrap">
        {value}
      </code>
      <CopyButton value={value} />
    </div>
  );
};

interface CopyButtonProps extends React.HTMLAttributes<HTMLButtonElement> {
  value: string;
}

const CopyButton = ({ value, ...props }: CopyButtonProps) => {
  const [hasCopied, setHasCopied] = React.useState(false);

  React.useEffect(() => {
    if (hasCopied === true) {
      setTimeout(() => {
        setHasCopied(false);
      }, 2000);
    }
  }, [hasCopied]);

  return (
    <Button
      {...props}
      aria-label="copy"
      variant="ghost"
      size="icon"
      className="rounded-sm text-primary"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setHasCopied(true);
      }}
    >
      {hasCopied ? (
        <CheckIcon className="h-6 w-6" />
      ) : (
        <ClipboardIcon className="h-6 w-6" />
      )}
    </Button>
  );
};
