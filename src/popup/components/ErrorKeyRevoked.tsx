import React from 'react'
// import browser from 'webextension-polyfill'
import { useForm } from 'react-hook-form'
import { WarningSign } from '@/popup/components/Icons'
import { Button } from '@/popup/components/ui/Button'
import { disconnectWallet } from '@/popup/lib/messages'

export const ErrorKeyRevoked = () => {
  const {
    handleSubmit,
    formState: { errors, isSubmitting },
    clearErrors,
    setError
  } = useForm({ criteriaMode: 'firstError', mode: 'onSubmit' })

  return (
    <form
      onSubmit={handleSubmit(async () => {
        clearErrors()
        try {
          await disconnectWallet()
        } catch (error) {
          setError('root', { message: error.message })
        }
      })}
    >
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
        <Button
          type="submit"
          className="mx-auto mt-3 block w-fit rounded-md bg-orange-100 px-2 py-1.5 font-medium text-orange-800 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2 focus:ring-offset-orange-50"
          aria-label="Reconnect"
          disabled={isSubmitting}
          loading={isSubmitting}
        >
          Reconnect
        </Button>

        {errors?.root?.message && (
          <div className="text-red-500">{errors.root.message}</div>
        )}
      </div>
    </form>
  )
}
