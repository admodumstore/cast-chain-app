# Cast Chain

Connect two actors through shared movie/TV credits in the fewest steps — a "Six Degrees" puzzle game. This is a Capacitor-wrapped version of the web prototype: the game itself (`www/`) is plain HTML/CSS/JS with no build step, and Capacitor wraps it into installable iOS and Android projects.

**Status:** Android is done and confirmed working (built and ran successfully in the Android Studio emulator on a Linux machine). iOS hasn't been touched yet — that's the next task, to be done on a Mac with Xcode. The coffee link in `www/index.html` is already set to the real URL. Nothing else is pending; this README plus the code is the full picture, no other context needed.

## What's here

- `www/` — the actual game. `index.html` + `styles.css` + `app.js` (game logic) + `data.js` (the dataset: ~3,000 titles / ~12,000 actors pulled from TMDb).
- `android/` — native Android project (Capacitor-generated). Open in Android Studio.
- `ios/` — native Xcode project (Capacitor-generated). Open in Xcode (macOS only).
- `capacitor.config.json` — app id (`com.castchain.app`), app name, and `webDir`.

## Before you ship it

1. **Pick a real app id** if `com.castchain.app` isn't what you want — it needs to be unique per app store, reverse-DNS style (e.g. `com.yourname.castchain`). Change it in `capacitor.config.json`, then re-run `npx cap sync`.

2. **App icon and splash screen** — Capacitor's defaults are placeholders. Use `@capacitor/assets` (`npm install -D @capacitor/assets`) to generate icons/splash screens from a single source image for both platforms.

## Local setup

Requires Node.js 22+.

```bash
npm install
npx cap sync
```

`npx cap sync` copies `www/` into both native projects and installs any Capacitor plugin native code. Re-run it any time you change files in `www/`.

## Running / building

**Android** (works on Linux/Windows/Mac):
- Install [Android Studio](https://developer.android.com/studio).
- `npx cap open android` opens the project there. Run on an emulator or a plugged-in device with USB debugging on.
- For a Play Store release: Android Studio → Build → Generate Signed Bundle/APK. You'll need a signing keystore (Android Studio can create one) and a $25 one-time Google Play Developer account.

**iOS** (macOS + Xcode required — this can't be built on Linux/Windows):
- Install Xcode from the Mac App Store.
- `npx cap open ios` opens the project there.
- You'll need an Apple Developer Program account ($99/year) to run on a physical device or submit to the App Store.
- CocoaPods (`sudo gem install cocoapods`) is required the first time you open the iOS project — Xcode/Capacitor will prompt for `pod install` if it's missing.

## Notes on the data

The dataset is a static, hand-curated slice of TMDb's catalog (fetched via their API, not a live connection) — see the `www/data.js` file. It's baked into the app bundle, so there's no backend and no network calls at runtime. If you outgrow what's reasonable to bundle, or want the dataset to keep growing over time, that's the point where a small backend/API would make sense — not needed for v1.
