#!/usr/bin/env bash
# Builds a signed Istrify APK without Android Studio.
# Needs: JDK 17+, aapt, dalvik-exchange (dx), zipalign, apksigner
#   (Ubuntu: apt install aapt dalvik-exchange zipalign apksigner)
# and an android.jar for API 34 (ANDROID_JAR) plus a signing keystore:
#   KEYSTORE=istrify-release.jks KEYSTORE_PASS=... ./build-apk.sh
set -euo pipefail
cd "$(dirname "$0")"

ANDROID_JAR=${ANDROID_JAR:?set ANDROID_JAR to an API 34 android.jar}
KEYSTORE=${KEYSTORE:?set KEYSTORE to your .jks file (keep it safe: updates need the same key)}
KEYSTORE_PASS=${KEYSTORE_PASS:?set KEYSTORE_PASS}
KEY_ALIAS=${KEY_ALIAS:-istrify}
OUT=build
VERSION=$(sed -n 's/.*android:versionName="\([^"]*\)".*/\1/p' AndroidManifest.xml)

rm -rf "$OUT" && mkdir -p "$OUT/classes"

echo "1/5 Compiling Java"
javac -source 8 -target 8 -Xlint:-options -encoding UTF-8 \
  -bootclasspath "$ANDROID_JAR" -d "$OUT/classes" $(find src -name '*.java')

echo "2/5 Converting to Dalvik bytecode"
dalvik-exchange --dex --min-sdk-version=23 --output="$OUT/classes.dex" "$OUT/classes"

echo "3/5 Packaging resources"
aapt package -f -M AndroidManifest.xml -S res -I "$ANDROID_JAR" -F "$OUT/unsigned.apk"
(cd "$OUT" && aapt add unsigned.apk classes.dex >/dev/null)

echo "4/5 Aligning"
zipalign -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

echo "5/5 Signing"
apksigner sign --ks "$KEYSTORE" --ks-key-alias "$KEY_ALIAS" --ks-pass "pass:$KEYSTORE_PASS" \
  --key-pass "pass:$KEYSTORE_PASS" --out "$OUT/istrify-$VERSION.apk" "$OUT/aligned.apk"
apksigner verify "$OUT/istrify-$VERSION.apk"
echo "Done: android/$OUT/istrify-$VERSION.apk"
