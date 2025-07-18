import React from 'react';
import { Button } from '@/pages/shared/components/ui/Button';
import { Input } from '@/pages/shared/components/ui/Input';
import { Switch } from '@/pages/shared/components/ui/Switch';
import { Code } from '@/pages/shared/components/ui/Code';
import { ErrorMessage } from '@/pages/shared/components/ErrorMessage';
import { LoadingSpinner } from '@/pages/shared/components/LoadingSpinner';
import { AutoKeyAddConsent } from '@/pages/shared/components/AutoKeyAddConsent';
import {
  InputAmount,
  validateAmount,
} from '@/pages/shared/components/InputAmount';
import {
  cn,
  formatNumber,
  toErrorInfoFactory,
  type ErrorInfo,
} from '@/pages/shared/lib/utils';
import { useTranslation } from '@/popup/lib/context';
import { deepClone } from 'valtio/utils';
import {
  errorWithKey,
  isErrorWithKey,
  sleep,
  toWalletAddressUrl,
  type ErrorWithKeyLike,
} from '@/shared/helpers';
import type {
  ConnectWalletPayload,
  ConnectWalletAddressInfo,
  Response,
} from '@/shared/messages';
import type { DeepReadonly, PopupTransientState } from '@/shared/types';

interface Inputs {
  walletAddressUrl: string;
  amount: string;
  recurring: boolean;
  autoKeyAddConsent: boolean;
}

type ConnectTransientState = DeepReadonly<PopupTransientState['connect']>;
type ErrorsParams = 'walletAddressUrl' | 'amount' | 'keyPair' | 'connect';
type Errors = Record<ErrorsParams, ErrorInfo | null>;

type OnInputHandler = NonNullable<
  React.DOMAttributes<HTMLInputElement>['onInput']
>;

interface ConnectWalletFormProps {
  publicKey: string;
  defaultValues: Partial<Inputs>;
  state?: ConnectTransientState;
  walletAddressPlaceholder?: string;
  saveValue?: (key: keyof Inputs, val: Inputs[typeof key]) => void;
  getWalletInfo: (
    walletAddressUrl: string,
  ) => Promise<ConnectWalletAddressInfo>;
  connectWallet: (data: ConnectWalletPayload) => Promise<Response>;
  clearConnectState: () => Promise<unknown>;
  onConnect?: () => void;
}

