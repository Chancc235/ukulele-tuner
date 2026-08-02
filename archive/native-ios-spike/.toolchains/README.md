# Project-local Xcode

The project pins Xcode `26.3` in `.xcode-version`. Apple lists Xcode 26.3 as compatible with macOS Sequoia 15.6 through macOS Tahoe 26.x, so it works with this Mac's existing macOS 26.0.1 without an OS upgrade.

Download Xcode 26.3 from the official Apple Developer downloads page with the user's Apple Account, expand it as:

```text
.toolchains/Xcode-26.3.app
```

Alternatively, keep it elsewhere and set `UKETUNE_XCODE_APP` to that app path. Run Xcode-related commands through:

```bash
scripts/with-project-xcode.sh xcodebuild -version
```

This sets `DEVELOPER_DIR` for one process only. It never runs `sudo xcode-select`, never replaces Command Line Tools, and never changes the system-wide active developer directory.

The Xcode app is intentionally ignored by Git. Downloading it requires an Apple Account and substantial disk space, so it is not fetched automatically by repository scripts.

