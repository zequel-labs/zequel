# Releasing

## How Auto-Update Works

The app uses `electron-updater` with GitHub Releases. On launch (production only), it checks the `latest-mac.yml` / `latest-linux.yml` / `latest.yml` files from the latest GitHub Release and compares the `version` field against `app.getVersion()` using semver. If the release version is greater, a toast notification prompts the user to download and install.

## Steps

### 1. Bump the version

```bash
# Patch: 1.0.0 -> 1.0.1
npm version patch

# Minor: 1.0.0 -> 1.1.0
npm version minor

# Major: 1.0.0 -> 2.0.0
npm version major
```

Or edit `version` in `package.json` manually and commit.

### 2. Push the tag

```bash
git push origin main --tags
```

This triggers the release workflow automatically.

## What the CI Does

The release workflow (`.github/workflows/release.yml`) triggers on tag push matching `v*.*.*` and runs three parallel jobs:

| Job | Runner | Builds |
|---------------------|---------------------|----------------------------------------------|
| `release-mac` | `macos-latest` | DMG for Intel (x64) and Apple Silicon (arm64) |
| `release-windows` | `windows-latest` | NSIS installer (x64) |
| `release-linux` | `ubuntu-latest` | AppImage (x64 + arm64) |

Each job:

1. Installs dependencies (`npm ci`).
2. Runs typecheck and unit tests (macOS only).
3. Builds the app (`npm run build`).
4. Packages and publishes to GitHub Releases (`electron-builder --publish always`).

### Release Assets

| File | Platform |
|-------------------------------|-------------------------------|
| `Zequel-X.X.X.dmg` | macOS Intel |
| `Zequel-X.X.X-arm64.dmg` | macOS Apple Silicon |
| `Zequel-Setup-X.X.X.exe` | Windows x64 |
| `Zequel-X.X.X.AppImage` | Linux x64 |
| `latest-mac.yml` | macOS auto-update metadata |
| `latest-linux.yml` | Linux auto-update metadata |
| `latest.yml` | Windows auto-update metadata |

### Code Signing

- **macOS**: Requires `CSC_LINK` (base64 `.p12` certificate) and `CSC_KEY_PASSWORD` secrets in GitHub.
- **Windows**: Requires `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` secrets (optional).

## What Users See

1. App opens and checks for updates.
2. Update found: a toast appears with a **"Download"** button.
3. User clicks Download: silent background download.
4. Download complete: a toast appears with a **"Restart"** button.
5. User clicks Restart: the app restarts on the new version.
6. If ignored: the update installs automatically on next quit.

Users can also check manually via **Zequel > Check for Updates...** (macOS) or **File > Check for Updates...** (Windows/Linux).
