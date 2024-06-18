import React from 'react'
import browser from 'webextension-polyfill'
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
            {browser.i18n.getMessage('siteNotMonetized_title')}
          </h3>
          <div className="space-y-2 text-orange-700">
            <p>{browser.i18n.getMessage('siteNotMonetized_heading')}</p>
            <p>{browser.i18n.getMessage('siteNotMonetized_suggestion')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
