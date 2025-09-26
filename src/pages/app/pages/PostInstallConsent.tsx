import React from 'react';
import { getBrowserName } from '@/shared/helpers';
import { useBrowser, useTranslation } from '@/app/lib/context';
import { Button } from '@/pages/shared/components/ui/Button';

export default () => {
  return (
    <div
      className="flex min-h-screen flex-col items-center bg-fixed sm:overflow-hidden landscape:justify-center"
      style={{
        backgroundImage: `url("/assets/images/bg-tile.svg")`,
        backgroundSize: '40vmax',
      }}
    >
      <div className="space-y-6 w-full max-w-screen-2xl flex-1 items-stretch p-3 sm:p-8 landscape:p-4">
        <Header />
        <Main />
      </div>
    </div>
  );
};

const Header = () => {
  const t = useTranslation();
  return (
    <header className="text-center">
      <img
        src="/assets/images/logo.svg"
        className="mx-auto mb-4 w-20 text-center"
        alt=""
      />
      <h1 className="text-2xl font-bold text-secondary-dark landscape:mb-2 landscape:text-3xl landscape:2xl:mb-3 landscape:2xl:text-4xl">
        Welcome to the Web Monetization Extension
      </h1>
    </header>
  );
};

const Main = () => {
  const _t = useTranslation();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-lg border border-gray-200 bg-white shadow-md p-3 sm:p-8">
      <div className="space-y-4">
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

      <div className="fixed bottom-0 inset-x-0 w-full bg-white p-4 flex justify-center shadow-2xl shadow-black">
        <AcceptForm />
      </div>
    </main>
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
      <h3 className="font-semibold text-xl text-alt">Data Shared</h3>
      <div className="space-y-1">
        <h4 className="font-medium text-lg">With your wallet provider</h4>
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
            <TooltipText title="via the `Accept-Language` HTTP header">
              language
            </TooltipText>{' '}
            and{' '}
            <TooltipText title="via the `User-Agent` HTTP header">
              browser version information
            </TooltipText>{' '}
            when making automatic or manual payments.
          </li>
        </ul>
      </div>

      <div className="space-y-1">
        <h4 className="font-medium text-lg">
          With the wallets used on websites you visit that use Web Monetization:
        </h4>
        <ul className="list-disc ml-4">
          <li>
            Your IP address,{' '}
            <TooltipText title="via the `Accept-Language` HTTP header">
              language
            </TooltipText>{' '}
            and{' '}
            <TooltipText title="via the `User-Agent` HTTP header">
              browser version information
            </TooltipText>{' '}
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
      <h3 className="font-semibold text-xl text-alt">What’s not shared</h3>
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
      <h3 className="font-semibold text-xl text-alt">Extension Permissions</h3>
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

function AcceptForm() {
  return (
    <form className="flex items-center justify-between w-full max-w-2xl flex-col md:flex-row md:gap-4">
      <label className="flex gap-2 items-start">
        <input type="checkbox" required className="rounded-sm mt-1" />
        <span className="">
          I confirm that I understand and consent to this data usage.
        </span>
      </label>
      <Button type="submit">Confirm and continue</Button>
    </form>
  );
}

const TooltipText = ({
  title,
  children,
}: React.PropsWithChildren<{ title: string }>) => (
  <span
    className="underline decoration-dotted decoration-gray-400"
    title={title}
  >
    {children}
  </span>
);
