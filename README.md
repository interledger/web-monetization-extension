<h1 align="center">Web Monetization Extension</h1>

[![Chrome](https://img.shields.io/chrome-web-store/v/oiabcfomehhigdepbbclppomkhlknpii.svg?label=Chrome&logo=googlechrome)](https://chromewebstore.google.com/detail/web-monetization/oiabcfomehhigdepbbclppomkhlknpii) [![Firefox](https://img.shields.io/amo/v/web-monetization-extension?label=Firefox&logo=firefoxbrowser)](https://addons.mozilla.org/en-US/firefox/addon/web-monetization-extension/) [![Edge](https://img.shields.io/badge/dynamic/json?label=Edge&prefix=v&query=$.version&url=https://microsoftedge.microsoft.com/addons/getproductdetailsbycrxid/imjgemgmeoioefpmfefmffbboogighjl)](https://microsoftedge.microsoft.com/addons/detail/web-monetization/imjgemgmeoioefpmfefmffbboogighjl) [![GitHub](https://img.shields.io/github/v/release/interledger/web-monetization-extension?sort=semver&filter=v*&display_name=release&label=GitHub&logo=github)](https://github.com/interledger/web-monetization-extension/releases/latest)

[![Nightly build](https://github.com/interledger/web-monetization-extension/actions/workflows/nightly-build.yaml/badge.svg)](https://github.com/interledger/web-monetization-extension/actions/workflows/nightly-build.yaml) [![Latest Nightly build](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.github.com%2Frepos%2Finterledger%2Fweb-monetization-extension%2Freleases%2Ftags%2Fnightly&query=%24.name&logo=github&label=Latest)](https://github.com/interledger/web-monetization-extension/releases/tag/nightly)

The Web Monetization browser extension is an open source implementation of the Web Monetization draft specification - learn more [here](https://webmonetization.org/specification/). The extension is built with React and TypeScript.

## Local Development Environment

### Prerequisites

- [NVM](https://github.com/nvm-sh/nvm) (Linux, macOS), [NVM Windows](https://github.com/coreybutler/nvm-windows) (Windows) - or another Node Version Manager

## Setup

### Environment Setup

```sh
# Install Node 20
# For Linux/macOS
nvm install lts/iron
nvm use lts/iron

# For Windows
nvm install lts
nvm use lts

# Install correct version of pnpm using Corepack (Corepack comes with Node)
corepack enable
```

To install dependencies, execute:

```sh
pnpm i
```

### Commands

All commands are run from the root of the project, from a terminal:

| Command                                 | Action                                                                                                                                                                                                                                                                                                                                                        |
| :-------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm dev [target]`                     | Builds the extension for development, rebuilding on source code changes, for a specified target (`chrome` or `firefox`). If the target is not specified the script will build the extension for a Chromium based browser. Output folder: `dev`.                                                                                                               |
| `pnpm build [TARGET] --channel=CHANNEL` | Builds the extension for production usage, for a specified target (`chrome` or `firefox`) and channel (`nightly`, `preview` or `stable`). If the target is not specified the script will build the extension for all available targets. If the channel is not specified the script will build the extension for the `nightly` channel. Output folder: `dist`. |
| `pnpm test`                             | Runs all test files using Jest.                                                                                                                                                                                                                                                                                                                               |

### Installing the extension from source, in Chromium based browsers (Chrome, Opera, Edge, Brave, Arc, Vivaldi)

1. Build the extension with `pnpm build chrome`
1. Open extensions page
   In Chrome, click the three dots in the top-right corner. Look for the `Extensions` options and select `Manage extensions`.
1. Enable developer mode
   To enable `Developer mode`, use the switch at the top-right of the extensions page.
1. Load the extension
   After enabling `Developer mode`, new buttons should appear in the top-left corner. Click the `Load unpacked` one and choose the **folder** that contains the extension files (in the `dist` folder, look for the `chrome` one with the `manifest.json` file).

### Installing the extension from source, in Firefox

1. Build the extension with `pnpm build firefox`
1. Open Firefox's add-ons page
   Open Firefox, click the three horizontal lines in the top-right corner, and choose `Add-ons and themes`.
1. Navigate to the add-ons debugging page
   In the add-ons page, click the gear icon and select "Debug Add-ons".
1. Load the extension
   Look for the `Temporary Extensions` section and expand its content. After expanding its content click on the `Load Temporary Add-on...` button and select the `manifest.json` file (in the `dist` folder, go in the `firefox` folder and select the manifest file).

## Contributing

Read the [developer's guide](./docs/DEVELOP.md) to understand the codebase.

Please familiarize yourself with the [contribution guidelines](.github/CONTRIBUTING.md) before submitting contributions. All contributions must adhere to our [code of conduct](.github/CODE_OF_CONDUCT.md).

## Roadmap

[Web Monetization Roadmap](https://github.com/orgs/interledger/projects/6/views/1?filterQuery=label%3A%22web+monetization%22)

See the [open issues](https://github.com/interledger/web-monetization-extension/issues) for a full list of proposed features (and known issues).

## Feedback and Issues

If you encounter any issues or have feedback, please open an issue on
the [GitHub repository](https://github.com/interledger/web-monetization-extension/issues). We appreciate your feedback
and contributions!

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](./LICENSE)
file for details
