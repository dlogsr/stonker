package com.stonker.app;

import android.os.Bundle;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
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
    }
}
