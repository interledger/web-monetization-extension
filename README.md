## Web Monetization Extension

![Github Actions CI](https://github.com/interledger/web-monetization-extension/actions/workflows/ci.yml/badge.svg?branch=main)
[![Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://prettier.io/)

Web Monetization is a browser extension that detects Web Monetization on websites using a browser API that allows the
creation of a payment stream from the user agent to the website. This extension is built with React, TypeScript, and
Vite.

### Contributing

Please read the [contribution guidelines](.github/CONTRIBUTING.md) before submitting contributions. All contributions must adhere to our [code of conduct](.github/CODE_OF_CONDUCT.md).

### Installation

1. Clone the repository from GitHub: `git clone https://github.com/interledger/web-monetization-extension.git`
2. Navigate to the project directory: `cd web-monetization-extension`
3. Install the dependencies using PNPM: `pnpm install`

### Development

To run the extension in development mode with hot reload, use the following command:

`pnpm dev`

This command builds the extension using Vite's hot reload feature, allowing you to see immediate changes in the browser
as you modify the code.

### Building the Extension

To build the extension for production, use the following command:

`pnpm build`

### Building the Extension for Firefox

To build the extension for Firefox, use the following command:

`pnpm build:firefox`

This command transpiles the TypeScript code and generates a production-ready build of the extension in the dist
directory.

### Installing the Extension in Chrome

To install the extension in Chrome, follow these steps:

1. Extract the Files:<br/>
   Extract the contents of the ZIP file to a folder on your computer.

2. Open Chrome's Extensions Page:<br/>
   Open Chrome, click the three dots in the top-right corner, go to "More tools," and select "Extensions."

3. Enable Developer Mode:<br/>
   Enable "Developer mode" using the toggle switch at the top-right of the Extensions page.

4. Load the Extension:<br/>
   Click the "Load unpacked" button that appears after enabling Developer mode.

5. Select the Extension Folder:<br/>
   Choose the folder containing the extracted extension files (with the manifest.json file).

6. Pin the Extension:<br/>
   Click on the puzzle piece icon in the top-right corner of Chrome, and pin the Web Monetization extension.

### Installing the Extension in Firefox

1. Extract the Files:<br/>
   Extract the contents of the ZIP file to a folder on your computer.

2. Open Firefox's Add-ons Page:<br/>
   Open Firefox, click the three horizontal lines in the top-right corner, and choose "Add-ons."

3. Access Extensions Settings:<br/>
   In the Add-ons Manager, click the gear icon in the top-right corner and select "Install Add-on From File..."

4. Select the Extension File:<br/>
   Navigate to the folder where you extracted the extension files and select the manifest.json file or the main folder of the extension.

### Testing the Extension

To run the tests, use the following command:

`pnpm test`

This command runs the tests using Jest and generates a coverage report in the coverage directory.

### Linting and Pre-Commit Hooks

The extension is set up with ESLint and Prettier for code linting and formatting. Husky and lint-staged are configured
to enforce linting and formatting rules before each commit. When you commit changes, Husky will run the linting and
formatting tasks to ensure code quality.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](./LICENSE)
file for details

## Feedback and Issues

If you encounter any issues or have feedback, please open an issue on
the [GitHub repository](https://github.com/interledger/web-monetization-extension/issues). We appreciate your feedback
and contributions!
