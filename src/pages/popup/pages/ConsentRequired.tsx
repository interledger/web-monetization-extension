import React from 'react';
import { useMessage, useTranslation } from '@/popup/lib/context';
import { Button } from '@/pages/shared/components/ui/Button';
import { WarningSign } from '@/pages/shared/components/Icons';

export default () => {
  const t = useTranslation();
  const message = useMessage();
  return (
    <div className="space-y-4 text-base" data-user-action="required">
      <div className="flex gap-2 rounded-md bg-error p-2">
        <WarningSign className="size-6 text-error" />
        <h3 className="text-base font-medium text-error">
          {t('consentRequired_text_title')}
        </h3>
      </div>

      <p className="">{t('consentRequired_text_subtitle')}</p>

      <p className="pt-2">{t('consentRequired_text_msg')}</p>

      <Button
        type="button"
        onClick={() =>
          message.send('OPEN_APP', { path: '/post-install/consent' })
        }
      >
        {t('consentRequired_action_primary')}
      </Button>
    </div>
  );
};
