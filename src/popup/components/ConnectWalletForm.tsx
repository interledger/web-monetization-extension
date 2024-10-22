import React from 'react';
import { Button } from '@/popup/components/ui/Button';
import { Input } from '@/popup/components/ui/Input';
import { Switch } from '@/popup/components/ui/Switch';
import { Code } from '@/popup/components/ui/Code';
import { ErrorMessage } from '@/popup/components/ErrorMessage';
import { LoadingSpinner } from '@/popup/components/LoadingSpinner';
import { InputAmount, validateAmount } from '@/popup/components/InputAmount';
import { toWalletAddressUrl } from '@/popup/lib/utils';
import { useTranslation } from '@/popup/lib/context';
import {
  cn,
  errorWithKey,
  isErrorWithKey,
  sleep,
  type ErrorWithKeyLike,
} from '@/shared/helpers';
import type { WalletAddress } from '@interledger/open-payments';
import type { ConnectWalletPayload, Response } from '@/shared/messages';
import type { PopupTransientState } from '@/shared/types';

interface Inputs {
  walletAddressUrl: string;
  amount: string;
  recurring: boolean;
  autoKeyAddConsent: boolean;
}

type ErrorInfo = { message: string; info?: ErrorWithKeyLike };
type ErrorsParams = 'walletAddressUrl' | 'amount' | 'keyPair' | 'connect';
type Errors = Record<ErrorsParams, ErrorInfo | null>;

interface ConnectWalletFormProps {
  publicKey: string;
  defaultValues: Partial<Inputs>;
  state?: PopupTransientState['connect'];
  saveValue?: (key: keyof Inputs, val: Inputs[typeof key]) => void;
  getWalletInfo: (walletAddressUrl: string) => Promise<WalletAddress>;
  connectWallet: (data: ConnectWalletPayload) => Promise<Response>;
  clearConnectState: () => Promise<unknown>;
  onConnect?: () => void;
}

