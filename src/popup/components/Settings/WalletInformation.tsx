import React from 'react';
import { useForm } from 'react-hook-form';
import { Input } from '@/popup/components/ui/Input';
import { Label } from '@/popup/components/ui/Label';
import { Code } from '@/popup/components/ui/Code';
import { Button } from '@/popup/components/ui/Button';
import { useMessage } from '@/popup/lib/context';
import type { PopupStore } from '@/shared/types';
import { ArrowBack } from '../Icons';

interface WalletInformationProps {
  publicKey: PopupStore['publicKey'];
  walletAddress: PopupStore['walletAddress'];
}

export const WalletInformation = ({
  publicKey,
  walletAddress,
}: WalletInformationProps) => {
  const message = useMessage();
  const {
    handleSubmit,
    formState: { isSubmitting },
  } = useForm();

  return (
    <div className="flex h-full flex-col gap-8">
      {/* TODO: Improve error handling */}
      <form
        className="space-y-4"
        onSubmit={handleSubmit(async () => {
          await message.send('DISCONNECT_WALLET');
          window.location.reload();
        })}
      >
        <Input
          className="bg-disabled"
          label="Connected wallet address"
          disabled={true}
          readOnly={true}
          value={walletAddress?.id}
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
