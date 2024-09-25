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
import { useTranslation } from '@/popup/lib/context';
import {
  cn,
  errorWithKey,
  isErrorWithKey,
  type ErrorWithKeyLike,
  type ErrorKeys,
} from '@/shared/helpers';
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
  const t = useTranslation();

  const [walletAddressUrl, setWalletAddressUrl] = React.useState<
    Inputs['walletAddressUrl']
  >(defaultValues.walletAddressUrl || '');
  const [amount, setAmount] = React.useState<Inputs['amount']>(
    defaultValues.amount || '5.00',
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

  const handleWalletAddressUrlChange = React.useCallback(
    async (value: string, _input: HTMLInputElement) => {
      setWalletAddressInfo(null);
      setWalletAddressUrl(value);

      const error = validateWalletAddressUrl(value);
      setErrors((_) => ({ ..._, walletAddressUrl: error ? t(error) : '' }));
      if (!error) {
        await getWalletInformation(value);
      }
      saveValue('walletAddressUrl', value);
    },
    [saveValue, getWalletInformation, t],
  );

  const handleAmountChange = React.useCallback(
    (value: string, input: HTMLInputElement) => {
      const error = validateAmount(value, currencySymbol.symbol);
      setErrors((_) => ({ ..._, amount: error ? t(error) : '' }));

      const amountValue = formatNumber(+value, currencySymbol.scale);
      if (!error) {
        setAmount(amountValue);
        input.value = amountValue;
      }
      saveValue('amount', error ? value : amountValue);
    },
    [saveValue, currencySymbol, t],
  );

  const handleSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (!walletAddressInfo) {
      setErrors((_) => ({ ..._, walletAddressUrl: 'Not fetched yet?!' }));
      return;
    }

    const errWalletAddressUrl = validateWalletAddressUrl(walletAddressUrl);
    const errAmount = validateAmount(amount, currencySymbol.symbol);
    if (errAmount || errWalletAddressUrl) {
      setErrors((_) => ({
        ..._,
        walletAddressUrl: errWalletAddressUrl ? t(errWalletAddressUrl) : '',
        amount: errAmount && t(errAmount),
      }));
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
        if (isErrorWithKey(res.error)) {
          const error = res.error;
          if (error.key === 'connectWalletKeyService_error_notImplemented') {
            setErrors((_) => ({ ..._, keyPair: t(error) }));
          } else {
            throw new Error(error.key);
          }
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
      className="flex flex-col gap-4"
      onSubmit={handleSubmit}
    >
      <div className={cn(!!errors.connect && 'sr-only')}>
        <h2 className="text-center text-lg text-strong">
          {t('connectWallet_text_title')}
        </h2>
        <p className="text-center text-sm text-weak">
          {t('connectWallet_text_desc')}
        </p>
      </div>

      {errors.connect && (
        <ErrorMessage error={errors.connect} className="my-0" />
      )}

      <Input
        type="text"
        label={t('connectWallet_label_walletAddress')}
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
          await handleWalletAddressUrlChange(value, ev.currentTarget);
        }}
      />

      <fieldset
        className={cn(
          'space-y-2',
          !walletAddressInfo?.assetCode && 'opacity-75',
        )}
      >
        <legend className="flex items-center px-2 font-medium leading-6 text-medium">
          {t('connectWallet_labelGroup_amount')}
        </legend>
        <div className="flex items-center gap-6">
          <Input
            id="connectAmount"
            type="text"
            inputMode="numeric"
            aria-label={t('connectWallet_label_amount')}
            placeholder="5.00"
            className="max-w-32"
            defaultValue={amount}
            readOnly={!walletAddressInfo?.assetCode}
            addOn={<span className="text-weak">{currencySymbol.symbol}</span>}
            aria-invalid={!!errors.amount}
            aria-describedby={errors.amount}
            required={true}
            onKeyDown={allowOnlyNumericInput}
            onBlur={(ev) => {
              const value = ev.currentTarget.value;
              if (value === amount && !ev.currentTarget.required) {
                return;
              }
              handleAmountChange(value, ev.currentTarget);
            }}
          />

          <Switch
            size="small"
            label={t('connectWallet_label_recurring')}
            defaultChecked={recurring}
            onChange={(ev) => {
              const value = ev.currentTarget.checked;
              setRecurring(value);
              saveValue('recurring', value);
            }}
          />
        </div>

        {errors.amount && (
          <p className="px-2 text-sm text-error">{errors.amount}</p>
        )}
      </fieldset>

      {(errors.keyPair || autoKeyShareFailed) && (
        <ManualKeyPairNeeded
          error={{
            message: t('connectWallet_error_failedAutoKeyAdd'),
            details: errors.keyPair,
            whyText: t('connectWallet_error_failedAutoKeyAddWhy'),
          }}
          hideError={autoKeyShareFailed}
          text={t('connectWallet_label_publicKey')}
          learnMoreText={t('connectWallet_text_publicKeyLearnMore')}
          publicKey={publicKey}
        />
      )}

      <div
        className={cn(
          'space-y-1',
          !errors.keyPair && !autoKeyShareFailed && 'pt-4',
        )}
      >
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
        >
          {t('connectWallet_action_connect')}
        </Button>
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

type ErrorCodeWalletAddressUrl = Extract<
  ErrorKeys,
  `connectWallet_error_url${string}`
>;
type ErrorCodeAmount = Extract<
  ErrorKeys,
  `connectWallet_error_amount${string}`
>;

function validateWalletAddressUrl(
  value: string,
): '' | ErrorWithKeyLike<ErrorCodeWalletAddressUrl> {
  if (!value) {
    return errorWithKey('connectWallet_error_urlRequired');
  }
  let url: URL;
  try {
    url = new URL(toWalletAddressUrl(value));
  } catch {
    return errorWithKey('connectWallet_error_urlInvalidUrl');
  }

  if (url.protocol !== 'https:') {
    return errorWithKey('connectWallet_error_urlInvalidNotHttps');
  }

  return '';
}

function validateAmount(
  value: string,
  currencySymbol: string,
): '' | ErrorWithKeyLike<ErrorCodeAmount> {
  if (!value) {
    return errorWithKey('connectWallet_error_amountRequired');
  }
  const val = Number(value);
  if (Number.isNaN(val)) {
    return errorWithKey('connectWallet_error_amountInvalidNumber', [
      `${currencySymbol}${value}`,
    ]);
  }
  if (val <= 0) {
    return errorWithKey('connectWallet_error_amountMinimum');
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
