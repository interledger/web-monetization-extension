import React from 'react';
import { ArrowBack } from '@/pages/shared/components/Icons';
import { Input } from '@/pages/shared/components/ui/Input';
import { Label } from '@/pages/shared/components/ui/Label';
import { Code } from '@/pages/shared/components/ui/Code';
import { Button } from '@/pages/shared/components/ui/Button';
import { useMessage } from '@/popup/lib/context';
import type { PopupStore } from '@/shared/types';

interface WalletInformationProps {
  publicKey: PopupStore['publicKey'];
  walletAddress: PopupStore['walletAddress'];
}

export const WalletInformation = ({
  publicKey,
  walletAddress,
}: WalletInformationProps) => {
  const message = useMessage();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  return (
    <div className="flex h-full flex-col gap-8">
      {/* TODO: Improve error handling */}
      <form
        className="space-y-4"
        onSubmit={async (ev) => {
          ev.preventDefault();
          setIsSubmitting(true);
          await message.send('DISCONNECT_WALLET');
          window.location.reload();
        }}
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
