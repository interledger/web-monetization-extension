import React from 'react';
import { Redirect } from 'wouter';
import { md } from 'imd/react';
import { isConsentRequired } from '@/shared/helpers';
import { getResponseOrThrow } from '@/shared/messages';
import {
  useBrowser,
  useBrowserInfo,
  useMessage,
  useTranslation,
} from '@/app/lib/context';
import { dispatch, useAppState } from '@/app/lib/store';
import { Button } from '@/pages/shared/components/ui/Button';
import { SwitchButton } from '@/pages/shared/components/ui/Switch';
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
        {t('postInstallConsent_title')}
      </h1>
    </header>
  );
};

const Main = () => {
  const t = useTranslation();
  const telemetryConsentRef = React.useRef<HTMLInputElement>(null);

  return (
    <main className="mx-auto w-full max-w-3xl p-3 sm:p-8">
      <div className="space-y-4 mb-48">
        <div className="space-y-1">
          <p>{t('postInstallConsent_header_text__1')}</p>
          <p>{t('postInstallConsent_header_text__2')}</p>
        </div>

        <DataShared />
        <DataSharedBrowser />
        <Telemetry ref={telemetryConsentRef} />
        <Permissions />
      </div>

      <div className="fixed bottom-0 inset-x-0 w-full bg-white p-4 flex justify-center shadow-2xl shadow-black">
        <AcceptForm telemetryConsentRef={telemetryConsentRef} />
      </div>
    </main>
  );
};

function DataShared() {
  const t = useTranslation();

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-xl text-alt">
        {t('postInstallConsent_dataShared_title')}
      </h3>
      <div className="space-y-1">
        <h4 className="font-medium text-lg">
          {t('postInstallConsent_dataShared_yourWallet_title')}
        </h4>
        <p>{t('postInstallConsent_dataShared_yourWallet_wa_text')}</p>
        <p>{t('postInstallConsent_dataShared_yourWallet_keyConsent_text')}</p>
      </div>

      <div className="space-y-1">
        <h4 className="font-medium text-lg">
          {t('postInstallConsent_dataShared_websiteWallets_title')}
        </h4>
        <p>{t('postInstallConsent_dataShared_websiteWallets_wa_text')}</p>
      </div>

      <div className="space-y-1">
        <h4 className="font-medium text-lg">
          {t('postInstallConsent_dataShared_websites_title')}
        </h4>
        <p>{t('postInstallConsent_dataShared_websites_desc')}</p>
      </div>
    </div>
  );
}

function DataSharedBrowser() {
  const t = useTranslation();
  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-xl text-alt">
        {t('postInstallConsent_dataShared_browser_title')}
      </h3>
      <p>
        {t('postInstallConsent_dataShared_browser_desc')}{' '}
        <InformationTooltip
          text={t('postInstallConsent_dataShared_headers_text')}
        />
      </p>
    </div>
  );
}

function Telemetry({ ref }: { ref: TelemetryConsentRef }) {
  const t = useTranslation();
  const { consentTelemetry } = useAppState();
  const [isOptedIn, setIsOptedIn] = React.useState(
    typeof consentTelemetry === 'undefined' || consentTelemetry,
  );

  return (
    <form className="space-y-2">
      <h3 className="font-semibold text-xl text-alt">
        {t('postInstallConsent_dataCollection_title')}
      </h3>
      <p>{t('postInstallConsent_dataCollection_desc')}</p>

      <div className="space-y-1">
        <h4 className="font-medium text-lg">
          {t('postInstallConsent_dataCollection_yes_heading')}
        </h4>
        <ul className="list-disc ml-4">
          <li>
            {md(t('postInstallConsent_dataCollection_yes_text__1'), {
              link: (children, href) => (
                <a
                  href={href}
                  className="pr-1 text-primary outline-current hover:underline"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {children}
                </a>
              ),
            })}
          </li>
          <li>{t('postInstallConsent_dataCollection_yes_text__2')}</li>
        </ul>
      </div>

      <div className="space-y-1">
        <h4 className="font-medium text-lg">
          {t('postInstallConsent_dataCollection_no_heading')}
        </h4>
        <ul className="list-disc ml-4">
          <li>{t('postInstallConsent_dataCollection_no_text__1')}</li>
          <li>{t('postInstallConsent_dataCollection_no_text__2')}</li>
        </ul>
      </div>

      <label
        htmlFor="consent-field-telemetry"
        className="my-6 font-medium text-lg flex items-center gap-4"
      >
        <span>{t('postInstallConsent_dataCollection_optIn_label')}</span>
        <SwitchButton
          form="consent-form"
          id="consent-field-telemetry"
          name="consent-field-telemetry"
          checked={isOptedIn}
          onChange={(ev) => setIsOptedIn(ev.currentTarget.checked)}
          ref={ref}
          size="small"
        />
      </label>

      <p>{t('postInstallConsent_dataCollection_footer')}</p>
    </form>
  );
}

