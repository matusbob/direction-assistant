# Direction Assistant for Android

The web app in a web view, plus straight-line walking guidance that keeps running with the screen locked. Plain Android framework (no libraries), Java, minSdk 29, targetSdk 36.

## Build and test

```
export ANDROID_HOME=/path/to/android-sdk   # needs platforms;android-36 and build-tools;36.0.0
./gradlew testDebugUnitTest                 # unit tests + the whole app on Robolectric
./gradlew lintRelease assembleRelease       # app/build/outputs/apk/release/app-release.apk
```

Raise `versionCode` / `versionName` in `app/build.gradle` for each new release so it installs as an update. To publish it on the project's GitHub Pages site, copy the APK to `../downloads/smerovy-asistent.apk` and update `../downloads/version.json` (`versionCode`, `versionName`, the APK's `sha256`, `notes_sk`, `notes_en`): the installed apps read that file to offer the update, and refuse an APK whose SHA-256 differs.

## Code

- `DriftEngine` - what to beep, vibrate and say for each compass reading (same rules as the web app).
- `Heading`, `HeadingFilter` - compass heading of the phone's top edge or back from the rotation-vector sensor, smoothed.
- `DistanceTracker` - GPS distance for "Doing good" and for drift in meters; `CompassCheck` - jumping-compass warning.
- `DirectionService` - foreground service: sensors, GPS, notification, `Beeper` (stereo tones), `Haptics`, `Speaker` (text-to-speech).
- `WebActivity` - the main screen: the web app from the project site in a web view, with the `SmerovyAsistentAndroid` bridge (voice, vibration, share, save file, keep the screen on, and the straight line in `DirectionService` with the web app's settings; the service's status and messages go back to the page as `__androidStatus` / `__androidMessage`). Only pages under the project URL can use the bridge; other links open in the browser.
- `MainActivity` - the simple screen, the settings dialogs. `UpdateFlow` - the update dialogs on either screen. `Prefs`, `Lang` - settings and in-app language.
- `Updater`, `UpdateReceiver` - updates: `version.json` and the APK from the project site, the SHA-256 check, Android's package installer.

## Signing

`signing/direction-assistant.jks` is committed on purpose so that every build installs as an update over the previous one. It does not protect against tampering: install the app only from this project.
