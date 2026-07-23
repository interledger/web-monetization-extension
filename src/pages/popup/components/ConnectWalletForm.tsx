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
import { md } from 'imd/react';
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
  debounceAsync,
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
type ErrorsParams = 'keyPair' | 'connect';
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
  const amountInputRef = useRef<AmountInputHandle>(null);
  const [walletAddressInfo, setWalletAddressInfo] =
    React.useState<ConnectWalletAddressInfo | null>(null);
  const [amountError, setAmountError] = React.useState<ErrorInfo | null>(null);

  const [errors, setErrors] = useReducer(
    (prev: Errors, patch: Partial<Errors>): Errors => ({ ...prev, ...patch }),
    { keyPair: null, connect: null },
  );

  const [isSubmitting, setIsSubmitting] = React.useState(
    initialState?.type === 'progress',
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

    const amount = amountInputRef.current!.getValue();

    const errAmount = validateAmount(amount, walletInfo.walletAddress);
    if (errAmount) {
      return amountInputRef.current!.setError(toErrorInfo(errAmount));
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
          const error = errorWithKey('connectWalletKeyService_noConsent_error');
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
          {t('connectWallet_title')}
        </h2>
        <p className="text-center text-sm text-weak">
          {t('connectWallet_desc')}
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
        onWalletInfoChange={setWalletAddressInfo}
      />

      <fieldset className="space-y-2">
        <legend className="flex items-center px-2 font-medium leading-6 text-medium">
          {t('connectWallet_amount_group_label')}
        </legend>
        <div className="flex gap-y-4 gap-x-6 flex-col @sm:flex-row @sm:items-center">
          <AmountInput
            ref={amountInputRef}
            defaultAmount={defaultValues.amount || '5.00'}
            isSubmitting={isSubmitting}
            walletAddressInfo={walletAddressInfo}
            saveValue={saveValue}
            onAmountChange={setAmount}
            onErrorChange={setAmountError}
          />

          <label
            htmlFor="connectRecurring"
            className="flex items-center gap-x-4 px-2"
          >
            <span className="font-medium text-medium @sm:font-normal grow @sm:grow-0 @sm:order-last">
              {t('connectWallet_recurring_label')}
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

        {amountError && (
          <p className="px-2 text-sm text-error">{amountError.message}</p>
        )}
      </fieldset>

      {showManualKeyCopy && (
        <ManualKeyPairNeeded
          error={{
            message: t('connectWallet_failedAutoKeyAdd_error'),
            details: errors.keyPair,
            whyText: t('connectWallet_failedAutoKeyAdd_why_text'),
          }}
          retry={resetState}
          retryText={t('connectWallet_retry_action')}
          hideError={!errors.keyPair}
          text={t('connectWallet_publicKey_label')}
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
            !walletAddressInfo || !!amountError || isSubmitting || !amount
          }
          loading={isSubmitting}
          loadingText={<ConnectSubmitLoadingText />}
        >
          {t('connectWallet_connect_action')}
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
        const msg = err instanceof Error ? err.message : String(err);
        setError(toErrorInfo(msg));
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
      await resetState();
      return walletInfo;
    },
    [validateAndFetch, resetState],
  );

  const debouncedCommit = useRef(debounceAsync(commit, 500)).current;

  useImperativeHandle(
    ref,
    () => ({ commit: () => commit(inputRef.current!.value) }),
    [commit],
  );

  const onInput: OnInputHandler = useCallback(
    (event) => {
      const input = event.currentTarget;
      const ev = event.nativeEvent as InputEvent;

      if (ev.inputType && ev.inputType !== 'insertReplacementText') {
        // regular typing, not autocomplete. commit once the user pauses
        void debouncedCommit(input.value);
        return;
      }

      const value = ev.data ?? input.value; // Chrome doesn't fire InputEvent on autocomplete!
      if (!value) return;
      if (validateWalletAddressUrl(value)) {
        return; // not valid data from autocomplete, fallback to input blur based behavior
      }
      // use as autocompleted value
      void commit(value);
    },
    [commit, debouncedCommit],
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
      label={t('connectWallet_walletAddress_label')}
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

interface AmountInputHandle {
  getValue: () => string;
  setError: (error: ErrorInfo | null) => void;
}

interface AmountInputProps {
  defaultAmount: string;
  isSubmitting: boolean;
  walletAddressInfo: ConnectWalletAddressInfo | null;
  saveValue: Props['saveValue'];
  onAmountChange: (value: string) => void;
  onErrorChange: (error: ErrorInfo | null) => void;
  ref?: React.Ref<AmountInputHandle>;
}

const DEFAULT_WALLET_ADDRESS = { assetCode: 'USD', assetScale: 2 };

function AmountInput({
  defaultAmount,
  isSubmitting,
  walletAddressInfo,
  saveValue,
  onAmountChange,
  onErrorChange,
  ref,
}: AmountInputProps) {
  const t = useTranslation();
  const toErrorInfo = useMemo(() => toErrorInfoFactory(t), [t]);

  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setErrorState] = useState<ErrorInfo | null>(null);

  const setError = useCallback(
    (err: ErrorInfo | null) => {
      setErrorState(err);
      onErrorChange(err);
    },
    [onErrorChange],
  );

  const handleChange = useCallback(
    (value: string, input: HTMLInputElement) => {
      setError(null);
      if (Number(value) > 0) {
        input.dataset.modified = '1';
      }
      saveValue('amount', value);
      onAmountChange(value);
    },
    [saveValue, onAmountChange, setError],
  );

  const handleError = useCallback(
    (err: ErrorWithKeyLike) => setError(toErrorInfo(err)),
    [toErrorInfo, setError],
  );

  useImperativeHandle(
    ref,
    () => ({
      getValue: () => inputRef.current!.value,
      setError,
    }),
    [setError],
  );

  // Applies the wallet's default budget once it's fetched, unless the user
  // has already typed their own amount (or the field is currently invalid).
  useEffect(() => {
    if (!walletAddressInfo) return;
    const inputEl = inputRef.current;
    if (
      !inputEl ||
      (inputEl.dataset.modified &&
        inputEl.value &&
        inputEl.ariaInvalid !== 'true')
    ) {
      return;
    }
    const defaultBudget = formatNumber(
      walletAddressInfo.defaultBudget,
      walletAddressInfo.walletAddress.assetScale,
    );
    setError(null);
    inputEl.defaultValue = defaultBudget;
    inputEl.value = defaultBudget;
    saveValue('amount', defaultBudget);
    onAmountChange(defaultBudget);
  }, [walletAddressInfo, saveValue, onAmountChange, setError]);

  return (
    <InputAmount
      ref={inputRef}
      id="connectAmount"
      label={t('connectWallet_amount_label')}
      labelHidden={true}
      amount={defaultAmount}
      className="@sm:max-w-48"
      walletAddress={walletAddressInfo?.walletAddress || DEFAULT_WALLET_ADDRESS}
      errorMessage={error?.message}
      errorHidden={true}
      readOnly={isSubmitting}
      onError={handleError}
      onChange={handleChange}
      placeholder={walletAddressInfo?.defaultBudget?.toString() || '5.00'}
    />
  );
}

const ManualKeyPairNeeded: React.FC<{
  error: { message: string; details: null | ErrorInfo; whyText: string };
  hideError?: boolean;
  retry: () => Promise<void>;
  retryText: string;
  text: string;
  publicKey: string;
}> = ({ error, hideError, text, retryText, publicKey, retry }) => {
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
            {retryText}
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
        {md(text, {
          link: (children, href) => (
            <a
              href={href}
              className="text-primary"
              target="_blank"
              rel="noreferrer"
            >
              {children}
            </a>
          ),
        })}
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
      return new ErrorWithKey('connectWallet_timeout_error');
    case 'grant_continuation_failed':
      return new ErrorWithKey('connectWallet_continuationFailed_error');
    case 'grant_hash_failed':
      return new ErrorWithKey('connectWallet_hashFailed_error');
    case 'grant_invalid':
      return new ErrorWithKey('connectWallet_grantInvalid_error');
    case 'key_add_failed': {
      if (isErrorWithKey(state.details)) {
        return new ErrorWithKey(
          'connectWalletKeyService_failed_error',
          deepClone(state.details.substitutions || []),
          deepClone(state.details),
        );
      } else {
        return new ErrorWithKey('connectWalletKeyService_failed_error');
      }
    }
    default:
      // TODO: better error message
      return new ErrorWithKey('connectWallet_invalidClient_error');
  }
}

