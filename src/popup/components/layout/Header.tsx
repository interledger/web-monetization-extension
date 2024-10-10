import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowBack, Settings } from '../Icons';
import { HeaderEmpty } from './HeaderEmpty';
import { Switch } from '@/popup/components/ui/Switch';
import { ROUTES_PATH } from '@/popup/Popup';
import { useBrowser, useMessage, usePopupState } from '@/popup/lib/context';
import { isOkState } from '@/shared/helpers';

const NavigationButton = () => {
  const location = useLocation();
  const {
    state: { connected },
  } = usePopupState();
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

const ToggleWMButton: React.FC<{ toggleWM: () => void }> = ({ toggleWM }) => {
  const {
    state: { enabled, connected, state },
  } = usePopupState();

  if (!connected) return null;
  if (!isOkState(state)) return null;

  return (
    <Switch
      checked={enabled}
      onChange={toggleWM}
      size="small"
      title="Enable/Disable Web Monetization"
      aria-label="Continuous payment stream"
    />
  );
};

export const Header = () => {
  const message = useMessage();
  const browser = useBrowser();
  const { dispatch } = usePopupState();

  const toggleWM = () => {
    message.send('TOGGLE_WM');
    dispatch({ type: 'TOGGLE_WM', data: {} });
  };

  const Logo = browser.runtime.getURL('assets/images/logo.svg');

  return (
    <HeaderEmpty logo={Logo}>
      <ToggleWMButton toggleWM={toggleWM} />
      <NavigationButton />
    </HeaderEmpty>
  );
};
