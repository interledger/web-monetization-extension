import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowBack, Settings } from '@/pages/shared/components/Icons';
import { HeaderEmpty } from './HeaderEmpty';
import { ROUTES_PATH } from '@/popup/Popup';
import { useBrowser } from '@/popup/lib/context';
import { usePopupState } from '@/popup/lib/store';

const NavigationButton = () => {
  const location = useLocation();
  const { connected } = usePopupState();

  return React.useMemo(() => {
    if (!connected) return null;

    if (location.pathname.includes('/s/')) {
      return (
        <Link to={location.pathname.split('/s/')[0]}>
          <ArrowBack className="h-6" />
        </Link>
      );
    }

    return location.pathname === `${ROUTES_PATH.SETTINGS}` ? (
      <Link to={ROUTES_PATH.HOME}>
        <ArrowBack className="h-6" />
      </Link>
    ) : (
      <Link to={ROUTES_PATH.SETTINGS}>
        <Settings className="h-6" />
      </Link>
    );
  }, [location, connected]);
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
