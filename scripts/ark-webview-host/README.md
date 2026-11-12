# ArkHost: a WebView with the Android app's Ark panel settings

This is for measuring the Ark in an Android WebView without signing in to the app, which shows the Ark only after sign-in. It is a full-screen `android.webkit.WebView` with the settings `ArkPanel.kt` uses, and it loads the URL given as the launch extra `url`. Part B used it on the 2 GB AVD (`docs/ark/streaming.md` §7).

```
./build.sh                                   # javac, d8, aapt2, zipalign, apksigner from the SDK (no Gradle); writes build/ArkHost.apk
adb install -r build/ArkHost.apk
node scripts/ark-runtime-measure.mjs --serve 3417 --population-file <snapshot.json> --out <dir>    # loopback; the emulator reaches it as 10.0.2.2
adb shell am start -n app.animaldex.arkhost/.MainActivity --es url "'http://10.0.2.2:3417/measure.html?seconds=60&population=population-file.json&prebuild=1&report=/report&label=android-auto'"
adb shell dumpsys meminfo        # the WebView renderer is com.google.android.webview:sandboxed_process0…
```

The page posts its result to the server, which writes it to `<dir>`. The build keystore (`debug.keystore`) is made on first build and is not committed.
