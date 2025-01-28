# Contributing to this repository <!-- omit in toc -->

Thank you for contributing to Web Monetization Extension :tada: Your contributions are essential to making this project better.

## Getting Started

- Have you read the [code of conduct](CODE_OF_CONDUCT.md)?
- Check out the [existing issues](https://github.com/interledger/web-monetization-extension/issues) & see if we [accept contributions](#types-of-contributions) for your type of issue.

## Table of Contents <!-- omit in toc -->

- [Types of contributions](#types-of-contributions)
  - [:beetle: Issues](#beetle-issues)
  - [:hammer_and_wrench: Pull requests](#hammer_and_wrench-pull-requests)
- [Working in the Web Monetization Extension repository](#working-in-the-web-monetization-extension-repository)
  - [Code quality](#code-quality)
    - [Linting](#linting)
    - [Formatting](#formatting)
    - [Testing](#testing)
    - [Language](#language)
    - [CI](#ci)
  - [Reporting Issues](#reporting-issues)
  - [Submitting Pull Requests](#submitting-pull-requests)
  - [Review Process](#review-process)

### Types of contributions

You can contribute to Web Monetization Extension in several ways.

#### :beetle: Issues

We use GitHub issues to track tasks that contributors can help with. We haven't finalized labels yet for contributors to tackle. If you want to help with work related to an issue, please comment on the issue before starting work on it.

If you've found something that needs fixing, search open issues to see if someone else has reported the same thing. If it's something new, open an issue. We'll use the issue to discuss the problem you want to fix.

#### :hammer_and_wrench: Pull requests

Feel free to fork and create a pull request on changes you think you can contribute.

The team will review your pull request as soon as possible.

### Working in the Web Monetization Extension repository

This project uses `PNPM`. A list of steps for setting up a [local development environment](https://github.com/interledger/web-monetization-extension/#development) can be found in the Readme.

#### Code quality

All the code quality tools used in the project are installed and configured at the root.

#### Linting & Formatting

We use [Biome](https://biomejs.dev/) for linting and formatting.

Check `format` and `lint` commands in `package.json`, along with their `:fix` counterparts on how to automatically fix formatting and linting issues.

We also rely on prettier, for Markdown and YAML files, until Biome supports them.

```shell
./biome.jsonc # config
```

#### Testing

[Jest](https://jestjs.io/) is used for unit and integration testing.

#### Language

[Typescript](https://www.staging-typescript.org/) is the chosen language.

```shell
./tsconfig.json # config
```

Typescript config at the root is intended to be a base config.

#### CI

We use GitHub actions to manage our CI pipeline.

The workflows can be found in `.github/workflows`

### Reporting Issues

If you encounter any issues or have a feature request, please [create a new issue](https://github.com/interledger/web-monetization-extension/issues/new) and provide the following details:

- A clear and descriptive title.
- A detailed description of the issue, including steps to reproduce if applicable.
- Information about your environment (e.g., operating system, browser, version).
- Any relevant screenshots or error messages.

### Submitting Pull Requests

1. [Fork](https://github.com/interledger/web-monetization-extension) the repository.
2. Create a new branch from `main`.
3. Make your changes and commit them.
4. Create a pull request (PR) to `main`.
5. Ensure your PR includes a clear title and description following the [Conventional Commits Specification](https://www.conventionalcommits.org/en/v1.0.0/).
6. If your PR addresses an issue, reference the issue in the description using `Closes #123`.
7. Be patient and be prepared to address feedback and make changes if needed.

### Review Process

- Project maintainers will review your PR for code quality, correctness, and adherence to guidelines.
- Please respond to any feedback promptly and make necessary changes.
- Once the PR is approved, it will be merged into the main branch.

Thank you for contributing to Web Monetization Extension! We appreciate your time and effort in helping make the Extension better. Join our community on [Slack](https://communityinviter.com/apps/interledger/interledger-working-groups-slack) to connect with other contributors and stay updated on project developments.

Happy coding!
