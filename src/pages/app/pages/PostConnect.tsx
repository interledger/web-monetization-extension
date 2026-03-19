import { cva } from 'class-variance-authority';
import React from 'react';
import { navigate } from 'wouter/use-hash-location';
import { isErrorWithKey } from '@/shared/helpers';
import { useTranslation } from '@/app/lib/context';
import { useAppState } from '@/app/lib/store';
import type {
  WalletStatus,
  WalletStatusCancel,
  WalletStatusFailure,
} from '@/shared/types';

export default function PostConnect() {
  const t = useTranslation();
  const { transientState } = useAppState();

  if (!transientState.connect || transientState.connect.type === 'progress') {
    return <p>Nothing to see here</p>;
  }

  const params = mapStatusToMessage(transientState.connect as WalletStatus, t);
  if (!params) {
    return <p>No mapping from status to messages!!</p>;
  }

  return (
    <div className="bg-white md:bg-gray-50 flex h-screen w-screen flex-col items-center justify-center gap-6 md:gap-14 p-3 md:p-4">
      <header className="flex gap-2 items-center w-fit mx-auto mt-8 md:mt-16 md:mb-14 text-center">
        <img
          src="/assets/images/logo.svg"
          alt="Web Monetization"
          className="h-6 md:h-16"
        />
        <h1 className="text-base md:text-4xl font-bold text-secondary-dark">
          Web Monetization extension
        </h1>
      </header>

      <div className="md:p-8 md:border rounded-lg bg-white bg-opacity-75 border-gray-100 mb-auto flex flex-col items-center gap-6 text-center w-full md:w-[42rem]">
        <img
          className="h-8 w-8 md:w-32 md:h-32"
          src={params.image.src}
          alt={params.image.alt}
        />

        <h2 className="text-3xl md:text-4xl font-bold">{params.heading}</h2>

        <p className="text-lg whitespace-pre-wrap">{params.info}</p>

        <div className="flex flex-col gap-3">
          {params.retryPossible === 'auto' && params.retryMessage && (
            <button
              type="button"
              className={ButtonVariants({ variant: 'solid' })}
            >
              Try again
            </button>
          )}

          {params.retryPossible && params.intent === 'connect' && (
            // biome-ignore lint/a11y/useValidAnchor: link is used for handling behaviors like right-click to open in new tab, copying link address, etc.
            <a
              href="/pages/app/index.html#post-install"
              onClick={(ev) => {
                ev.preventDefault();
                navigate('#post-install', { state: { focusConnect: true } });
              }}
              className={ButtonVariants({
                variant: params.retryPossible === 'auto' ? 'outline' : 'solid',
              })}
            >
              Change the wallet address or budget amount
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

const ButtonVariants = cva(
  'border border-popup px-6 py-3 rounded-xl w-full md:w-96 text-base',
  {
    variants: {
      variant: {
        solid: 'bg-button-base text-white',
        outline: 'bg-white text-secondary-dark',
      },
    },
  },
);

function mapStatusToMessage(
  status: WalletStatus,
  t: Localizer,
): MessageParams | null {
  if (status.type === 'progress') {
    throw new Error('Invalid state to show on this page');
  }

  if (status.type === 'success') {
    const { heading, info } = mapSuccessMessage(status, t);
    return {
      heading,
      info,
      image: getImage('success'),
      retryPossible: false,
      intent: status.intent,
    };
  }

  if (status.type === 'cancel') {
    if (status.code === 'tab_closed') return null;
    const { heading, info } = mapCancelMessage(status, t);
    return {
      heading,
      info,
      image: getImage('warning'),
      intent: status.intent,
      retryPossible: status.retryPossible,
      retryMessage: status.retryMessage,
    };
  }

  const { heading, info } = mapFailureMessage(status, t);
  return {
    heading,
    info,
    image: getImage('error'),
    intent: status.intent,
    retryPossible: status.retryPossible,
    retryMessage: status.retryMessage,
  };
}

function mapSuccessMessage(
  status: Extract<WalletStatus, { type: 'success' }>,
  t: Localizer,
): MessageContent {
  const SUCCESS_MSGS: Record<WalletStatus['intent'], MessageContent> = {
    connect: {
      heading: t('postConnect_connect_success_title'),
      info: t('postConnect_connect_success_msg'),
    },
    add_funds: {
      heading: t('postConnect_addFunds_success_title'),
      info: t('postConnect_addFunds_success_msg'),
    },
    update_budget: {
      heading: t('postConnect_updateBudget_success_title'),
      info: t('postConnect_updateBudget_success_msg'),
    },
    reconnect: {
      heading: t('postConnect_reconnect_success_title'),
      info: t('postConnect_reconnect_success_msg'),
    },
  };
  return SUCCESS_MSGS[status.intent];
}

function mapCancelMessage(
  status: Extract<WalletStatus, { type: 'cancel' }>,
  t: Localizer,
): MessageContent {
  if (status.code === 'tab_closed') {
    throw new Error('Unexpected status code');
  }

  const CANCEL_MSGS: Record<
    WalletStatus['intent'],
    Record<Exclude<WalletStatusCancel['code'], 'tab_closed'>, MessageContent>
  > = {
    connect: {
      grant_rejected: {
        heading: t('postConnect_connect_cancel_grantRejected_title'),
        info: t('postConnect_connect_cancel_grantRejected_msg'),
      },
    },
    add_funds: {
      grant_rejected: {
        heading: t('postConnect_addFunds_cancel_grantRejected_title'),
        info: t('postConnect_addFunds_cancel_grantRejected_msg'),
      },
    },
    update_budget: {
      grant_rejected: {
        heading: t('postConnect_updateBudget_cancel_grantRejected_title'),
        info: t('postConnect_updateBudget_cancel_grantRejected_msg'),
      },
    },
    reconnect: {
      grant_rejected: {
        heading: t('postConnect_reconnect_cancel_grantRejected_title'),
        info: t('postConnect_reconnect_cancel_grantRejected_msg'),
      },
    },
  };
  return CANCEL_MSGS[status.intent][status.code];
}

function mapFailureMessage(
  status: Extract<WalletStatus, { type: 'failure' }>,
  t: Localizer,
): MessageContent {
  const FAILURE_MSGS: Record<
    WalletStatus['intent'],
    (
      code: WalletStatusFailure['code'],
      details: WalletStatusFailure['details'],
    ) => MessageContent
  > = {
    connect(code, details) {
      if (code === 'timeout') {
        return {
          heading: t('postConnect_connect_failure_timeout_title'),
          info: t('postConnect_connect_failure_timeout_msg'),
        };
      }
      if (code === 'key_add_failed') {
        const infoPlus = isErrorWithKey(details)
          ? t(details.key, [...details.substitutions])
          : details?.message;
        return {
          heading: t('postConnect_connect_failure_keyAdd_title'),
          info: t('postConnect_connect_failure_keyAdd_msg', [
            infoPlus ? `\n${infoPlus}` : '',
          ]),
        };
      }
      return {
        heading: t('postConnect_connect_failure_other_title'),
        info: t('postConnect_connect_failure_other_msg'),
      };
    },
    add_funds(code, details) {
      if (code === 'timeout') {
        return {
          heading: t('postConnect_addFunds_failure_timeout_title'),
          info: t('postConnect_addFunds_failure_timeout_msg'),
        };
      }
      const infoPlus = isErrorWithKey(details)
        ? t(details.key, [...details.substitutions])
        : details?.message;
      return {
        heading: t('postConnect_addFunds_failure_other_title'),
        info: t('postConnect_addFunds_failure_other_msg', [
          infoPlus ? `\n${infoPlus}` : '',
        ]),
      };
    },
    reconnect(code, details) {
      if (code === 'key_add_failed') {
        const infoPlus = isErrorWithKey(details)
          ? t(details.key, [...details.substitutions])
          : details?.message;
        return {
          heading: t('postConnect_reconnect_failure_keyAdd_title'),
          info: t('postConnect_reconnect_failure_keyAdd_msg', [
            infoPlus ? `\n${infoPlus}` : '',
          ]),
        };
      }
      return {
        heading: t('postConnect_reconnect_failure_other_title'),
        info: t('postConnect_reconnect_failure_other_msg'),
      };
    },
    update_budget(code, details) {
      if (code === 'timeout') {
        return {
          heading: t('postConnect_updateBudget_failure_timeout_title'),
          info: t('postConnect_updateBudget_failure_timeout_msg'),
        };
      }
      const infoPlus = isErrorWithKey(details)
        ? t(details.key, details.substitutions)
        : details?.message;
      return {
        heading: t('postConnect_updateBudget_failure_other_title'),
        info: t('postConnect_updateBudget_failure_other_msg', [
          infoPlus ? `\n${infoPlus}` : '',
        ]),
      };
    },
  };
  return FAILURE_MSGS[status.intent](status.code, status.details);
}

function getImage(type: 'success' | 'warning' | 'error') {
  return { src: `/assets/images/icons/${type}.svg`, alt: type };
}

type Localizer = ReturnType<typeof useTranslation>;

type MessageContent = { heading: string; info: string };

type MessageParams = MessageContent & {
  image: { src: string; alt: string };
  intent: WalletStatus['intent'];
  retryPossible: false | 'auto' | 'manual';
  retryMessage?: (WalletStatusCancel | WalletStatusFailure)['retryMessage'];
};
