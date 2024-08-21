# Web Monetization Extension Release Pipeline

Two channels of the extensions will be maintained:

- Preview
- Stable

A separate Nightly release channel will be available via GitHub releases (without publishing to stores).

## Extension versioning

Web extensions do not follow SEMVER. The version string consists of 1 to 4 numbers separated by dots, for example, `1.2.3.4` (`major.minor.patch.build`). This is essentially SEMVER but with an additional build number, but does not support the alpha, beta or other suffixes.

### Major version bump

A major version bump (`2.0.0.0`) signifies the start of a block of product features.

Before the extension is available first on the Stable channel, we only increase the build number (`2.0.0.x`) when publishing to the Preview channel. After that (during maintenance mode), we follow SEMVER (`2.x.y.0`).

### Minor version bump

New features and enhancements will be released under a minor version bump.

### Patch version bump

Bug fixes, performance and small updates will be released under a patch version bump.

### Build version bump

The build version bump should only happen when starting the work on a new major version. Once a major version (e.g. `v1`) goes into maintenance mode, the extension major version is bumped to `2.0.0.0`. Until the new major version is made available on the Stable channel, only build number should be incremented.

Multiple "build" version bumps can be made available in the Preview channel. e.g. we can have `2.0.0.1`, `2.0.0.2`, ..., `2.0.0.90` in the Preview channel before we make it available in the Stable channel.

When the new major version is going to be available in the Stable channel, it will have the last published version as in the Preview channel (i.e. the first Stable channel build could be `2.0.0.90`, not necessarily `2.0.0` or `2.0.1`).

## Nightly

The Nightly version will be built every day (except Sundays) at 12AM UTC and it will be added to GitHub releases with the tag `nightly`.

Nightly releases will correspond to the latest commit in the `main` branch of the repository at the time of the build. The tag reference will get updated on every release (rolling tags). Whenever a new release is happening, the previous one gets deleted first.

### Versioning for the Nightly build

On every action run, the workflow will update the following properties in the manifest:

- `version`: will be set to the current date in `YYYY.M.D` format (note: not `YYYY.MM.DD` as we cannot have zero as prefix in these numbers)
- `version_name`: will be set to `Nightly YYYY.M.D`

### Release artifacts

Artifacts follow the name: `nightly-{browser}-{version}.zip`, e.g. `nightly-chrome-2024.7.13.zip`, `nightly-edge-2024.7.13.zip`, `nightly-firefox-2024.7.13.zip`

## Preview

The Preview version represents a release candidate on the `main` branch. They are less stable than the Stable version.

Releases are triggered manually (via GitHub Actions), and can have a minor/patch/build version bump.

Once a new development stage starts for a new major version and we start publishing it to the Preview channel, we will not be able to push an older version to the Preview channel - they will only be available in GitHub. But the releases for the older version are to be promoted to Stable immediately.

### Release artifacts

Artifacts follow the name `preview-{browser}-{version}.zip`, e.g. `preview-chrome-1.0.4.0.zip`, `preview-edge-2.0.0.12.zip`, `preview-firefox-2.1.1.0.zip`

## Release

Some of the releases from the Preview channel (that are considered stable enough) are **promoted** to the Stable channel.

Release promotions are triggered manually (via GitHub Actions).

### Release artifacts

Artifacts follow the name `{browser}-{version}.zip`, e.g. `chrome-1.0.4.0.zip`, `edge-2.0.0.12.zip`, `firefox-2.1.1.0.zip`.

---

## Branching strategy

Whenever a major version goes into maintenance mode, `v{major}.x` is branched-off `main` (e.g. when we work at `v2`, we split a `v1.x` branch from `main`, and then `main` will correspond to `v2.x`). The maintenance branch will mostly receive bug fixes and security updates. Changes to the build process must be back-ported to maintenance branches, to keep workflows consistent.

We primarily work over the `main` branch. For the maintenance of previous major versions, PRs can be sent to the `v{major}.x` branch. If some commits from the `main` branch need to be available on an earlier major version as well, they can be back-ported (after being merged into `main`) by sending a PR with the other major branch (e.g. `v1.x`) as base.

## Pull requests

When there's a commit that needs to be back-ported, the PR corresponding to that commit should have a "needs backport" label. Once back-ported, the label should be removed (or replaced with "backported").

---

# Release Workflow

## Releasing to Preview channel

1. Visit ["Bump Manifest Version" manual dispatch workflow](https://github.com/interledger/web-monetization-extension/actions/workflows/bump-manifest-version.yml) and click the "Run workflow" button.
   - Choose the version bump - build, patch, or minor as described above.
   - For branch, choose `main` (default) if releasing for the latest major version. Otherwise, select the required `v{major}.x` branch.
   - When releasing for a `v{major}.x` branch:
     - The extension will not be uploaded to the extension web stores' Preview channel.
     - As the extension won't be available on the web store's Preview channel, the [GitHub Release](https://github.com/interledger/web-monetization-extension/releases/) can be shared if testing is required before the promotion to the Stable channel.
1. Validate and approve PR sent from workflow.
   - Do not update the PR/commit title.
   - Squash and merge the PR.
1. Extension will be released automatically (via ["Release for Preview Channel" workflow](https://github.com/interledger/web-monetization-extension/actions/workflows/release-preview.yml)) as the PR is merged.
   - If there's a temporary failure in the action run, re-run the workflow.

## Releasing to Stable channel

To promote a Preview channel release to Stable:

1. Run the ["Release Stable" manual-dispatch workflow](https://github.com/interledger/web-monetization-extension/actions/workflows/release-stable.yml).
   - Specify the Preview version tag that should be promoted to Stable, e.g. `v1.2.3.5-preview`.
   - Do not change the branch from "main".
1. Extension will be released on as the workflow runs.
