import React from 'react';
import { Redirect } from 'wouter';
import { getBrowserName, isConsentRequired } from '@/shared/helpers';
import { getResponseOrThrow } from '@/shared/messages';
import { useBrowser, useMessage, useTranslation } from '@/app/lib/context';
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
  const t = useTranslation();
  return (
    <header className="text-center">
      <img
        src="/assets/images/logo.svg"
        className="mx-auto md:mb-4 w-12 md:w-20 text-center"
        alt=""
      />
      <h1 className="text-2xl font-bold text-secondary-dark landscape:mb-2 landscape:text-3xl landscape:2xl:mb-3 landscape:2xl:text-4xl">
        {t('postInstallConsent_text_title')}
      </h1>
    </header>
  );
};

const Main = () => {
  const t = useTranslation();
  return (
    <main className="mx-auto w-full max-w-3xl p-3 sm:p-8">
      <div className="space-y-4 mb-48">
        <p>{t('postInstallConsent_text_header1')}</p>
        <p>{t('postInstallConsent_text_header2')}</p>

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
  const t = useTranslation();
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
      <h3 className="font-semibold text-xl text-alt">
        {t('postInstallConsent_text_dataShared_title')}
      </h3>
      <div className="space-y-1">
        <h4 className="font-medium text-lg">
          {t('postInstallConsent_text_dataShared_yourWallet_title')}
        </h4>
        <ul className="list-disc ml-4">
          <li>
            {t('postInstallConsent_text_dataShared_yourWallet_keyName')}
            <ul className="list-disc ml-4">
              <li>Browser name: {browserName}</li>
              <li>Extension name: {extensionName}</li>
            </ul>
          </li>
          <li>
            {t('postInstallConsent_text_dataShared_yourWallet_headers')}
            <InformationTooltip
              text={t('postInstallConsent_text_dataShared_headers')}
            />
          </li>
        </ul>
        <p>{t('postInstallConsent_text_dataShared_yourWallet_keyConsent')}</p>
      </div>

      <div className="space-y-1">
        <h4 className="font-medium text-lg">
          {t('postInstallConsent_text_dataShared_websiteWallets_title')}
        </h4>
        <ul className="list-disc ml-4">
          <li>
            {t('postInstallConsent_text_dataShared_websiteWallets_headers')}
            <InformationTooltip
              text={t('postInstallConsent_text_dataShared_headers')}
            />
          </li>
          <li>{t('postInstallConsent_text_dataShared_websiteWallets_wa')}</li>
        </ul>
      </div>
    </div>
  );
}

function DataNotShared() {
  const t = useTranslation();
  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-xl text-alt">
        {t('postInstallConsent_text_dataNotShared_title')}
      </h3>
      <ul className="list-disc ml-4">
        <li>{t('postInstallConsent_text_dataNotShared_walletDetails')}</li>
        <li>{t('postInstallConsent_text_dataNotShared_browsingHistory')}</li>
      </ul>
    </div>
  );
}

function Permissions() {
  const t = useTranslation();
  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-xl text-alt">
        {t('postInstallConsent_text_permissions_title')}
      </h3>
      <p>
        {t('postInstallConsent_text_permissions_text')}{' '}
        <a
          href="https://github.com/interledger/web-monetization-extension/blob/main/docs/PERMISSIONS.md"
          className="group pr-1 text-primary outline-current hover:underline"
          target="_blank"
          rel="noreferrer noopener"
        >
          {t('postInstallConsent_text_permissions_linkText')}
        </a>
      </p>
    </div>
  );
}

function AcceptForm() {
  const t = useTranslation();
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
        <p>{t('postInstallConsent_state_consentProvided')}</p>
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
        <span className="">{t('postInstallConsent_text_confirmation')}</span>
      </label>
      <Button type="submit" className="w-full sm:w-auto">
        {t('postInstallConsent_action_confirm')}
      </Button>
    </form>
  );
}

function InformationTooltip({ text }: { text: string }) {
  return (
    <span title={text}>
      <InfoCircle className="inline-block h-5 w-5 ml-1 -mt-1 text-gray-500" />
    </span>
  );
}
