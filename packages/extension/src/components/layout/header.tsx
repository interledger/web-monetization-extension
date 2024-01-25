import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { runtime } from 'webextension-polyfill';

import { ArrowBack, Settings } from '../icons';
import { ROUTES } from '../router-provider';

const Logo = runtime.getURL('assets/images/logo.svg');

const NavigationButton = () => {
  const location = useLocation();

  const component = useMemo(
    () =>
      location.pathname === `/${ROUTES.SETTINGS}` ? (
        <Link to={ROUTES.INDEX}>
          <ArrowBack className="h-6" />
        </Link>
      ) : (
        <Link to={ROUTES.SETTINGS}>
          <Settings className="h-6" />
        </Link>
      ),

    [location],
  );

  return component;
};

export const Header = () => {
  return (
    <div className="flex flex-row items-center justify-between py-8">
      <div className="flex flex-row items-center">
        <img src={Logo} alt="Web Monetization Logo" className="h-6" />
        <p className="ml-3 text-strong text-xl">Web Monetization</p>
      </div>
      <div className="flex flex-row items-center">
        <NavigationButton />
      </div>
    </div>
  );
};
