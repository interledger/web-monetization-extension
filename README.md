<h1 align="center">Web Monetization Extension</h1>

![Github Actions CI](https://github.com/interledger/web-monetization-extension/actions/workflows/sanity.yml/badge.svg?branch=main)
[![Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://prettier.io/)

The Web Monetization browser extension is an open source implementation of the Web Monetization draft specification - learn more [here](https://webmonetization.org/specification/). The extension is built with React and TypeScript.

## Local Development Environment

### Prerequisites

- [NVM](https://github.com/nvm-sh/nvm) (Linux, macOS), [NVM Windows](https://github.com/coreybutler/nvm-windows) (Windows) - or another Node Version Manager
- [PNPM](https://pnpm.io/)

## Setup

### Environment Setup

```sh
# Install Node 20
nvm install lts/iron
nvm use lts/iron

# Install pnpm using Corepack
corepack enable
```

If you do not have `corepack` installed locally you can use `npm` or `yarn` to install `pnpm`:

```sh
npm install -g pnpm
# or
yarn install -g pnpm
```

For alternative methods of installing `pnpm`, you can refer to the [official `pnpm` documentation](https://pnpm.io/installation).

To install dependencies, execute:

```sh
pnpm i
```

### Commands

All commands are run from the root of the project, from a terminal:

| Command               | Action                                                                                                                                                                                                          |
| :-------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev <TARGET>`   | Builds the extension for development, for a specified target (`chrome` or `firefox`). If the target is not specified the script will build the extension for a Chromium based browser. Output folder: `dev`.    |
| `pnpm build <TARGET>` | Builds the extension for production usage, for a specified target (`chrome` or `firefox`). If the target is not specified the script will build the extension for all available targets. Output folder: `dist`. |
| `pnpm test`           | Runs all test files using Jest.                                                                                                                                                                                 |

### Installing the extension from source, in Chromium based browsers (Chrome, Opera, Edge, Brave, Arc)

1. <b>Build the extension with `pnpm build chrome`</b>

1. <b>Open extensions page</b><br/>
   In Chrome, click the three dots in the top-right corner. Look for the `Extensions` options and select `Manage extensions`.

1. <b>Enable developer mode</b><br/>
   To enable `Developer mode`, use the switch at the top-right of the extensions page.

1. <b>Load the extension</b><br/>
   After enabling `Developer mode`, new buttons should appear in the top-left corner. Click the `Load unpacked` one and choose the <b>folder</b> that contains the extension files (in the `dist` folder, look for the `chrome` one with the `manifest.json` file).

### Installing the extension from source, in Firefox

1. <b>Build the extension with `pnpm build firefox`</b>

1. <b>Open Firefox's add-ons page</b><br/>
   Open Firefox, click the three horizontal lines in the top-right corner, and choose `Add-ons and themes`.

1. <b>Navigate to the add-ons debugging page</b><br/>
   In the add-ons page, click the gear icon and select "Debug Add-ons".

1. <b>Load the extension</b><br/>
   Look for the `Temporary Extensions` section and expand its content. After expanding its content click on the `Load Temporary Add-on...` button and select the `manifest.json` file (in the `dist` folder, go in the `firefox` folder and select the manifest file).

### Project structure

Inside this project, you'll see the following folders and files:

```
.
├── .github/ # GitHub Workflows
├── scripts/ # Script to build the extension (production, development)
├── src/ # Extension's source code
│   ├── _locales/ # Files for multi-lang support
│   ├── assets/ # Images for the extension (icon, etc.)
│   ├── background/ # Source code for the background script
│   ├── content/ # Source  code for the content script
│   │   ├── static/ # WM polyfill
│   ├── popup/ # Source code for the popup UI
│   └── shared/ # Shared utilities
├── webpack/ # Webpack configuration
├── jest.config.ts
├── jest.setup.ts
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## Contributing

Please read the [contribution guidelines](.github/CONTRIBUTING.md) before submitting contributions. All contributions must adhere to our [code of conduct](.github/CODE_OF_CONDUCT.md).

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
