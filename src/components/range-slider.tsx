import * as Slider from '@radix-ui/react-slider'
import React from 'react'

interface IProps {
  min?: number
  max?: number
  value?: number
  step?: number
  title?: string
  onChange: (_value: any) => void
}

const RangeSlider: React.FC<IProps> = ({ min, max, value = 0, step, title, onChange }) => (
  <div className="grid gap-4 w-full">
    {title && <div className="px-2 text-base font-medium text-medium">{title}</div>}
    <Slider.Root
      className="relative flex items-center select-none touch-none w-full h-1"
      defaultValue={[value]}
      max={max}
      min={min}
      onValueCommit={([v]) => onChange(v || 0)}
      step={step}>
      <Slider.Track className="bg-disabled-strong relative grow rounded-full h-[3px]">
        <Slider.Range className="absolute bg-disabled-strong rounded-full h-full" />
      </Slider.Track>
      <Slider.Thumb className="block w-5 h-5 bg-switch-base rounded-[10px]" />
    </Slider.Root>
  </div>
)

export default RangeSlider
