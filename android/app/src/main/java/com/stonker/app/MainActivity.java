package com.stonker.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Opt out of edge-to-edge so the WebView sits below the status bar
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    }
}
