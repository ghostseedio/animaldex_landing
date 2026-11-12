package app.animaldex.arkhost;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * A WebView with the AnimalDex app's Ark panel settings (ArkPanel.kt on ark-runtime-android: JavaScript and DOM
 * storage on, media needs a gesture, no file or content access, no zoom, debugging on in debug), full screen, loading
 * the URL given as the launch extra `url`. Measurement only (Part B, docs/ark/streaming.md): the app itself shows the
 * Ark only after sign-in.
 */
public class MainActivity extends Activity {
    private WebView view;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        WebView.setWebContentsDebuggingEnabled(true);
        view = new WebView(this);
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        view.setWebViewClient(new WebViewClient());
        setContentView(view);
        String url = getIntent().getStringExtra("url");
        if (url != null) view.loadUrl(url);
    }

    @Override
    protected void onDestroy() {
        if (view != null) view.destroy();
        super.onDestroy();
    }
}
