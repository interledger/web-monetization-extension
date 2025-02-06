import React from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { AutoKeyAddConsent } from '@/pages/shared/components/AutoKeyAddConsent';
import { WarningSign } from '@/pages/shared/components/Icons';
import { Button } from '@/pages/shared/components/ui/Button';
import { Code } from '@/pages/shared/components/ui/Code';
import { useTranslation } from '@/pages/shared/lib/context';
import { useLocalStorage } from '@/pages/shared/lib/hooks';
import type { PopupStore } from '@/shared/types';
import type { ReconnectWalletPayload, Response } from '@/shared/messages';

interface Props {
  info: Pick<PopupStore, 'publicKey' | 'walletAddress'>;
  disconnectWallet: () => Promise<Response>;
  reconnectWallet: (data: ReconnectWalletPayload) => Promise<Response>;
  onReconnect?: () => void;
  onDisconnect?: () => void;
}

type Screen = 'main' | 'manual-reconnect' | 'consent-reconnect';

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
          disconnectWallet={disconnectWallet}
          onDisconnect={onDisconnect}
          setScreen={setScreen}
        />
      </AnimatePresence>
    );
  } else if (screen === 'consent-reconnect') {
    return (
      <AnimatePresence mode="sync">
        <AutoKeyAddConsent
          onAccept={async () => {
            try {
              await reconnectWallet({ autoKeyAddConsent: true });
              clearScreen();
              onReconnect?.();
            } catch (error) {
              setScreen('manual-reconnect');
              throw error;
            }
          }}
          onDecline={() => setScreen('manual-reconnect')}
          intent="RECONNECT_WALLET"
        />
      </AnimatePresence>
    );
  } else {
    return (
      <AnimatePresence mode="sync">
        <ManualReconnectScreen
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
  setScreen: (screen: Screen) => void;
}

const MainScreen = ({
  disconnectWallet,
  onDisconnect,
  setScreen,
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
          className="rounded-xs px-2 text-sm text-error"
        >
          {errorMsg}
        </m.div>
      )}

      <m.form className="flex flex-col items-stretch gap-4">
        <Button onClick={() => requestDisconnect()} loading={loading}>
          {t('keyRevoked_action_disconnect')}
        </Button>
        <Button onClick={() => setScreen('consent-reconnect')}>
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

const ManualReconnectScreen = ({
  info,
  reconnectWallet,
  onReconnect,
}: ReconnectScreenProps) => {
  type Errors = Record<'root', null | { message: string }>;

  const t = useTranslation();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Errors>({
    root: null,
  });

  const requestManualReconnect = async () => {
    setErrors({ root: null });
    try {
      setIsSubmitting(true);
      const res = await reconnectWallet({ autoKeyAddConsent: false });
      if (res.success) {
        onReconnect?.();
      } else {
        setErrors({ root: { message: res.message } });
      }
    } catch (error) {
      setErrors({ root: { message: error.message } });
    }
    setIsSubmitting(false);
  };

  return (
    <m.form
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-stretch gap-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        requestManualReconnect();
      }}
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
          className="rounded-xs px-2 text-sm text-error"
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
