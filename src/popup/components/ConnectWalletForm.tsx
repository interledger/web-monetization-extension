import React from 'react';
import { Button } from '@/popup/components/ui/Button';
import { Input } from '@/popup/components/ui/Input';
import { Switch } from '@/popup/components/ui/Switch';
import { Code } from '@/popup/components/ui/Code';
import { ErrorMessage } from '@/popup/components/ErrorMessage';
import { LoadingSpinner } from '@/popup/components/LoadingSpinner';
import {
  charIsNumber,
  formatNumber,
  getCurrencySymbol,
  toWalletAddressUrl,
} from '@/popup/lib/utils';
import { cn } from '@/shared/helpers';
import type { WalletAddress } from '@interledger/open-payments';
import type { Response } from '@/shared/messages';

interface Inputs {
  walletAddressUrl: string;
  amount: string;
  recurring: boolean;
}

interface ConnectWalletFormProps {
  publicKey: string;
  defaultValues: Partial<Inputs>;
  saveValue?: (key: keyof Inputs, val: Inputs[typeof key]) => void;
  getWalletInfo: (walletAddressUrl: string) => Promise<WalletAddress>;
  connectWallet: (data: Inputs) => Promise<Response>;
  onConnect?: () => void;
}

export const ConnectWalletForm = ({
  publicKey,
  defaultValues,
  getWalletInfo,
  connectWallet,
  saveValue = () => {},
  onConnect = () => {},
}: ConnectWalletFormProps) => {
  const [walletAddressUrl, setWalletAddressUrl] = React.useState<
    Inputs['walletAddressUrl']
  >(defaultValues.walletAddressUrl || '');
  const [amount, setAmount] = React.useState<Inputs['amount']>(
    defaultValues.amount || '',
  );
  const [recurring, setRecurring] = React.useState<Inputs['recurring']>(
    defaultValues.recurring || false,
  );

  const [walletAddressInfo, setWalletAddressInfo] =
    React.useState<WalletAddress | null>(null);

  const [errors, setErrors] = React.useState({
    walletAddressUrl: '',
    amount: '',
    keyPair: '',
    connect: '',
  });
  const [isValidating, setIsValidating] = React.useState({
    walletAddressUrl: false,
    amount: false,
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [currencySymbol, setCurrencySymbol] = React.useState<{
    symbol: string;
    scale: number;
  }>({ symbol: '$', scale: 2 });

  const getWalletCurrency = React.useCallback(
    async (walletAddressUrl: string): Promise<void> => {
      setErrors((e) => ({ ...e, walletAddressUrl: '' }));
      if (!walletAddressUrl) return;
      try {
        setIsValidating((e) => ({ ...e, walletAddressUrl: true }));
        setWalletAddressInfo(null);
        const url = new URL(toWalletAddressUrl(walletAddressUrl));
        const walletAddress = await getWalletInfo(url.toString());
        setWalletAddressInfo(walletAddress);
      } catch (error) {
        setErrors((e) => ({
          ...e,
          walletAddressUrl: error.message,
        }));
      } finally {
        setIsValidating((e) => ({ ...e, walletAddressUrl: false }));
      }
    },
    [getWalletInfo],
  );

  const handleSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const errors = {
      walletAddressUrl: validateWalletAddressUrl(walletAddressUrl),
      amount: validateAmount(amount, currencySymbol.symbol),
    };
    setErrors((e) => ({ ...e, ...errors }));
    if (errors.amount || errors.walletAddressUrl) {
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await connectWallet({
        walletAddressUrl: toWalletAddressUrl(walletAddressUrl),
        amount,
        recurring,
      });
      if (res.success) {
        onConnect();
      } else {
        throw new Error(res.message);
      }
    } catch (error) {
      setErrors((e) => ({ ...e, connect: error.message }));
    } finally {
      setIsSubmitting(false);
    }
  };

  React.useEffect(() => {
    if (!walletAddressInfo) return;
    setCurrencySymbol({
      symbol: getCurrencySymbol(walletAddressInfo.assetCode),
      scale: walletAddressInfo.assetScale,
    });
  }, [walletAddressInfo]);

  React.useEffect(() => {
    if (defaultValues.walletAddressUrl) {
      void getWalletCurrency(defaultValues.walletAddressUrl);
    }
  }, [defaultValues.walletAddressUrl, getWalletCurrency]);

  return (
    <form
      data-testid="connect-wallet-form"
      className="space-y-4"
      onSubmit={handleSubmit}
    >
      <div className="pb-4" hidden={!!errors.keyPair || !!errors.connect}>
        <h2 className="text-center text-lg text-strong">
          {"Let's get you set up!"}
        </h2>
        <p className="text-center text-sm text-weak">{`Just a few quick steps to connect the extension to your wallet`}</p>
      </div>

      {errors.connect && <ErrorMessage error={errors.connect} />}

      <div className="space-y-2">
        <Input
          type="text"
          label="Wallet address or payment pointer"
          id="connectWalletAddressUrl"
          placeholder="https://ilp.rafiki.money/johndoe"
          errorMessage={errors.walletAddressUrl}
          defaultValue={walletAddressUrl}
          addOn={
            isValidating.walletAddressUrl ? (
              <LoadingSpinner color="gray" size="md" />
            ) : null
          }
          addOnPosition="right"
          required={true}
          autoComplete="on"
          onBlur={async (e) => {
            const value = e.currentTarget.value;
            if (value === walletAddressUrl) {
              if (value || !e.currentTarget.required) {
                return;
              }
            }
            setWalletAddressUrl(value);

            const error = validateWalletAddressUrl(value);
            setErrors((e) => ({ ...e, walletAddressUrl: error }));
            if (!error) {
              await getWalletCurrency(value);
            }
            saveValue('walletAddressUrl', value);
          }}
        />
      </div>

      <fieldset
        className={cn(
          'space-y-2',
          !walletAddressInfo?.assetCode && 'opacity-75',
        )}
      >
        <legend className="sr-only">Amount to allocate from your wallet</legend>
        <Input
          id="connectAmount"
          type="text"
          inputMode="numeric"
          label="Amount"
          placeholder="5.00"
          defaultValue={amount}
          disabled={!walletAddressInfo?.assetCode}
          addOn={currencySymbol.symbol}
          errorMessage={errors.amount}
          required={true}
          onKeyDown={(e) => {
            if (
              (!charIsNumber(e.key) &&
                e.key !== 'Backspace' &&
                e.key !== 'Delete' &&
                e.key !== 'Tab') ||
              (e.key === '.' && e.currentTarget.value.includes('.'))
            ) {
              e.preventDefault();
            }
          }}
          onBlur={(e) => {
            const value = e.currentTarget.value;
            if (value === amount && !e.currentTarget.required) {
              return;
            }

            const error = validateAmount(value, currencySymbol.symbol);
            setErrors((e) => ({ ...e, amount: error }));

            const amountValue = formatNumber(+value, currencySymbol.scale);
            if (!error) {
              setAmount(amountValue);
              e.currentTarget.value = amountValue;
            }
            saveValue('amount', error ? value : amountValue);
          }}
        />

        <div className="px-2">
          <Switch
            size="small"
            label="Renew monthly"
            defaultChecked={recurring}
            onChange={(ev: React.FocusEvent<HTMLInputElement>) => {
              const value = ev.currentTarget.checked;
              setRecurring(value);
              saveValue('recurring', value);
            }}
          />
        </div>
      </fieldset>

      {errors.keyPair && (
        <ManualKeyPairNeeded
          error={{
            message: `We couldn't automatically share the key-pair with your provider.`,
            details: errors.keyPair,
            whyText: `Why?`,
          }}
          text={`Please copy this key and paste it into your wallet manually and then connect.`}
          learnMoreText={`Learn more.`}
          publicKey={publicKey}
        />
      )}

      <div className={cn('space-y-1', !errors.keyPair && 'pt-4')}>
        <Button
          type="submit"
          className="w-full"
          disabled={
            isValidating.amount ||
            isValidating.walletAddressUrl ||
            !!errors.amount ||
            !!errors.walletAddressUrl
          }
          loading={isSubmitting}
          aria-label="Connect your wallet"
        >
          Connect
        </Button>

        {!errors.keyPair && (
          <AutomaticKeyPairNote
            text={`We'll automatically add a key-pair with your wallet provider.`}
            learnMoreText={`Learn more`}
          />
        )}
      </div>
    </form>
  );
};

const ManualKeyPairNeeded: React.FC<{
  error?: { message: string; details: string; whyText: string } | null;
  text: string;
  learnMoreText: string;
  publicKey: string;
}> = ({ error, text, learnMoreText, publicKey }) => {
  const ErrorDetails = () => {
    if (!error) return null;
    return (
      <details className="group inline-block">
        <summary className="cursor-pointer list-none underline decoration-dotted group-open:sr-only">
          {error.whyText}
        </summary>
        <span>{error.details}</span>
      </details>
    );
  };

  return (
    <div className="space-y-1">
      {error && (
        <div
          className="border-weak border-t px-2 pt-2 text-xs text-error"
          role="alert"
        >
          <span>{error.message}</span> <ErrorDetails />
        </div>
      )}
      <p className="px-2 text-left text-xs">
        {text}{' '}
        <a
          href="https://webmonetization.org/docs/resources/op-wallets/"
          className="text-primary"
          target="_blank"
          rel="noreferrer"
        >
          {learnMoreText}
        </a>
      </p>
      <Code className="text-xs" value={publicKey} />
    </div>
  );
};

const AutomaticKeyPairNote: React.FC<{
  text: string;
  learnMoreText: string;
}> = ({ text, learnMoreText }) => {
  return (
    <p className="text-center text-xs text-weak">
      {text}
      <br />
      <a
        href="https://webmonetization.org"
        className="text-primary"
        target="_blank"
        rel="noreferrer"
      >
        {learnMoreText}
      </a>
    </p>
  );
};

function validateWalletAddressUrl(value: string): string {
  if (!value) {
    return 'Wallet address URL is required.';
  }
  let url: URL;
  try {
    url = new URL(toWalletAddressUrl(value));
  } catch {
    return 'Invalid wallet address URL.';
  }

  if (url.protocol !== 'https:') {
    return 'Wallet address must be a https:// URL or a payment pointer.';
  }

  return '';
}

function validateAmount(value: string, currencySymbol: string): string {
  if (!value) {
    return 'Amount is required.';
  }
  const val = Number(value);
  if (Number.isNaN(val)) {
    return 'Amount must be a number.';
  }
  if (val <= 0) {
    return `Amount must be greater than ${currencySymbol}${val}.`;
  }
  return '';
}
