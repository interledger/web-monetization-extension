<h1 align="center">Web Monetization Extension</h1>

[![Chrome](https://img.shields.io/chrome-web-store/v/oiabcfomehhigdepbbclppomkhlknpii.svg?label=Chrome&logo=googlechrome&color=orange)](https://chromewebstore.google.com/detail/web-monetization/oiabcfomehhigdepbbclppomkhlknpii) [![Firefox](https://img.shields.io/amo/v/web-monetization-extension?label=Firefox&logo=firefoxbrowser&color=orange)](https://addons.mozilla.org/en-US/firefox/addon/web-monetization-extension/) [![Edge](https://img.shields.io/badge/dynamic/json?label=Edge&prefix=v&query=$.version&url=https://microsoftedge.microsoft.com/addons/getproductdetailsbycrxid/imjgemgmeoioefpmfefmffbboogighjl&color=orange)](https://microsoftedge.microsoft.com/addons/detail/web-monetization/imjgemgmeoioefpmfefmffbboogighjl) [![GitHub](https://img.shields.io/github/v/release/interledger/web-monetization-extension?sort=semver&filter=v*&display_name=release&label=GitHub&logo=github&color=orange)](https://github.com/interledger/web-monetization-extension/releases/latest)

[![Nightly build](https://github.com/interledger/web-monetization-extension/actions/workflows/nightly-build.yaml/badge.svg)](https://github.com/interledger/web-monetization-extension/actions/workflows/nightly-build.yaml) [![Latest Nightly build](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.github.com%2Frepos%2Finterledger%2Fweb-monetization-extension%2Freleases%2Ftags%2Fnightly&query=%24.name&logo=github&label=Latest)](https://github.com/interledger/web-monetization-extension/releases/tag/nightly)

The Web Monetization browser extension is an open source implementation of the Web Monetization draft specification - learn more [here](https://webmonetization.org/specification/). The extension is built with React and TypeScript.

## Local Development Environment

### Prerequisites

- [NVM](https://github.com/nvm-sh/nvm) (Linux, macOS), [NVM Windows](https://github.com/coreybutler/nvm-windows) (Windows) - or another Node Version Manager

## Setup

### Environment Setup

```sh
# Install Node 22
# For Linux/macOS
nvm install lts/jod
nvm use lts/jod

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

- **`pnpm dev [TARGET]`**
  - Builds the extension for **development**, with live reloading on code changes.
    - `TARGET`: Specify `chrome` or `firefox` or `safari`. Defaults to `chrome` if not specified.
  - **Output:** `dev/${TARGET}` folder.

- **`pnpm build [TARGET] --channel=CHANNEL`**
  - Creates a **production-ready build** of the extension.
    - `TARGET`: Specify `chrome` or `firefox` or `safari`. Builds for all targets if not specified.
    - `CHANNEL`: Choose `nightly`, `preview`, or `stable`. Defaults to `nightly` if not specified.
  - **Output:** `dist/${TARGET}` folder. Also creates a `.zip` file in the `dist` folder.

Learn how to install the extension from source by reading the [installation instructions](./docs/INSTALL.md).

#### Additional commands

- **`pnpm test`**
  - Runs jest for unit testing and integration testing.
  - Use `pnpm test:watch` to run tests in watch mode.

- **`pnpm test:e2e:chromium`**
  - Runs all **end-to-end tests** using Chromium & Playwright.
  - Add `--ui` to run in interactive UI mode.
  - Read our [documentation on testing](./docs/TESTING.md) for details.

- **`pnpm format`**
  - Runs **Biome** and **Prettier** on the codebase to find formatting issues.
  - Use `pnpm format:fix` to automatically fix some of the issues.

- **`pnpm lint`**
  - Runs **Biome** on the codebase to find linting issues.
  - Use `pnpm lint:fix` to automatically fix some of the issues.

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
