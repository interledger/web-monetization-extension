import React from 'react';
import { useForm } from 'react-hook-form';
import { AnimatePresence, m } from 'framer-motion';
import { WarningSign } from '@/popup/components/Icons';
import { Button } from '@/popup/components/ui/Button';
import { Code } from '@/popup/components/ui/Code';
import { useTranslation } from '@/popup/lib/context';
import { useLocalStorage } from '@/popup/lib/hooks';
import type { PopupStore } from '@/shared/types';
import type { Response } from '@/shared/messages';

interface Props {
  info: Pick<PopupStore, 'publicKey' | 'walletAddress'>;
  disconnectWallet: () => Promise<Response>;
  reconnectWallet: () => Promise<Response>;
  onReconnect?: () => void;
  onDisconnect?: () => void;
}

type Screen = 'main' | 'reconnect';

export const ErrorKeyRevoked = ({
  info,
  disconnectWallet,
  reconnectWallet,
  onReconnect,
  onDisconnect,
}: Props) => {
  const [screen, setScreen, clearScreen] = useLocalStorage<Screen>(
    'keyRevokedScreen',
    'main',
    { maxAge: 2 * 60 },
  );

  if (screen === 'main') {
    return (
      <AnimatePresence mode="sync">
        <MainScreen
          requestReconnect={() => setScreen('reconnect')}
          disconnectWallet={disconnectWallet}
          onDisconnect={onDisconnect}
        />
      </AnimatePresence>
    );
  } else {
    return (
      <AnimatePresence mode="sync">
        <ReconnectScreen
          info={info}
          reconnectWallet={reconnectWallet}
          onReconnect={() => {
            clearScreen();
            onReconnect?.();
          }}
        />
      </AnimatePresence>
    );
  }
};

interface MainScreenProps {
  disconnectWallet: Props['disconnectWallet'];
  onDisconnect?: Props['onDisconnect'];
  requestReconnect: () => void;
}

const MainScreen = ({
  disconnectWallet,
  onDisconnect,
  requestReconnect,
}: MainScreenProps) => {
  const t = useTranslation();
  const [errorMsg, setErrorMsg] = React.useState('');
  const [loading, setIsLoading] = React.useState(false);

  const requestDisconnect = async () => {
    setErrorMsg('');
    try {
      setIsLoading(true);
      await disconnectWallet();
      onDisconnect?.();
    } catch (error) {
      setErrorMsg(error.message);
    }
    setIsLoading(false);
  };

  return (
    <m.div exit={{ opacity: 0 }} className="space-y-4 text-sm">
      <div className="flex gap-2 rounded-md bg-error p-2">
        <WarningSign className="size-6 text-error" />
        <h3 className="text-base font-medium text-error">
          {t('keyRevoked_error_title')}
        </h3>
      </div>
      <p className="text-sm text-medium">{t('keyRevoked_error_text')}</p>

      {errorMsg && (
        <m.div
          animate={{ opacity: 1 }}
          initial={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-sm px-2 text-sm text-error"
        >
          {errorMsg}
        </m.div>
      )}

      <m.form className="flex flex-col items-stretch gap-4">
        <Button onClick={() => requestDisconnect()} loading={loading}>
          {t('keyRevoked_action_disconnect')}
        </Button>
        <Button onClick={() => requestReconnect()}>
          {t('keyRevoked_action_reconnect')}
        </Button>
      </m.form>
    </m.div>
  );
};

interface ReconnectScreenProps {
  info: Props['info'];
  reconnectWallet: Props['reconnectWallet'];
  onReconnect?: Props['onDisconnect'];
}

const ReconnectScreen = ({
  info,
  reconnectWallet,
  onReconnect,
}: ReconnectScreenProps) => {
  const t = useTranslation();
  const {
    handleSubmit,
    formState: { errors, isSubmitting },
    clearErrors,
    setError,
  } = useForm({ criteriaMode: 'firstError', mode: 'onSubmit' });

  const requestReconnect = async () => {
    clearErrors();
    try {
      const res = await reconnectWallet();
      if (res.success) {
        onReconnect?.();
      } else {
        setError('root', { message: res.message });
      }
    } catch (error) {
      setError('root', { message: error.message });
    }
  };

  return (
    <m.form
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-stretch gap-4"
      onSubmit={handleSubmit(requestReconnect)}
    >
      <div className="space-y-1 text-sm">
        <p className="px-2">
          Reconnecting to wallet:{' '}
          <span className="underline">{info.walletAddress?.id}</span>
        </p>
        <p className="px-2">
          <strong>Before</strong> you reconnect, copy the public key below and
          add it to your wallet.
        </p>
        <Code className="text-xs" value={info.publicKey} />
      </div>

      {errors?.root?.message && (
        <m.div
          animate={{ opacity: 1 }}
          initial={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-sm px-2 text-sm text-error"
        >
          {errors.root.message}
        </m.div>
      )}

      <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
        {t('keyRevoked_action_reconnectBtn')}
      </Button>
    </m.form>
  );
};
