import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { Button } from '@/pages/shared/components/ui/Button';
import { Input } from '@/pages/shared/components/ui/Input';
import { SwitchButton } from '@/pages/shared/components/ui/Switch';
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
  ErrorWithKey,
  errorWithKey,
  isErrorWithKey,
  sleep,
  toWalletAddressUrl,
  type ErrorWithKeyLike,
} from '@/shared/helpers';
import { getResponseOrThrow } from '@/shared/messages';
import type {
  ConnectWalletPayload,
  ConnectWalletAddressInfo,
  MessageManager,
  PopupToBackgroundMessage,
  Response,
} from '@/shared/messages';
import type {
  WalletStatus,
  DeepReadonly,
  TransientState,
} from '@/shared/types';

interface Inputs {
  walletAddressUrl: string;
  amount: string;
  recurring: boolean;
  autoKeyAddConsent: boolean;
}

type ConnectTransientState = DeepReadonly<TransientState['connect']>;
type ErrorsParams = 'amount' | 'keyPair' | 'connect';
type Errors = Record<ErrorsParams, ErrorInfo | null>;

type OnInputHandler = NonNullable<
  React.DOMAttributes<HTMLInputElement>['onInput']
>;
type OnPasteHandler = NonNullable<
  React.DOMAttributes<HTMLInputElement>['onPaste']
>;

// carries the frequently-updating transient connect state.
export const ConnectStateContext = createContext<ConnectTransientState>(null);
const useConnectState = () => useContext(ConnectStateContext);

interface Props {
  publicKey: string;
  defaultValues: Partial<Inputs>;
  initialState?: ConnectTransientState;
  walletAddressPlaceholder?: string;
  saveValue: (key: keyof Inputs, val: Inputs[typeof key]) => void;
  getWalletInfo: (
    walletAddressUrl: string,
  ) => Promise<ConnectWalletAddressInfo>;
  connectWallet: (data: ConnectWalletPayload) => Promise<Response>;
  clearConnectState: () => Promise<unknown>;
  onConnect?: () => void;
}
export type { Props as ConnectWalletFormProps };