function mapErrorCancel(
  state: Extract<WalletStatus, { type: 'cancel' }>,
): ErrorWithKeyLike {
  switch (state.code) {
    case 'grant_rejected':
      return new ErrorWithKey('connectWallet_grantRejected_error');
    case 'tab_closed':
      return new ErrorWithKey('connectWallet_tabClosed_error');
    default:
      return new ErrorWithKey('connectWallet_grantRejected_error'); // TODO: better error for unknown cancel reason
  }
}

function canRetryAutoKeyAdd(err?: ErrorInfo['info']) {
  if (!err) return false;
  return (
    err.key === 'connectWalletKeyService_noConsent_error' ||
    err.cause?.key === 'connectWalletKeyService_timeoutLogin_error' ||
    err.cause?.key === 'connectWalletKeyService_accountNotFound_error'
  );
}

function validateWalletAddressUrl(value: string): null | ErrorWithKeyLike {
  if (!value) {
    return errorWithKey('connectWallet_url_required_error');
  }
  let url: URL;
  try {
    url = new URL(toWalletAddressUrl(value));
  } catch {
    return errorWithKey('connectWallet_url_invalidUrl_error');
  }

  if (url.protocol !== 'https:') {
    return errorWithKey('connectWallet_url_invalidNotHttps_error');
  }

  return null;
}
