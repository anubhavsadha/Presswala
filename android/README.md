# Istrify Android app

A small native Android app (about 25 KB) that opens https://www.istrify.in full screen.
Everything (pages, login, data) comes from the live site, so website updates reach app
users instantly. Rebuild the APK only to change the app shell (icon, name, permissions).

What the shell adds over a browser tab:
- Own icon and full-screen window, opens straight to the login / home screen
- Stays logged in between launches
- Location permission for "Use my current location"
- Call, UPI pay, Google Maps and WhatsApp links open the right app
- Android back button goes back through pages; friendly offline screen with retry
- istrify.in links shared on WhatsApp can open in the app

## Download

The latest build is served at https://www.istrify.in/istrify.apk (file: `public/istrify.apk`).

## Build

```bash
sudo apt install aapt dalvik-exchange zipalign apksigner   # plus JDK 17+
ANDROID_JAR=/path/to/android-34.jar \
KEYSTORE=/path/to/istrify-release.jks KEYSTORE_PASS=... ./build-apk.sh
cp build/istrify-*.apk ../public/istrify.apk
```

An API 34 `android.jar` is available from https://github.com/Sable/android-platforms
(`android-34/android.jar`). Regenerate icons from `public/icon.svg` with `node make-icons.cjs`.

Before each release, bump `android:versionCode` (+1) and `android:versionName` in
`AndroidManifest.xml`.

**Keep `istrify-release.jks` and its password safe and out of git.** Android only installs an
update over an existing app when it is signed with the same key; a lost key means users must
uninstall and reinstall. The same key is needed for a Play Store upload.
