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

Set `GH_TOKEN` with write access to releases, then:

```bash
GH_TOKEN=ghp_xxx npm run build:mac -- --publish always
```

This builds and creates the GitHub Release with all assets automatically.

## What Users See

1. App opens → checks for updates after 3 seconds
2. Update found → toast with **"Download"** button
3. User clicks Download → silent download
4. Download complete → toast with **"Restart"** button
5. User clicks Restart → app restarts on new version
6. If ignored → installs automatically on next quit

Users can also check manually via **Zequel > Check for Updates...** in the menu bar.
