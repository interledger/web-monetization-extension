import React from 'react'

import { cn } from '@/shared/helpers'

import { Button } from './Button'
import { CheckIcon, ClipboardIcon } from '../Icons'

interface CodeProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

export const Code = ({ value, className, ...props }: CodeProps) => {
  return (
    <div
      className={cn(
        'flex items-center justify-between text-sm rounded-xl px-4 bg-nav-active py-4 text-medium break-all',
        className
      )}
      {...props}
    >
      <code className="text-ellipsis overflow-hidden whitespace-nowrap">
        {value}
      </code>
      <CopyButton value={value} />
    </div>
  )
}

interface CopyButtonProps extends React.HTMLAttributes<HTMLButtonElement> {
  value: string
}

const CopyButton = ({ value, ...props }: CopyButtonProps) => {
  const [hasCopied, setHasCopied] = React.useState(false)

  React.useEffect(() => {
    if (hasCopied === true) {
      setTimeout(() => {
        setHasCopied(false)
      }, 2000)
    }
  }, [hasCopied])

  return (
    <Button
      {...props}
      aria-label="copy"
      variant="ghost"
      size="icon"
      className="text-primary rounded-sm"
      onClick={() => {
        navigator.clipboard.writeText(value)
        setHasCopied(true)
      }}
    >
      {hasCopied ? (
        <CheckIcon className="h-6 w-6" />
      ) : (
        <ClipboardIcon className="h-6 w-6" />
      )}
    </Button>
  )
}
