interface TestEnvVars {
  /** Login email for the test wallet */
  TEST_WALLET_USERNAME: string;
  /** Login password for the test wallet @secret */
  TEST_WALLET_PASSWORD: string;
  /** Wallet address that we'll use to connect with the extension */
  TEST_WALLET_ADDRESS_URL: string;

  /** ID of the key that will be connected to extension (UUID v4) */
  TEST_WALLET_KEY_ID: string;
  /** Base-64 public key */
  TEST_WALLET_PUBLIC_KEY: string;
  /** Hex-encoded private key @secret */
  TEST_WALLET_PRIVATE_KEY: string;

  // If either of following is not provided, relevant tests will be skipped.
  /** Fynbos wallet address (used for Fynbos specific tests only) */
  FYNBOS_WALLET_ADDRESS_URL: string | undefined;
  /** Login email for Fynbos wallet */
  FYNBOS_USERNAME: string | undefined;
  /** Login password for Fynbos wallet @secret */
  FYNBOS_PASSWORD: string | undefined;

  // If either of following is not provided, relevant tests will be skipped.
  /** Chimoney wallet address (used for Chimoney specific tests only) */
  CHIMONEY_WALLET_ADDRESS_URL: string | undefined;
  /** Chimoney wallet URL origin (without trailing /) */
  CHIMONEY_WALLET_ORIGIN: string | undefined;
  /** Login email for Chimoney wallet */
  CHIMONEY_USERNAME: string | undefined;
  /** Login password for Chimoney wallet @secret */
  CHIMONEY_PASSWORD: string | undefined;

  // If variables in following group are not provided, tests will not be run
  // for `interledger.cards` wallet. You must provide wallet addresses in at
  // least one format - interledger.cards & ilp.dev.
  /** Login email for interledger.cards wallet (used for interledger.cards specific tests only) @secret */
  INTERLEDGER_CARDS_USERNAME: string | undefined;
  /** Login password for interledger.cards wallet @secret */
  INTERLEDGER_CARDS_PASSWORD: string | undefined;
  /** interledger.cards wallet address URL */
  INTERLEDGER_CARDS_WALLET_ADDRESS_URL: string | undefined;
  /** interledger.cards $ilp.dev wallet address */
  INTERLEDGER_CARDS_ILP_DEV_WALLET_ADDRESS_URL: string | undefined;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv extends TestEnvVars {}
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
