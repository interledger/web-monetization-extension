import React from 'react'
// import browser from 'webextension-polyfill'
import { WarningSign } from '@/popup/components/Icons'

export const ErrorKeyRevoked = () => {
  return (
    <div className="rounded-md bg-orange-50 p-4 text-sm">
      <div className="flex">
        <div className="flex-shrink-0">
          <WarningSign className="size-8 text-orange-500" />
        </div>
        <div className="ml-3 flex flex-col gap-2">
          <h3 className="font-medium text-orange-800">Disconnected</h3>
          <div className="text-orange-700">
            <p>It appears that your key has been revoked.</p>
          </div>
        </div>
      </div>
      <button
        type="button"
        className="mx-auto mt-3 block w-fit rounded-md bg-orange-100 px-2 py-1.5 font-medium text-orange-800 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2 focus:ring-offset-orange-50"
        onClick={() => {
          // todo
        }}
      >
        Reconnect
      </button>
    </div>
  )
}
