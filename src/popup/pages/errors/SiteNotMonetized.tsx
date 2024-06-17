import React from 'react'
import { WarningSign } from '@/popup/components/Icons'

export const Component = () => {
  return (
    <div className="rounded-md bg-orange-50 p-4 text-sm">
      <div className="flex">
        <div className="flex-shrink-0">
          <WarningSign className="size-8 text-orange-500" />
        </div>
        <div className="ml-3 flex flex-col gap-2">
          <h3 className="font-medium text-orange-800">
            Website is not monetized
          </h3>
          <div className="space-y-2 text-orange-700">
            <p>This website does not support Web Monetization.</p>
            <p>
              Help monetize the open web by asking the website owner to add Web
              Monetization support!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
