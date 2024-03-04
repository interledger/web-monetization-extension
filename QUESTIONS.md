1. What will the default amount be for wallets not using USD, such as BTC?

- BTC Scale - scale 8 -> 0.00000060BTC ~~ $0.04 <<< $0.60
- XRP Scale - scale 6 - 0.000060XRP ~~ $0.000039 <<<<<< $0.60
- Should users also have the option to define their rate of pay when setting up their wallet?
- Probably we need a rates service for correct conversion???

2. How do we handle scenarios where the wallet's asset scale is low (for example, 2)? Should we opt for sending the minimum amount, like 0.02, and avoid sending it every second? What is going to happen if the user reloads the page - will we send the minimum amount again?

3. Do we need to handle multiple link tags for V1?

   3.1. We split the amount that needs to be sent every second?

   3.2. What should happen when the wallet address has a low asset scale (2 for example)?

   - If the sending wallet address has a low asset scale how are we splitting the amounts? For asset scale 2 it will need to send 4 units ($0.04) - $0.02 for each link tag
   - If the receiving wallet address has a low asset scale - we will need to ignore the WM user rate of pay and send the minimum amount x number links (two links, with the minimum amount of 2 units - $0.04)

4. During the work week it was decided to have the exception list in the follwing format:

```json
{
  "exceptionList": {
    "https://example.com": {
      "amount": "1",
      "interval": "???"
    },
    "https://example.com/path/to/article": {
      "amount": "1",
      "interval": "???"
    }
  }
}
```

What does the `interval` property represent?

5. Should we have another extension icon with an orange dot - the page has a monetization link (valid or not) but WM is disabled globally or for this URL?

6. For the recurring monthly amount - what should be the top-up date? If the user sets up the wallet on 15th of March, the next top-up should happen on 15th of April or should we always top up at start of the month?

7. For clarity, is this how the `load` and `error` events need to be triggered?

   7.1. User lands on page

   7.2. We check if WM is enabled for the current page

   7.2.1. If WM is disabled globally or for the current URL - noop
   7.2.2. If WM is enabled - continue to step 7.3

   7.3. We search for link tags in the document

   7.3.1. No link tags found - noop

   7.3.2. When a link tag is found - we fetch its information

   - valid JSON response - dispatch `load` event at link tag
   - not a valid JSON response - dispatch `error` event at link tag
