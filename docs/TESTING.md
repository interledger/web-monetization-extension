# Automated Testing

## Unit tests

Run `pnpm test` to run unit tests locally. These tests are run automatically on every pull request.

## End-to-end Tests

To run end-to-end tests, run `pnpm test:e2e` in terminal. To run tests with Chrome only, run `pnpm test:e2e:chrome`.

Make sure you run `pnpm build chrome` before running tests.

**Before you begin**, you need to setup some environment variables/secrets in `tests/e2e/.env`.

1. Copy `tests/e2e/.env.example` to `tests/e2e/.env`
2. Update `tests/e2e/.env` with your secrets.

Environment variables for test are defined in [`env.d.ts` as `TestEnvVars`](../tests/e2e/env.d.ts).

To get the `TEST_WALLET_KEY_ID`, `TEST_WALLET_PRIVATE_KEY` and `TEST_WALLET_PUBLIC_KEY` vars, follow these steps:

1. Load the extension in browser (via `chrome://extensions/`)
   - Once the extension is loaded, it'll generate a key-pair that we will need to connect with our wallet.
1. Inspect service worker with "Inspect views service worker"
1. Run following in devtools console to copy keys to your clipboard, and paste it in `tests/e2e/.env`:
   ```js
   // 1. Gets generated keys from extension storage.
   // 2. Converts result to `TEST_WALLET_{X}="VAL"` format for use in .env file.
   // 3. Copies result to clipboard.
   copy(
     Object.entries(
       await chrome.storage.local.get(['privateKey', 'publicKey', 'keyId']),
     )
       .map(
         ([k, v]) =>
           `TEST_WALLET_${k.replace(/([A-Z])/g, '_$1').toUpperCase()}="${v}"`,
       )
       .join('\n'),
   );
   ```
1. Then copy `TEST_WALLET_PUBLIC_KEY` key to https://wallet.interledger-test.dev/settings/developer-keys under your wallet address.
1. Now you're ready to run the tests.

### How to run in end-to-end tests in GitHub

As these tests are expensive/time-consuming, these need to be triggered manually when needed, instead of on every pull request/commit.

For a pull request, users with write access to repository can trigger the workflow to run end-to-end tests by adding a review-comment (from PR Files tab) with body `test-e2e` (exactly).

End-to-end tests run automatically daily before creating the Nightly release. You can also trigger that workflow manually from [Actions Dashboard](https://github.com/interledger/web-monetization-extension/actions/workflows/nightly-build.yaml).
