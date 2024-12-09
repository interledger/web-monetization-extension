import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAppState } from '@/app/lib/store';
import { ROUTES } from '@/app/App';

const Redirect = () => {
  const state = useAppState();

  if (!state.connected) {
    return <Navigate to={ROUTES.POST_INSTALL} />;
  }

  return null;
};

export const MainLayout = () => {
  return (
    <>
      <Redirect />
      <Outlet />
    </>
  );
};
