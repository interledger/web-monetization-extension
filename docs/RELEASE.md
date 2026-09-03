# Web Monetization Extension Release Pipeline

The extension has a single Stable release channel.

A separate Nightly release channel will be available via GitHub releases (without publishing to stores).

## Extension versioning

We follow SEMVER (Semantic Versioning) for our extension's versioning (`major.minor.patch`).

### Major version bump

A major version bump (`2.0.0`) signifies the start of a block of product features.

### Minor version bump

New features and enhancements will be released under a minor version bump.

### Patch version bump

Bug fixes, performance and small updates will be released under a patch version bump.

> [!note]
> Build version support was removed in [#1218](https://github.com/interledger/web-monetization-extension/issues/1218) due to incompatibility with Apple App Store (Safari).

## Nightly

The Nightly version will be built every day (except Sundays) at 12AM UTC and it will be added to GitHub releases with the tag `nightly`.

Nightly releases will correspond to the latest commit in the `main` branch of the repository at the time of the build. The tag reference will get updated on every release (rolling tags). Whenever a new release is happening, the previous one gets deleted first.

### Versioning for the Nightly build

On every action run, the workflow will update the following properties in the manifest:

- `version`: will be set to the current date in `YYYY.M.D` format (note: not `YYYY.MM.DD` as we cannot have zero as prefix in these numbers)
- `version_name`: will be set to `Nightly YYYY.M.D`

### Release artifacts

Artifacts follow the name: `nightly-{browser}-{version}.zip`, e.g. `nightly-chrome-2024.7.13.zip`, `nightly-edge-2024.7.13.zip`, `nightly-firefox-2024.7.13.zip`

## Release

Releases are triggered by bumping the extension version on the `main` branch, and can have a minor/patch/build version bump.

### Release artifacts

Artifacts follow the name `{browser}-{version}.zip`, e.g. `chrome-1.0.4.zip`, `edge-2.0.12.zip`, `firefox-2.1.1.zip`.

---

## Release Workflow

### Releasing to Stable channel

1. Visit ["Bump Manifest Version" manual dispatch workflow](https://github.com/interledger/web-monetization-extension/actions/workflows/bump-manifest-version.yml) and click the "Run workflow" button.
   - Choose the version bump - build, patch, or minor as described above.
1. Validate and approve PR sent from workflow.
   - Do not update the PR/commit title.
   - Squash and merge the PR.
1. Extension will be released automatically (via ["Release Stable" workflow](https://github.com/interledger/web-monetization-extension/actions/workflows/release-stable.yml)) as the PR is merged.
   - If there's a temporary failure in the action run, re-run the workflow.
