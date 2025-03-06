import React from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowBack, Settings } from '@/pages/shared/components/Icons';
import { HeaderEmpty } from './HeaderEmpty';
import { TogglePaymentsButton } from '@/popup/components/TogglePaymentsButton';
import { ROUTES_PATH } from '@/popup/Popup';
import { useBrowser } from '@/popup/lib/context';
import { usePopupState } from '@/popup/lib/store';

const NavigationButton = () => {
  const [pathname] = useLocation();
  const { connected } = usePopupState();

  return React.useMemo(() => {
    if (!connected) return null;

    if (pathname.includes('/s/')) {
      return (
        <Link to={pathname.split('/s/')[0]}>
          <ArrowBack className="h-6 text-gray-500" />
        </Link>
      );
    }

    return pathname === `${ROUTES_PATH.SETTINGS}` ? (
      <Link to={ROUTES_PATH.HOME}>
        <ArrowBack className="h-6 text-gray-500" />
      </Link>
    ) : (
      <React.Fragment>
        {connected && <TogglePaymentsButton />}
        <Link to={ROUTES_PATH.SETTINGS}>
          <Settings className="h-6" />
        </Link>
      </React.Fragment>
    );
  }, [pathname, connected]);
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
