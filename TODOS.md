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

---

### Monetization Flow (ContentScript <> Background)

1. Setup MutationObserver to detect link tags
2. For each found tag check if the href has a valid JSON response (based on OP Spec)
3. For each valid tag save details (Wallet Address response - `authServer`, `resourceServer` etc ... + a unique identifier - uuidv4, w/e)
   in a map/array/something and send `START_MONETIZATION` (payload wallet JSON - opt requestId TBD) event to background script
4. In background - call `monetizationServer.start()`
   4.1 request incoming payment grant
   4.2 create incoming payment - NO AMOUNT
   4.3 try to send payment - if received status code is 403, rotate token
   4.4 revoke grant after creating incoming payment
   4.5 add incoming payment details to a map - (key: tabId, value: {"uuidv4" : { ...incomingPaymentDetails, active: true }, ...})
5. Create quote with `receiveAmount = RATE_OF_PAY / 3600` to incoming payment (active: true)
6. Create outgoing payment with quote identifier (active: true)
7. Send "MONETIZATION_EVENT" to content script with `MonetizationEvent` payload + request id,
   that will dispatch a `MonetizationEvent` to the link tag
8. Watch for document visibility change
   - on `hidden`, stop monetization
     - send "STOP_MONETIZATION" event with payload requestId and mark active `false` for that requestId
   - on `visible`, resume monetization
     - send "RESUME_MONETIZATION" event with payload requestId and mark active `true` for that requestId
     - repeat steps 5-6 - if IP expired, go back to 4.1 and update payment details instead of adding a new record
9. Add tab listener to watch for closed tabs and remove payment details from map (step 4.5) for that specific tab
