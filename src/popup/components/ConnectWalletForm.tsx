import React from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/popup/components/ui/Button';
import { Input } from '@/popup/components/ui/Input';
import { Label } from '@/popup/components/ui/Label';
import { Switch } from '@/popup/components/ui/Switch';
import { Code } from '@/popup/components/ui/Code';
import {
  charIsNumber,
  formatNumber,
  getCurrencySymbol,
  toWalletAddressUrl,
} from '@/popup/lib/utils';
import type { WalletAddress } from '@interledger/open-payments';
import type { Response } from '@/shared/messages';

interface ConnectWalletFormInputs {
  walletAddressUrl: string;
  amount: string;
  recurring: boolean;
}

interface ConnectWalletFormProps {
  publicKey: string;
  defaultValues: Partial<ConnectWalletFormInputs>;
  onChange: (
    key: keyof ConnectWalletFormInputs,
    val: ConnectWalletFormInputs[typeof key],
  ) => void;
  getWalletInfo: (walletAddressUrl: string) => Promise<WalletAddress>;
  connectWallet: (data: ConnectWalletFormInputs) => Promise<Response>;
  onConnect?: () => void;
}

export const ConnectWalletForm = ({
  publicKey,
  defaultValues,
  getWalletInfo,
  onChange,
  connectWallet,
  onConnect = () => {},
}: ConnectWalletFormProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    clearErrors,
    setError,
    setValue,
  } = useForm<ConnectWalletFormInputs>({
    criteriaMode: 'firstError',
    mode: 'onSubmit',
    reValidateMode: 'onBlur',
    defaultValues,
  });
  const [currencySymbol, setCurrencySymbol] = React.useState<{
    symbol: string;
    scale: number;
  }>({ symbol: '$', scale: 2 });

  const getWalletCurrency = React.useCallback(
    async (walletAddressUrl: string): Promise<void> => {
      clearErrors('walletAddressUrl');
      if (!walletAddressUrl) return;
      try {
        const url = new URL(toWalletAddressUrl(walletAddressUrl));
        const walletAddress = await getWalletInfo(url.toString());
        setCurrencySymbol({
          symbol: getCurrencySymbol(walletAddress.assetCode),
          scale: walletAddress.assetScale,
        });
      } catch {
        setError('walletAddressUrl', {
          type: 'validate',
          message: 'Invalid wallet address.',
        });
      }
    },
    [clearErrors, setError, getWalletInfo],
  );

  React.useEffect(() => {
    if (defaultValues.walletAddressUrl) {
      void getWalletCurrency(defaultValues.walletAddressUrl);
    }
  }, [defaultValues.walletAddressUrl, getWalletCurrency]);

  return (
    <form
      onSubmit={handleSubmit(async (data) => {
        const response = await connectWallet({
          ...data,
          walletAddressUrl: toWalletAddressUrl(data.walletAddressUrl),
        });
        if (response.success) {
          return onConnect();
        }
        setError('walletAddressUrl', {
          type: 'validate',
          message: response.message,
        });
      })}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label className="text-base font-medium">Public key</Label>
        <p className="px-2 text-xs">
          Get a wallet address from a provider before connecting it below.
          Please find a list of available wallets{' '}
          <a
            href="https://webmonetization.org/docs/resources/op-wallets/"
            className="text-primary"
            target="_blank"
            rel="noreferrer"
          >
            here
          </a>
          .
          <br /> <br />
          Copy the public key below and paste it into your wallet.
        </p>
        <Code className="text-xs" value={publicKey} />
      </div>
      <Input
        type="text"
        label="Wallet address or payment pointer"
        placeholder="https://ilp.rafiki.money/johndoe"
        errorMessage={errors.walletAddressUrl?.message}
        {...register('walletAddressUrl', {
          required: { value: true, message: 'Wallet address URL is required.' },
          onBlur(e: React.FocusEvent<HTMLInputElement>) {
            const walletAddressUrl = e.currentTarget.value;
            getWalletCurrency(walletAddressUrl);
            onChange('walletAddressUrl', walletAddressUrl);
          },
        })}
      />
      <Input
        type="text"
        inputMode="numeric"
        addOn={currencySymbol.symbol}
        label="Amount"
        description="Enter the amount to use from your wallet."
        placeholder="5.00"
        onKeyDown={(e) => {
          if (
            !charIsNumber(e.key) &&
            e.key !== 'Backspace' &&
            e.key !== 'Delete' &&
            e.key !== 'Tab'
          ) {
            e.preventDefault();
          }
        }}
        errorMessage={errors.amount?.message}
        {...register('amount', {
          required: { value: true, message: 'Amount is required.' },
          valueAsNumber: false,
          onBlur(e: React.FocusEvent<HTMLInputElement>) {
            const val = +e.currentTarget.value;
            const amountValue = formatNumber(val, currencySymbol.scale);
            setValue('amount', amountValue);
            onChange('amount', amountValue);
          },
        })}
      />
      <div className="px-2">
        <Switch
          {...register('recurring', {
            onChange(ev: React.FocusEvent<HTMLInputElement>) {
              onChange('recurring', ev.currentTarget.checked);
            },
          })}
          label="Renew amount monthly"
        />
      </div>
      <Button
        type="submit"
        className="w-full"
        disabled={isSubmitting}
        loading={isSubmitting}
        aria-label="Connect your wallet"
      >
        Connect
      </Button>
    </form>
  );
};
