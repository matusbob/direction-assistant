# Direction Assistant for Android

Straight-line walking guidance that keeps running with the screen locked. Plain Android framework (no libraries), Java, minSdk 29, targetSdk 36.

## Build and test

```
export ANDROID_HOME=/path/to/android-sdk   # needs platforms;android-36 and build-tools;36.0.0
./gradlew testDebugUnitTest                 # unit tests + the whole app on Robolectric
./gradlew lintRelease assembleRelease       # app/build/outputs/apk/release/app-release.apk
```

Copy the APK to `../downloads/smerovy-asistent.apk` to publish it on the project's GitHub Pages site, and raise `versionCode` / `versionName` in `app/build.gradle` for each new release so it installs as an update.

## Code

- `DriftEngine` - what to beep, vibrate and say for each compass reading (same rules as the web app).
- `Heading`, `HeadingFilter` - compass heading of the phone's top edge or back from the rotation-vector sensor, smoothed.
- `DistanceTracker` - GPS distance for "Doing good"; `CompassCheck` - jumping-compass warning.
- `DirectionService` - foreground service: sensors, GPS, notification, `Beeper` (stereo tones), `Haptics`, `Speaker` (text-to-speech).
- `MainActivity` - the one screen and the settings dialogs. `Prefs`, `Lang` - settings and in-app language.

## Signing

`signing/direction-assistant.jks` is committed on purpose so that every build installs as an update over the previous one. It does not protect against tampering: install the app only from this project.