export const ConnectWalletForm = React.memo(function ConnectWalletForm({
  publicKey,
  defaultValues,
  initialState,
  walletAddressPlaceholder = 'https://walletprovider.com/MyWallet',
  getWalletInfo,
  connectWallet,
  clearConnectState,
  saveValue,
  onConnect,
}: Props) {
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
    initialState?.type === 'failure' && initialState.code === 'key_add_failed',
  );
  const [showConsent, setShowConsent] = React.useState(false);
  const autoKeyAddConsent = React.useRef<boolean>(
    defaultValues.autoKeyAddConsent || false,
  );

  const resetState = React.useCallback(async () => {
    await clearConnectState();
    setErrors({ keyPair: null, connect: null });
    setAutoKeyShareFailed(false);
  }, [clearConnectState]);

  const walletAddressInputRef = useRef<WalletAddressInputHandle>(null);
  const [walletAddressInfo, setWalletAddressInfo] =
    React.useState<ConnectWalletAddressInfo | null>(null);

  const [errors, setErrors] = useReducer(
    (prev: Errors, patch: Partial<Errors>): Errors => ({ ...prev, ...patch }),
    { amount: null, keyPair: null, connect: null },
  );

  const [isSubmitting, setIsSubmitting] = React.useState(
    initialState?.type === 'progress',
  );

  const handleAmountChange = React.useCallback(
    (amountValue: string, input?: HTMLInputElement) => {
      setErrors({ amount: null });
      setAmount(amountValue);
      if (input && Number(amountValue) > 0) {
        input.dataset.modified = '1';
      }
      saveValue('amount', amountValue);
    },
    [saveValue],
  );

  const onWalletInfoChange = useCallback(
    (info: ConnectWalletAddressInfo | null) => {
      setWalletAddressInfo(info);
      if (!info) return;

      const defaultBudget = formatNumber(
        info.defaultBudget,
        info.walletAddress.assetScale,
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
        setErrors({ amount: null });
        inputEl.defaultValue = defaultBudget;
        inputEl.value = defaultBudget;
        setAmount(defaultBudget);
        saveValue('amount', defaultBudget);
      }
    },
    [saveValue],
  );

  const handleSubmit = async (ev?: React.SubmitEvent<HTMLFormElement>) => {
    ev?.preventDefault();

    const addressInputEl = ev?.currentTarget.connectWalletAddressUrl;
    const walletAddressInput =
      addressInputEl instanceof HTMLInputElement
        ? addressInputEl.value
        : walletAddressUrl;
    let freshWalletInfo = walletAddressInfo;
    if (addressInputEl) {
      const result = await walletAddressInputRef.current!.commit();
      if (result === null) return;
      if (result) freshWalletInfo = result;
    }

    const walletInfo = freshWalletInfo
      ? await getWalletInfo(freshWalletInfo.walletAddress.id)
      : await getWalletInfo(toWalletAddressUrl(walletAddressInput));

    if (
      !walletInfo.isKeyAdded &&
      !autoKeyAddConsent.current &&
      walletInfo.isKeyAutoAddSupported
    ) {
      setShowConsent(true);
      return;
    }

    const amountInput = document.querySelector<HTMLInputElement>(
      'input#connectAmount',
    )!;
    const amount = amountInput.value;

    const errAmount = validateAmount(amount, walletInfo.walletAddress);
    if (errAmount) {
      return setErrors({ amount: toErrorInfo(errAmount) });
    }

    try {
      setIsSubmitting(true);
      if (errors.keyPair) {
        setAutoKeyShareFailed(true);
      }

      setErrors({ keyPair: null, connect: null });
      const res = await connectWallet({
        walletAddress: walletInfo.walletAddress,
        amount,
        rateOfPay: walletInfo.defaultRateOfPay,
        maxRateOfPay: walletInfo.maxRateOfPay,
        recurring,
        autoKeyAdd: autoKeyAddConsent.current,
      });
      if (res.success) {
        onConnect?.();
      } else {
        if (!isErrorWithKey(res.error)) throw new Error(res.message);
        // Otherwise, errors are handled by `ConnectStateErrorSync`
      }
    } catch (error) {
      setErrors({ connect: toErrorInfo(error.message) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const keyAddNeeded = !walletAddressInfo?.isKeyAdded;
  const showManualKeyCopy =
    (errors.keyPair ||
      autoKeyShareFailed ||
      walletAddressInfo?.isKeyAutoAddSupported === false) &&
    keyAddNeeded;

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
          setErrors({ keyPair: toErrorInfo(error) });
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
      <ConnectStateErrorSync setErrors={setErrors} toErrorInfo={toErrorInfo} />

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

      <WalletAddressInput
        ref={walletAddressInputRef}
        placeholder={walletAddressPlaceholder}
        defaultValue={defaultValues.walletAddressUrl || ''}
        isSubmitting={isSubmitting}
        saveValue={saveValue}
        getWalletInfo={getWalletInfo}
        resetState={resetState}
        onWalletAddressChange={setWalletAddressUrl}
        onWalletInfoChange={onWalletInfoChange}
      />

      <fieldset className="space-y-2">
        <legend className="flex items-center px-2 font-medium leading-6 text-medium">
          {t('connectWallet_labelGroup_amount')}
        </legend>
        <div className="flex gap-y-4 gap-x-6 flex-col @sm:flex-row @sm:items-center">
          <AmountInput
            amount={amount}
            isSubmitting={isSubmitting}
            walletAddressInfo={walletAddressInfo}
            onAmountChange={handleAmountChange}
            error={errors.amount}
            onError={(err) => {
              setErrors({ amount: toErrorInfo(err) });
            }}
          />

          <label
            htmlFor="connectRecurring"
            className="flex items-center gap-x-4 px-2"
          >
            <span className="font-medium text-medium @sm:font-normal flex-grow @sm:flex-grow-0 @sm:order-last">
              {t('connectWallet_label_recurring')}
            </span>
            <SwitchButton
              id="connectRecurring"
              size="small"
              disabled={isSubmitting}
              checked={recurring}
              onChange={(ev) => {
                const value = ev.currentTarget.checked;
                setRecurring(value);
                saveValue('recurring', value);
              }}
            />
          </label>
        </div>

        {errors.amount && (
          <p className="px-2 text-sm text-error">{errors.amount.message}</p>
        )}
      </fieldset>

      {showManualKeyCopy && (
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
            !walletAddressInfo || !!errors.amount || isSubmitting || !amount
          }
          loading={isSubmitting}
          loadingText={<ConnectSubmitLoadingText />}
        >
          {t('connectWallet_action_connect')}
        </Button>
      </div>
    </form>
  );
});

function ConnectStateErrorSync({
  setErrors,
  toErrorInfo,
}: {
  setErrors: React.Dispatch<Partial<Errors>>;
  toErrorInfo: ReturnType<typeof toErrorInfoFactory>;
}) {
  const state = useConnectState();

  useEffect(() => {
    if (state?.type === 'failure' && state.code === 'key_add_failed') {
      const errInfo = toErrorInfo(mapErrorFailure(state));
      setErrors({ keyPair: errInfo });
    }
    if (state?.type === 'failure' && state.code !== 'key_add_failed') {
      const errInfo = toErrorInfo(mapErrorFailure(state));
      setErrors({ connect: errInfo });
    }
    if (state?.type === 'cancel') {
      const errInfo = toErrorInfo(mapErrorCancel(state));
      setErrors({ connect: errInfo });
    }
  }, [state, toErrorInfo, setErrors]);

  return null;
}

function ConnectSubmitLoadingText() {
  const t = useTranslation();
  const state = useConnectState();

  if (state?.type !== 'progress') return null;
  return typeof state.currentStep === 'string'
    ? state.currentStep
    : t(state.currentStep.key, [...state.currentStep.substitutions]);
}

export const saveValue: Props['saveValue'] = (key, val) => {
  localStorage?.setItem(`connect.${key}`, String(val));
};
export const getSavedValues = (): Props['defaultValues'] => {
  return {
    recurring: localStorage?.getItem('connect.recurring') === 'true' || false,
    amount: localStorage?.getItem('connect.amount') || undefined,
    walletAddressUrl:
      localStorage?.getItem('connect.walletAddressUrl') || undefined,
    autoKeyAddConsent:
      localStorage?.getItem('connect.autoKeyAddConsent') === 'true',
  };
};

type ConnectWalletMessages = Pick<
  PopupToBackgroundMessage,
  'GET_CONNECT_WALLET_ADDRESS_INFO' | 'CONNECT_WALLET' | 'RESET_CONNECT_STATE'
>;

export function useConnectWalletFormActions(
  message: MessageManager<ConnectWalletMessages>,
) {
  const getWalletInfo: Props['getWalletInfo'] = useCallback(
    async (waUrl) => {
      const res = await message.send('GET_CONNECT_WALLET_ADDRESS_INFO', waUrl);
      return getResponseOrThrow(res);
    },
    [message],
  );

  const connectWallet: Props['connectWallet'] = useCallback(
    (data) => message.send('CONNECT_WALLET', data),
    [message],
  );

  const clearConnectState: Props['clearConnectState'] = useCallback(
    () => message.send('RESET_CONNECT_STATE'),
    [message],
  );

  return { getWalletInfo, connectWallet, clearConnectState };
}

interface WalletAddressInputHandle {
  /** Force-validates and re-fetches whatever is currently in the field. */
  commit: () => Promise<ConnectWalletAddressInfo | null | undefined>;
}

interface WalletAddressInputProps {
  placeholder: string;
  defaultValue: string;
  isSubmitting: boolean;
  saveValue: Props['saveValue'];
  getWalletInfo: Props['getWalletInfo'];
  resetState: () => Promise<void>;
  onWalletAddressChange: (value: string) => void;
  onWalletInfoChange: (info: ConnectWalletAddressInfo | null) => void;
  ref?: React.Ref<WalletAddressInputHandle>;
}

function WalletAddressInput({
  placeholder,
  defaultValue,
  isSubmitting,
  saveValue,
  getWalletInfo,
  resetState,
  onWalletAddressChange,
  onWalletInfoChange,
  ref,
}: WalletAddressInputProps) {
  const t = useTranslation();
  const toErrorInfo = useMemo(() => toErrorInfoFactory(t), [t]);

  const inputRef = useRef<HTMLInputElement>(null);
  const lastCommittedValue = useRef(defaultValue);

  const [error, setError] = useState<ErrorInfo | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const validateAndFetch = useCallback(
    async (value: string): Promise<ConnectWalletAddressInfo | null> => {
      lastCommittedValue.current = value;
      onWalletAddressChange(value);
      onWalletInfoChange(null);
      saveValue('walletAddressUrl', value);

      const validationError = validateWalletAddressUrl(value);
      setError(toErrorInfo(validationError));
      if (validationError) return null;

      setIsValidating(true);
      try {
        const url = new URL(toWalletAddressUrl(value));
        const walletInfo = await getWalletInfo(url.toString());
        onWalletInfoChange(walletInfo);
        return walletInfo;
      } catch (err) {
        setError(toErrorInfo(err.message));
        return null;
      } finally {
        setIsValidating(false);
      }
    },
    [
      saveValue,
      getWalletInfo,
      onWalletAddressChange,
      onWalletInfoChange,
      toErrorInfo,
    ],
  );

  const commit = useCallback(
    async (
      value: string,
    ): Promise<ConnectWalletAddressInfo | null | undefined> => {
      if (value && value === lastCommittedValue.current) {
        return;
      }
      const walletInfo = await validateAndFetch(value);
      void resetState();
      return walletInfo;
    },
    [validateAndFetch, resetState],
  );

  useImperativeHandle(
    ref,
    () => ({ commit: () => commit(inputRef.current!.value) }),
    [commit],
  );

  const onInput: OnInputHandler = useCallback(
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
      // use as autocompleted value
      void commit(value);
    },
    [commit],
  );

  const onPaste: OnPasteHandler = useCallback(
    async (ev) => {
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
      await commit(value);
    },
    [commit],
  );

  useEffect(() => {
    if (defaultValue) void validateAndFetch(defaultValue);
  }, [defaultValue, validateAndFetch]);

  return (
    <Input
      ref={inputRef}
      type="text"
      label={t('connectWallet_label_walletAddress')}
      id="connectWalletAddressUrl"
      placeholder={placeholder}
      errorMessage={error?.message}
      defaultValue={defaultValue}
      trailingAddOn={
        isValidating ? <LoadingSpinner color="gray" size="md" /> : null
      }
      required={true}
      autoComplete="on"
      spellCheck={false}
      enterKeyHint="go"
      readOnly={isSubmitting}
      onInput={onInput}
      onPaste={onPaste}
      onBlur={(ev) => commit(ev.currentTarget.value)}
    />
  );
}

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
      className="@sm:max-w-48"
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
    if (!error?.details) return null;
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

function mapErrorFailure(
  state: DeepReadonly<Extract<WalletStatus, { type: 'failure' }>>,
): ErrorWithKeyLike {
  switch (state.code) {
    case 'timeout':
      return new ErrorWithKey('connectWallet_error_timeout');
    case 'grant_continuation_failed':
      return new ErrorWithKey('connectWallet_error_continuationFailed');
    case 'grant_hash_failed':
      return new ErrorWithKey('connectWallet_error_hashFailed');
    case 'grant_invalid':
      return new ErrorWithKey('connectWallet_error_grantInvalid');
    case 'key_add_failed': {
      if (isErrorWithKey(state.details)) {
        return new ErrorWithKey(
          'connectWalletKeyService_error_failed',
          deepClone(state.details.substitutions || []),
          deepClone(state.details),
        );
      } else {
        return new ErrorWithKey('connectWalletKeyService_error_failed');
      }
    }
    default:
      // TODO: better error message
      return new ErrorWithKey('connectWallet_error_invalidClient');
  }
}

function mapErrorCancel(
  state: Extract<WalletStatus, { type: 'cancel' }>,
): ErrorWithKeyLike {
  switch (state.code) {
    case 'grant_rejected':
      return new ErrorWithKey('connectWallet_error_grantRejected');
    case 'tab_closed':
      return new ErrorWithKey('connectWallet_error_tabClosed');
    default:
      return new ErrorWithKey('connectWallet_error_grantRejected'); // TODO: better error for unknown cancel reason
  }
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
