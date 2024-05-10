import React from 'react'
import { XIcon } from './Icons'
import { cn } from '@/shared/helpers'

interface ErrorMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  error?: string
}
export const ErrorMessage = React.forwardRef<HTMLDivElement, ErrorMessageProps>(
  ({ error, className, ...props }, ref) => {
    if (!error) return null

    return (
      <div
        {...props}
        ref={ref}
        className={cn(
          'break-word mb-4 flex items-center gap-2 rounded-xl border border-red-300 bg-red-500/10 px-3 py-2',
          className
        )}
      >
        <XIcon className="size-8 text-red-500" />
        <span>{error}</span>
      </div>
    )
  }
)

ErrorMessage.displayName = 'ErrorMessage'
