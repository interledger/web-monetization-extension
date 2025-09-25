import React from 'react';
import { getBrowserName } from '@/shared/helpers';
import { useBrowser, useTranslation } from '@/app/lib/context';

export default () => {
  return (
    <div
      className="flex min-h-screen flex-col items-center bg-fixed sm:overflow-hidden landscape:justify-center"
      style={{
        backgroundImage: `url("/assets/images/bg-tile.svg")`,
        backgroundSize: '40vmax',
      }}
    >
      <div className="flex min-h-screen w-full max-w-screen-2xl flex-1 grid-cols-2 flex-col items-stretch gap-6 p-3 sm:p-8 landscape:grid landscape:p-4">
        <Header />
        <div className="flex items-center">
          <Main />
        </div>
      </div>
    </div>
  );
};

const Header = () => {
  const t = useTranslation();
  return (
    <div className="text-center landscape:mt-[33vh]">
      <img
        src="/assets/images/logo.svg"
        className="mx-auto mb-4 w-16 text-center landscape:w-36 landscape:2xl:w-48"
        alt=""
      />
      <p className="text-xl font-bold text-secondary-dark landscape:mb-2 landscape:text-3xl landscape:2xl:mb-3 landscape:2xl:text-4xl">
        {t('tagline_text_1')}
      </p>
      <p className="text-xl font-light text-secondary-dark landscape:text-3xl landscape:2xl:text-4xl">
        {t('tagline_text_2')}
      </p>
    </div>
  );
};

const Main = () => {
  const _t = useTranslation();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-lg border border-gray-200 bg-gray-50/75 p-3 shadow-md backdrop-blur-0 sm:p-8">
      <h2 className="rounded-sm bg-gray-100 p-2 text-center text-base font-semibold sm:rounded-2xl sm:p-4 sm:text-lg">
        Welcome to the Web Monetization Extension
      </h2>

      <div className="space-y-4 bzg-white zp-4">
        <p>
          To get started, we want to be transparent about what data is shared
          and how it’s used.
        </p>
        <p>
          By continuing, you give your consent to share the following
          information:
        </p>

        <DataShared />
        <DataNotShared />
        <Permissions />
      </div>
    </div>
  );
};

function DataShared() {
  const browser = useBrowser();

  const browserName = getBrowserName(browser, navigator.userAgent);
  const [extensionName, setExtensionName] = React.useState('');
  React.useEffect(() => {
    browser.management.getSelf().then((s) => {
      setExtensionName(s.name);
    });
  }, [browser]);

  return (
    <div className="space-y-2">
      <h3 className="font-semibold">Data Shared</h3>
      <div>
        <h4 className="font-medium">With your wallet provider</h4>
        <ul className="list-disc ml-4">
          <li>
            When you connect your wallet (if you choose automatic key addition):
            <ul className="list-disc ml-4">
              <li>Browser name ({browserName})</li>
              <li>
                Extension name {extensionName ? `(${extensionName})` : ''}
              </li>
            </ul>
          </li>
          <li>You’ll always be asked for consent before any connection.</li>
          <li>
            Your IP address,{' '}
            <span
              className="underline decoration-dotted decoration-gray-400"
              title="via the `Accept-Language` HTTP header"
            >
              language
            </span>{' '}
            and{' '}
            <span
              className="underline decoration-dotted decoration-gray-400"
              title="via the `User-Agent` HTTP header"
            >
              browser version information
            </span>{' '}
            when making automatic or manual payments.
          </li>
        </ul>
      </div>

      <div>
        <h4 className="font-medium">
          With the wallets used on websites you visit that use Web Monetization:
        </h4>
        <ul className="list-disc ml-4">
          <li>
            Your IP address,{' '}
            <span
              className="underline decoration-dotted decoration-gray-400"
              title="via the `Accept-Language` HTTP header"
            >
              language
            </span>{' '}
            and{' '}
            <span
              className="underline decoration-dotted decoration-gray-400"
              title="via the `User-Agent` HTTP header"
            >
              browser version information
            </span>{' '}
            .
          </li>
          <li>Your wallet address.</li>
        </ul>
      </div>
    </div>
  );
}

function DataNotShared() {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold">What’s not shared</h3>
      <ul className="list-disc ml-4">
        <li>
          Your wallet address, balance, or currency are not shared with websites
          you visit.
        </li>
        <li>Your browsing history — it stays private in your browser.</li>
      </ul>
    </div>
  );
}

function Permissions() {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold">Extension Permissions</h3>
      <p>
        This extension requires certain{' '}
        <a
          href="https://github.com/interledger/web-monetization-extension/blob/main/docs/PERMISSIONS.md"
          className="group pr-1 text-primary outline-current hover:underline"
          target="_blank"
          rel="noreferrer noopener"
        >
          permissions for basic functionality.
        </a>
      </p>
    </div>
  );
}
