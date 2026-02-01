# App Icons

## Requirements

| Platform | File | Sizes (px) |
|----------|--------------------------------------|--------------------------------------|
| macOS | `build/icons/mac/icon.icns` | 16, 32, 64, 128, 256, 512, 1024 |
| Windows | `build/icons/win/icon.ico` | 16, 24, 32, 48, 64, 128, 256 |
| Linux | `build/icons/png/*.png` | 16, 24, 32, 48, 64, 128, 256, 512 |

## Generating Icons

1. Place a **1024x1024** PNG with a transparent background at `resources/icon-1024.png`.
2. Run:

```bash
npx electron-icon-builder --input=resources/icon-1024.png --output=build
```

This generates all required sizes and formats inside `build/icons/`.
