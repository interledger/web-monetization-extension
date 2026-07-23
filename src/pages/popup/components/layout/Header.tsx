import React from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowBack, Settings } from '@/pages/shared/components/Icons';
import { HeaderEmpty } from './HeaderEmpty';
import { TogglePaymentsButton } from '@/popup/components/TogglePaymentsButton';
import { ROUTES_PATH } from '@/popup/Popup';
import { useBrowser, useTranslation } from '@/popup/lib/context';
import { usePopupState } from '@/popup/lib/store';

const NavigationButton = () => {
  const t = useTranslation();
  const [pathname] = useLocation();
  const { connected, state } = usePopupState();

  return React.useMemo(() => {
    if (!connected) return null;
    if (state.consent_required) return null;

    if (pathname.includes('/s/')) {
      return (
        <Link
          to={pathname.split('/s/')[0]}
          aria-label={t('header_back_action')}
        >
          <ArrowBack className="h-6 touch:h-8 text-gray-500" />
        </Link>
      );
    }

    return pathname.startsWith(ROUTES_PATH.SETTINGS) ? (
      <Link to={ROUTES_PATH.HOME} aria-label={t('header_back_action')}>
        <ArrowBack className="h-6 touch:h-8 text-gray-500" />
      </Link>
    ) : (
      <React.Fragment>
        {connected && <TogglePaymentsButton />}
        <Link
          to={ROUTES_PATH.SETTINGS}
          aria-label={t('header_settings_action')}
        >
          <Settings className="h-6 touch:h-8" />
        </Link>
      </React.Fragment>
    );
  }, [pathname, connected, state, t]);
};

export const Header = () => {
  const browser = useBrowser();
  const Logo = browser.runtime.getURL('assets/images/logo.svg');

  return (
    <HeaderEmpty logo={Logo}>
      <NavigationButton />
    </HeaderEmpty>
  );
};
