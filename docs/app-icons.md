# App Icons

## Requirements

| Platform | File | Sizes (px) |
|----------|------|------------|
| macOS | `build/icon.icns` | 16, 32, 64, 128, 256, 512, 1024 |
| Windows | `build/icon.ico` | 16, 24, 32, 48, 64, 128, 256 |
| Linux | `build/icons/*.png` | 16, 24, 32, 48, 64, 128, 256, 512 |

## Generating Icons

1. Create a single **1024x1024** PNG with transparent background (`icon-1024.png`)
2. Run:

```bash
npx electron-icon-builder --input=icon-1024.png --output=build
```

This generates all sizes and formats inside `build/icons/`.
