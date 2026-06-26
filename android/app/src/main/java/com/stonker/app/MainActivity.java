package com.stonker.app;

import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.Window;
import android.webkit.JavascriptInterface;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** Exposed to the WebView as window.StonkerAndroid so the web app can sync the watchlist. */
    private final class WatchlistBridge {
        @JavascriptInterface
        public void saveWatchlist(String json) {
            getSharedPreferences("stonker_prefs", MODE_PRIVATE)
                .edit()
                .putString("watchlist", json)
                .apply();
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();

        // Go edge-to-edge: content draws behind status bar, and
        // env(safe-area-inset-top) in CSS reports the actual status bar height.
        // This is required on Android 15+ (API 35) where edge-to-edge is mandatory.
        WindowCompat.setDecorFitsSystemWindows(window, false);

        // Transparent status bar so the app's dark background shows through
        window.setStatusBarColor(android.graphics.Color.TRANSPARENT);
        window.setNavigationBarColor(0xFF0F172A);

        // Light-on-dark icons for status bar and nav bar
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(false);
        controller.setAppearanceLightNavigationBars(false);

        // Expose a JS bridge so the web app can push watchlist changes to SharedPreferences,
        // which the Android Auto CarAppService reads to show the same stocks in the car.
        getBridge().getWebView().addJavascriptInterface(new WatchlistBridge(), "StonkerAndroid");
    }
}