export const ConnectWalletForm = ({
  publicKey,
  defaultValues,
  state,
  walletAddressPlaceholder = 'https://walletprovider.com/MyWallet',
  getWalletInfo,
  connectWallet,
  clearConnectState,
  saveValue = () => {},
  onConnect = () => {},
}: ConnectWalletFormProps) => {
  const t = useTranslation();
  const toErrorInfo = React.useMemo(() => toErrorInfoFactory(t), [t]);

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

  const [walletAddressInfo, setWalletAddressInfo] =
    React.useState<ConnectWalletAddressInfo | null>(null);

  const [errors, setErrors] = React.useState<Errors>({
    walletAddressUrl: null,
    amount: null,
    keyPair:
      state?.status === 'error:key'
        ? toErrorInfo(deepClone(state.error))
        : null,
    connect:
      state?.status === 'error' ? toErrorInfo(deepClone(state.error)) : null,
  });
  const [isValidating, setIsValidating] = React.useState({
    walletAddressUrl: false,
    amount: false,
  });
  const [isSubmitting, setIsSubmitting] = React.useState(
    state?.status?.startsWith('connecting') || false,
  );

  const handleAmountChange = React.useCallback(
    (amountValue: string, input?: HTMLInputElement) => {
      setErrors((prev) => ({ ...prev, amount: null }));
      setAmount(amountValue);
      if (input && Number(amountValue) > 0) {
        input.dataset.modified = '1';
      }
      saveValue('amount', amountValue);
    },
    [saveValue],
  );

  const getWalletInformation = React.useCallback(
    async (walletAddressUrl: string): Promise<boolean> => {
      setErrors((prev) => ({ ...prev, walletAddressUrl: null }));
      if (!walletAddressUrl) return false;
      try {
        setIsValidating((_) => ({ ..._, walletAddressUrl: true }));
        const url = new URL(toWalletAddressUrl(walletAddressUrl));
        const walletInfo = await getWalletInfo(url.toString());
        setWalletAddressInfo(walletInfo);
        const defaultBudget = formatNumber(
          walletInfo.defaultBudget,
          walletInfo.walletAddress.assetScale,
        );
        const inputEl = document.querySelector<HTMLInputElement>(
          'input#connectAmount',
        );
        if (
          inputEl &&
          (!inputEl.dataset.modified ||
            !inputEl.value ||
            inputEl.ariaInvalid === 'true')
        ) {
          setErrors((prev) => ({ ...prev, amount: null }));
          inputEl.defaultValue = defaultBudget;
          inputEl.value = defaultBudget;
          setAmount(defaultBudget);
          saveValue('amount', defaultBudget);
        }
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
    [getWalletInfo, saveValue, toErrorInfo],
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

  const onWalletAddressInput: OnInputHandler = React.useCallback(
    (event) => {
      const input = event.currentTarget;
      const ev = event.nativeEvent as InputEvent;
      const value = ev.data ?? input.value; // Chrome doesn't fire InputEvent on autocomplete!
      if (
        !value ||
        (ev.inputType && ev.inputType !== 'insertReplacementText')
      ) {
        return; // not autocomplete
      }
      if (validateWalletAddressUrl(value)) {
        return; // not valid data from autocomplete, fallback to input blur based behavior
      }
      if (value === walletAddressUrl) {
        if (value || !input.required) {
          return;
        }
      }
      // use as autocompleted value
      void handleWalletAddressUrlChange(value, input).then((ok) => {
        resetState();
        if (ok) document.getElementById('connectAmount')?.focus();
      });
    },
    [handleWalletAddressUrlChange, resetState, walletAddressUrl],
  );

  const handleSubmit = async (ev?: React.FormEvent<HTMLFormElement>) => {
    ev?.preventDefault();

    let walletAddressInput = walletAddressUrl;
    if (ev) {
      // When submitting form using Enter key on wallet address input, we want
      // to ensure its current value is same as the value we've in React state
      // (as state is not set until input field blur). If it's not same, we
      // validate it before connecting.
      const form = ev.currentTarget;
      if (
        form.connectWalletAddressUrl &&
        walletAddressInput !== form.connectWalletAddressUrl.value
      ) {
        walletAddressInput = form.connectWalletAddressUrl.value;
        const ok = await handleWalletAddressUrlChange(
          walletAddressInput,
          form.connectWalletAddressUrl,
        );
        if (!ok) return;
        // above call will not immediately set `walletAddressUrl` state
        // variable, so we get latest value via `walletAddress` variable.
      }
    }

    const walletInfo =
      walletAddressInfo ??
      (await getWalletInfo(toWalletAddressUrl(walletAddressUrl)));

    const amountInput = document.querySelector<HTMLInputElement>(
      'input#connectAmount',
    )!;
    const amount = amountInput.value;

    const errWalletAddressUrl = validateWalletAddressUrl(walletAddressInput);
    const errAmount = validateAmount(amount, walletInfo!.walletAddress);
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
        walletAddress: walletInfo.walletAddress,
        amount,
        rateOfPay: walletInfo.defaultRateOfPay,
        maxRateOfPay: walletInfo.maxRateOfPay,
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
        onAccept={async () => {
          autoKeyAddConsent.current = true;
          setShowConsent(false);
          await sleep(200);
          await handleSubmit();
        }}
        onDecline={() => {
          const error = errorWithKey('connectWalletKeyService_error_noConsent');
          setErrors((prev) => ({ ...prev, keyPair: toErrorInfo(error) }));
          setShowConsent(false);
        }}
        intent="CONNECT_WALLET"
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
        placeholder={walletAddressPlaceholder}
        errorMessage={errors.walletAddressUrl?.message}
        defaultValue={walletAddressUrl}
        trailingAddOn={
          isValidating.walletAddressUrl ? (
            <LoadingSpinner color="gray" size="md" />
          ) : null
        }
        required={true}
        autoComplete="on"
        spellCheck={false}
        enterKeyHint="go"
        readOnly={isSubmitting}
        onInput={onWalletAddressInput}
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

      <fieldset className="space-y-2">
        <legend className="flex items-center px-2 font-medium leading-6 text-medium">
          {t('connectWallet_labelGroup_amount')}
        </legend>
        <div className="flex items-center gap-6">
          <AmountInput
            amount={amount}
            isSubmitting={isSubmitting}
            walletAddressInfo={walletAddressInfo}
            onAmountChange={handleAmountChange}
            error={errors.amount}
            onError={(err) => {
              setErrors((prev) => ({ ...prev, amount: toErrorInfo(err) }));
            }}
          />

          <Switch
            size="small"
            label={t('connectWallet_label_recurring')}
            defaultChecked={recurring}
            disabled={isSubmitting}
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
          loadingText={
            state?.status === 'connecting' || state?.status === 'connecting:key'
              ? state.currentStep
              : undefined
          }
        >
          {t('connectWallet_action_connect')}
        </Button>
      </div>
    </form>
  );
};

interface AmountInputProps {
  amount: string;
  isSubmitting: boolean;
  error: ErrorInfo | null;
  walletAddressInfo: ConnectWalletAddressInfo | null;
  onError: React.ComponentProps<typeof InputAmount>['onError'];
  onAmountChange: React.ComponentProps<typeof InputAmount>['onChange'];
}

function AmountInput({
  amount,
  isSubmitting,
  error,
  walletAddressInfo,
  onError,
  onAmountChange,
}: AmountInputProps) {
  const t = useTranslation();

  return (
    <InputAmount
      id="connectAmount"
      label={t('connectWallet_label_amount')}
      labelHidden={true}
      amount={amount}
      className="max-w-48"
      walletAddress={
        walletAddressInfo?.walletAddress || {
          assetCode: 'USD',
          assetScale: 2,
        }
      }
      errorMessage={error?.message}
      errorHidden={true}
      readOnly={isSubmitting}
      onError={onError}
      onChange={onAmountChange}
      placeholder={walletAddressInfo?.defaultBudget?.toString() || '5.00'}
    />
  );
}

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
          href="https://webmonetization.org/supporters/get-started/#resolve-a-key-addition-failure"
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

function isAutoKeyAddFailed(state: ConnectTransientState) {
  if (state?.status === 'error') {
    return (
      isErrorWithKey(state.error) &&
      state.error.key !== 'connectWallet_error_tabClosed' &&
      state.error.key !== 'connectWallet_error_timeout'
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
