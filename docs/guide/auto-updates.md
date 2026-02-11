# Auto Updates

Zequel uses electron-updater to deliver application updates automatically. Once installed, you do not need to manually download new versions -- the application handles the entire update process in the background.

## How Updates Work

1. **Check** -- Each time Zequel launches, it contacts the update server to check whether a newer version is available.
2. **Update Available** -- If a newer version is found, a toast notification appears showing the version number with a **Download** button. Click it to start the download.
3. **Downloading** -- A persistent "Downloading Update" toast appears while the update downloads in the background. You can continue working normally.
4. **Install or Later** -- Once the download completes, a toast appears with two options:
   - **Install Now** -- Quits and restarts Zequel to apply the update immediately.
   - **Later** -- Dismisses the toast. The update will be applied automatically the next time you quit and reopen Zequel.

## Manual Update Check

If you want to check for updates without restarting the application:

1. Open the application menu.
2. Click **Check for Updates**.
3. Zequel contacts the update server and reports whether a new version is available.

## Update Channels

Zequel supports two update channels:

| Channel | Description |
|---------|-------------|
| **Stable** | Production-ready releases. This is the default. |
| **Beta** | Pre-release builds with new features that may still have rough edges. |

To switch channels, open the application menu and select your preferred channel. The change takes effect immediately -- the next update check will look for releases on the selected channel. Your channel preference is saved and persists across restarts.

## Platform Notes

| Platform | Update format                                     |
| -------- | ------------------------------------------------- |
| macOS    | Updates are delivered as `.dmg` or `.zip` archives and applied automatically. |
| Windows  | Updates use the NSIS installer and are applied on the next restart. |
| Linux    | AppImage builds support auto-update through electron-updater's AppImage update mechanism. |

## Troubleshooting Updates

If updates are not working as expected:

- **No update notification** -- Ensure your machine has internet access and can reach GitHub. Firewalls or proxy configurations may block the update check.
- **Download fails** -- A network interruption during download can cause the update to fail. Restart Zequel to trigger a fresh update check.
- **Update does not apply** -- On some platforms, the application must be fully quit (not just closed to the system tray) for the update to install. Quit Zequel completely and reopen it.
