import React from 'react';
import { useBrowser } from '@/app/lib/context';

export const Component = () => {
  const browser = useBrowser();

  return (
    <div
      className="grid h-screen w-full grid-cols-2 p-12"
      style={{
        backgroundImage: `url("/assets/images/bg-tile.svg")`,
        backgroundSize: '50rem',
      }}
    >
      <LeftCol />
      <RightCol openPopup={() => browser.action.openPopup({})} />
    </div>
  );
};

const LeftCol = () => {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1">
      <div className="mb-6">
        <img src="/assets/images/logo.svg" className="w-60" alt="" />
      </div>
      <p className="text-5xl font-bold text-secondary-dark">
        Support content you love
      </p>
      <p className="text-5xl font-light text-secondary-dark">
        Pay as you browse
      </p>
    </div>
  );
};

const RightCol = ({ openPopup }: { openPopup: () => Promise<void> }) => {
  return (
    <div className="flex h-full flex-col gap-6">
      <header className="rounded-2xl bg-gray-100 p-6 text-xl">
        Welcome to your Web Monetization extension!
      </header>

      <p className="bg-gray-100 p-6">
        Get ready to start using Web Monetization! Don’t worry we’ve got helpful{' '}
        <a href="https://webmonetization.org" target="_blank" rel="noreferrer">
          links and resources
        </a>{' '}
        to guide you. Here are few things you’ll need before setting up your
        extension:
      </p>

      <div className="h-full bg-white p-4 outline outline-gray-100">
        <Steps />
      </div>

      <div className="ml-auto mt-auto px-6">
        <button
          className="rounded-md bg-white px-4 py-2 text-lg font-medium shadow-md shadow-purple-500"
          onClick={openPopup}
        >
          {"Let's Go!"}
        </button>
      </div>
    </div>
  );
};

const Steps = () => {
  return <p>steps come here</p>;
};
