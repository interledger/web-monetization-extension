import React from 'react';
import { ArrowBack } from '@/pages/shared/components/Icons';
import { Input } from '@/pages/shared/components/ui/Input';
import { Label } from '@/pages/shared/components/ui/Label';
import { Code } from '@/pages/shared/components/ui/Code';
import { Button } from '@/pages/shared/components/ui/Button';
import { toErrorInfoFactory } from '@/pages/shared/lib/utils';
import { useMessage, useTranslation } from '@/popup/lib/context';
import { ROUTES_PATH } from '@/popup/Popup';
import { useLocation } from 'wouter';
import type { PopupStore } from '@/shared/types';

interface WalletInformationProps {
  publicKey: PopupStore['publicKey'];
  walletAddress: PopupStore['walletAddress'];
}

export const WalletInformation = ({
  publicKey,
  walletAddress,
}: WalletInformationProps) => {
  const t = useTranslation();
  const message = useMessage();
  const [_location, navigate] = useLocation();
  const [disconnectError, setDisconnectError] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const toErrorInfo = toErrorInfoFactory(t);

  const disconnectWallet = async (force = false) => {
    setIsSubmitting(true);
    setDisconnectError('');
    try {
      const res = await message.send('DISCONNECT_WALLET', { force });
      if (!res.success) {
        if (res.error) {
          throw new Error(toErrorInfo(res.error)!.message);
        }
        throw new Error(res.message);
      }
      navigate(ROUTES_PATH.HOME);
      window.location.reload();
    } catch (error) {
      setDisconnectError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-8">
      {/* TODO: Improve error handling */}
      <form
        className="space-y-4"
        onSubmit={async (ev) => {
          ev.preventDefault();
          await disconnectWallet();
        }}
      >
        <Input
          className="bg-disabled"
          label="Connected wallet address"
          disabled={true}
          readOnly={true}
          value={walletAddress?.url}
          title={
            walletAddress && walletAddress.id !== walletAddress.url
              ? `Wallet address ID: ${walletAddress.id}`
              : undefined
          }
        />

        <Button
          type="submit"
          variant="destructive"
          className="w-full"
          aria-label="Disconnect your wallet"
          disabled={isSubmitting}
          loading={isSubmitting}
        >
          Disconnect
        </Button>

        {disconnectError && (
          <p className="text-sm text-error !mt-1">
            {disconnectError}
            <button
              type="button"
              onClick={() => disconnectWallet(true)}
              className="ml-1 inline-block underline"
            >
              Force disconnect?
            </button>
          </p>
        )}
      </form>

      <details className="border-t">
        <summary className="flex cursor-pointer items-center justify-between px-2 py-2 text-sm text-weak hover:text-strong">
          <span>Advanced</span>
          <span className="-rotate-90">
            <ArrowBack className="h-4 w-4" />
          </span>
        </summary>
        <div className="space-y-2">
          <Label>Public key</Label>
          <Code className="text-xs" value={publicKey} />
        </div>
      </details>
    </div>
  );
};
