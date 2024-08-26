import React from 'react'
import { WarningSign } from './Icons'
import { cn } from '@/shared/helpers'

interface WarningMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  warning?: string
}
export const WarningMessage = React.forwardRef<
  HTMLDivElement,
  WarningMessageProps
>(({ warning, className, children, ...props }, ref) => {
  if (!warning) return null

  return (
    <div
      {...props}
      ref={ref}
      className={cn(
        'break-word mb-4 flex items-center gap-2 rounded-xl border border-orange-300 bg-orange-500/10 px-3 py-2',
        className,
      )}
    >
      <WarningSign className="size-8 text-orange-500" />
      <div>
        <span>{warning}</span>
        {children}
      </div>
    </div>
  )
})

WarningMessage.displayName = 'WarningMessage'
