# Releasing a New Version

## How Auto-Update Works

The app uses `electron-updater` with GitHub Releases. On launch (production only), it checks the `latest-mac.yml` file from the latest GitHub Release and compares its `version` field against `app.getVersion()` using semver. If the release version is greater, a toast notification prompts the user to download and install.

## Steps

### 1. Bump the version

```bash
# Patch: 1.0.0 → 1.0.1
npm version patch

# Minor: 1.0.0 → 1.1.0
npm version minor

# Major: 1.0.0 → 2.0.0
npm version major
```

Or edit `version` in `package.json` manually and commit.

### 2. Build

```bash
npm run build:mac
```

This generates three files in `dist/`:

| File | Purpose |
|------|---------|
| `Zequel-X.X.X-mac.zip` | Binary downloaded by the auto-updater (required) |
| `latest-mac.yml` | Metadata file read by the auto-updater (required) |
| `Zequel-X.X.X.dmg` | For manual download from the website (optional) |

### 3. Create GitHub Release

```bash
gh release create vX.X.X \
  dist/Zequel-X.X.X-mac.zip \
  dist/latest-mac.yml \
  dist/Zequel-X.X.X.dmg \
  --title "vX.X.X" \
  --notes "Changelog here"
```

All three files must be attached to the release for auto-update to work.

### Alternative: Publish from CI

There are two GitHub Actions workflows in `.github/workflows/`:

#### CI (`.github/workflows/ci.yml`)

Runs on every push and PR to `main`. Uses `macos-latest` because native deps (`better-sqlite3`, `keytar`) need macOS to compile.

- `npm ci` → `npm run typecheck` → `npm run test:unit`
- Uses `concurrency` with `cancel-in-progress` to avoid wasted CI minutes on rapid pushes

#### Release (`.github/workflows/release.yml`)

Triggers automatically on tag push matching `v*.*.*`. Validates then builds and publishes.

- Runs typecheck and unit tests before building
- Builds with `npm run build && electron-builder --mac --publish always`
- `GH_TOKEN` is auto-provided by GitHub for release upload
- `CSC_LINK` / `CSC_KEY_PASSWORD` repo secrets enable macOS code signing (optional)

To release via CI:

```bash
npm version patch     # or minor / major
git push origin main --tags
```

The workflow builds, signs, and publishes all assets to GitHub Releases automatically.

To publish manually without CI, set `GH_TOKEN` with write access to releases:

```bash
GH_TOKEN=ghp_xxx npm run build:mac -- --publish always
```

## What Users See

1. App opens → checks for updates after 3 seconds
2. Update found → toast with **"Download"** button
3. User clicks Download → silent download
4. Download complete → toast with **"Restart"** button
5. User clicks Restart → app restarts on new version
6. If ignored → installs automatically on next quit

Users can also check manually via **Zequel > Check for Updates...** in the menu bar.
