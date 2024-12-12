import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowBack, Settings } from '@/pages/shared/components/Icons';
import { Switch } from '@/pages/shared/components/ui/Switch';
import { HeaderEmpty } from './HeaderEmpty';
import { isOkState } from '@/shared/helpers';
import { ROUTES_PATH } from '@/popup/Popup';
import { useBrowser, useMessage } from '@/popup/lib/context';
import { usePopupState, dispatch } from '@/popup/lib/store';

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

const TogglePaymentsButton = ({ toggle }: { toggle: () => void }) => {
  const { enabled, connected, state } = usePopupState();

  if (!connected) return null;
  if (!isOkState(state)) return null;

  return (
    <Switch
      checked={enabled}
      onChange={toggle}
      size="small"
      title="Enable/Disable Payments"
      aria-label="Toggle payments"
    />
  );
};

export const Header = () => {
  const browser = useBrowser();
  const message = useMessage();
  const Logo = browser.runtime.getURL('assets/images/logo.svg');

  return (
    <HeaderEmpty logo={Logo}>
      <TogglePaymentsButton
        toggle={() => {
          message.send('TOGGLE_PAYMENTS');
          dispatch({ type: 'TOGGLE_PAYMENTS' });
        }}
      />
      <NavigationButton />
    </HeaderEmpty>
  );
};
