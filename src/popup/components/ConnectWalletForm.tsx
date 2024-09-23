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
import type { ConnectWalletPayload, Response } from '@/shared/messages';

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
  connectWallet: (data: ConnectWalletPayload) => Promise<Response>;
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
  const [autoKeyShareFailed, setAutoKeyShareFailed] = React.useState(false);

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

  const getWalletInformation = React.useCallback(
    async (walletAddressUrl: string): Promise<void> => {
      setErrors((_) => ({ ..._, walletAddressUrl: '' }));
      if (!walletAddressUrl) return;
      try {
        setIsValidating((_) => ({ ..._, walletAddressUrl: true }));
        const url = new URL(toWalletAddressUrl(walletAddressUrl));
        const walletAddress = await getWalletInfo(url.toString());
        setWalletAddressInfo(walletAddress);
      } catch (error) {
        setErrors((_) => ({ ..._, walletAddressUrl: error.message }));
      } finally {
        setIsValidating((_) => ({ ..._, walletAddressUrl: false }));
      }
    },
    [getWalletInfo],
  );

  const handleSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const err = {
      walletAddressUrl: validateWalletAddressUrl(walletAddressUrl),
      amount: validateAmount(amount, currencySymbol.symbol),
    };
    if (!walletAddressInfo) {
      setErrors((_) => ({ ..._, walletAddressUrl: 'Not fetched yet?!' }));
      return;
    }
    setErrors((_) => ({ ..._, ...err }));
    if (err.amount || err.walletAddressUrl) {
      return;
    }

    try {
      setIsSubmitting(true);
      let skipAutoKeyShare = autoKeyShareFailed;
      if (errors.keyPair) {
        skipAutoKeyShare = true;
        setAutoKeyShareFailed(true);
      }
      setErrors((_) => ({ ..._, keyPair: '', connect: '' }));
      const res = await connectWallet({
        walletAddressUrl: toWalletAddressUrl(walletAddressUrl),
        amount,
        recurring,
        skipAutoKeyShare,
      });
      if (res.success) {
        onConnect();
      } else {
        if (res.message.startsWith('ADD_PUBLIC_KEY_TO_WALLET:')) {
          const message = res.message.replace('ADD_PUBLIC_KEY_TO_WALLET:', '');
          setErrors((_) => ({ ..._, keyPair: message }));
        } else {
          throw new Error(res.message);
        }
      }
    } catch (error) {
      setErrors((_) => ({ ..._, connect: error.message }));
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
      void getWalletInformation(defaultValues.walletAddressUrl);
    }
  }, [defaultValues.walletAddressUrl, getWalletInformation]);

  return (
    <form
      data-testid="connect-wallet-form"
      className="space-y-4"
      onSubmit={handleSubmit}
    >
      <div
        className="pb-4"
        hidden={!!errors.keyPair || autoKeyShareFailed || !!errors.connect}
      >
        <h2 className="text-center text-lg text-strong">
          {"Let's get you set up!"}
        </h2>
        <p className="text-center text-sm text-weak">{`Just a few quick steps to connect the extension to your wallet`}</p>
      </div>

      {errors.connect && <ErrorMessage error={errors.connect} />}

      <Input
        type="text"
        label="Enter your wallet address or payment pointer"
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
        onBlur={async (ev) => {
          const value = ev.currentTarget.value;
          if (value === walletAddressUrl) {
            if (value || !ev.currentTarget.required) {
              return;
            }
          }
          setWalletAddressInfo(null);
          setWalletAddressUrl(value);

          const error = validateWalletAddressUrl(value);
          setErrors((_) => ({ ..._, walletAddressUrl: error }));
          if (!error) {
            await getWalletInformation(value);
          }
          saveValue('walletAddressUrl', value);
        }}
      />

      <fieldset
        className={cn(
          'space-y-2',
          !walletAddressInfo?.assetCode && 'opacity-75',
        )}
      >
        <legend className="sr-only">Amount</legend>
        <Input
          id="connectAmount"
          type="text"
          inputMode="numeric"
          label="Enter the amount to allocate from your wallet"
          placeholder="5.00"
          defaultValue={amount}
          readOnly={!walletAddressInfo?.assetCode}
          addOn={<span className="text-weak">{currencySymbol.symbol}</span>}
          errorMessage={errors.amount}
          required={true}
          onKeyDown={allowOnlyNumericInput}
          onBlur={(ev) => {
            const value = ev.currentTarget.value;
            if (value === amount && !ev.currentTarget.required) {
              return;
            }

            const error = validateAmount(value, currencySymbol.symbol);
            setErrors((_) => ({ ..._, amount: error }));

            const amountValue = formatNumber(+value, currencySymbol.scale);
            if (!error) {
              setAmount(amountValue);
              ev.currentTarget.value = amountValue;
            }
            saveValue('amount', error ? value : amountValue);
          }}
        />

        <div className="px-2">
          <Switch
            size="small"
            label="Renew monthly"
            defaultChecked={recurring}
            onChange={(ev) => {
              const value = ev.currentTarget.checked;
              setRecurring(value);
              saveValue('recurring', value);
            }}
          />
        </div>
      </fieldset>

      {(errors.keyPair || autoKeyShareFailed) && (
        <ManualKeyPairNeeded
          error={{
            message: `We couldn't automatically share the key-pair with your provider.`,
            details: errors.keyPair,
            whyText: `Why?`,
          }}
          hideError={autoKeyShareFailed}
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
            !!errors.walletAddressUrl ||
            !walletAddressUrl ||
            !amount
          }
          loading={isSubmitting}
          aria-label="Connect your wallet"
        >
          Connect
        </Button>

        {!errors.keyPair && !autoKeyShareFailed && (
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
  error: { message: string; details: string; whyText: string };
  hideError?: boolean;
  text: string;
  learnMoreText: string;
  publicKey: string;
}> = ({ error, hideError, text, learnMoreText, publicKey }) => {
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
    <div className="border-weak space-y-1 border-t pt-2">
      {!hideError && (
        <div className="px-2 text-xs text-error" role="alert">
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
    return 'Wallet address is required.';
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
    return 'Please provide a valid number as amount.';
  }
  if (val <= 0) {
    return `An amount greater than ${currencySymbol}${val} is required.`;
  }
  return '';
}

function allowOnlyNumericInput(ev: React.KeyboardEvent<HTMLInputElement>) {
  if (
    (!charIsNumber(ev.key) &&
      ev.key !== 'Backspace' &&
      ev.key !== 'Delete' &&
      ev.key !== 'Tab') ||
    (ev.key === '.' && ev.currentTarget.value.includes('.'))
  ) {
    ev.preventDefault();
  }
}
