import React from 'react'
// import browser from 'webextension-polyfill'
import { useForm } from 'react-hook-form'
import { WarningSign } from '@/popup/components/Icons'
import { Button } from '@/popup/components/ui/Button'
import { checkKeyAuthentication, disconnectWallet } from '@/popup/lib/messages'
import { Label } from './ui/Label'
import { Code } from './ui/Code'
import type { PopupStore } from '@/shared/types'

interface Props {
  info: Pick<PopupStore, 'publicKey' | 'walletAddress'>
  onDisconnect?: () => void
  onKeyAdded?: () => void
}

export const ErrorKeyRevoked = ({ info, onKeyAdded, onDisconnect }: Props) => {
  const {
    handleSubmit,
    formState: { errors, isSubmitting },
    clearErrors,
    setError
  } = useForm({ criteriaMode: 'firstError', mode: 'onSubmit' })

  const requestDisconnect = async () => {
    try {
      await disconnectWallet()
      onDisconnect?.()
    } catch (error) {
      setError('root', { message: error.message })
    }
  }

  const requestReconnect = async () => {
    clearErrors()
    try {
      const res = await checkKeyAuthentication()
      if (res.success) {
        onKeyAdded?.()
      } else {
        setError('root', { message: res.message })
      }
    } catch (error) {
      setError('root', { message: error.message })
    }
  }

  return (
    <div className="text-sm">
      <div className="-mx-2 flex rounded-md bg-error p-4">
        <div className="flex-shrink-0">
          <WarningSign className="size-8 text-error" />
        </div>
        <div className="ml-3 flex flex-col gap-0.5">
          <h3 className="text-base font-medium text-error">Unauthenticated</h3>
          <div>
            <p>
              It appears that the key has been revoked from your wallet.
              Authenticate wallet by adding the key again, or disconnect.
            </p>
          </div>
        </div>
      </div>

      <form
        className="mt-4 h-full space-y-4"
        onReset={handleSubmit(requestDisconnect)}
        onSubmit={handleSubmit(requestReconnect)}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Public key</Label>
            <p className="px-2 text-xs">
              Copy the public key below and paste it into your connected wallet.
              Your wallet address is {info.walletAddress?.id}.
            </p>
            <Code className="text-xs" value={info.publicKey} />
          </div>

          <div className="space-y-1 text-center">
            <p className="text-xs text-gray-400">
              I have added the public key to wallet
            </p>
            <Button
              type="submit"
              variant="default"
              aria-label="Reconnect"
              disabled={isSubmitting}
              loading={isSubmitting}
            >
              Reconnect
            </Button>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-2 text-sm text-gray-500">Or</span>
          </div>
        </div>

        <Button
          type="reset"
          variant="destructive"
          className="mx-auto mt-auto block w-fit"
          aria-label="Disconnect"
          disabled={isSubmitting}
          loading={isSubmitting}
        >
          Disconnect
        </Button>

        {errors?.root?.message && (
          <div className="text-red-500">{errors.root.message}</div>
        )}
      </form>
    </div>
  )
}
