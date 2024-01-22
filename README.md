## Web Monetization Extension

![Github Actions CI](https://github.com/interledger/web-monetization-extension/actions/workflows/sanity.yml/badge.svg?branch=main)
[![Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://prettier.io/)

Web Monetization is a browser extension that detects Web Monetization on websites using a browser API that allows the creation of a payment stream from the user agent to the website.

### Contributing

Please read the [contribution guidelines](.github/CONTRIBUTING.md) before submitting contributions. All contributions must adhere to our [code of conduct](.github/CODE_OF_CONDUCT.md).

### Installation

1. Clone the repository from GitHub: `git clone https://github.com/interledger/web-monetization-extension.git`
2. Navigate to the project directory: `cd web-monetization-extension`
3. Install the dependencies using PNPM: `pnpm install`

### Development

To run the extension and the Web Monetization server in development mode with hot reload, use the following command:

```sh
pnpm dev # default Chrome
pnpm dev firefox # For Firefox
pnpm dev opera # For Opera
pnpm dev edge # For Edge
```

### Building the extension

To build the extension for production (all browsers), use the following command:

```sh
pnpm extension build
```

### Building the extension for a specific browser

To build the extension for a specific browser, use one of the following commands:

```sh
pnpm extension build chrome
pnpm extension build firefox
pnpm extension build opera
pnpm extension build edge
```

The `build` command transpiles the TypeScript code and generates a production-ready build of the extension in the `packages/extension/dist`
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

### Testing

To run the tests, use the following command:

`pnpm test`

This command runs the tests using Jest and generates a coverage report in the coverage directory.

### Linting

The extension is set up with ESLint and Prettier for code linting and formatting.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](./LICENSE)
file for details

## Feedback and Issues

If you encounter any issues or have feedback, please open an issue on
the [GitHub repository](https://github.com/interledger/web-monetization-extension/issues). We appreciate your feedback
and contributions!
