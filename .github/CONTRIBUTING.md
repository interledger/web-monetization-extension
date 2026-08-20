# Contributing

Thank you for contributing to the Web Monetization Extension :tada: Your contributions are essential to making this project better.

The Web Monetization extension is no longer being proactively developed by the Interledger Foundation in terms of new features. We are maintaining the existing code and the extension will remain open source and available to use.

The extension will continue to exist as a wallet agnostic browser extension that allows users to support Web Monetized websites while the native browser implementation continues to be developed.

We are moving to a community-led model and welcome code contributions, including the development of new features. All code will be reviewed by the Interledger Foundation.

The Web Monetization standard will continue to be actively stewarded by the foundation.

## Before you start

- Have you read the [code of conduct](CODE_OF_CONDUCT.md)?
- Check out the [existing issues](https://github.com/interledger/web-monetization-extension/issues)

## Types of contributions

You can contribute to Web Monetization Extension in several ways.

### :beetle: Issues

We use GitHub issues to track tasks. If you've found something that needs fixing, search open issues to see if someone else has reported the same thing. If it's something new, open an issue. We'll use the issue to discuss the problem you want to fix.

Please include:

- A clear and descriptive title.
- A detailed description of the issue, including steps to reproduce if applicable.
- Information about your environment (e.g., operating system, browser, version) if applicable.
- Any relevant screenshots or error messages.

### :hammer_and_wrench: Pull requests

Feel free to fork and create a pull request for [existing issues](https://github.com/interledger/web-monetization-extension/issues). Some issues are still being discussed though. You can pick work from the "Todo" column in the [project board](https://github.com/orgs/interledger/projects/14/views/6). If you have an idea, please create an issue for discussion first. This makes sure that the contribution is impactful and you don't spend time creating a PR that we will not accept.

Ensure your PR includes a clear title and description following the [Conventional Commits Specification](https://www.conventionalcommits.org/en/v1.0.0/).

If your PR addresses an issue, reference the issue in the description using `Closes #123`.

Project maintainers will review your PR for code quality, correctness, and adherence to guidelines as soon as possible. Please respond to any feedback and make necessary changes.

## Development

### Setup

Learn [how to build](./docs/BUILDING.md) the extension locally and [install](./docs/INSTALL.md) it in your browser. Please also look at the other documents in the `docs` folder, as they contain crucial information about the extension's architecture.

### Code quality

All the code quality tools used in the project are installed and configured at the root.

### Linting & formatting

We use [Biome](https://biomejs.dev/) for linting and formatting.

Check `format` and `lint` commands in `package.json`, along with their `:fix` counterparts on how to automatically fix formatting and linting issues.

We also rely on prettier, for Markdown and YAML files, until Biome supports them.

```shell
./biome.jsonc # config
```

### Testing

[Vitest](https://vitest.dev/) is used for unit and integration testing.

### Language

[Typescript](https://www.staging-typescript.org/) is the chosen language.

```shell
./tsconfig.json # config
```

Typescript config at the root is intended to be a base config.

### CI

We use GitHub actions to manage our CI pipeline.

The workflows can be found in `.github/workflows`

---

Thank you for contributing to the Web Monetization extension! We appreciate your time and effort in helping make the extension better. Join our community on [Slack](https://join.slack.com/t/interledger/shared_invite/zt-44g089zrn-XdSIiHF~cs8Oo_MBmSfECA) to connect with other contributors and stay updated on project developments.

Happy coding!
