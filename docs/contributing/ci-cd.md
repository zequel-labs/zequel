# CI/CD

Zequel uses two GitHub Actions workflows for continuous integration and releases.

## CI Workflow

**File**: `.github/workflows/ci.yml`

Runs on every push to `main` and on every pull request targeting `main`. Uses concurrency groups to cancel in-progress runs when a new commit is pushed.

### Matrix

| Runner | OS |
|---------------------|---------|
| `macos-latest` | macOS |
| `windows-latest` | Windows |
| `ubuntu-latest` | Ubuntu |

### Steps

1. **Checkout** the repository.
2. **Setup Node.js 20** with npm caching.
3. **Install dependencies** (`npm ci`).
4. **Typecheck** (`npm run typecheck`).
5. **Unit tests** (`npm run test:unit`).

All steps run on every matrix OS to catch platform-specific issues early.

## Release Workflow

**File**: `.github/workflows/release.yml`

Triggered when a tag matching `v*.*.*` is pushed. Runs three parallel jobs that build platform-specific installers and publish them to GitHub Releases.

### Jobs

| Job | Runner | Output |
|---------------------|---------------------|----------------------------------------------|
| `release-mac` | `macos-latest` | DMG for Intel (x64) and Apple Silicon (arm64) |
| `release-windows` | `windows-latest` | NSIS installer (x64) |
| `release-linux` | `ubuntu-latest` | AppImage (x64 + arm64) |

### macOS Job Steps

1. Checkout.
2. Setup Node.js 20.
3. Install dependencies (`npm ci`).
4. Typecheck (`npm run typecheck`).
5. Unit tests (`npm run test:unit`).
6. Build and publish (`npm run build && npx electron-builder --mac --x64 --arm64 --publish always`).

Typecheck and unit tests run only in the macOS job to avoid redundant CI time.

### Windows Job Steps

1. Checkout.
2. Setup Node.js 20.
3. Install dependencies (`npm ci`).
4. Build and publish (`npm run build && npx electron-builder --win --x64 --publish always`).

### Linux Job Steps

1. Checkout.
2. Setup Node.js 20.
3. Install dependencies (`npm ci`).
4. Build and publish (`npm run build && npx electron-builder --linux --x64 --arm64 --publish always`).

### Secrets

| Secret | Purpose |
|------------------------|------------------------------------------------------|
| `GITHUB_TOKEN` | Automatically provided; used to publish release assets |
| `CSC_LINK` | macOS code signing certificate (base64 `.p12`) |
| `CSC_KEY_PASSWORD` | macOS certificate password |
| `WIN_CSC_LINK` | Windows code signing certificate (optional) |
| `WIN_CSC_KEY_PASSWORD` | Windows certificate password (optional) |

See [Releasing](./releasing) for the full release process and what users see.
