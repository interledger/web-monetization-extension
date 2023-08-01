## Web Monetization Extension

![Github Actions CI](https://github.com/interledger/web-monetization-extension/actions/workflows/ci.yml/badge.svg?branch=main)
[![Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://prettier.io/)

Web Monetization is a browser extension that detects Web Monetization on websites using a browser API that allows the
creation of a payment stream from the user agent to the website. This extension is built with React, TypeScript, and
Vite.

### Installation

1. Clone the repository from GitHub: `git clone https://github.com/interledger/web-monetization-extension.git`
2. Navigate to the project directory: `cd web-monetization-extension`
3. Install the dependencies using Yarn: `yarn install`

### Development

To run the extension in development mode with hot reload, use the following command:

`yarn dev`

This command builds the extension using Vite's hot reload feature, allowing you to see immediate changes in the browser
as you modify the code.

### Building the Extension

To build the extension for production, use the following command:

`yarn build`

This command transpiles the TypeScript code and generates a production-ready build of the extension in the dist
directory.

### Testing the Extension

To run the tests, use the following command:

`yarn test`

This command runs the tests using Jest and generates a coverage report in the coverage directory.

### Linting and Pre-Commit Hooks

The extension is set up with ESLint and Prettier for code linting and formatting. Husky and lint-staged are configured
to enforce linting and formatting rules before each commit. When you commit changes, Husky will run the linting and
formatting tasks to ensure code quality.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](https://www.apache.org/licenses/LICENSE-2.0)
file for details

## Feedback and Issues

If you encounter any issues or have feedback, please open an issue on
the [GitHub repository](https://github.com/interledger/web-monetization-extension/issues). We appreciate your feedback
and contributions!
