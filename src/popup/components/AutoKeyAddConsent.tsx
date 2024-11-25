import React from 'react';
import { useTranslation } from '@/popup/lib/context';
import { Button } from '@/popup/components/ui/Button';

export const AutoKeyAddConsent: React.FC<{
  onAccept: () => void;
  onDecline: () => void;
  textConsent: string;
}> = ({ onAccept, onDecline, textConsent }) => {
  const t = useTranslation();
  return (
    <form
      className="space-y-4 text-center"
      data-testid="connect-wallet-auto-key-consent"
    >
      <p className="text-lg leading-snug text-weak">
        {textConsent}{' '}
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
