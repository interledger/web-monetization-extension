1. What will the default amount be for wallets not using USD, such as BTC?

   - Should users also have the option to define their rate of pay when setting up their wallet?

2. How do we handle scenarios where the wallet's asset scale is low (for example, 2)? Should we opt for sending the minimum amount, like 0.02, and avoid sending it every second? What is going to happen if the user reloads the page - will we send the minimum amount again?

3. During the work week it was decided to have the exception list in the follwing format:

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

4. Should we have another extension icon with an orange dot - the page has a monetization link (valid or not) but WM is disabled globally or for this URL?
