import React, { forwardRef } from 'react'

import { cn } from '@/utils/cn'

export interface SliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
  errorMessage?: string
  disabled?: boolean
  icon?: React.ReactNode
  min?: number
  max?: number
  value?: number
  defaultValue?: number
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider(
  { errorMessage, defaultValue, value, disabled, ...props },
  ref,
) {
  const [innerValue, setInnerValue] = React.useState<number>(value || defaultValue || 0)

  return (
    <div className="w-100">
      <input
        ref={ref}
        type="range"
        className={cn(
          `[&::-webkit-slider-thumb]:appearance-none
        [&::-webkit-slider-thumb]:w-5
        [&::-webkit-slider-thumb]:h-5
        [&::-webkit-slider-thumb]:bg-switch-base
        [&::-webkit-slider-thumb]:rounded-full
        [&::-moz-range-thumb]:appearance-none
        [&::-moz-range-thumb]:w-5
        [&::-moz-range-thumb]:h-5
        [&::-moz-range-thumb]:bg-switch-base
        [&::-moz-range-thumb]:rounded-full
        w-full h-1 bg-disabled-strong rounded-lg appearance-none cursor-pointer dark:bg-disabled-strong`,
          innerValue === 0 &&
            '[&::-webkit-slider-thumb]:bg-disabled-strong [&::-moz-range-thumb]:bg-disabled-strong',
        )}
        disabled={disabled ?? false}
        aria-disabled={disabled ?? false}
        aria-invalid={!!errorMessage}
        aria-describedby={errorMessage}
        defaultValue={defaultValue}
        value={innerValue}
        onChange={e => setInnerValue(Number(e.target.value))}
        {...props}
      />
      {innerValue}

      {errorMessage && <p className="text-error text-sm px-2">{errorMessage}</p>}
    </div>
  )
})
