# Auto Updates

Zequel uses electron-updater to deliver application updates automatically. Once installed, you do not need to manually download new versions -- the application handles the entire update process in the background.

## How Updates Work

1. **Check** -- Each time Zequel launches, it contacts the update server to check whether a newer version is available.
2. **Download** -- If an update is found, it is downloaded in the background while you continue working. A progress indicator may appear to show the download status.
3. **Install** -- Once the download is complete, Zequel notifies you that an update is ready. You can choose to restart the application immediately to apply the update, or dismiss the notification and the update will be applied the next time you quit and reopen the app.

## Manual Update Check

If you want to check for updates without restarting the application:

1. Open the application menu.
2. Click **Check for Updates**.
3. Zequel contacts the update server and reports whether a new version is available.

## Update Channels

Zequel releases stable builds through GitHub Releases. The auto-updater fetches releases from this channel by default.

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