function Permissions() {
  const t = useTranslation();
  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-xl text-alt">
        {t('postInstallConsent_permissions_title')}
      </h3>
      <p>
        {md(t('postInstallConsent_permissions_text'), {
          link: (children, href) => (
            <a
              href={href}
              className="group pr-1 text-primary outline-current hover:underline"
              target="_blank"
              rel="noreferrer noopener"
            >
              {children}
            </a>
          ),
        })}
      </p>
    </div>
  );
}

function AcceptForm({
  telemetryConsentRef,
}: {
  telemetryConsentRef: TelemetryConsentRef;
}) {
  const t = useTranslation();
  const { connected, consent } = useAppState();
  const message = useMessage();
  const browser = useBrowser();
  const browserInfo = useBrowserInfo();
  const hasChanges = useAcceptFormHasChanges(telemetryConsentRef);

  const onSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const formData = new FormData(ev.currentTarget);
    let consentTelemetry = formData.get('consent-field-telemetry') === 'on';
    if (browserInfo.name === 'firefox') {
      const permission = {
        data_collection: ['technicalAndInteraction' as const],
      };
      if (consentTelemetry) {
        const granted = await browser.permissions.request(permission);
        if (!granted) {
          consentTelemetry = false;
          telemetryConsentRef.current?.click();
        }
      } else {
        await browser.permissions.remove(permission);
      }
    }
    const res = await message.send('PROVIDE_CONSENT', { consentTelemetry });
    const consent = getResponseOrThrow(res);
    dispatch({ type: 'SET_CONSENT', data: { consent, consentTelemetry } });
  };

  if (!isConsentRequired(consent)) {
    if (!connected) {
      return <Redirect to={ROUTES.DEFAULT} />;
    }

    if (!hasChanges) {
      return (
        <div className="max-w-2xl flex gap-2" role="alert">
          <InfoCircle className="size-6 flex-shrink-0" />
          <p>{t('postInstallConsent_consentProvided_text')}</p>
        </div>
      );
    }
  }

  return (
    <form
      id="consent-form"
      onSubmit={onSubmit}
      className="flex items-center justify-between w-full max-w-2xl flex-col md:flex-row gap-2 md:gap-4"
    >
      <label className="flex gap-2 items-start">
        <input type="checkbox" required className="rounded-xs mt-1" />
        <span className="">{t('postInstallConsent_confirmation')}</span>
      </label>
      <Button type="submit" className="w-full sm:w-auto">
        {t('postInstallConsent_confirm_action')}
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

type TelemetryConsentRef = React.RefObject<HTMLInputElement | null>;

function useTelemetryConsentInput(
  inputRef: TelemetryConsentRef,
  initial?: boolean,
) {
  const [checked, setChecked] = React.useState(initial);

  React.useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    setChecked(input.checked);

    const observer = new MutationObserver(() => setChecked(input.checked));
    observer.observe(input, { attributes: true });
    return () => observer.disconnect();
  }, [inputRef]);

  return checked;
}

function useAcceptFormHasChanges(telemetryConsentRef: TelemetryConsentRef) {
  const { consentTelemetry } = useAppState();

  const [hasChanges, setHasChanges] = React.useState(false);
  const telemetryConsentChecked = useTelemetryConsentInput(
    telemetryConsentRef,
    consentTelemetry,
  );
  React.useEffect(() => {
    setHasChanges(() => telemetryConsentChecked !== consentTelemetry);
  }, [consentTelemetry, telemetryConsentChecked]);

  return hasChanges;
}
