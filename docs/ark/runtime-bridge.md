# Ark runtime bridge (the apps → the Ark's WebView)

The contract for the iOS and Android apps' Ark panel (`public/ark/embed.html`, the scene bundle `public/ark/ark-scene.js`). It adds two messages to the ones the embed already takes (`ark:snapshot`, `ark:select`, `ark:lite`, …; see the comment at the top of `embed.html`), plus one convenience. Code: `src/ark-scene/runtime/` (`governor.ts`, `power.ts`). Nothing here changes the server or what happens in the Ark: it only decides when and how richly the page draws.

## Messages

| Message | Payload | What the scene does |
|---|---|---|
| `ark:visible` | `{type: "ark:visible", visible: boolean}` | `false`: nothing is drawn and the frame loop stops asking for frames (no GPU, almost no CPU) until `true`. Send `false` when the panel is covered (a sheet, the chat over it, another tab of the app) or the app goes to the background; `true` when it is on screen again. |
| `ark:power` | `{type: "ark:power", saver?: boolean, thermal?: "nominal" \| "fair" \| "serious" \| "critical", battery?: number, charging?: boolean}` | Battery saver, or heat `serious`: at most 30 fps and the low tier. Heat `critical`: at most 20 fps and the low tier. `battery` is 0–1 (a number over 1 is read as percent); with `charging: false` and `battery ≤ 0.2` it counts as saver. Fields left out keep their last value. `{type: "ark:power", power: null}` hands back to the browser's own sources. |
| `ark:reset` | `{type: "ark:reset"}` | Flies back to the whole island (the scene's own reset button does the same). |

Malformed fields are ignored, never guessed (an unknown `thermal` word, a non-boolean `saver`). Messages sent before the scene is up are kept (the latest of each) and applied when it mounts.

The fields may also come nested: `{type: "ark:power", power: {saver: true}}`.

## How to post them

The embed listens on `window.message` and exposes `window.AnimalDexArkHost.send(message)`; use the latter from native code.

**iOS (WKWebView)**
```swift
func arkSend(_ message: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: message),
          let json = String(data: data, encoding: .utf8) else { return }
    webView.evaluateJavaScript("window.AnimalDexArkHost && window.AnimalDexArkHost.send(\(json))")
}

// Visible: the panel's own appearance, and the app's.
override func viewDidAppear(_ animated: Bool)    { super.viewDidAppear(animated); arkSend(["type": "ark:visible", "visible": true]) }
override func viewWillDisappear(_ animated: Bool) { super.viewWillDisappear(animated); arkSend(["type": "ark:visible", "visible": false]) }
// Also on UIApplication.didEnterBackgroundNotification (false) / willEnterForegroundNotification (true),
// and whenever a sheet or the chat covers the panel (SwiftUI: the presenting view's onChange of its cover state).

// Power: Low Power Mode and the thermal state, at start and on change.
func arkSendPower() {
    let thermal: String
    switch ProcessInfo.processInfo.thermalState {
    case .nominal: thermal = "nominal"
    case .fair: thermal = "fair"
    case .serious: thermal = "serious"
    case .critical: thermal = "critical"
    @unknown default: thermal = "nominal"
    }
    UIDevice.current.isBatteryMonitoringEnabled = true
    let level = UIDevice.current.batteryLevel      // -1 when unknown: leave it out
    var message: [String: Any] = ["type": "ark:power", "saver": ProcessInfo.processInfo.isLowPowerModeEnabled, "thermal": thermal]
    if level >= 0 {
        message["battery"] = level
        message["charging"] = UIDevice.current.batteryState == .charging || UIDevice.current.batteryState == .full
    }
    arkSend(message)
}
// Observe: Notification.Name.NSProcessInfoPowerStateDidChange, ProcessInfo.thermalStateDidChangeNotification,
// UIDevice.batteryLevelDidChangeNotification, UIDevice.batteryStateDidChangeNotification.
```
Send after the page's `ark:ready` (or any time; early ones are held). WKWebView already pauses `requestAnimationFrame` when the app is in the background; `ark:visible` matters most for the panel being covered while the app is in front.

**Android (WebView)**
```kotlin
fun arkSend(json: String) = webView.post {
    webView.evaluateJavascript("window.AnimalDexArkHost && window.AnimalDexArkHost.send($json)", null)
}

// Visible: the panel's lifecycle (onResume / onPause of the screen that holds it) and whether it is covered.
arkSend("""{"type":"ark:visible","visible":false}""")

// Power: battery saver, thermal status (API 29+), battery.
fun arkSendPower(context: Context) {
    val power = context.getSystemService(PowerManager::class.java)
    val thermal = if (Build.VERSION.SDK_INT >= 29) when (power.currentThermalStatus) {
        PowerManager.THERMAL_STATUS_NONE -> "nominal"
        PowerManager.THERMAL_STATUS_LIGHT -> "fair"
        PowerManager.THERMAL_STATUS_MODERATE, PowerManager.THERMAL_STATUS_SEVERE -> "serious"
        else -> "critical"   // CRITICAL, EMERGENCY, SHUTDOWN
    } else "nominal"
    val battery = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    val level = battery?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
    val scale = battery?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
    val plugged = (battery?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0) != 0
    val parts = mutableListOf("\"type\":\"ark:power\"", "\"saver\":${power.isPowerSaveMode}", "\"thermal\":\"$thermal\"")
    if (level >= 0 && scale > 0) { parts += "\"battery\":${level.toFloat() / scale}"; parts += "\"charging\":$plugged" }
    arkSend("{${parts.joinToString(",")}}")
}
// Listen: PowerManager.ACTION_POWER_SAVE_MODE_CHANGED, PowerManager.addThermalStatusListener (API 29+),
// Intent.ACTION_BATTERY_CHANGED.
```
Android's WebView keeps running `requestAnimationFrame` while its view is merely covered by another view in the same activity, so `ark:visible` false saves the most there. Calling `webView.onPause()` when the app backgrounds is still right; the message is the in-app part.

## Defaults when the app says nothing

| Signal | Default |
|---|---|
| Visible | Visible, unless the page is hidden (`document.visibilityState`, `pagehide`) or the world is scrolled off screen (an IntersectionObserver). |
| Saver | Off, unless the Battery API (Chrome, Android WebView) reports ≤ 20 % and not charging. Safari and WKWebView have no Battery API: off. |
| Heat | `nominal`, unless the Compute Pressure API (desktop Chrome) reports CPU pressure `serious` / `critical`. |
| Tier | The device's own (`tierFor`), dropped once if frames run long, and re-checked only at display rate (never while capped). |
| Memory (Part B) | The browser's `navigator.deviceMemory` (Chromium, capped at 8 GB). iOS never tells a page its memory. The app can pass the real figure on the embed's URL as `?mem=<GB>` (iOS `ProcessInfo.physicalMemory`, Android `ActivityManager.MemoryInfo.totalMem`, rounded to GB): 2 GB or less starts on the low tier, 3 GB on low (touch). The render distance and memory budgets follow the tier (`docs/ark/streaming.md`). |

The app's word wins field by field over the browser's (a host `thermal: "nominal"` beats a browser pressure reading). When the power cap lets go, the tier from before it comes back (unless the reader chose the lighter view meanwhile, which `ark:lite` still controls).

## Frame rate without the app

The scene also lowers its own rate when nothing needs it (`governor.ts`):

| Mode | When | Rate |
|---|---|---|
| full | input within 5 s, or a camera flight, follow, replay, a talking animal, the opening, an arrival's entrance, a wheel glide | every display frame (power cap aside) |
| calm | no input for 5 s and none of the above | 30 fps |
| drowsy | no input for 2 min | 20 fps |
| still | reduced motion and nothing moving | 4 fps |
| paused | hidden (above) | nothing |

## Testing in the apps (later lane)

1. iOS: Instruments' Energy Log and the GPU frame counter with the panel open, then covered (expect ~0 GPU with `visible: false`), then left alone 5 s (30 fps) and 2 min (20 fps). Toggle Low Power Mode (expect the low tier: `ark:tier` comes back with `low`).
2. Android: `adb shell dumpsys gfxinfo <package>` frame counts in the same states; `adb shell cmd power set-mode 1` for battery saver; `adb shell cmd thermalservice override-status 3` for heat.
3. The scene's numbers in a debug build: `scene.runtime()` on the handle (mode, power, drawn / skipped frames, model bytes against the tier's budget).
