import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowBack, Settings } from '@/pages/shared/components/Icons';
import { HeaderEmpty } from './HeaderEmpty';
import { PowerSwitch } from '@/popup/components/PowerSwitch';
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

export const TogglePaymentsButton = ({
  large = false,
  enabled = false,
}: {
  large?: boolean;
  enabled?: boolean;
}) => {
  const message = useMessage();

  return (
    <PowerSwitch
      enabled={enabled}
      onChange={() => {
        message.send('TOGGLE_PAYMENTS');
        dispatch({ type: 'TOGGLE_PAYMENTS' });
      }}
      title="Toggle extension"
      iconClassName={large ? 'w-32' : 'w-6'}
    />
  );
};

export const Header = () => {
  const browser = useBrowser();
  const { enabled } = usePopupState();
  const Logo = browser.runtime.getURL('assets/images/logo.svg');

  return (
    <HeaderEmpty logo={Logo}>
      {enabled && <TogglePaymentsButton enabled={enabled} />}
      <NavigationButton />
    </HeaderEmpty>
  );
};
