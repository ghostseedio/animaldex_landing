#!/bin/sh
# Builds ArkHost.apk with the SDK's own tools (no Gradle): javac, d8, aapt2, zipalign, apksigner.
set -e
cd "$(dirname "$0")"
SDK=$HOME/Library/Android/sdk
BT=$SDK/build-tools/36.1.0
JAR=$SDK/platforms/android-36/android.jar
rm -rf build && mkdir -p build/classes build/dex
javac -source 11 -target 11 -classpath "$JAR" -d build/classes src/app/animaldex/arkhost/MainActivity.java
"$BT/d8" --lib "$JAR" --min-api 26 --output build/dex $(find build/classes -name '*.class')
"$BT/aapt2" link -o build/unsigned.apk -I "$JAR" --manifest AndroidManifest.xml
cd build && zip -q unsigned.apk classes.dex -j dex/classes.dex 2>/dev/null || (cp dex/classes.dex . && zip -q unsigned.apk classes.dex)
"$BT/zipalign" -f 4 unsigned.apk aligned.apk
[ -f ../debug.keystore ] || keytool -genkeypair -keystore ../debug.keystore -storepass android -keypass android -alias debug -keyalg RSA -keysize 2048 -validity 3650 -dname "CN=ArkHost" >/dev/null 2>&1
"$BT/apksigner" sign --ks ../debug.keystore --ks-pass pass:android --key-pass pass:android --out ArkHost.apk aligned.apk
echo "built $(pwd)/ArkHost.apk"
