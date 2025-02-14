declare global {
  namespace NodeJS {
    interface ProcessEnv {
      /** Can replace with a localhost instance if needed */
      TEST_WALLET_ORIGIN: string;
      TEST_WALLET_USERNAME: string;
      TEST_WALLET_PASSWORD: string;
      /** Wallet address that we'll use to connect with the extension */
      TEST_WALLET_ADDRESS_URL: string;
      /** UUID v4 */
      TEST_WALLET_KEY_ID: string;
      /** Base-64 public key */
      TEST_WALLET_PUBLIC_KEY: string;
      /** Hex-encoded private key */
      TEST_WALLET_PRIVATE_KEY: string;
      /**
       * Another test wallet address URL for test wallet. Must have the same currency
       * as {@linkcode TEST_WALLET_ADDRESS_URL} (`_E` for "equal" currency
       * exchange rate).
       *
       * Both wallet addresses should preferably be in same account so the tests
       * continue to run without the account getting out of funds early.
       */
      TEST_WALLET_ADDRESS_URL_E: string;
      /**
       * A test wallet address URL in a currency "weaker" than {@linkcode TEST_WALLET_ADDRESS_URL}
       * @example Use a `MXN` one if `TEST_WALLET_ADDRESS_URL` is `USD`
       */
      TEST_WALLET_ADDRESS_URL_W: string;
      /**
       * A test wallet address URL in a currency "stronger" than{@linkcode TEST_WALLET_ADDRESS_URL}
       * @example Use a `GBP` one if `TEST_WALLET_ADDRESS_URL` is `USD`
       */
      TEST_WALLET_ADDRESS_URL_S: string;

      /** Fynbos wallet address (used for Fynbos specific tests only) */
      FYNBOS_WALLET_ADDRESS_URL: string | undefined;
      /** Login email for Fynbos wallet */
      FYNBOS_USERNAME: string | undefined;
      /** Login password for Fynbos wallet*/
      FYNBOS_PASSWORD: string | undefined;

      /** Chimoney wallet address (used for Chimoney specific tests only) */
      CHIMONEY_WALLET_ADDRESS_URL: string | undefined;
      /** Chimoney wallet URL origin (without trailing /) */
      CHIMONEY_WALLET_ORIGIN: string | undefined;
      /** Login email for Chimoney wallet */
      CHIMONEY_USERNAME: string | undefined;
      /** Login password for Chimoney wallet*/
      CHIMONEY_PASSWORD: string | undefined;
    }
  }

  namespace window {
    interface MonetizationEvent extends Event {
      amountSent: {
        value: string;
        currency: string;
      };
      incomingPayment: string;
      paymentPointer: string;
    }
  }
}

export {};
