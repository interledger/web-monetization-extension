import React, { useCallback, useEffect, useState } from 'react';
import { IconPlus } from '@/pages/shared/components/Icons';
import { Button } from '@/pages/shared/components/ui/Button';
import { useTranslation } from '@/popup/lib/context';
import { usePopupState } from '@/popup/lib/store';
import { normalizeHostname } from '@/shared/helpers';
import type { Host } from '@/shared/types';
import { AddExceptionForm } from './RateOfPaySiteAddException';
import { SitesList } from './RateOfPaySitesList';

interface Props {
  highlight?: 'new' | Host;
}

export function RateOfPayManageSites({ highlight }: Props) {
  const t = useTranslation();
  const [isFormOpen, setIsFormOpen] = useState(highlight === 'new');
  const [highlightedHostname, setHighlightedHostname] = useState<Host | null>(
    highlight && highlight !== 'new' ? normalizeHostname(highlight) : null,
  );
  const { tab } = usePopupState();

  const defaultHostname = normalizeHostname(URL.parse(tab.url)?.hostname || '');

  useEffect(() => {
    if (!highlightedHostname) return;
    const timer = setTimeout(() => setHighlightedHostname(null), 2000);
    return () => clearTimeout(timer);
  }, [highlightedHostname]);

  type OnDone = React.ComponentProps<typeof AddExceptionForm>['onDone'];
  const onFormDone: OnDone = useCallback((entry) => {
    setIsFormOpen(false);
    if (entry) setHighlightedHostname(entry.hostname);
  }, []);

  return (
    <>
      <div className="flex flex-col gap-4 my-6">
        <p>{t('settings_sitePaymentRates_desc')}</p>

        {!isFormOpen ? (
          <Button
            type="button"
            variant="default"
            className="gap-2"
            onClick={() => setIsFormOpen(true)}
          >
            <IconPlus className="size-4 p-0.5" />
            {t('settings_sitePaymentRates_action_addException')}
          </Button>
        ) : (
          <AddExceptionForm
            defaultHostname={defaultHostname}
            onDone={onFormDone}
          />
        )}
      </div>

      <div className="space-y-6">
        <h3 className="font-bold text-medium text-lg">
          {t('settings_sitePaymentRates_heading')}
        </h3>
        <SitesList highlightedHostname={highlightedHostname} />
      </div>
    </>
  );
}
