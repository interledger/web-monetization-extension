import React from 'react';
import { Redirect } from 'wouter';
import { getBrowserName, isConsentRequired } from '@/shared/helpers';
import { getResponseOrThrow } from '@/shared/messages';
import { useBrowser, useMessage } from '@/app/lib/context';
import { dispatch, useAppState } from '@/app/lib/store';
import { Button } from '@/pages/shared/components/ui/Button';
import { InfoCircle } from '@/pages/shared/components/Icons';
import { ROUTES } from '../App';

export default () => {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="space-y-6 w-full p-4 sm:p-8">
        <Header />
        <Main />
      </div>
    </div>
  );
};

const Header = () => {
  return (
    <header className="text-center">
      <img
        src="/assets/images/logo.svg"
        className="mx-auto md:mb-4 w-12 md:w-20 text-center"
        alt=""
      />
      <h1 className="text-2xl font-bold text-secondary-dark landscape:mb-2 landscape:text-3xl landscape:2xl:mb-3 landscape:2xl:text-4xl">
        Welcome to the Web Monetization Extension
      </h1>
    </header>
  );
};

const Main = () => {
  return (
    <main className="mx-auto w-full max-w-3xl p-3 sm:p-8">
      <div className="space-y-4 mb-48">
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
  const { connected, consent } = useAppState();
  const message = useMessage();

  const onSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const res = await message.send('PROVIDE_CONSENT');
    const data = getResponseOrThrow(res);
    dispatch({ type: 'SET_CONSENT', data });
  };

  if (!isConsentRequired(consent)) {
    if (!connected) {
      return <Redirect to={ROUTES.DEFAULT} />;
    }
    return (
      <div className="max-w-2xl flex gap-2" role="alert">
        <InfoCircle className="size-6 flex-shrink-0" />
        <p>
          You have provided your consent to the above. Access the extension from
          the browser toolbar.
        </p>
      </div>
    );
  }

  return (
    <form
      className="flex items-center justify-between w-full max-w-2xl flex-col md:flex-row gap-2 md:gap-4"
      onSubmit={onSubmit}
    >
      <label className="flex gap-2 items-start">
        <input type="checkbox" required className="rounded-sm mt-1" />
        <span className="">
          I confirm that I understand and consent to this data usage.
        </span>
      </label>
      <Button type="submit" className="w-full sm:w-auto">
        Confirm and continue
      </Button>
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
