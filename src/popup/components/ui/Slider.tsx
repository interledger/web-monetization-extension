import React, { forwardRef } from 'react'

import { cn } from '@shared/helpers'

export interface SliderProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  errorMessage?: string
  disabled?: boolean
  icon?: React.ReactNode
  min?: number
  max?: number
  value?: number
  onChange?: (_event: React.ChangeEvent<HTMLInputElement>) => void
}

const sliderClasses = `
  [&::-webkit-slider-thumb]:appearance-none
  [&::-webkit-slider-thumb]:w-5
  [&::-webkit-slider-thumb]:h-5
  [&::-webkit-slider-thumb]:bg-switch-base
  [&::-webkit-slider-thumb]:rounded-full
  [&::-moz-range-thumb]:appearance-none
  [&::-moz-range-thumb]:w-5
  [&::-moz-range-thumb]:h-5
  [&::-moz-range-thumb]:bg-switch-base
  [&::-moz-range-thumb]:rounded-full
  [&::-webkit-slider-thumb]:disabled:bg-disabled-strong
  w-full h-1 bg-disabled-strong rounded-lg
  appearance-none cursor-pointer dark:bg-disabled-strong
`

export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider(
  {
    errorMessage,
    value = 0,
    className,
    onChange = () => {},
    disabled,
    ...props
  },
  ref
) {
  return (
    <div className="w-full">
      <div className="flex h-1 items-center">
        <input
          ref={ref}
          type="range"
          className={sliderClasses + cn(className)}
          disabled={disabled ?? false}
          aria-disabled={disabled ?? false}
          aria-invalid={!!errorMessage}
          aria-describedby={errorMessage}
          value={disabled ? 0 : value}
          onChange={onChange}
          {...props}
        />
      </div>

      {errorMessage && (
        <p className="px-2 text-sm text-error">{errorMessage}</p>
      )}
    </div>
  )
})
