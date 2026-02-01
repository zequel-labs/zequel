# Installation

Zequel is available for macOS, Windows, and Linux. All builds are distributed through GitHub Releases and include automatic updates so you always stay on the latest version.

[Download the latest release](https://github.com/zequel-labs/zequel/releases/latest)

## macOS

Zequel ships as a `.dmg` disk image with separate builds for each architecture:

- **Apple Silicon** (M1, M2, M3, M4) -- `Zequel-x.x.x-arm64.dmg`
- **Intel** -- `Zequel-x.x.x-x64.dmg`

### Steps

1. Download the `.dmg` file that matches your Mac's processor.
2. Open the disk image and drag **Zequel** into your **Applications** folder.
3. Launch Zequel from Applications. On first launch, macOS may ask you to confirm that you want to open an app downloaded from the internet -- click **Open**.

> If you are unsure which architecture your Mac uses, click the Apple menu, then **About This Mac**. Look for **Chip** (Apple Silicon) or **Processor** (Intel).

## Windows

Zequel is distributed as an NSIS installer:

- **64-bit** -- `Zequel-Setup-x.x.x.exe`

### Steps

1. Download the `.exe` installer from the releases page.
2. Run the installer and follow the on-screen prompts. Zequel will be installed into your user application directory by default.
3. Launch Zequel from the Start menu or desktop shortcut.

Windows may display a SmartScreen warning for unsigned builds. Click **More info**, then **Run anyway** to proceed.

## Linux

Zequel is available as an AppImage, which runs on most Linux distributions without installation:

- **x86_64** -- `Zequel-x.x.x.AppImage`

### Steps

1. Download the `.AppImage` file from the releases page.
2. Make it executable:
   ```bash
   chmod +x Zequel-x.x.x.AppImage
   ```
3. Run it:
   ```bash
   ./Zequel-x.x.x.AppImage
   ```

Some distributions may require FUSE to run AppImages. On Ubuntu or Debian-based systems:

```bash
sudo apt install libfuse2
```

## Automatic Updates

Once installed, Zequel checks for updates automatically on launch. When a new version is available, you will be prompted to download and install it. No manual steps are required after the initial installation.

## Next Steps

With Zequel installed, head to the [Quick Start](/guide/quick-start) guide to create your first database connection.