export const ConnectWalletForm = ({
  publicKey,
  defaultValues,
  state,
  getWalletInfo,
  connectWallet,
  clearConnectState,
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

  const [autoKeyShareFailed, setAutoKeyShareFailed] = React.useState(
    isAutoKeyAddFailed(state),
  );
  const [showConsent, setShowConsent] = React.useState(false);
  const autoKeyAddConsent = React.useRef<boolean>(
    defaultValues.autoKeyAddConsent || false,
  );

  const resetState = React.useCallback(async () => {
    await clearConnectState();
    setErrors((prev) => ({ ...prev, keyPair: null, connect: null }));
    setAutoKeyShareFailed(false);
  }, [clearConnectState]);

  const toErrorInfo = React.useCallback(
    (err?: string | ErrorWithKeyLike | null): ErrorInfo | null => {
      if (!err) return null;
      if (typeof err === 'string') return { message: err };
      return { message: t(err), info: err };
    },
    [t],
  );

  const [walletAddressInfo, setWalletAddressInfo] =
    React.useState<WalletAddress | null>(null);

  const [errors, setErrors] = React.useState<Errors>({
    walletAddressUrl: null,
    amount: null,
    keyPair: state?.status === 'error:key' ? toErrorInfo(state.error) : null,
    connect: state?.status === 'error' ? toErrorInfo(state.error) : null,
  });
  const [isValidating, setIsValidating] = React.useState({
    walletAddressUrl: false,
    amount: false,
  });
  const [isSubmitting, setIsSubmitting] = React.useState(
    state?.status?.startsWith('connecting') || false,
  );

  const getWalletInformation = React.useCallback(
    async (walletAddressUrl: string): Promise<boolean> => {
      setErrors((prev) => ({ ...prev, walletAddressUrl: null }));
      if (!walletAddressUrl) return false;
      try {
        setIsValidating((_) => ({ ..._, walletAddressUrl: true }));
        const url = new URL(toWalletAddressUrl(walletAddressUrl));
        const walletAddress = await getWalletInfo(url.toString());
        setWalletAddressInfo(walletAddress);
      } catch (error) {
        setErrors((prev) => ({
          ...prev,
          walletAddressUrl: toErrorInfo(error.message),
        }));
        return false;
      } finally {
        setIsValidating((_) => ({ ..._, walletAddressUrl: false }));
      }
      return true;
    },
    [getWalletInfo, toErrorInfo],
  );

  const handleWalletAddressUrlChange = React.useCallback(
    async (value: string, _input?: HTMLInputElement) => {
      setWalletAddressInfo(null);
      setWalletAddressUrl(value);

      const error = validateWalletAddressUrl(value);
      setErrors((prev) => ({ ...prev, walletAddressUrl: toErrorInfo(error) }));
      saveValue('walletAddressUrl', value);
      if (!error) {
        const ok = await getWalletInformation(value);
        return ok;
      }
      return false;
    },
    [saveValue, getWalletInformation, toErrorInfo],
  );

  const handleAmountChange = React.useCallback(
    (amountValue: string) => {
      setErrors((prev) => ({ ...prev, amount: null }));
      setAmount(amountValue);
      saveValue('amount', amountValue);
    },
    [saveValue],
  );

  const handleSubmit = async (ev?: React.FormEvent<HTMLFormElement>) => {
    ev?.preventDefault();

    const errWalletAddressUrl = validateWalletAddressUrl(walletAddressUrl);
    const errAmount = validateAmount(amount, walletAddressInfo!);
    if (errAmount || errWalletAddressUrl) {
      setErrors((prev) => ({
        ...prev,
        walletAddressUrl: toErrorInfo(errWalletAddressUrl),
        amount: toErrorInfo(errAmount),
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
      setErrors((prev) => ({ ...prev, keyPair: null, connect: null }));
      const res = await connectWallet({
        walletAddressUrl: toWalletAddressUrl(walletAddressUrl),
        amount,
        recurring,
        autoKeyAdd: !skipAutoKeyShare,
        autoKeyAddConsent: autoKeyAddConsent.current,
      });
      if (res.success) {
        onConnect();
      } else {
        if (isErrorWithKey(res.error)) {
          const error = res.error;
          if (error.key.startsWith('connectWalletKeyService_error_')) {
            if (error.key === 'connectWalletKeyService_error_noConsent') {
              setShowConsent(true);
              return;
            }
            setErrors((prev) => ({ ...prev, keyPair: toErrorInfo(error) }));
          } else {
            setErrors((prev) => ({ ...prev, connect: toErrorInfo(error) }));
          }
        } else {
          throw new Error(res.message);
        }
      }
    } catch (error) {
      setErrors((prev) => ({ ...prev, connect: toErrorInfo(error.message) }));
    } finally {
      setIsSubmitting(false);
    }
  };

  React.useEffect(() => {
    if (defaultValues.walletAddressUrl) {
      handleWalletAddressUrlChange(defaultValues.walletAddressUrl);
    }
  }, [defaultValues.walletAddressUrl, handleWalletAddressUrlChange]);

  if (showConsent) {
    return (
      <AutoKeyAddConsent
        onAccept={() => {
          autoKeyAddConsent.current = true;
          // saveValue('autoKeyAddConsent', true);
          setShowConsent(false);
          handleSubmit();
        }}
        onDecline={() => {
          const error = errorWithKey('connectWalletKeyService_error_noConsent');
          setErrors((prev) => ({ ...prev, keyPair: toErrorInfo(error) }));
          setShowConsent(false);
        }}
      />
    );
  }

  return (
    <form
      data-testid="connect-wallet-form"
      className="my-auto flex flex-col gap-4"
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
        <ErrorMessage error={errors.connect.message} className="my-0" />
      )}

      <Input
        type="text"
        label={t('connectWallet_label_walletAddress')}
        id="connectWalletAddressUrl"
        placeholder="https://ilp.interledger-test.dev/johndoe"
        errorMessage={errors.walletAddressUrl?.message}
        defaultValue={walletAddressUrl}
        addOn={
          isValidating.walletAddressUrl ? (
            <LoadingSpinner color="gray" size="md" />
          ) : null
        }
        addOnPosition="right"
        required={true}
        autoComplete="on"
        spellCheck={false}
        enterKeyHint="go"
        readOnly={isSubmitting}
        onPaste={async (ev) => {
          const input = ev.currentTarget;
          let value = ev.clipboardData.getData('text');
          if (!value) return;
          if (!validateWalletAddressUrl(value)) {
            ev.preventDefault(); // full url was pasted
            input.value = value;
          } else {
            await sleep(0); // allow paste to be complete
            value = input.value;
          }
          if (value === walletAddressUrl) {
            if (value || !input.required) {
              return;
            }
          }
          const ok = await handleWalletAddressUrlChange(value, input);
          resetState();
          if (ok) document.getElementById('connectAmount')?.focus();
        }}
        onBlur={async (ev) => {
          const value = ev.currentTarget.value;
          if (value === walletAddressUrl) {
            if (value || !ev.currentTarget.required) {
              return;
            }
          }
          await handleWalletAddressUrlChange(value, ev.currentTarget);
          resetState();
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
          <InputAmount
            id="connectAmount"
            label={t('connectWallet_label_amount')}
            labelHidden={true}
            amount={amount}
            walletAddress={
              walletAddressInfo || { assetCode: 'USD', assetScale: 2 }
            }
            errorMessage={errors.amount?.message}
            errorHidden={true}
            readOnly={!walletAddressInfo?.assetCode || isSubmitting}
            onError={(err) => {
              setErrors((prev) => ({ ...prev, amount: toErrorInfo(err) }));
            }}
            onChange={handleAmountChange}
            className="max-w-32"
            placeholder="5.00"
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
          <p className="px-2 text-sm text-error">{errors.amount.message}</p>
        )}
      </fieldset>

      {(errors.keyPair || autoKeyShareFailed) && (
        <ManualKeyPairNeeded
          error={{
            message: t('connectWallet_error_failedAutoKeyAdd'),
            details: errors.keyPair,
            whyText: t('connectWallet_error_failedAutoKeyAddWhy'),
          }}
          retry={resetState}
          hideError={!errors.keyPair}
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
            isSubmitting ||
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

const AutoKeyAddConsent: React.FC<{
  onAccept: () => void;
  onDecline: () => void;
}> = ({ onAccept, onDecline }) => {
  const t = useTranslation();
  return (
    <form
      className="space-y-4 text-center"
      data-testid="connect-wallet-auto-key-consent"
    >
      <p className="text-lg leading-snug text-weak">
        {t('connectWalletKeyService_text_consentP1')}{' '}
        <a
          hidden
          href="https://webmonetization.org"
          className="text-primary hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          {t('connectWalletKeyService_text_consentLearnMore')}
        </a>
      </p>

      <div className="space-y-2 pt-12 text-medium">
        <p>{t('connectWalletKeyService_text_consentP2')}</p>
        <p>{t('connectWalletKeyService_text_consentP3')}</p>
      </div>

      <div className="mx-auto flex w-3/4 justify-around gap-4">
        <Button onClick={onAccept}>
          {t('connectWalletKeyService_label_consentAccept')}
        </Button>
        <Button onClick={onDecline} variant="destructive">
          {t('connectWalletKeyService_label_consentDecline')}
        </Button>
      </div>
    </form>
  );
};

const ManualKeyPairNeeded: React.FC<{
  error: { message: string; details: null | ErrorInfo; whyText: string };
  hideError?: boolean;
  retry: () => Promise<void>;
  text: string;
  learnMoreText: string;
  publicKey: string;
}> = ({ error, hideError, text, learnMoreText, publicKey, retry }) => {
  const ErrorDetails = () => {
    if (!error || !error.details) return null;
    return (
      <details className="group inline-block">
        <summary className="cursor-pointer list-none underline decoration-dotted group-open:sr-only">
          {error.whyText}
        </summary>
        <span>{error.details.message}</span>
        {canRetryAutoKeyAdd(error.details.info) && (
          <button
            type="button"
            onClick={retry}
            className="ml-1 inline-block text-primary underline"
          >
            Try again?
          </button>
        )}
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

function isAutoKeyAddFailed(state: PopupTransientState['connect']) {
  if (state?.status === 'error') {
    return (
      isErrorWithKey(state.error) &&
      state.error.key !== 'connectWallet_error_tabClosed'
    );
  } else if (state?.status === 'error:key') {
    return (
      isErrorWithKey(state.error) &&
      state.error.key.startsWith('connectWalletKeyService_error_')
    );
  }
  return false;
}

function canRetryAutoKeyAdd(err?: ErrorInfo['info']) {
  if (!err) return false;
  return (
    err.key === 'connectWalletKeyService_error_noConsent' ||
    err.cause?.key === 'connectWalletKeyService_error_timeoutLogin' ||
    err.cause?.key === 'connectWalletKeyService_error_accountNotFound'
  );
}

function validateWalletAddressUrl(value: string): null | ErrorWithKeyLike {
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

  return null;
}
