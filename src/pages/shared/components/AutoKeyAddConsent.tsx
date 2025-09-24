import React from 'react';
import { Button } from '@/pages/shared/components/ui/Button';
import { useTranslation } from '@/popup/lib/context';
import type { TranslationKeys } from '@/shared/helpers';

type Intent = 'CONNECT_WALLET' | 'RECONNECT_WALLET';

const consentMessage: Record<Intent, TranslationKeys> = {
  CONNECT_WALLET: 'connectWalletKeyService_text_consentP1',
  RECONNECT_WALLET: 'reconnectWalletKeyService_text_consentP1',
};

type Props = {
  onAccept: () => void;
  onDecline: () => void;
  intent: Intent;
};

export const AutoKeyAddConsent = ({ onAccept, onDecline, intent }: Props) => {
  const t = useTranslation();
  return (
    <form
      className="space-y-4 text-center"
      data-testid="connect-wallet-auto-key-consent"
    >
      <p className="text-lg leading-snug text-weak">
        {t(consentMessage[intent])}{' '}
        <a
          hidden
          href="https://webmonetization.org/supporters/get-started/#resolve-a-key-addition-failure"
          className="text-primary hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          {t('connectWalletKeyService_text_consentLearnMore')}
        </a>
      </p>

      <div className="space-y-2 pt-12 text-medium text-left">
        <p>{t('connectWalletKeyService_text_consentP2')}</p>
        <ul className="list-disc px-2 pb-4">
          <li>{t('connectWalletKeyService_text_consentP3')}</li>
          <li>{t('connectWalletKeyService_text_consentP4')}</li>
        </ul>
        <p className="text-center">
          {t('connectWalletKeyService_text_consent_no_access_funds')}
        </p>
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
