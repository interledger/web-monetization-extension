# Building the extension

The extension is built with React and TypeScript. We use a Node.js environment to develop.

## Local Development Environment

### Prerequisites

- [NVM](https://github.com/nvm-sh/nvm) (Linux, macOS), [NVM Windows](https://github.com/coreybutler/nvm-windows) (Windows) - or another Node Version Manager

## Setup

### Environment Setup

```sh
# Install Node version required by the project
# For Linux/macOS
nvm install
nvm use

# For Windows
nvm install 24
nvm use 24

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

Learn how to install the extension from source by reading the [installation instructions](./INSTALL.md).

### Additional commands

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
