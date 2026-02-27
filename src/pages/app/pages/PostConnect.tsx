import { cva } from 'class-variance-authority';
import React from 'react';
import { useSearchParams } from 'wouter';
import { navigate } from 'wouter/use-hash-location';

export default function PostConnect() {
  const [searchParams] = useSearchParams();
  const params = mapStatusToMessage(searchParams);

  if (!params) {
    return <p>Invalid URL parameters</p>;
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

        <p className="text-lg">{params.info}</p>

        <div className="flex flex-col gap-3">
          {params.retryPossible === 'auto' && (
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
              {/* Change the wallet address or budget amount */}
              Try again
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

// Most of following will be removed soon as we look into better message passing
// instead of being limited by URL parameters.
function mapStatusToMessage(
  searchParams: URLSearchParams,
): MessageParams | null {
  const DEFAULT_ERROR_MESSAGE = (intent: Intent) => {
    if (intent === 'funds') {
      return 'Something went wrong. Please try adding funds again.';
    }
    if (intent === 'update_budget') {
      return 'Something went wrong. Please try updating your budget again.';
    }
    return 'Something went wrong. Please try reconnecting your wallet.';
  };
  const CLOSE_TAB_MESSAGE = 'You may safely close this tab.';

  type ErrorCode = keyof typeof ERROR_MESSAGES;

  const ERROR_MESSAGES = {
    continuation_failed(intent: Intent): string {
      if (intent === 'funds') {
        return 'An error occurred. Please try adding funds again.';
      }
      if (intent === 'update_budget') {
        return 'An error occurred. Please try updating your budget again.';
      }
      return 'An error occurred. Please try reconnecting the wallet.';
    },
    hash_failed(intent: Intent): string {
      if (intent === 'funds') {
        return 'An error occurred. Please try adding funds again.';
      }
      if (intent === 'update_budget') {
        return 'An error occurred. Please try updating your budget again.';
      }
      return 'An error occurred. Please try reconnecting the wallet.';
    },
  };

  const MESSAGES = {
    grant_success(intent: Intent): string {
      if (intent === 'funds') {
        return 'You have successfully added more funds.';
      }
      if (intent === 'update_budget') {
        return 'You have successfully updated your budget.';
      }
      return 'Your wallet is now successfully connected to the extension.';
    },
    key_add_success(): string {
      return 'Your wallet is now successfully reconnected to the extension.';
    },
    grant_rejected(intent: Intent): string {
      if (intent === 'funds') {
        return 'No funds were added.';
      }
      if (intent === 'update_budget') {
        return 'Your budget was not updated.';
      }
      return 'Your request was successfully rejected.';
    },
    key_add_error(): string {
      return 'Something went wrong with your request. Please try reconnecting your wallet.';
    },
    grant_invalid(intent: Intent): string {
      if (intent === 'funds') {
        return 'Something went wrong with your request. Please try adding funds again.';
      }
      if (intent === 'update_budget') {
        return 'Something went wrong with your request. Please try updating your budget again.';
      }
      return 'Something went wrong with your request. Please try reconnecting your wallet.';
    },
  };

  const result = searchParams.get('result') as SuccessParam;
  const errorCode = searchParams.get('errorCode') as ErrorCode;
  const intent = (searchParams.get('intent') ?? 'connect') as Intent;

  function getImage(type: 'success' | 'error' | 'warning') {
    return { src: `/assets/images/icons/${type}.svg`, alt: type };
  }

  switch (result) {
    case 'grant_success':
      return {
        image: getImage('success'),
        heading: MESSAGES[result](intent),
        info: CLOSE_TAB_MESSAGE,
        intent,
        retryPossible: false,
      };
    case 'key_add_success':
      return {
        image: getImage('success'),
        heading: MESSAGES[result](),
        info: CLOSE_TAB_MESSAGE,
        intent,
        retryPossible: false,
      };
    case 'grant_rejected':
      return {
        image: getImage('warning'),
        heading: MESSAGES[result](intent),
        info: CLOSE_TAB_MESSAGE,
        intent,
        retryPossible: 'manual',
      };
    case 'key_add_error':
      return {
        image: getImage('error'),
        heading: MESSAGES[result](),
        info: CLOSE_TAB_MESSAGE,
        intent,
        retryPossible: 'manual',
      };
    case 'grant_invalid':
      return {
        image: getImage('error'),
        heading: MESSAGES[result](intent),
        info: CLOSE_TAB_MESSAGE,
        intent,
        retryPossible: 'manual',
      };
    case 'grant_error':
      return {
        image: getImage('error'),
        heading: ERROR_MESSAGES[errorCode]
          ? ERROR_MESSAGES[errorCode](intent)
          : DEFAULT_ERROR_MESSAGE(intent),
        info: CLOSE_TAB_MESSAGE,
        intent,
        retryPossible: 'manual',
      };
    default:
      return null;
  }
}

type SuccessParam =
  | 'grant_success'
  | 'grant_error'
  | 'grant_rejected'
  | 'grant_invalid'
  | 'key_add_success'
  | 'key_add_error';

type Intent = 'connect' | 'reconnect' | 'funds' | 'update_budget';

type MessageParams = {
  image: { src: string; alt: string };
  heading: string;
  info: string;
  intent: Intent;
  retryPossible: false | 'auto' | 'manual';
};
