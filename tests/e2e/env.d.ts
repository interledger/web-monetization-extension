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
    }
  }
}

export {};
