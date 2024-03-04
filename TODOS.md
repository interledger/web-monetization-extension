### Background

- [x] Custom Logger
- [ ] Finish monetization service
- [ ] Add handlers to update the extension icon based on WM state
- [ ] We need to treat URLs as ORIGIN + PATHNAME (ex: https://example.com/path/to/category?show=20 => https://example.com/path/to/category - ignore search params)
- [ ] (TBD) Interaction polling instead of the redirecting to http://localhost

### Popup

- [ ] Custom Logger

### Content

- [ ] Configure container
- [ ] Custom Logger
- [ ] Configure messages between content script and background
- [ ] Audit MonetizationTagManager
  - [ ] Retrieve WM state from background (method in the background storage that accepts a URL as parameter returns true or false)
  - [ ] If there is no connected wallet - noop
  - [ ] If WM is disabled - noop
  - [ ] If WM is enabled - Use `getWalletInformation` utility function to validate the wallet address that was found in the page
  - [ ] If the URL is a valid wallet address, dispatch the `load` event at the link tag and start streaming money
  - [ ] If the URL is not a valid address, dispatch the `error` event at the link tag

### Project

- [ ] Audit package.json
- [ ] Audit webpack config
- [ ] Audit tsconfig
- [ ] Audit jest config & setup
- [ ] Update ESLint Config
- [ ] Add `prettier-plugin-tailwindcss`
- [ ] Update README
- [ ] Setup Renovate
- [ ] Use JS/TS file to build the extension/run dev/profiler - based on Alex's Lunch & Learn
- [ ] CSP with sha256 hash when building the extension

### Testing

- [ ] E2E Testing - Playwright/Cypress/Puppeteer
